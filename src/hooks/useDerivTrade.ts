import { useCallback, useEffect, useRef, useState } from 'react';

const APP_ID = 1089;
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

function getAuthToken(): string | null {
    try {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
            if (k.startsWith('client.accounts')) {
                const data = JSON.parse(localStorage.getItem(k) || '{}');
                if (data?.token) return data.token;
            }
        }
        const loginInfo = localStorage.getItem('active_loginid');
        if (loginInfo) {
            const accountsKey = `client.accounts`;
            const accounts = JSON.parse(localStorage.getItem(accountsKey) || '{}');
            const account = accounts[loginInfo];
            if (account?.token) return account.token;
        }
    } catch {/* */}
    return null;
}

export function useDerivTrade() {
    const wsRef = useRef<WebSocket | null>(null);
    const reqIdRef = useRef(1);
    const pendingRef = useRef<Map<number, (d: any) => void>>(new Map());
    const tickCallbacksRef = useRef<Map<string, (t: TickData) => void>>(new Map());
    const [connected, setConnected] = useState(false);
    const [balance, setBalance] = useState<number | null>(null);
    const [currency, setCurrency] = useState('USD');
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const send = useCallback((msg: object): Promise<any> => {
        return new Promise((resolve, reject) => {
            const id = reqIdRef.current++;
            const payload = { ...msg, req_id: id };
            pendingRef.current.set(id, (d) => {
                if (d.error) reject(d.error);
                else resolve(d);
            });
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify(payload));
            } else {
                reject(new Error('WebSocket not connected'));
            }
        });
    }, []);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = async () => {
            setConnected(true);
            const token = getAuthToken();
            if (token) {
                try {
                    const auth = await send({ authorize: token });
                    if (auth.authorize) {
                        setBalance(auth.authorize.balance);
                        setCurrency(auth.authorize.currency || 'USD');
                        send({ balance: 1, subscribe: 1 });
                    }
                } catch {/* demo mode */}
            }
        };

        ws.onmessage = (e) => {
            const d = JSON.parse(e.data);
            if (d.req_id && pendingRef.current.has(d.req_id)) {
                const cb = pendingRef.current.get(d.req_id)!;
                pendingRef.current.delete(d.req_id);
                cb(d);
            }
            if (d.tick) {
                const q = d.tick.quote;
                const tick: TickData = {
                    symbol: d.tick.symbol,
                    digit: getLastDigit(q),
                    quote: q,
                    epoch: d.tick.epoch,
                };
                const cb = tickCallbacksRef.current.get(d.tick.symbol);
                if (cb) cb(tick);
            }
            if (d.balance) {
                setBalance(d.balance.balance);
                setCurrency(d.balance.currency || 'USD');
            }
        };

        ws.onclose = () => {
            setConnected(false);
            reconnectRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => ws.close();
    }, [send]);

    useEffect(() => {
        connect();
        return () => {
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

    const buyContract = useCallback(async (params: BuyParams): Promise<ContractResult> => {
        const { symbol, contract_type, duration, duration_unit = 't', stake, barrier, currency: cur = 'USD' } = params;
        const buyParams: any = {
            contract_type,
            currency: cur,
            duration,
            duration_unit,
            basis: 'stake',
            amount: stake,
            symbol,
        };
        if (barrier !== undefined) buyParams.barrier = barrier;

        const res = await send({ buy: '1', price: stake, parameters: buyParams });
        return {
            contract_id: res.buy?.contract_id || 0,
            buy_price: res.buy?.buy_price || stake,
            status: 'open',
        };
    }, [send]);

    const getDigitStats = useCallback(async (symbol: string, count = 1000): Promise<number[]> => {
        const res = await send({ ticks_history: symbol, count, end: 'latest', style: 'ticks' });
        const prices = res.history?.prices || [];
        const freq = new Array(10).fill(0);
        prices.forEach((p: number) => { freq[getLastDigit(p)]++; });
        return freq.map((c: number) => (prices.length > 0 ? (c / prices.length) * 100 : 10));
    }, [send]);

    return { connected, balance, currency, send, subscribeTicks, buyContract, getDigitStats };
}
