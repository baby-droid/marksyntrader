// @ts-nocheck
import { useEffect, useRef, useState, useCallback } from 'react';

const APP_ID = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DERIV_APP_ID) || '36300';
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;

export interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

export interface UseDigitStatsReturn {
  digits: DigitStat[];
  lastDigit: number | null;
  currentPrice: number | null;
  lastTicks: number[];
  symbol: string;
  setSymbol: (s: string) => void;
  isConnected: boolean;
}

const HISTORY_SIZE = 1000;

/**
 * CRITICAL: JavaScript strips trailing zeros from floats.
 *   JSON  1234.10  →  JS Number  1234.1  →  String  "1234.1"  →  last char "1" (WRONG)
 *   Fix: toFixed(pipSize) rebuilds proper string  "1234.10"  →  last char "0" (CORRECT)
 */
function extractLastDigit(price: number, pipSize: number): number {
  const s = Number(price).toFixed(pipSize);
  return parseInt(s[s.length - 1], 10);
}

export function useDigitStats(initialSymbol = 'R_10'): UseDigitStatsReturn {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [digits, setDigits] = useState<DigitStat[]>(
    Array.from({ length: 10 }, (_, i) => ({ digit: i, count: 0, percentage: 10 }))
  );
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [lastTicks, setLastTicks] = useState<number[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const tickHistory = useRef<number[]>([]);
  const pipSizeRef = useRef<number>(2); // updated from first tick response
  const wsRef = useRef<WebSocket | null>(null);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  const computeDigits = useCallback((history: number[], pipSize: number) => {
    const counts = Array(10).fill(0);
    history.forEach(price => {
      const d = extractLastDigit(price, pipSize);
      if (!isNaN(d) && d >= 0 && d <= 9) counts[d]++;
    });
    const total = history.length || 1;
    return Array.from({ length: 10 }, (_, i) => ({
      digit: i,
      count: counts[i],
      percentage: parseFloat(((counts[i] / total) * 100).toFixed(2)),
    }));
  }, []);

  const subscribe = useCallback((sym: string) => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) {}
      wsRef.current = null;
    }
    tickHistory.current = [];
    pipSizeRef.current = 2;
    setIsConnected(false);

    const ws = new WebSocket(DERIV_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ ticks_history: sym, count: 500, end: 'latest', style: 'ticks' }));
      ws.send(JSON.stringify({ ticks: sym, subscribe: 1 }));
    };

    ws.onmessage = (e: MessageEvent) => {
      if (sym !== symbolRef.current) return;
      let data;
      try { data = JSON.parse(e.data); } catch (_) { return; }

      if (data.msg_type === 'history' && data.history?.prices) {
        const prices: number[] = data.history.prices.map(Number);
        tickHistory.current = prices.slice(-HISTORY_SIZE);
        setCurrentPrice(prices[prices.length - 1]);
        setLastTicks(prices.slice(-50));
        // pipSize from history isn't given directly — use current ref (will be updated by first tick)
        setDigits(computeDigits(tickHistory.current, pipSizeRef.current));
        const lastP = prices[prices.length - 1];
        setLastDigit(extractLastDigit(lastP, pipSizeRef.current));
        setIsConnected(true);
      } else if (data.msg_type === 'tick' && data.tick?.quote != null) {
        setIsConnected(true);
        const p = Number(data.tick.quote);
        if (!isFinite(p)) return;
        if (sym !== symbolRef.current) return;

        // Capture pip_size from the live feed — this is the authoritative source
        if (data.tick.pip_size != null) {
          pipSizeRef.current = Number(data.tick.pip_size);
        }

        const pipSize = pipSizeRef.current;
        const d = extractLastDigit(p, pipSize);

        setCurrentPrice(p);
        tickHistory.current = [...tickHistory.current, p].slice(-HISTORY_SIZE);
        setLastTicks(prev => [...prev, p].slice(-50));
        if (!isNaN(d)) setLastDigit(d);
        setDigits(computeDigits(tickHistory.current, pipSize));
      }
    };

    ws.onerror = () => setIsConnected(false);
    ws.onclose = () => setIsConnected(false);
  }, [computeDigits]);

  useEffect(() => {
    subscribe(symbol);
    return () => {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (_) {}
        wsRef.current = null;
      }
    };
  }, [symbol, subscribe]);

  return { digits, lastDigit, currentPrice, lastTicks, symbol, setSymbol, isConnected };
}
