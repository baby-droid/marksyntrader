// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '@/hooks/useStore';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import Chart from './chart';
import { ChartTradePanel } from './chart-trade-panel';
import MobileChartView from './mobile-chart-view';
import './chart.scss';
import './chart-trade-panel.scss';
import './chart-digit-overlay.scss';

interface ChartWrapperProps {
    prefix?: string;
    show_digits_stats: boolean;
}

/* Color helper */
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

/**
 * Map digit 0-9 to horizontal % position in a 10-item space-between row.
 * With flex:1 per item, each item occupies 10% of the container.
 * Center of item i = (i * 10 + 5) %.
 */
const digitToPercent = (d: number): string => `${d * 10 + 5}%`;

interface PendingTrade {
    id: string;
    totalTicks: number;
    countedTicks: number;
}

/* ════════════════════════════════════════════════════════════════════════════ */
const ChartWrapper = observer(({ prefix = 'chart', show_digits_stats }: ChartWrapperProps) => {
    const { client, chart_store } = useStore();
    const symbol = chart_store?.symbol || '1HZ100V';

    /* ── Mobile breakpoint detection ─────────────────────────────────────── */
    const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 767);
    useEffect(() => {
        const onResize = () => setIsMobileView(window.innerWidth <= 767);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const [uuid] = useState(uuidv4());
    const uniqueKey = client.loginid
        ? `${prefix}-${client.loginid}`
        : `${prefix}-${uuid}`;

    /* Tick state */
    const [currentDigit, setCurrentDigit]   = useState<number | null>(null);
    const [digitCounts,  setDigitCounts]    = useState<number[]>(new Array(10).fill(0));
    const [pipSize,      setPipSize]        = useState(2);
    const [currentPrice, setCurrentPrice]   = useState<number | null>(null);
    const [priceChange,  setPriceChange]    = useState(0);
    const digitHistoryRef = useRef<number[]>([]);
    const prevPriceRef    = useRef<number | null>(null);
    const pipSizeRef      = useRef(2);

    /* Barrier (last digit prediction selection) */
    const [barrier, setBarrier] = useState(5);

    /* Win/Loss */
    const [lastTrade, setLastTrade] = useState<{ digit: number; won: boolean } | null>(null);
    const [tradeFlags, setTradeFlags] = useState<Array<{ id: string; won: boolean; profit: number }>>([]);
    const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flagTimersRef     = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    /* Pending tick counters */
    const [pendingTrades, setPendingTrades] = useState<PendingTrade[]>([]);
    const pendingTradesRef      = useRef<PendingTrade[]>([]);
    const contractTickDigitsRef = useRef<Map<string, number[]>>(new Map());
    const [tickDigitSnapshot, setTickDigitSnapshot] = useState<Map<string, number[]>>(new Map());

    /* Trade events */
    useEffect(() => {
        const handleStarted = (e: CustomEvent) => {
            const { contractId, ticks } = e.detail;
            const trade: PendingTrade = { id: String(contractId), totalTicks: ticks, countedTicks: 0 };
            contractTickDigitsRef.current.set(String(contractId), []);
            pendingTradesRef.current = [...pendingTradesRef.current, trade];
            setPendingTrades([...pendingTradesRef.current]);
            setTickDigitSnapshot(new Map(contractTickDigitsRef.current));
        };

        // ── Authoritative tick update from proposal_open_contract ──────────────
        // tick_stream[0] is always the FIRST tick AFTER entry (what Deriv calls
        // "tick 1"). This works correctly for all index types — Volatility plain,
        // Volatility 1s, Bear/Bull, Jump, Boom, Crash, Step, Range Break.
        const handleTradeTick = (e: CustomEvent) => {
            const { contractId, tickStream, totalTicks } = e.detail;
            const id = String(contractId);

            // Extract last digits from the authoritative tick_display_value field
            const digits: number[] = (tickStream as any[]).map((t: any) => {
                const dv: string = t.tick_display_value ?? String(t.tick ?? '');
                const clean = dv.replace('.', '');
                return parseInt(clean[clean.length - 1] ?? '0', 10);
            });

            contractTickDigitsRef.current.set(id, digits);
            setTickDigitSnapshot(new Map(contractTickDigitsRef.current));

            pendingTradesRef.current = pendingTradesRef.current.map(t =>
                t.id === id
                    ? { ...t, countedTicks: digits.length, totalTicks: totalTicks ?? t.totalTicks }
                    : t
            );
            setPendingTrades([...pendingTradesRef.current]);
        };

        const handleSettlement = (e: CustomEvent) => {
            const { won, profit, exitDigit, barrier: tradedBarrier, contractId } = e.detail;
            const digit = exitDigit ?? tradedBarrier;

            if (contractId != null) {
                pendingTradesRef.current = pendingTradesRef.current.filter(t => t.id !== String(contractId));
                setPendingTrades([...pendingTradesRef.current]);
                setTimeout(() => {
                    contractTickDigitsRef.current.delete(String(contractId));
                    setTickDigitSnapshot(new Map(contractTickDigitsRef.current));
                }, 5100);
            } else {
                const removed = pendingTradesRef.current[0];
                pendingTradesRef.current = pendingTradesRef.current.slice(1);
                setPendingTrades([...pendingTradesRef.current]);
                if (removed) {
                    setTimeout(() => {
                        contractTickDigitsRef.current.delete(removed.id);
                        setTickDigitSnapshot(new Map(contractTickDigitsRef.current));
                    }, 5100);
                }
            }

            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
            setLastTrade({ digit, won });
            highlightTimerRef.current = setTimeout(() => setLastTrade(null), 5000);

            const id = String(Date.now()) + Math.random();
            setTradeFlags(prev => [...prev, { id, won, profit }]);
            const t = setTimeout(() => {
                setTradeFlags(prev => prev.filter(f => f.id !== id));
                flagTimersRef.current.delete(id);
            }, 5500);
            flagTimersRef.current.set(id, t);
        };

        window.addEventListener('chart:trade-started', handleStarted as any);
        window.addEventListener('chart:trade-tick',    handleTradeTick as any);
        window.addEventListener('chart:trade-settled', handleSettlement as any);
        return () => {
            window.removeEventListener('chart:trade-started', handleStarted as any);
            window.removeEventListener('chart:trade-tick',    handleTradeTick as any);
            window.removeEventListener('chart:trade-settled', handleSettlement as any);
            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
            flagTimersRef.current.forEach(t => clearTimeout(t));
            flagTimersRef.current.clear();
        };
    }, []);

    /* ── Tick subscription — real-time + accurate digit stats ──────────────
     *  Design:
     *  1. Subscribe to live ticks FIRST so pip_size comes from the authoritative
     *     Deriv field (tick.pip_size), not from fragile string-length detection.
     *  2. Only after the first live tick (pip_size known) load 1000 history ticks
     *     and compute digits from that pip_size. Deduplicate history vs live
     *     stream using epoch timestamps so no tick is counted twice.
     *  3. Track the server-side subscription_id and send an explicit `forget`
     *     on cleanup — RxJS local unsubscribe alone does NOT cancel the server
     *     subscription, causing stale data after symbol changes.
     *  4. If api_base.api is not ready yet, retry every 500 ms.
     * ─────────────────────────────────────────────────────────────────────── */
    useEffect(() => {
        digitHistoryRef.current = [];
        prevPriceRef.current    = null;
        setCurrentDigit(null);
        setDigitCounts(new Array(10).fill(0));
        setCurrentPrice(null);
        setPriceChange(0);

        let alive            = true;
        let subscriptionId: string | null = null;
        let historyLoaded    = false;
        // Epochs received from the live stream before history arrives — used to
        // skip duplicate ticks that appear in both the history batch and the stream.
        const liveEpochs = new Set<number>();
        let liveDigitsBuffer: number[] = [];   // live digits before history is ready
        let rxSub: { unsubscribe: () => void } | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;

        // ── Digit-count helper: O(1) incremental update ────────────────────
        // Maintains a running tally so we never loop 1000 items per tick.
        const applyDigit = (d: number) => {
            // Drop the oldest digit if the window is full
            const evicted = digitHistoryRef.current.length >= 1000
                ? digitHistoryRef.current[0] : null;
            digitHistoryRef.current = digitHistoryRef.current.length >= 1000
                ? [...digitHistoryRef.current.slice(1), d]
                : [...digitHistoryRef.current, d];
            setDigitCounts(prev => {
                const next = [...prev];
                if (evicted !== null) next[evicted] = Math.max(0, next[evicted] - 1);
                next[d]++;
                return next;
            });
        };

        // ── Watchdog: if no tick arrives within 20 s, the stream has gone
        //   silent (WebSocket drop / server-side forget). Tear down and
        //   resubscribe so the page stays live without a manual refresh.
        let watchdog: ReturnType<typeof setTimeout> | null = null;
        const WATCHDOG_MS = 20_000;
        const resetWatchdog = () => {
            if (watchdog) clearTimeout(watchdog);
            watchdog = setTimeout(() => {
                if (!alive) return;
                rxSub?.unsubscribe?.();
                rxSub = null;
                startSub();          // silent resubscribe
            }, WATCHDOG_MS);
        };

        const teardownSub = () => {
            if (watchdog) { clearTimeout(watchdog); watchdog = null; }
            rxSub?.unsubscribe?.();
            rxSub = null;
            if (subscriptionId) {
                try { (api_base.api as any)?.send({ forget: subscriptionId }).catch(() => {}); } catch { /* noop */ }
                subscriptionId = null;
            }
        };

        const startSub = () => {
            if (!alive) return;
            if (!(api_base as any)?.api) {
                retryTimer = setTimeout(startSub, 300);
                return;
            }

            teardownSub();   // clean up any previous sub before creating a new one

            const observable = (api_base.api as any).subscribe({ ticks: symbol, subscribe: 1 });
            rxSub = observable.subscribe({
                next: (res: any) => {
                    if (!alive) return;
                    const tick = res?.tick;
                    if (!tick) return;

                    resetWatchdog();   // we got a tick — restart the silence timer

                    // Capture subscription id for explicit server-side forget on cleanup
                    if (!subscriptionId && res.subscription?.id) {
                        subscriptionId = res.subscription.id;
                    }

                    const price = Number(tick.quote);
                    const epoch = Number(tick.epoch ?? 0);
                    const ps    = tick.pip_size ?? pipSizeRef.current;
                    pipSizeRef.current = ps;
                    setPipSize(ps);
                    setCurrentPrice(price);
                    if (prevPriceRef.current !== null) setPriceChange(price - prevPriceRef.current);
                    prevPriceRef.current = price;
                    const d = getLastDigit(price, ps);
                    setCurrentDigit(d);

                    if (!historyLoaded) {
                        // Buffer live ticks — but ALSO update the digit bar immediately
                        // so stats are never frozen while waiting for the history batch.
                        liveEpochs.add(epoch);
                        liveDigitsBuffer.push(d);
                        applyDigit(d);

                        // Kick off history fetch on the FIRST live tick (pip_size is set)
                        if (liveDigitsBuffer.length === 1) {
                            ;(api_base.api as any).send({
                                ticks_history: symbol, count: 1000, end: 'latest', style: 'ticks',
                            }).then((hRes: any) => {
                                if (!alive) return;
                                const prices: number[] = hRes?.history?.prices ?? [];
                                const times: number[]  = hRes?.history?.times  ?? [];
                                const usedPs = pipSizeRef.current;
                                const filteredPrices: number[] = [];
                                prices.forEach((p: number, i: number) => {
                                    if (!liveEpochs.has(times[i])) filteredPrices.push(p);
                                });
                                const histDigits = filteredPrices.map((p: number) => getLastDigit(p, usedPs));
                                // Replace the live-only buffer with the full merged history
                                digitHistoryRef.current = [...histDigits, ...liveDigitsBuffer].slice(-1000);
                                historyLoaded = true;
                                // Rebuild counts once from the authoritative merged set
                                const counts = new Array(10).fill(0);
                                digitHistoryRef.current.forEach((x: number) => counts[x]++);
                                setDigitCounts([...counts]);
                            }).catch(() => {
                                historyLoaded = true;
                                digitHistoryRef.current = [...liveDigitsBuffer];
                                const counts = new Array(10).fill(0);
                                digitHistoryRef.current.forEach((x: number) => counts[x]++);
                                setDigitCounts([...counts]);
                            });
                        }
                    } else {
                        // Normal real-time path — O(1) incremental update
                        applyDigit(d);
                    }

                    // Update pending trade tick-counters (fallback path; POC is authoritative)
                    if (pendingTradesRef.current.length > 0) {
                        pendingTradesRef.current = pendingTradesRef.current.map(t => {
                            if (t.countedTicks < t.totalTicks) {
                                const arr = contractTickDigitsRef.current.get(t.id) ?? [];
                                arr.push(d);
                                contractTickDigitsRef.current.set(t.id, arr);
                            }
                            return { ...t, countedTicks: Math.min(t.countedTicks + 1, t.totalTicks) };
                        });
                        setPendingTrades([...pendingTradesRef.current]);
                        setTickDigitSnapshot(new Map(contractTickDigitsRef.current));
                    }
                },
                error: () => {
                    if (!alive) return;
                    // Fast retry — don't leave a 2 s gap in the stream
                    retryTimer = setTimeout(startSub, 100);
                },
            });

            resetWatchdog();  // arm watchdog immediately after subscribe
        };

        startSub();

        // Re-subscribe when the browser comes back online or the tab regains focus
        const handleReconnect = () => { if (alive && !rxSub) startSub(); };
        window.addEventListener('online',           handleReconnect);
        window.addEventListener('visibilitychange', handleReconnect);

        return () => {
            alive = false;
            if (retryTimer) clearTimeout(retryTimer);
            window.removeEventListener('online',           handleReconnect);
            window.removeEventListener('visibilitychange', handleReconnect);
            teardownSub();
        };
    }, [symbol]);

    /* Derived stats */
    const total  = Math.max(digitHistoryRef.current.length, 1);
    const pcts   = digitCounts.map(c => (c / total) * 100);
    const sorted = [...pcts].sort((a, b) => a - b);

    /* Per-digit tick labels */
    const digitTradeLabels = new Map<number, string[]>();
    tickDigitSnapshot.forEach((digits, tradeId) => {
        const pending = pendingTradesRef.current.find(t => t.id === tradeId);
        digits.forEach((d, idx) => {
            const tickNum = idx + 1;
            const isLast  = pending ? tickNum === pending.totalTicks : true;
            const label   = isLast ? `T${tickNum}★` : `T${tickNum}`;
            const arr = digitTradeLabels.get(d) ?? [];
            arr.push(label);
            digitTradeLabels.set(d, arr);
        });
    });

    /* ── Mobile view: Deriv-style full-screen trade UI ────────────────────── */
    if (isMobileView) {
        const activeSymbols: Array<{ symbol: string; display_name: string }> =
            Array.isArray((api_base as any)?.active_symbols)
                ? (api_base as any).active_symbols.map((s: any) => ({
                      symbol: s.symbol ?? s.underlying_symbol ?? '',
                      display_name: s.display_name ?? s.symbol ?? '',
                  })).filter((s: any) => s.symbol)
                : [];
        return (
            <MobileChartView
                symbol={symbol}
                onSymbolChange={(s) => chart_store.onSymbolChange(s)}
                currentDigit={currentDigit}
                currentPrice={currentPrice}
                priceChange={priceChange}
                pipSize={pipSize}
                pcts={pcts}
                sorted={sorted}
                barrier={barrier}
                onBarrierChange={setBarrier}
                pendingTrades={pendingTrades}
                tickDigitSnapshot={tickDigitSnapshot}
                lastTrade={lastTrade}
                activeSymbols={activeSymbols}
            />
        );
    }

    return (
        <div className='cw-scroll-wrapper'>
        <div className='cw-root'>

            {/* ── LEFT: SmartChart + digit bar ──────────────────────────── */}
            <div className='cw-left'>

                {/* Chart canvas — SmartChart renders its own market card inside */}
                <div className='cw-chart-inner'>
                    <Chart key={uniqueKey} show_digits_stats={false} />

                    {pendingTrades.map((t, i) => (
                        <div key={t.id} className='cdo-tick-counter' style={{ top: `${18 + i * 44}px` }}>
                            <span className='cdo-tick-counter__dot' />
                            <span className='cdo-tick-counter__count'>{t.countedTicks}/{t.totalTicks}</span>
                            <span className='cdo-tick-counter__label'>ticks</span>
                        </div>
                    ))}

                    {/* Win/Loss flags — compact pennant, right side of chart near centre */}
                    {tradeFlags.map((flag, i) => (
                        <div
                            key={flag.id}
                            className={`chart-trade-flag chart-trade-flag--${flag.won ? 'win' : 'loss'}`}
                            style={{ top: `calc(38% + ${i * 44}px)` }}
                        >
                            <div className='chart-trade-flag__pole' />
                            <div className='chart-trade-flag__banner'>
                                <span className='chart-trade-flag__emoji'>{flag.won ? '🎉' : '💔'}</span>
                                <span className='chart-trade-flag__amount'>
                                    {flag.won ? '+' : ''}{flag.profit.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Digit circles bar ─────────────────────────────────── */}
                <div className='cdo' aria-label='Last Digit Statistics'>

                    {/* Body row: price chip + right column (triangle + circles) */}
                    <div className='cdo__body'>
                        <div className='cdo__price'>
                            <span className='cdo__price-val'>
                                {currentPrice != null ? currentPrice.toFixed(pipSize) : '—'}
                            </span>
                            {currentDigit !== null && (
                                <span className='cdo__price-digit'>{currentDigit}</span>
                            )}
                        </div>

                        {/* ① Triangle track — ▼ slides above circles only (not over price chip) */}
                        <div className='cdo__right'>
                            <div className='cdo__triangle-track'>
                                <div
                                    className={`cdo__triangle-pointer${currentDigit === null ? ' cdo__triangle-pointer--hidden' : ''}`}
                                    style={{ left: currentDigit !== null ? digitToPercent(currentDigit) : '-100px' }}
                                />
                            </div>

                        {/* ② Circles row */}
                        <div className='cdo__circles'>
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => {
                                const pct       = pcts[d] ?? 0;
                                const colorRank = getCircleColor(pct, sorted);
                                const isCurrent = currentDigit === d;
                                const isBarrier = barrier === d;
                                const isWin     = lastTrade?.won === true  && lastTrade.digit === d;
                                const isLoss    = lastTrade?.won === false && lastTrade.digit === d;
                                const tLabels   = digitTradeLabels.get(d) ?? [];
                                const hasT      = tLabels.length > 0;
                                const isFinalT  = tLabels.some(l => l.includes('★'));

                                return (
                                    <div key={d} className='cdo__item' onClick={() => setBarrier(d)}>
                                        {hasT ? (
                                            <div className={`cdo__tlabel${isFinalT ? ' cdo__tlabel--final' : ''}`}>
                                                {tLabels.map(l => l.replace('★', '')).join(' ')}
                                            </div>
                                        ) : (
                                            <div className='cdo__tlabel cdo__tlabel--hidden' />
                                        )}
                                        <div className={[
                                            'cdo__circle',
                                            `cdo__circle--${colorRank}`,
                                            isCurrent ? 'cdo__circle--current' : '',
                                            isBarrier ? 'cdo__circle--barrier' : '',
                                            isWin     ? 'cdo__circle--win'     : '',
                                            isLoss    ? 'cdo__circle--loss'    : '',
                                            hasT && !isFinalT ? 'cdo__circle--tick-active' : '',
                                            hasT && isFinalT  ? (isWin ? 'cdo__circle--win' : isLoss ? 'cdo__circle--loss' : 'cdo__circle--tick-final') : '',
                                        ].filter(Boolean).join(' ')}>
                                            {d}
                                        </div>
                                        <span className='cdo__pct'>{pct.toFixed(1)}%</span>
                                    </div>
                                );
                            })}
                        </div>{/* /cdo__circles */}
                        </div>{/* /cdo__right */}
                    </div>{/* /cdo__body */}
                </div>{/* /cdo */}
            </div>{/* /cw-left */}

            {/* ── RIGHT: trade panel ────────────────────────────────────── */}
            <div className='cw-right-panel'>
                <ChartTradePanel
                    symbol={symbol}
                    onSymbolChange={(s) => chart_store.onSymbolChange(s)}
                    currentDigit={currentDigit}
                    currentPrice={currentPrice}
                    priceChange={priceChange}
                    pipSize={pipSize}
                    barrier={barrier}
                    onBarrierChange={setBarrier}
                />
            </div>

        </div>
        </div>
    );
});

export default ChartWrapper;
