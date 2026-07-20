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

interface PendingTrade {
    id: string;
    totalTicks: number;
    countedTicks: number;
    won?: boolean;
}

const ChartWrapper = observer(({ prefix = 'chart', show_digits_stats }: ChartWrapperProps) => {
    const { client, chart_store } = useStore();
    const symbol = chart_store?.symbol || '1HZ100V';

    const [uuid] = useState(uuidv4());
    const uniqueKey = client.loginid ? `${prefix}-${client.loginid}` : `${prefix}-${uuid}`;

    // ── Tick subscription state ───────────────────────────────────────────────
    const [currentDigit, setCurrentDigit]   = useState<number | null>(null);
    const [digitCounts,  setDigitCounts]    = useState<number[]>(new Array(10).fill(0));
    const [pipSize,      setPipSize]        = useState(2);
    const [currentPrice, setCurrentPrice]   = useState<number | null>(null);
    const [priceChange,  setPriceChange]    = useState(0);
    const digitHistoryRef = useRef<number[]>([]);
    const prevPriceRef    = useRef<number | null>(null);
    const pipSizeRef      = useRef(2); // sync ref for callbacks

    // Selected barrier shared with trade panel
    const [barrier, setBarrier] = useState(5);

    // ── Win/Loss tracking ─────────────────────────────────────────────────────
    const [lastTrade, setLastTrade] = useState<{ digit: number; won: boolean } | null>(null);
    const [tradeFlags, setTradeFlags] = useState<Array<{ id: string; won: boolean; profit: number }>>([]);
    const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flagTimersRef     = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // ── Pending trade tick counters ───────────────────────────────────────────
    const [pendingTrades, setPendingTrades] = useState<PendingTrade[]>([]);
    const pendingTradesRef = useRef<PendingTrade[]>([]);

    useEffect(() => {
        const handleStarted = (e: CustomEvent) => {
            const { contractId, ticks } = e.detail;
            const trade: PendingTrade = {
                id: String(contractId),
                totalTicks: ticks,
                countedTicks: 0,
            };
            pendingTradesRef.current = [...pendingTradesRef.current, trade];
            setPendingTrades([...pendingTradesRef.current]);
        };

        const handleSettlement = (e: CustomEvent) => {
            const { won, profit, exitDigit, barrier: tradedBarrier, contractId } = e.detail;
            const digit = exitDigit ?? tradedBarrier;

            // Remove from pending trades
            if (contractId != null) {
                pendingTradesRef.current = pendingTradesRef.current.filter(t => t.id !== String(contractId));
                setPendingTrades([...pendingTradesRef.current]);
            } else {
                // Remove the oldest pending trade
                pendingTradesRef.current = pendingTradesRef.current.slice(1);
                setPendingTrades([...pendingTradesRef.current]);
            }

            // Digit-circle highlight
            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
            setLastTrade({ digit, won });
            highlightTimerRef.current = setTimeout(() => setLastTrade(null), 5000);

            // Per-flag independent timer
            const id = String(Date.now()) + Math.random();
            setTradeFlags(prev => [...prev, { id, won, profit }]);
            const t = setTimeout(() => {
                setTradeFlags(prev => prev.filter(f => f.id !== id));
                flagTimersRef.current.delete(id);
            }, 60000);
            flagTimersRef.current.set(id, t);
        };

        window.addEventListener('chart:trade-started', handleStarted as any);
        window.addEventListener('chart:trade-settled', handleSettlement as any);
        return () => {
            window.removeEventListener('chart:trade-started', handleStarted as any);
            window.removeEventListener('chart:trade-settled', handleSettlement as any);
            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
            flagTimersRef.current.forEach(t => clearTimeout(t));
            flagTimersRef.current.clear();
        };
    }, []);

    useEffect(() => {
        digitHistoryRef.current = [];
        prevPriceRef.current    = null;
        setCurrentDigit(null);
        setDigitCounts(new Array(10).fill(0));
        setCurrentPrice(null);
        setPriceChange(0);

        if (!api_base?.api || !symbol) return;
        let alive = true;

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
                pipSizeRef.current = ps;
                const digits = prices.map((p: number) => getLastDigit(p, ps));
                digitHistoryRef.current = digits;
                const counts = new Array(10).fill(0);
                digits.forEach((d: number) => counts[d]++);
                setDigitCounts([...counts]);
            }
        }).catch(() => {});

        const sub = (api_base.api as any).subscribe({ ticks: symbol, subscribe: 1 });
        sub.subscribe({
            next: (res: any) => {
                if (!alive) return;
                const tick = res?.tick;
                if (!tick) return;
                const price = Number(tick.quote);
                const ps    = tick.pip_size ?? pipSizeRef.current;
                pipSizeRef.current = ps;
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

                // Increment tick counter for pending trades
                if (pendingTradesRef.current.length > 0) {
                    pendingTradesRef.current = pendingTradesRef.current.map(t => ({
                        ...t,
                        countedTicks: Math.min(t.countedTicks + 1, t.totalTicks),
                    }));
                    setPendingTrades([...pendingTradesRef.current]);
                }
            },
            error: () => {},
        });

        return () => { alive = false; sub?.unsubscribe?.(); };
    }, [symbol]);

    const total  = Math.max(digitHistoryRef.current.length, 1);
    const pcts   = digitCounts.map(c => (c / total) * 100);
    const sorted = [...pcts].sort((a, b) => a - b);

    // Digit display order: 0-9 left to right
    const DIGIT_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '65% 35%', width: '100%', height: '100%', overflow: 'hidden', background: '#fff' }}>
            {/* ─── Chart area ─── */}
            <div style={{ position: 'relative', minWidth: 0, overflow: 'hidden', paddingLeft: '0.6cm', paddingRight: '0.2cm' }}>
                <Chart key={uniqueKey} show_digits_stats={false} />

                {/* Tick counter badges for running contracts */}
                {pendingTrades.map((t, i) => (
                    <div key={t.id} className='cdo-tick-counter' style={{ top: `${18 + i * 44}px` }}>
                        <span className='cdo-tick-counter__dot' />
                        <span className='cdo-tick-counter__count'>{t.countedTicks}/{t.totalTicks}</span>
                        <span className='cdo-tick-counter__label'>ticks</span>
                    </div>
                ))}

                {/* Win/Loss floating flags */}
                {tradeFlags.map((flag, i) => (
                    <div key={flag.id} className={`chart-trade-flag chart-trade-flag--${flag.won ? 'win' : 'loss'}`}
                        style={{ top: `${18 + i * 44}px`, left: '50%' }}>
                        &nbsp;{flag.won ? '✓ WIN' : '✗ LOSS'}&nbsp;{flag.won ? '+' : ''}{flag.profit.toFixed(2)}
                    </div>
                ))}

                {/* Digit stats bar at bottom */}
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
                        {DIGIT_ORDER.map(d => {
                            const pct       = pcts[d] ?? 0;
                            const colorRank = getCircleColor(pct, sorted);
                            const isCurrent = currentDigit === d;
                            const isBarrier = barrier === d;
                            const isWin     = lastTrade?.won === true  && lastTrade.digit === d;
                            const isLoss    = lastTrade?.won === false && lastTrade.digit === d;
                            return (
                                <div key={d} className='cdo__item' onClick={() => setBarrier(d)}>
                                    {/* Always reserve triangle space to prevent layout shift */}
                                    <div className={`cdo__triangle${isCurrent ? '' : ' cdo__triangle--hidden'}`} />
                                    <div className={[
                                        'cdo__circle',
                                        `cdo__circle--${colorRank}`,
                                        isCurrent ? 'cdo__circle--current' : '',
                                        isBarrier ? 'cdo__circle--barrier' : '',
                                        isWin     ? 'cdo__circle--win'     : '',
                                        isLoss    ? 'cdo__circle--loss'    : '',
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
