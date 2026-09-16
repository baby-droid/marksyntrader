import { useEffect, useState } from 'react';

/**
 * Live FX rate from a base currency to a target (default KES / Kenyan Shilling).
 *
 * Uses the free, key-less open.er-api.com endpoint (CORS-enabled) and refreshes
 * hourly. Falls back to a sensible static approximation if the network call
 * fails so the converter always shows a value.
 */
const FALLBACK_USD_KES = 129;
const REFRESH_MS = 60 * 60 * 1000;

// Simple in-memory cache shared across component instances.
const cache = new Map<string, number>();

export const useFxRate = (base = 'USD', target = 'KES'): number | null => {
    const key = `${base}_${target}`;
    const [rate, setRate] = useState<number | null>(cache.get(key) ?? null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
                const data = await res.json();
                const r = data?.rates?.[target];
                if (!cancelled && typeof r === 'number') {
                    cache.set(key, r);
                    setRate(r);
                    return;
                }
                throw new Error('rate missing');
            } catch {
                if (!cancelled && cache.get(key) == null) {
                    const fallback = base === 'USD' ? FALLBACK_USD_KES : FALLBACK_USD_KES;
                    cache.set(key, fallback);
                    setRate(fallback);
                }
            }
        };

        load();
        const id = setInterval(load, REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [base, target, key]);

    return rate;
};

export default useFxRate;
