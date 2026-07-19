// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '@/hooks/useStore';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import Chart from './chart';
import { ChartTradePanel } from './chart-trade-panel';
import './chart.scss';
import './chart-trade-panel.scss';
import './chart-digit-overlay.scss';

interface ChartWrapperProps {
    prefix?: string;
    show_digits_stats: boolean;
}

/** Classify each digit's % into a color rank */
function getCircleColor(pct: number, sorted: number[]): 'green' | 'blue' | 'yellow' | 'red' | 'default' {
    const unique = [...new Set(sorted)];
    const max  = unique[unique.length - 1];
    const min  = unique[0];
    const max2 = unique.length >= 2 ? unique[unique.length - 2] : null;
    const min2 = unique.length >= 3 ? unique[1] : null;
    if (pct === max)  return 'green';
    if (pct === min)  return 'red';
    if (max2 !== null && pct === max2) return 'blue';
    if (min2 !== null && pct === min2) return 'yellow';
    return 'default';
}

function getLastDigit(price: number, ps: number): number {
    const s = price.toFixed(ps).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

const ChartWrapper = observer(({ prefix = 'chart', show_digits_stats }: ChartWrapperProps) => {
    const { client, chart_store } = useStore();
    const symbol = chart_store?.symbol || '1HZ100V';

    const [uuid] = useState(uuidv4());
    const uniqueKey = client.loginid ? `${prefix}-${client.loginid}` : `${prefix}-${uuid}`;

    // ── Tick subscription state (shared across overlay + panel) ──────────────
    const [currentDigit, setCurrentDigit]   = useState<number | null>(null);
    const [digitCounts,  setDigitCounts]    = useState<number[]>(new Array(10).fill(0));
    const [pipSize,      setPipSize]        = useState(2);
    const [currentPrice, setCurrentPrice]   = useState<number | null>(null);
    const [priceChange,  setPriceChange]    = useState(0);
    const digitHistoryRef = useRef<number[]>([]);
    const prevPriceRef    = useRef<number | null>(null);

    // Selected barrier — shared between overlay click and trade panel
    const [barrier, setBarrier] = useState(5);

    useEffect(() => {
        digitHistoryRef.current = [];
        prevPriceRef.current    = null;
        setCurrentDigit(null);
        setDigitCounts(new Array(10).fill(0));
        setCurrentPrice(null);
        setPriceChange(0);

        if (!api_base?.api || !symbol) return;
        let alive = true;

        // Load last 1000 ticks for accurate digit stats
        (api_base.api as any).send({
            ticks_history: symbol, count: 1000, end: 'latest', style: 'ticks',
        }).then((res: any) => {
            if (!alive) return;
            const prices: number[] = res?.history?.prices ?? [];
            if (prices.length > 0) {
                const sampleStr = String(prices[0]);
                const dotIdx    = sampleStr.indexOf('.');
                const ps        = dotIdx === -1 ? 0 : sampleStr.length - dotIdx - 1;
                setPipSize(ps);
                const digits = prices.map((p: number) => getLastDigit(p, ps));
                digitHistoryRef.current = digits;
                const counts = new Array(10).fill(0);
                digits.forEach((d: number) => counts[d]++);
                setDigitCounts([...counts]);
            }
        }).catch(() => {});

        // Live tick subscription
        const sub = (api_base.api as any).subscribe({ ticks: symbol, subscribe: 1 });
        sub.subscribe({
            next: (res: any) => {
                if (!alive) return;
                const tick = res?.tick;
                if (!tick) return;
                const price = Number(tick.quote);
                const ps    = tick.pip_size ?? pipSize;
                setPipSize(ps);
                setCurrentPrice(price);
                if (prevPriceRef.current !== null) setPriceChange(price - prevPriceRef.current);
                prevPriceRef.current = price;
                const d = getLastDigit(price, ps);
                setCurrentDigit(d);
                digitHistoryRef.current = [...digitHistoryRef.current.slice(-999), d];
                const counts = new Array(10).fill(0);
                digitHistoryRef.current.forEach(x => counts[x]++);
                setDigitCounts([...counts]);
            },
            error: () => {},
        });

        return () => { alive = false; sub?.unsubscribe?.(); };
    }, [symbol]);

    // ── Digit stats derived values ────────────────────────────────────────────
    const total  = Math.max(digitHistoryRef.current.length, 1);
    const pcts   = digitCounts.map(c => (c / total) * 100);
    const sorted = [...pcts].sort((a, b) => a - b);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '75% 25%', width: '100%', height: '100%', overflow: 'hidden', background: '#fff' }}>
            {/* ─── Chart area with digit overlay ─── */}
            <div style={{ position: 'relative', minWidth: 0, overflow: 'hidden' }}>
                <Chart key={uniqueKey} show_digits_stats={false} />

                {/* Digit stats floating bar at bottom of chart */}
                <div className='cdo' aria-label='Last Digit Statistics'>
                    <div className='cdo__price'>
                        <span className='cdo__price-val'>
                            {currentPrice != null ? currentPrice.toFixed(pipSize) : '—'}
                        </span>
                        {currentDigit !== null && (
                            <span className='cdo__price-digit'>{currentDigit}</span>
                        )}
                    </div>
                    <div className='cdo__circles'>
                        {Array.from({ length: 10 }, (_, d) => {
                            const pct       = pcts[d] ?? 0;
                            const colorRank = getCircleColor(pct, sorted);
                            const isCurrent = currentDigit === d;
                            const isBarrier = barrier === d;
                            return (
                                <div key={d} className='cdo__item' onClick={() => setBarrier(d)}>
                                    {isCurrent && <div className='cdo__triangle' />}
                                    <div className={[
                                        'cdo__circle',
                                        `cdo__circle--${colorRank}`,
                                        isCurrent ? 'cdo__circle--current' : '',
                                        isBarrier ? 'cdo__circle--barrier' : '',
                                    ].filter(Boolean).join(' ')}>
                                        {d}
                                    </div>
                                    <span className='cdo__pct'>{pct.toFixed(1)}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ─── Trading panel ─── */}
            <div style={{ minWidth: 0, overflow: 'hidden auto', borderLeft: '1px solid #e8e8e8' }}>
                <ChartTradePanel
                    symbol={symbol}
                    currentDigit={currentDigit}
                    currentPrice={currentPrice}
                    priceChange={priceChange}
                    pipSize={pipSize}
                    barrier={barrier}
                    onBarrierChange={setBarrier}
                />
            </div>
        </div>
    );
});

export default ChartWrapper;
