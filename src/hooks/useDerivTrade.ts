import { useCallback, useEffect, useRef, useState } from 'react';
import { getTradingToken } from '@/utils/trading-token';

const APP_ID = (process.env.NEXT_PUBLIC_DERIV_APP_ID as string) || '1089';
const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`;

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
}

export type ContractType =
    | 'CALL' | 'PUT' | 'DIGITEVEN' | 'DIGITODD'
    | 'DIGITMATCH' | 'DIGITDIFF' | 'DIGITOVER' | 'DIGITUNDER';

export interface BuyParams {
    symbol: string;
    contract_type: ContractType;
    duration: number;
    duration_unit?: 't' | 's' | 'm' | 'h';
    stake: number;
    barrier?: number;
    currency?: string;
}

function getLastDigit(quote: number): number {
    const s = quote.toFixed(2).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

export function useDerivTrade() {
    const wsRef = useRef<WebSocket | null>(null);
    const reqIdRef = useRef(1);
    const pendingRef = useRef<Map<number, (d: any) => void>>(new Map());
    const tickCallbacksRef = useRef<Map<string, (t: TickData) => void>>(new Map());
    const pocCallbacksRef = useRef<Map<number, (c: SettledContract) => void>>(new Map());
    const [connected, setConnected] = useState(false);
    const [balance, setBalance] = useState<number | null>(null);
    const [currency, setCurrency] = useState('USD');
    const [authorized, setAuthorized] = useState(false);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    const send = useCallback((msg: object): Promise<any> => {
        return new Promise((resolve, reject) => {
            const id = reqIdRef.current++;
            const payload = { ...msg, req_id: id };
            pendingRef.current.set(id, (d) => {
                if (d.error) reject(d);
                else resolve(d);
            });
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify(payload));
            } else {
                pendingRef.current.delete(id);
                reject(new Error('WebSocket not connected'));
            }
        });
    }, []);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = async () => {
            if (!mountedRef.current) return;
            setConnected(true);
            const token = getTradingToken();
            if (token) {
                try {
                    const auth = await send({ authorize: token });
                    if (auth.authorize && mountedRef.current) {
                        setAuthorized(true);
                        setBalance(parseFloat(auth.authorize.balance ?? '0'));
                        setCurrency(auth.authorize.currency || 'USD');
                        // Subscribe to live balance updates
                        send({ balance: 1, subscribe: 1 }).catch(() => {});
                    }
                } catch (err: any) {
                    console.warn('[useDerivTrade] Auth failed:', err?.error?.message || err?.message);
                    setAuthorized(false);
                }
            }
        };

        ws.onmessage = (e) => {
            const d = JSON.parse(e.data);
            // Resolve pending requests
            if (d.req_id && pendingRef.current.has(d.req_id)) {
                const cb = pendingRef.current.get(d.req_id)!;
                pendingRef.current.delete(d.req_id);
                cb(d);
            }
            // Live tick data
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
            // Balance updates
            if (d.balance && d.balance.balance != null && mountedRef.current) {
                setBalance(parseFloat(d.balance.balance));
                setCurrency(d.balance.currency || 'USD');
            }
            // Contract settlement
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
                        });
                        pocCallbacksRef.current.delete(cid);
                    }
                }
            }
        };

        ws.onclose = () => {
            if (!mountedRef.current) return;
            setConnected(false);
            setAuthorized(false);
            // Reconnect after 3 seconds
            reconnectRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => ws.close();
    }, [send]);

    useEffect(() => {
        mountedRef.current = true;
        connect();
        return () => {
            mountedRef.current = false;
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            wsRef.current?.close();
        };
    }, [connect]);

    const subscribeTicks = useCallback((symbol: string, cb: (t: TickData) => void) => {
        tickCallbacksRef.current.set(symbol, cb);
        send({ ticks: symbol, subscribe: 1 }).catch(() => {});
        return () => {
            tickCallbacksRef.current.delete(symbol);
            send({ forget_all: 'ticks' }).catch(() => {});
        };
    }, [send]);

    const buyContract = useCallback(
        async (params: BuyParams, onSettled?: (c: SettledContract) => void): Promise<ContractResult> => {
            const { symbol, contract_type, duration, duration_unit = 't', stake, barrier, currency: cur } = params;
            const buyParams: any = {
                contract_type,
                currency: cur || currency || 'USD',
                duration,
                duration_unit,
                basis: 'stake',
                amount: stake,
                symbol,
            };
            if (barrier !== undefined) buyParams.barrier = barrier;

            const res = await send({ buy: '1', price: stake, parameters: buyParams });
            if (res.error) throw res;

            const contract_id = res.buy?.contract_id || 0;
            // Refresh balance after buy
            send({ balance: 1 }).catch(() => {});

            if (contract_id && onSettled) {
                pocCallbacksRef.current.set(Number(contract_id), onSettled);
                send({ proposal_open_contract: 1, contract_id, subscribe: 1 }).catch(() => {});
            }
            return {
                contract_id,
                buy_price: res.buy?.buy_price || stake,
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
