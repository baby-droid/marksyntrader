// @ts-nocheck
import { useEffect, useRef, useState, useCallback } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { useApiBase } from '@/hooks/useApiBase';

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
  const { connectionStatus } = useApiBase();
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
  const tickSubscriptionRef = useRef<any>(null);
  const tickSubscriptionIdRef = useRef<string | null>(null);
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
    tickSubscriptionRef.current?.unsubscribe?.();
    tickSubscriptionRef.current = null;
    if (tickSubscriptionIdRef.current && api_base.api) {
      (api_base.api as any).send({ forget: tickSubscriptionIdRef.current }).catch(() => {});
      tickSubscriptionIdRef.current = null;
    }
    tickHistory.current = [];
    pipSizeRef.current = 2;
    setIsConnected(false);
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const start = async () => {
      if (cancelled) return;
      const api = api_base.api as any;
      if (!api || connectionStatus !== CONNECTION_STATUS.OPENED) {
        retryTimer = setTimeout(start, 350);
        return;
      }
      try {
        const data = await api.send({ ticks_history: sym, count: 500, end: 'latest', style: 'ticks' });
        if (cancelled || sym !== symbolRef.current) return;
        if (data?.error) throw new Error(data.error.message || 'History request failed');
        if (data.history?.prices) {
        const prices: number[] = data.history.prices.map(Number);
        tickHistory.current = prices.slice(-HISTORY_SIZE);
        setCurrentPrice(prices[prices.length - 1]);
        setLastTicks(prices.slice(-50));
        }

        const tickStream = api.subscribe({ ticks: sym, subscribe: 1 });
        tickSubscriptionRef.current = tickStream?.subscribe?.((message: any) => {
          if (cancelled || sym !== symbolRef.current) return;
          const data = message?.data ?? message;
          if (data?.subscription?.id) tickSubscriptionIdRef.current = String(data.subscription.id);
          if (data?.error) return;
          if (data?.tick?.quote != null) {
        setIsConnected(true);
          const p = Number(data.tick.quote);
          if (!isFinite(p)) return;

          if (data.tick.pip_size != null) pipSizeRef.current = Number(data.tick.pip_size);

          const pipSize = pipSizeRef.current;
          const d = extractLastDigit(p, pipSize);

          setCurrentPrice(p);
          tickHistory.current = [...tickHistory.current, p].slice(-HISTORY_SIZE);
          setLastTicks(prev => [...prev, p].slice(-50));
          if (!isNaN(d)) setLastDigit(d);
          setDigits(computeDigits(tickHistory.current, pipSize));
          }
        });
      } catch (_) {
        if (!cancelled) retryTimer = setTimeout(start, 700);
      }
    };
    start();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      tickSubscriptionRef.current?.unsubscribe?.();
      tickSubscriptionRef.current = null;
      if (tickSubscriptionIdRef.current && api_base.api) {
        (api_base.api as any).send({ forget: tickSubscriptionIdRef.current }).catch(() => {});
        tickSubscriptionIdRef.current = null;
      }
    };
  }, [computeDigits, connectionStatus]);

  useEffect(() => {
    return subscribe(symbol);
  }, [symbol, subscribe, connectionStatus]);

  return { digits, lastDigit, currentPrice, lastTicks, symbol, setSymbol, isConnected };
}
