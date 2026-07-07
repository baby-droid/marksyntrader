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
  const wsRef = useRef<WebSocket | null>(null);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  const computeDigits = useCallback((history: Array<number | string>) => {
    const counts = Array(10).fill(0);
    history.forEach(price => {
      const s = String(price);
      const dotIdx = s.indexOf('.');
      const lastChar = dotIdx !== -1 ? s[s.length - 1] : s[s.length - 1];
      const d = parseInt(lastChar, 10);
      if (!isNaN(d)) counts[d]++;
    });
    const total = history.length || 1;
    return Array.from({ length: 10 }, (_, i) => ({
      digit: i,
      count: counts[i],
      percentage: parseFloat(((counts[i] / total) * 100).toFixed(2)),
    }));
  }, []);

  const ingestTick = useCallback((rawPrice: number | string, sym: string) => {
    if (sym !== symbolRef.current) return;
    const p = Number(rawPrice);
    if (!isFinite(p)) return;
    setCurrentPrice(p);
    // Store as string to preserve exact decimal precision
    const priceStr = String(rawPrice);
    tickHistory.current = [...tickHistory.current, priceStr as any].slice(-HISTORY_SIZE);
    setLastTicks(prev => [...prev, p].slice(-50));
    const s = priceStr;
    const d = parseInt(s[s.length - 1], 10);
    if (!isNaN(d)) setLastDigit(d);
    setDigits(computeDigits(tickHistory.current));
  }, [computeDigits]);

  const subscribe = useCallback((sym: string) => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) {}
      wsRef.current = null;
    }
    tickHistory.current = [];
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
        const prices = data.history.prices.map(Number);
        tickHistory.current = prices.slice(-HISTORY_SIZE);
        setCurrentPrice(prices[prices.length - 1]);
        setLastTicks(prices.slice(-50));
        setDigits(computeDigits(tickHistory.current));
        const lastP = prices[prices.length - 1];
        const s = lastP.toFixed(2);
        setLastDigit(parseInt(s[s.length - 1], 10));
        setIsConnected(true);
      } else if (data.msg_type === 'tick' && data.tick?.quote != null) {
        setIsConnected(true);
        ingestTick(data.tick.quote, sym);
      }
    };

    ws.onerror = () => setIsConnected(false);
    ws.onclose = () => setIsConnected(false);
  }, [computeDigits, ingestTick]);

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
