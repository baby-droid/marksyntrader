import { useCallback, useEffect, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import {
    CONNECTION_STATUS,
    connectionStatus$,
    isAuthorized$,
} from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { publishMasterTrade, getMasterSource } from '@/utils/trade-bus';
import { observer } from '@/external/bot-skeleton/utils/observer';
import {
    isFastExecutionEnabled,
    recordPhase,
    recordTick,
    startPingMonitor,
    stopPingMonitor,
    setPingRestartHook,
} from '@/utils/execution-speed';

/**
 * Trading hook — rides on the SAME authenticated WebSocket connection the rest
 * of the app already uses (api_base, authorized via the user's normal Deriv
 * login). No separate API token, no second login — if the user is logged in
 * to the app, this hook can trade on their account immediately.
 */

export interface TickData {
    symbol: string;
    digit: number;
    quote: number;
    epoch: number;
    pip_size: number;
}

export interface ContractResult {
    contract_id: number;
    buy_price: number;
    profit?: number;
    status?: 'open' | 'won' | 'lost';
    entry_spot?: number;
    exit_spot?: number;
}

export interface SettledContract {
    contract_id: number;
    profit: number;
    status: 'won' | 'lost';
    entry_spot?: number;
    exit_spot?: number;
    buy_price?: number;
    pip_size?: number;   // authoritative pip_size from the settled POC
}

export type ContractType =
    | 'CALL' | 'PUT' | 'DIGITEVEN' | 'DIGITODD'
    | 'DIGITMATCH' | 'DIGITDIFF' | 'DIGITOVER' | 'DIGITUNDER';

export interface BuyParams {
    symbol: string;
    contract_type: ContractType | string;
    duration: number;
    duration_unit?: 't' | 's' | 'm' | 'h';
    stake: number;
    barrier?: number | string;
    currency?: string;
    // Extra app metadata is copied onto the native contract event so
    // Bot Builder's transaction store can group Auto Trades positions.
    metadata?: Record<string, unknown>;
}

const NEEDS_BARRIER = new Set(['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF']);

function getLastDigit(quote: number, pipSize = 2): number {
    const s = quote.toFixed(pipSize).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

export function useDerivTrade() {
    const tickCallbacksRef = useRef<Map<string, (t: TickData) => void>>(new Map());
    const pocCallbacksRef = useRef<Map<number, (c: SettledContract) => void>>(new Map());
    const contractMetaRef = useRef<Map<number, any>>(new Map());
    const [connected, setConnected] = useState(connectionStatus$.value === CONNECTION_STATUS.OPENED);
    const [balance, setBalance] = useState<number | null>(null);
    const [currency, setCurrency] = useState('USD');
    const [authorized, setAuthorized] = useState(isAuthorized$.value);
    const balanceSubscribedRef = useRef(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        const connSub = connectionStatus$.subscribe(status => {
            if (!mountedRef.current) return;
            setConnected(status === CONNECTION_STATUS.OPENED);
        });
        const authSub = isAuthorized$.subscribe(isAuth => {
            if (!mountedRef.current) return;
            setAuthorized(isAuth);
            if (isAuth && !balanceSubscribedRef.current) {
                balanceSubscribedRef.current = true;
                (api_base.api?.send as unknown as ((data: unknown) => Promise<any>) | undefined)?.({ balance: 1, subscribe: 1 })?.catch(() => {});
                // Start ping monitor once authenticated so Fast mode diagnostics are live
                try {
                    const sendFn = (msg: object) =>
                        (api_base.api?.send as unknown as (d: unknown) => Promise<any>)(msg);
                    startPingMonitor(sendFn);
                    // Re-start with correct interval when Fast mode toggled
                    setPingRestartHook(() => startPingMonitor(sendFn));
                } catch { /* non-fatal */ }
            }
        });
        return () => {
            mountedRef.current = false;
            connSub.unsubscribe();
            authSub.unsubscribe();
            stopPingMonitor();
        };
    }, []);

    useEffect(() => {
        const sub = api_base.api?.onMessage()?.subscribe(({ data: d }: { data: any }) => {
            if (!d || typeof d !== 'object') return;

            if (d.balance && d.balance.balance != null && mountedRef.current) {
                setBalance(parseFloat(d.balance.balance));
                setCurrency(d.balance.currency || 'USD');
            }

            if (d.tick) {
                recordTick(); // count tick for Fast mode tick-rate display
                const q = Number(d.tick.quote);
                const epoch = Number(d.tick.epoch);
                const ps = Number(d.tick.pip_size ?? 2);
                /* Deriv can emit a partial tick while a subscription is being
                   attached/re-attached. Never forward that payload: scalpers
                   and charts both use epoch as the ordering/entry anchor. */
                if (!Number.isFinite(q) || !Number.isFinite(epoch) || !Number.isFinite(ps) || ps < 0) return;
                const tick: TickData = {
                    symbol: d.tick.symbol,
                    digit: getLastDigit(q, ps),
                    quote: q,
                    epoch,
                    pip_size: ps,
                };
                if (typeof d.tick.symbol === 'string' && d.tick.symbol) {
                    tickCallbacksRef.current.get(d.tick.symbol)?.(tick);
                }
            }

            if (d.proposal_open_contract) {
                const poc = d.proposal_open_contract;
                const cid = Number(poc.contract_id);
                if (poc.is_sold || poc.status === 'won' || poc.status === 'lost') {
                    const cb = pocCallbacksRef.current.get(cid);
                    if (cb) {
                        const profit = parseFloat(poc.profit ?? '0');
                        // Use the definitive status from the API; fall back to profit sign
                        const status: 'won' | 'lost' =
                            poc.status === 'won' ? 'won'
                            : poc.status === 'lost' ? 'lost'
                            : profit > 0 ? 'won' : 'lost';
                        cb({
                            contract_id: cid,
                            profit,
                            status,
                            entry_spot: poc.entry_spot,
                            exit_spot: poc.exit_spot,
                            buy_price: poc.buy_price,
                            pip_size: poc.pip_size != null ? Number(poc.pip_size) : undefined,
                        });
                        const meta = contractMetaRef.current.get(cid);
                        if (meta) {
                            const settledContract = {
                                ...meta,
                                transaction_ids: { ...meta.transaction_ids, sell: cid },
                                is_sold: true,
                                is_completed: true,
                                status,
                                profit,
                                payout: profit > 0 ? Number(poc.payout ?? meta.buy_price + profit) : 0,
                                bid_price: Number(poc.bid_price ?? 0),
                                entry_spot: poc.entry_spot,
                                exit_spot: poc.exit_spot,
                                entry_tick_time: poc.entry_tick_time,
                                exit_tick_time: poc.exit_tick_time,
                            };
                            observer.emit('bot.contract', settledContract);
                            window.dispatchEvent(new CustomEvent('auto-trade:contract', {
                                detail: settledContract,
                            }));
                            window.dispatchEvent(new CustomEvent('chart:trade-settled', {
                                detail: {
                                    contractId: cid,
                                    symbol: meta.underlying_symbol,
                                    contractType: meta.contract_type,
                                    won: status === 'won',
                                    profit,
                                    barrier: meta.barrier,
                                    exitDigit: poc.exit_tick_display_value
                                        ? parseInt(String(poc.exit_tick_display_value).replace('.', '').slice(-1), 10)
                                        : undefined,
                                },
                            }));
                            contractMetaRef.current.delete(cid);
                        }
                        pocCallbacksRef.current.delete(cid);
                    }
                }
            }
        });
        return () => sub?.unsubscribe?.();
    }, []);

    const send = useCallback((msg: object): Promise<any> => {
        if (!api_base.api) return Promise.reject(new Error('Not connected'));
        return (api_base.api.send as unknown as (data: unknown) => Promise<any>)(msg);
    }, []);

    const subscribeTicks = useCallback((symbol: string, cb: (t: TickData) => void) => {
        tickCallbacksRef.current.set(symbol, cb);
        send({ ticks: symbol, subscribe: 1 }).catch(() => {});
        return () => {
            tickCallbacksRef.current.delete(symbol);
            send({ forget_all: 'ticks' }).catch(() => {});
        };
    }, [send]);

    /**
     * buyContract — always uses the proven proposal→buy two-step flow.
     * The direct-buy shortcut (buy: 1, parameters: {...}) causes
     * "Input validation failed: parameters" on the DerivAPIBasic client
     * for digit contract types. The proposal→buy path works for ALL types.
     */
    const buyContract = useCallback(
        async (params: BuyParams, onSettled?: (c: SettledContract) => void): Promise<ContractResult> => {
            const {
                symbol,
                contract_type,
                duration,
                duration_unit = 't',
                stake,
                barrier,
                currency: cur,
                metadata,
            } = params;

            const cur_ = cur || currency || 'USD';
            const needsBarrier = NEEDS_BARRIER.has(String(contract_type).toUpperCase());

            // Step 1 — proposal (get an ask_price and a proposal ID)
            const t0 = performance.now();
            const proposalReq: any = {
                proposal: 1,
                amount: stake,
                basis: 'stake',
                contract_type,
                currency: cur_,
                duration,
                duration_unit,
                underlying_symbol: symbol,
            };
            if (needsBarrier && barrier !== undefined && barrier !== null) {
                proposalReq.barrier = String(barrier);
            }

            let proposalRes: any;
            try {
                proposalRes = await send(proposalReq);
            } catch (e: any) {
                throw e?.error ?? e;
            }
            if (proposalRes?.error) {
                throw proposalRes.error;
            }
            const proposalId = proposalRes?.proposal?.id;
            const askPrice   = Number(proposalRes?.proposal?.ask_price ?? stake);
            if (!proposalId) {
                throw new Error('Proposal failed — no proposal ID returned');
            }
            // Record proposal round-trip time as evalToBuy phase
            if (isFastExecutionEnabled()) {
                recordPhase('evalToBuy', Math.round(performance.now() - t0));
            }

            // ── Publish copy-trade signal IN PARALLEL with master's buy ────
            // Firing the signal here (after proposal accepted, before buy confirmed)
            // means follower accounts start their own buy at the SAME TIME as the
            // master's buy request is in-flight — both enter on the same market tick.
            // The copy engine deduplicates using a 5-second fingerprint window so
            // a later publish (with contract_id) won't cause a second mirror.
            try {
                publishMasterTrade({
                    symbol,
                    contract_type,
                    stake,
                    duration,
                    duration_unit,
                    barrier,
                    source: getMasterSource(),
                    time:   Date.now(),
                    // no contract_id yet — engine deduplicates by fingerprint
                });
            } catch { /* never let copy-trade errors affect the master trade */ }

            // Step 2 — buy using the proposal ID
            const t1 = performance.now();
            let buyRes: any;
            try {
                buyRes = await send({ buy: proposalId, price: askPrice });
            } catch (e: any) {
                throw e?.error ?? e;
            }
            if (buyRes?.error) {
                throw buyRes.error;
            }
            if (isFastExecutionEnabled()) {
                recordPhase('buyToResponse', Math.round(performance.now() - t1));
            }

            const contract_id = Number(buyRes?.buy?.contract_id ?? 0);
            if (!contract_id) {
                throw new Error('Buy failed — no contract ID returned');
            }

            const contractMeta = {
                id: contract_id,
                contract_id,
                transaction_ids: { buy: contract_id },
                underlying_symbol: symbol,
                display_name: symbol,
                contract_type,
                currency: cur_,
                buy_price: Number(buyRes?.buy?.buy_price ?? stake),
                payout: 0,
                bid_price: 0,
                profit: 0,
                is_sold: false,
                status: 'open',
                date_start: Math.floor(Date.now() / 1000),
                barrier,
                duration,
                duration_unit,
                ...(metadata || {}),
            };
            contractMetaRef.current.set(contract_id, contractMeta);
            observer.emit('bot.contract', contractMeta);
            window.dispatchEvent(new CustomEvent('auto-trade:contract', {
                detail: contractMeta,
            }));
            window.dispatchEvent(new CustomEvent('chart:trade-started', {
                detail: {
                    contractId: contract_id,
                    ticks: duration,
                    symbol,
                    contractType: contract_type,
                },
            }));

            // Step 3 — subscribe to settlement notifications
            // In Fast mode: subscribe is fire-and-forget (never blocks the caller)
            if (onSettled) {
                pocCallbacksRef.current.set(contract_id, onSettled);
                if (isFastExecutionEnabled()) {
                    // Defer subscription message to rAF so the trade engine stays unblocked
                    requestAnimationFrame(() => {
                        send({ proposal_open_contract: 1, contract_id, subscribe: 1 }).catch(() => {});
                    });
                } else {
                    send({ proposal_open_contract: 1, contract_id, subscribe: 1 }).catch(() => {});
                }
            }

            return {
                contract_id,
                buy_price: buyRes?.buy?.buy_price ?? stake,
                status: 'open',
            };
        },
        [send, currency]
    );

    const getDigitStats = useCallback(async (symbol: string, count = 1000): Promise<number[]> => {
        const res = await send({ ticks_history: symbol, count, end: 'latest', style: 'ticks' });
        const prices = res.history?.prices || [];
        const freq = new Array(10).fill(0);
        prices.forEach((p: number) => { freq[getLastDigit(p)]++; });
        return freq.map((c: number) => (prices.length > 0 ? (c / prices.length) * 100 : 10));
    }, [send]);

    return { connected, authorized, balance, currency, send, subscribeTicks, buyContract, getDigitStats };
}
