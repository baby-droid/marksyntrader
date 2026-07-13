import { useCallback, useEffect, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import {
    CONNECTION_STATUS,
    connectionStatus$,
    isAuthorized$,
} from '@/external/bot-skeleton/services/api/observables/connection-status-stream';

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
}

const NEEDS_BARRIER = new Set(['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF']);

function getLastDigit(quote: number): number {
    const s = quote.toFixed(2).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

export function useDerivTrade() {
    const tickCallbacksRef = useRef<Map<string, (t: TickData) => void>>(new Map());
    const pocCallbacksRef = useRef<Map<number, (c: SettledContract) => void>>(new Map());
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
            }
        });
        return () => {
            mountedRef.current = false;
            connSub.unsubscribe();
            authSub.unsubscribe();
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
                const q = d.tick.quote;
                const tick: TickData = {
                    symbol: d.tick.symbol,
                    digit: getLastDigit(q),
                    quote: q,
                    epoch: d.tick.epoch,
                };
                tickCallbacksRef.current.get(d.tick.symbol)?.(tick);
            }

            if (d.proposal_open_contract) {
                const poc = d.proposal_open_contract;
                const cid = Number(poc.contract_id);
                if (poc.is_sold || poc.status === 'won' || poc.status === 'lost') {
                    const cb = pocCallbacksRef.current.get(cid);
                    if (cb) {
                        const profit = parseFloat(poc.profit ?? '0');
                        cb({
                            contract_id: cid,
                            profit,
                            status: poc.status === 'won' || profit > 0 ? 'won' : 'lost',
                            entry_spot: poc.entry_spot,
                            exit_spot: poc.exit_spot,
                            buy_price: poc.buy_price,
                        });
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
            } = params;

            const cur_ = cur || currency || 'USD';
            const needsBarrier = NEEDS_BARRIER.has(String(contract_type).toUpperCase());

            // Step 1 — proposal (get an ask_price and a proposal ID)
            const proposalReq: any = {
                proposal: 1,
                amount: stake,
                basis: 'stake',
                contract_type,
                currency: cur_,
                duration,
                duration_unit,
                symbol,
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

            // Step 2 — buy using the proposal ID
            let buyRes: any;
            try {
                buyRes = await send({ buy: proposalId, price: askPrice });
            } catch (e: any) {
                throw e?.error ?? e;
            }
            if (buyRes?.error) {
                throw buyRes.error;
            }

            const contract_id = Number(buyRes?.buy?.contract_id ?? 0);
            if (!contract_id) {
                throw new Error('Buy failed — no contract ID returned');
            }

            // Step 3 — subscribe to settlement notifications
            if (onSettled) {
                pocCallbacksRef.current.set(contract_id, onSettled);
                send({ proposal_open_contract: 1, contract_id, subscribe: 1 }).catch(() => {});
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
