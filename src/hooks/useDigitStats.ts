// @ts-nocheck
import { useEffect, useRef, useState, useCallback } from 'react';
import { api_base } from '@/external/bot-skeleton';

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
  const subscriptionRef = useRef<any>(null);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  const computeDigits = useCallback((history: number[]) => {
    const counts = Array(10).fill(0);
    history.forEach(price => {
      const s = price.toFixed(2);
      const d = parseInt(s[s.length - 1], 10);
      if (!isNaN(d)) counts[d]++;
    });
    const total = history.length || 1;
    return Array.from({ length: 10 }, (_, i) => ({
      digit: i,
      count: counts[i],
      percentage: parseFloat(((counts[i] / total) * 100).toFixed(2)),
    }));
  }, []);

  const subscribe = useCallback(async (sym: string) => {
    try {
      if (subscriptionRef.current) {
        try { subscriptionRef.current.unsubscribe(); } catch (_) {}
        subscriptionRef.current = null;
      }
      tickHistory.current = [];

      // Get history first
      const histRes = await api_base.api.send({
        ticks_history: sym,
        count: 500,
        end: 'latest',
        style: 'ticks',
      });
      if (histRes?.history?.prices) {
        const prices = histRes.history.prices.map(Number);
        tickHistory.current = prices.slice(-HISTORY_SIZE);
        setCurrentPrice(prices[prices.length - 1]);
        setLastTicks(prices.slice(-50));
        setDigits(computeDigits(tickHistory.current));
        const lastP = prices[prices.length - 1];
        const s = lastP.toFixed(2);
        setLastDigit(parseInt(s[s.length - 1], 10));
      }

      // Subscribe to live ticks
      const obs = api_base.api.subscribe({ ticks: sym });
      subscriptionRef.current = obs.subscribe({
        next: (res: any) => {
          const price = res?.tick?.quote;
          if (price == null) return;
          setIsConnected(true);
          const p = Number(price);
          setCurrentPrice(p);
          tickHistory.current = [...tickHistory.current, p].slice(-HISTORY_SIZE);
          setLastTicks(prev => [...prev, p].slice(-50));
          const s = p.toFixed(2);
          const d = parseInt(s[s.length - 1], 10);
          if (!isNaN(d)) setLastDigit(d);
          setDigits(computeDigits(tickHistory.current));
        },
        error: () => setIsConnected(false),
      });
    } catch (e) {
      console.error('useDigitStats subscribe error', e);
    }
  }, [computeDigits]);

  useEffect(() => {
    subscribe(symbol);
    return () => {
      if (subscriptionRef.current) {
        try { subscriptionRef.current.unsubscribe(); } catch (_) {}
      }
    };
  }, [symbol, subscribe]);

  return { digits, lastDigit, currentPrice, lastTicks, symbol, setSymbol, isConnected };
}
