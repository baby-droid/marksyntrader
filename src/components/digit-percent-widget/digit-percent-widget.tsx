import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api_base } from '@/external/bot-skeleton';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { useApiBase } from '@/hooks/useApiBase';
import './digit-percent-widget.scss';

const MARKETS: { value: string; label: string; pipSize: number }[] = [
    { value: 'R_10',      label: 'Volatility 10 Index',       pipSize: 3 },
    { value: 'R_25',      label: 'Volatility 25 Index',       pipSize: 3 },
    { value: 'R_50',      label: 'Volatility 50 Index',       pipSize: 4 },
    { value: 'R_75',      label: 'Volatility 75 Index',       pipSize: 4 },
    { value: 'R_100',     label: 'Volatility 100 Index',      pipSize: 2 },
    { value: '1HZ10V',    label: 'Volatility 10 (1s) Index',  pipSize: 3 },
    { value: '1HZ25V',    label: 'Volatility 25 (1s) Index',  pipSize: 2 },
    { value: '1HZ50V',    label: 'Volatility 50 (1s) Index',  pipSize: 4 },
    { value: '1HZ75V',    label: 'Volatility 75 (1s) Index',  pipSize: 4 },
    { value: '1HZ100V',   label: 'Volatility 100 (1s) Index', pipSize: 2 },
    { value: 'JD10',      label: 'Jump 10 Index',             pipSize: 3 },
    { value: 'JD25',      label: 'Jump 25 Index',             pipSize: 2 },
    { value: 'JD50',      label: 'Jump 50 Index',             pipSize: 4 },
    { value: 'JD75',      label: 'Jump 75 Index',             pipSize: 4 },
    { value: 'JD100',     label: 'Jump 100 Index',            pipSize: 2 },
    { value: 'CRASH300N', label: 'Crash 300 Index',           pipSize: 2 },
    { value: 'CRASH500',  label: 'Crash 500 Index',           pipSize: 2 },
    { value: 'CRASH1000', label: 'Crash 1000 Index',          pipSize: 2 },
    { value: 'BOOM300N',  label: 'Boom 300 Index',            pipSize: 2 },
    { value: 'BOOM500',   label: 'Boom 500 Index',            pipSize: 2 },
    { value: 'BOOM1000',  label: 'Boom 1000 Index',           pipSize: 2 },
    { value: 'stpRNG',    label: 'Step Index',                pipSize: 2 },
    { value: 'RDBEAR',    label: 'Bear Market Index',         pipSize: 4 },
    { value: 'RDBULL',    label: 'Bull Market Index',         pipSize: 4 },
    { value: 'RBREAKOUT100N', label: 'Range Break 100 Index', pipSize: 4 },
    { value: 'RBREAKOUT200N', label: 'Range Break 200 Index', pipSize: 4 },
];

type TDigitStat = { digit: number; count: number; pct: number };

/**
 * Extract last digit from a price value.
 *
 * WHY toFixed() and not String():
 *   JavaScript silently strips trailing zeros from floats.
 *   e.g.  JSON 1234.10  →  JS Number 1234.1  →  String "1234.1"
 *   The last character is "1", not "0" — so digit 0 would count ~0% of the time.
 *   toFixed(pipSize) rebuilds the full decimal string: 1234.1.toFixed(2) = "1234.10"
 *   and the last character is correctly "0".
 */
function getLastDigit(quoteRaw: string | number, pipSize: number): number {
    const s = Number(quoteRaw).toFixed(pipSize);
    return parseInt(s[s.length - 1], 10);
}

function computeRankColors(stats: TDigitStat[]): Record<number, { fill: string; ring: string }> {
    const withTicks = stats.filter(s => s.count > 0);
    const distinct = Array.from(new Set(withTicks.map(s => s.pct))).sort((a, b) => a - b);
    const lowest = distinct[0];
    const secondLowest = distinct.length > 1 ? distinct[1] : undefined;
    const highest = distinct[distinct.length - 1];
    const secondHighest = distinct.length > 1 ? distinct[distinct.length - 2] : undefined;

    const result: Record<number, { fill: string; ring: string }> = {};
    stats.forEach(s => {
        let color: string | null = null;
        if (s.count > 0) {
            if (s.pct === highest) color = '#22c55e';
            else if (secondHighest !== undefined && s.pct === secondHighest) color = '#3b82f6';
            else if (s.pct === lowest) color = '#ef4444';
            else if (secondLowest !== undefined && s.pct === secondLowest) color = '#eab308';
        }
        result[s.digit] = color ? { fill: color, ring: color } : { fill: '', ring: '' };
    });
    return result;
}

function getStreamTag(digit: number): { tag: string; cls: string } {
    if (digit % 2 === 0) return { tag: 'E', cls: 'stream-even' };
    return { tag: 'O', cls: 'stream-odd' };
}

function getOverUnderTag(digit: number, threshold: number): { tag: string; cls: string } {
    if (digit > threshold) return { tag: 'ov', cls: 'stream-over' };
    if (digit < threshold) return { tag: 'u', cls: 'stream-under' };
    return { tag: '=', cls: 'stream-eq' };
}

function computeStreamStats(ticks: number[], threshold: number) {
    if (ticks.length === 0) return null;
    const n = ticks.length;
    const evenCount  = ticks.filter(d => d % 2 === 0).length;
    const oddCount   = n - evenCount;
    const overCount  = ticks.filter(d => d > threshold).length;
    const underCount = ticks.filter(d => d < threshold).length;
    const eqCount    = n - overCount - underCount;
    return {
        evenPct:  +((evenCount  / n) * 100).toFixed(1),
        oddPct:   +((oddCount   / n) * 100).toFixed(1),
        overPct:  +((overCount  / n) * 100).toFixed(1),
        underPct: +((underCount / n) * 100).toFixed(1),
        eqPct:    +((eqCount    / n) * 100).toFixed(1),
        n,
    };
}

const DigitPercentWidget: React.FC<{ showTrigger?: boolean }> = ({ showTrigger = true }) => {
    const { connectionStatus } = useApiBase();
    const [open, setOpen] = useState(false);
    const [symbol, setSymbol] = useState(() => {
        try { return localStorage.getItem('digit_widget_market') || 'R_100'; } catch { return 'R_100'; }
    });
    const [tickCount, setTickCount] = useState(1000);
    const [tickInput, setTickInput] = useState('1000');
    const [ticks, setTicks] = useState<number[]>([]);
    const [currentDigit, setCurrentDigit] = useState<number | null>(null);
    const [currentPrice, setCurrentPrice] = useState<string | null>(null);
    const [lastLiveTickAt, setLastLiveTickAt] = useState(0);
    const [threshold, setThreshold] = useState(5);
    const [darkMode, setDarkMode] = useState(() => {
        try { return localStorage.getItem('digit_widget_dark') === '1'; } catch { return false; }
    });
    // AI analyser tick count — adjustable 5–100, default 50
    const [aiTickCount, setAiTickCount] = useState(() => {
        try { return parseInt(localStorage.getItem('digit_widget_ai_ticks') || '50', 10) || 50; } catch { return 50; }
    });
    const [aiTickInput, setAiTickInput] = useState(() => {
        try { return localStorage.getItem('digit_widget_ai_ticks') || '50'; } catch { return '50'; }
    });
    const tickSubscriptionRef = useRef<any>(null);
    const tickSubscriptionIdRef = useRef<string | null>(null);
    // Resolve current market first so pipSizeRef can use it for its initial value
    const currentMarket = MARKETS.find(m => m.value === symbol) ?? MARKETS[0];
    // pip_size starts from our static table; the live stream overrides it authoritatively
    const pipSizeRef = useRef<number>(currentMarket.pipSize);
    // Raw history prices held until the live tick confirms the real pip_size
    const rawHistoryRef = useRef<number[]>([]);
    // Flag: have we received a pip_size from the API yet for this subscription?
    const pipSizeConfirmedRef = useRef<boolean>(false);

    // Panel drag state — persists position in localStorage
    const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(() => {
        try { const raw = localStorage.getItem('digit_widget_pos'); if (raw) return JSON.parse(raw); } catch {}
        return null;
    });
    const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; dragging: boolean } | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const openAnalyzer = () => setOpen(true);
        window.addEventListener('digit-analyzer:open', openAnalyzer);
        return () => window.removeEventListener('digit-analyzer:open', openAnalyzer);
    }, []);

    useEffect(() => {
        if (panelPos) try { localStorage.setItem('digit_widget_pos', JSON.stringify(panelPos)); } catch {}
    }, [panelPos]);

    useEffect(() => {
        try { localStorage.setItem('digit_widget_dark', darkMode ? '1' : '0'); } catch {}
    }, [darkMode]);

    const onDragDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const el = panelRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        dragRef.current = {
            startX: e.clientX, startY: e.clientY,
            origX: panelPos?.x ?? rect.left,
            origY: panelPos?.y ?? rect.top,
            dragging: false,
        };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }, [panelPos]);

    const onDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const st = dragRef.current;
        if (!st) return;
        const dx = e.clientX - st.startX;
        const dy = e.clientY - st.startY;
        if (!st.dragging && Math.hypot(dx, dy) < 4) return;
        st.dragging = true;
        const el = panelRef.current;
        const w = el?.offsetWidth ?? 340;
        const h = el?.offsetHeight ?? 400;
        const x = Math.max(0, Math.min(window.innerWidth - w, st.origX + dx));
        const y = Math.max(0, Math.min(window.innerHeight - h, st.origY + dy));
        setPanelPos({ x, y });
    }, []);

    const onDragUp = useCallback(() => { dragRef.current = null; }, []);

    useEffect(() => {
        if (!open) return;
        tickSubscriptionRef.current?.unsubscribe?.();
        tickSubscriptionRef.current = null;
        if (tickSubscriptionIdRef.current && api_base.api) {
            (api_base.api as any).send({ forget: tickSubscriptionIdRef.current }).catch(() => {});
            tickSubscriptionIdRef.current = null;
        }
        setTicks([]);
        setCurrentDigit(null);
        setCurrentPrice(null);
        setLastLiveTickAt(0);

        // Reset state for this new subscription
        pipSizeRef.current = currentMarket.pipSize;
        rawHistoryRef.current = [];
        pipSizeConfirmedRef.current = false;

        let cancelled = false;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    let messageSubscription: any = null;
    const clearWatchdog = () => {
        if (watchdogTimer) {
            clearTimeout(watchdogTimer);
            watchdogTimer = null;
        }
    };
    const armWatchdog = () => {
        clearWatchdog();
        watchdogTimer = setTimeout(() => {
            if (cancelled) return;
            messageSubscription?.unsubscribe?.();
            messageSubscription = null;
            if (tickSubscriptionIdRef.current && api_base.api) {
                (api_base.api as any).send({ forget: tickSubscriptionIdRef.current }).catch(() => {});
                tickSubscriptionIdRef.current = null;
            }
            retryTimer = setTimeout(start, 100);
        }, 20_000);
    };
        const start = async () => {
            if (cancelled) return;
            const api = api_base.api as any;
            if (!api) {
                retryTimer = setTimeout(start, 350);
                return;
            }

            try {
                // Fetch history through the same API instance that is authorized by
                // the app. The response is returned directly by DerivAPIBasic.send().
                const historyResponse = await api.send({
                ticks_history: symbol,
                count: tickCount,
                end: 'latest',
                style: 'ticks',
                });
                if (cancelled) return;
                const data = historyResponse;
                if (data.error) {
                    console.warn('[DigitWidget] WS error:', data.error.message);
                } else if (data.history?.prices && Array.isArray(data.history.prices)) {
                    // History batch arrives first — store raw prices.
                    // We do NOT compute digits yet because the API pip_size hasn't
                    // been confirmed. Processing with the wrong pip_size is what
                    // caused digit-0 to appear 99%+ of the time on markets like
                    // Jump 25 and Volatility 25 (1s).
                    const rawPrices: number[] = data.history.prices.map(Number);
                    rawHistoryRef.current = rawPrices;

                    // If we already got a confirmed pip_size (unlikely but safe), render now.
                    if (pipSizeConfirmedRef.current) {
                        const ps = pipSizeRef.current;
                        const digits = rawPrices.map(p => getLastDigit(p, ps));
                        setTicks(digits);
                        if (digits.length > 0) setCurrentDigit(digits[digits.length - 1]);
                        const last = rawPrices[rawPrices.length - 1];
                        if (last != null) setCurrentPrice(last.toFixed(ps));
                        rawHistoryRef.current = [];
                    }
                    // else: wait for live tick pip_size below
                }

                // Subscribe via RxJS observable — same robust pattern as chart-wrapper.tsx.
                // This is more reliable than api.onMessage which can miss messages on
                // some API versions.
                const tickObservable = api.subscribe({ ticks: symbol, subscribe: 1 });
                messageSubscription = tickObservable.subscribe({
                    next: (res: any) => {
                        if (cancelled) return;
                        // Capture server-side subscription id for explicit forget on cleanup
                        if (!tickSubscriptionIdRef.current && res?.subscription?.id) {
                            tickSubscriptionIdRef.current = String(res.subscription.id);
                        }
                        const tick = res?.tick;
                        if (!tick) return;

                        // Live tick — authoritative pip_size source
                        if (tick.pip_size != null) {
                            const confirmedPs = Number(tick.pip_size);
                            if (!pipSizeConfirmedRef.current) {
                                // First live tick: confirm pip_size and retroactively
                                // recompute history stored with the wrong static default.
                                pipSizeRef.current = confirmedPs;
                                pipSizeConfirmedRef.current = true;
                                const stored = rawHistoryRef.current;
                                if (stored.length > 0) {
                                    const digits = stored.map((p: number) => getLastDigit(p, confirmedPs));
                                    setTicks(digits);
                                    if (digits.length > 0) setCurrentDigit(digits[digits.length - 1]);
                                    const last = stored[stored.length - 1];
                                    if (last != null) setCurrentPrice(last.toFixed(confirmedPs));
                                    // Keep the authoritative price history alive for the
                                    // AI's Rise/Fall, High/Low and streak analysis.
                                    rawHistoryRef.current = stored.slice(-tickCount);
                                }
                            } else {
                                pipSizeRef.current = confirmedPs;
                            }
                        }

                        const ps    = pipSizeRef.current;
                        const quote = Number(tick.quote);
                        const digit = getLastDigit(quote, ps);
                        setCurrentDigit(digit);
                        setCurrentPrice(quote.toFixed(ps));
                        rawHistoryRef.current = [...rawHistoryRef.current, quote].slice(-tickCount);
                        setTicks(prev => [...prev.slice(-(tickCount - 1)), digit]);
                        setLastLiveTickAt(Date.now());
                        armWatchdog();
                    },
                    error: () => {
                        if (!cancelled) retryTimer = setTimeout(start, 500);
                    },
                });
            } catch (err) {
                if (!cancelled) {
                    console.warn('[DigitWidget] authenticated market data error:', err);
                    retryTimer = setTimeout(start, 700);
                }
            }
        };
        start();

        return () => {
            cancelled = true;
            if (retryTimer) clearTimeout(retryTimer);
            clearWatchdog();
            tickSubscriptionRef.current?.unsubscribe?.();
            tickSubscriptionRef.current = null;
            messageSubscription?.unsubscribe?.();
            messageSubscription = null;
            if (tickSubscriptionIdRef.current && api_base.api) {
                (api_base.api as any).send({ forget: tickSubscriptionIdRef.current }).catch(() => {});
                tickSubscriptionIdRef.current = null;
            }
        };
    }, [open, symbol, tickCount]); // eslint-disable-line react-hooks/exhaustive-deps

    const stats: TDigitStat[] = Array.from({ length: 10 }, (_, d) => {
        const count = ticks.filter(t => t === d).length;
        const pct = ticks.length > 0 ? (count / ticks.length) * 100 : 0;
        return { digit: d, count, pct };
    });

    const colors = computeRankColors(stats);
    const topRow = stats.slice(0, 5);
    const bottomRow = stats.slice(5, 10);

    const recentTicks  = ticks.slice(-40);
    const last100Ticks = ticks.slice(-100);
    const stats100     = computeStreamStats(last100Ticks, threshold);
    const statsAll     = computeStreamStats(ticks, threshold);

    // Default: right side on small screens so it never blocks page headings on mobile
    const isMobileWidth = typeof window !== 'undefined' && window.innerWidth <= 600;
    const panelStyle: React.CSSProperties = panelPos
        ? { position: 'fixed', left: panelPos.x, top: panelPos.y, transform: 'none', zIndex: 9999 }
        : isMobileWidth
            ? { position: 'fixed', right: '0.4rem', top: '8rem', zIndex: 9999 }
            : { position: 'fixed', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', zIndex: 9999 };

    const dmBg    = darkMode ? '#0f172a' : undefined;
    const dmBd    = darkMode ? '#334155' : undefined;
    const dmText  = darkMode ? '#e2e8f0' : undefined;
    const dmSec   = darkMode ? '#1e293b' : undefined;

    return (
        <div className='digit-percent-widget'>
            {showTrigger && (
                <button
                    className='digit-percent-widget__trigger'
                    title='Digit % Analyzer'
                    onClick={() => setOpen(o => !o)}
                >
                    <span className='digit-percent-widget__dot' />
                    <span className='digit-percent-widget__dot' />
                    <span className='digit-percent-widget__dot' />
                    <span className='digit-percent-widget__dot' />
                </button>
            )}

            {open && createPortal(
                <div
                    className={`digit-percent-widget__panel ${darkMode ? 'digit-percent-widget__panel--dark' : ''}`}
                    ref={panelRef}
                    style={{ ...panelStyle, background: dmBg, borderColor: dmBd, color: dmText }}
                >
                    {/* Drag header with X close + dark/light mode */}
                    <div
                        className='digit-percent-widget__drag-header'
                        style={darkMode ? { background: dmSec, borderColor: dmBd } : undefined}
                        onPointerDown={onDragDown}
                        onPointerMove={onDragMove}
                        onPointerUp={onDragUp}
                        onPointerCancel={onDragUp}
                    >
                        <span className='digit-percent-widget__drag-icon'>⠿</span>
                        <span className='digit-percent-widget__drag-title' style={darkMode ? { color: dmText } : undefined}>
                            Digit % Analyzer
                        </span>
                        {/* Dark / Light toggle */}
                        <button
                            className='digit-percent-widget__close-btn'
                            style={darkMode ? { borderColor: dmBd, color: '#94a3b8', background: dmSec } : undefined}
                            onClick={e => { e.stopPropagation(); setDarkMode(d => !d); }}
                            title={darkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}
                        >
                            {darkMode ? '☀' : '🌙'}
                        </button>
                        <button
                            className='digit-percent-widget__close-btn'
                            style={darkMode ? { borderColor: dmBd, color: '#94a3b8', background: dmSec } : undefined}
                            onClick={() => setOpen(false)}
                            title='Close'
                        >✕</button>
                    </div>

                    {/* Market dropdown + live price */}
                    <div className='digit-percent-widget__header'>
                        <select
                            className='digit-percent-widget__select'
                            style={darkMode ? { background: dmSec, borderColor: dmBd, color: dmText } : undefined}
                            value={symbol}
                            onChange={e => {
                                setSymbol(e.target.value);
                                try { localStorage.setItem('digit_widget_market', e.target.value); } catch {}
                            }}
                        >
                            {MARKETS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                        {currentPrice && (
                            <span style={{
                                marginLeft: '0.5rem',
                                fontSize: '1.05rem',
                                fontWeight: 700,
                                color: darkMode ? '#22d3ee' : '#7b3fe4',
                                whiteSpace: 'nowrap',
                            }}>
                                {currentPrice}
                            </span>
                        )}
                        {ticks.length === 0 && <span className='digit-percent-widget__loading'>Loading…</span>}
                    </div>

                    {/* Ticks slider + editable input */}
                    <div className='digit-percent-widget__ticks-row' style={darkMode ? { color: dmText } : undefined}>
                        <label className='digit-percent-widget__ticks-label' style={darkMode ? { color: dmText } : undefined}>
                            Ticks:
                        </label>
                        <input
                            type='number'
                            className='digit-percent-widget__ticks-input'
                            style={darkMode ? { background: dmSec, borderColor: dmBd, color: dmText } : undefined}
                            min={100}
                            max={5000}
                            step={100}
                            value={tickInput}
                            onChange={e => setTickInput(e.target.value)}
                            onBlur={() => {
                                const v = Math.max(100, Math.min(5000, parseInt(tickInput) || 1000));
                                setTickInput(String(v));
                                setTickCount(v);
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    const v = Math.max(100, Math.min(5000, parseInt(tickInput) || 1000));
                                    setTickInput(String(v));
                                    setTickCount(v);
                                }
                            }}
                        />
                        <input
                            className='digit-percent-widget__ticks-slider'
                            type='range' min={100} max={5000} step={100}
                            value={tickCount}
                            onChange={e => { setTickCount(Number(e.target.value)); setTickInput(e.target.value); }}
                        />
                    </div>

                    {/* TOP row: digits 0-4 */}
                    <div className='digit-percent-widget__row-section'>
                        {ticks.length > 0 && currentDigit !== null && currentDigit <= 4 && (
                            <div className='digit-percent-widget__triangle-track'>
                                <div
                                    className='digit-percent-widget__triangle digit-percent-widget__triangle--down'
                                    style={{ left: `calc(${currentDigit} * (100% / 5) + (100% / 10))` }}
                                />
                            </div>
                        )}
                        {ticks.length > 0 && currentDigit !== null && currentDigit > 4 && (
                            <div className='digit-percent-widget__triangle-track digit-percent-widget__triangle-track--placeholder' />
                        )}
                        <div className='digit-percent-widget__circles'>
                            {topRow.map(s => {
                                const isCurrent = currentDigit === s.digit;
                                const c = colors[s.digit];
                                const fillColor = c.fill || (darkMode ? '#374151' : '#f3f4f6');
                                const textColor = c.fill ? '#fff' : (darkMode ? '#e2e8f0' : '#1f2937');
                                return (
                                    <div key={s.digit} className='digit-percent-widget__cell'>
                                        <div
                                            className={`digit-percent-widget__circle ${isCurrent ? 'digit-percent-widget__circle--current' : ''}`}
                                            style={{ background: fillColor, border: `2px solid ${c.ring || (darkMode ? '#475569' : '#d1d5db')}` }}
                                        >
                                            <span className='digit-percent-widget__digit' style={{ color: textColor }}>
                                                {s.digit}
                                            </span>
                                        </div>
                                        <span className='digit-percent-widget__pct' style={darkMode ? { color: '#cbd5e1' } : undefined}>
                                            {s.pct.toFixed(1)}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className='digit-percent-widget__row-gap' />

                    {/* BOTTOM row: digits 5-9 */}
                    <div className='digit-percent-widget__row-section'>
                        <div className='digit-percent-widget__circles'>
                            {bottomRow.map(s => {
                                const isCurrent = currentDigit === s.digit;
                                const c = colors[s.digit];
                                const fillColor = c.fill || (darkMode ? '#374151' : '#f3f4f6');
                                const textColor = c.fill ? '#fff' : (darkMode ? '#e2e8f0' : '#1f2937');
                                return (
                                    <div key={s.digit} className='digit-percent-widget__cell'>
                                        <div
                                            className={`digit-percent-widget__circle ${isCurrent ? 'digit-percent-widget__circle--current' : ''}`}
                                            style={{ background: fillColor, border: `2px solid ${c.ring || (darkMode ? '#475569' : '#d1d5db')}` }}
                                        >
                                            <span className='digit-percent-widget__digit' style={{ color: textColor }}>
                                                {s.digit}
                                            </span>
                                        </div>
                                        <span className='digit-percent-widget__pct' style={darkMode ? { color: '#cbd5e1' } : undefined}>
                                            {s.pct.toFixed(1)}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        {ticks.length > 0 && currentDigit !== null && currentDigit >= 5 && (
                            <div className='digit-percent-widget__triangle-track digit-percent-widget__triangle-track--below'>
                                <div
                                    className='digit-percent-widget__triangle digit-percent-widget__triangle--up'
                                    style={{ left: `calc(${currentDigit - 5} * (100% / 5) + (100% / 10))` }}
                                />
                            </div>
                        )}
                    </div>

                    {/* 100-tick Even/Odd and Over/Under stats */}
                    {stats100 && (
                        <div className='digit-percent-widget__stats100' style={darkMode ? { background: dmSec, borderColor: dmBd } : undefined}>
                            <div className='digit-percent-widget__stats100-title' style={darkMode ? { color: '#94a3b8' } : undefined}>
                                Last 100 ticks &nbsp;
                                <span className='digit-percent-widget__stats100-sub'>({Math.min(last100Ticks.length, 100)} loaded)</span>
                            </div>
                            <div className='digit-percent-widget__stats100-row'>
                                <div className={`digit-percent-widget__stats100-pill stats100-even${darkMode ? '--dark' : ''}`}>
                                    <span>Even</span><strong>{stats100.evenPct}%</strong>
                                </div>
                                <div className={`digit-percent-widget__stats100-pill stats100-odd${darkMode ? '--dark' : ''}`}>
                                    <span>Odd</span><strong>{stats100.oddPct}%</strong>
                                </div>
                                <div className={`digit-percent-widget__stats100-pill stats100-over${darkMode ? '--dark' : ''}`}>
                                    <span>Over {threshold}</span><strong>{stats100.overPct}%</strong>
                                </div>
                                <div className={`digit-percent-widget__stats100-pill stats100-under${darkMode ? '--dark' : ''}`}>
                                    <span>Under {threshold}</span><strong>{stats100.underPct}%</strong>
                                </div>
                                {stats100.eqPct > 0 && (
                                    <div className='digit-percent-widget__stats100-pill stats100-eq'>
                                        <span>={threshold}</span><strong>{stats100.eqPct}%</strong>
                                    </div>
                                )}
                            </div>
                            {statsAll && statsAll.n > 100 && (
                                <div className='digit-percent-widget__stats100-row' style={{ marginTop: '0.3rem', opacity: 0.75 }}>
                                    <span style={{ fontSize: '0.85rem', color: darkMode ? '#64748b' : '#94a3b8', marginRight: 6 }}>All {statsAll.n}:</span>
                                    <span className='digit-percent-widget__stats100-pill stats100-even' style={{ padding: '1px 6px' }}>E {statsAll.evenPct}%</span>
                                    <span className='digit-percent-widget__stats100-pill stats100-odd' style={{ padding: '1px 6px' }}>O {statsAll.oddPct}%</span>
                                    <span className='digit-percent-widget__stats100-pill stats100-over' style={{ padding: '1px 6px' }}>Ov {statsAll.overPct}%</span>
                                    <span className='digit-percent-widget__stats100-pill stats100-under' style={{ padding: '1px 6px' }}>Un {statsAll.underPct}%</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Threshold control */}
                    <div className='digit-percent-widget__threshold-row' style={darkMode ? { color: dmText } : undefined}>
                        <label>Threshold digit:</label>
                        <select
                            className='digit-percent-widget__threshold-select'
                            style={darkMode ? { background: dmSec, borderColor: dmBd, color: dmText } : undefined}
                            value={threshold}
                            onChange={e => setThreshold(Number(e.target.value))}
                        >
                            {[0,1,2,3,4,5,6,7,8,9].map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>

                    {/* Stream display: E/O and Over/Under */}
                    {recentTicks.length > 0 && (
                        <div className={`digit-percent-widget__stream-section${darkMode ? '--dark' : ''}`} style={darkMode ? { borderColor: '#334155' } : undefined}>
                            <div className='digit-percent-widget__stream-label' style={darkMode ? { color: '#94a3b8' } : undefined}>
                                Even / Odd stream (E=even, O=odd)
                            </div>
                            <div className='digit-percent-widget__stream'>
                                {recentTicks.map((d, i) => {
                                    const { tag, cls } = getStreamTag(d);
                                    return (
                                        <span key={i} className={`digit-percent-widget__stream-tag ${cls}${darkMode ? '--dark' : ''} ${i === recentTicks.length - 1 ? 'current' : ''}`}>
                                            {tag}
                                        </span>
                                    );
                                })}
                            </div>
                            <div className='digit-percent-widget__stream-label' style={darkMode ? { color: '#94a3b8' } : undefined}>
                                Over / Under / Equal (threshold={threshold})
                            </div>
                            <div className='digit-percent-widget__stream'>
                                {recentTicks.map((d, i) => {
                                    const { tag, cls } = getOverUnderTag(d, threshold);
                                    return (
                                        <span key={i} className={`digit-percent-widget__stream-tag ${cls}${darkMode ? '--dark' : ''} ${i === recentTicks.length - 1 ? 'current' : ''}`}>
                                            {tag}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── AI Contract Type Analyser ─────────────────────── */}
                    {ticks.length >= 20 && (() => {
                        const aiTicks   = Math.min(Math.max(aiTickCount, 5), Math.min(100, ticks.length));
                        const lastN     = ticks.slice(-aiTicks);
                        const n         = lastN.length;
                        const evenCount = lastN.filter(d => d % 2 === 0).length;
                        const oddCount  = n - evenCount;
                        const evenPct   = (evenCount / n * 100);
                        const oddPct    = (oddCount  / n * 100);
                        const freq      = Array.from({ length: 10 }, (_, i) => lastN.filter(d => d === i).length);
                        const minDigit  = freq.indexOf(Math.min(...freq));
                        const maxDigit  = freq.indexOf(Math.max(...freq));
                        const overCount  = lastN.filter(d => d > threshold).length;
                        const underCount = lastN.filter(d => d < threshold).length;
                        const overPct    = (overCount  / n * 100);
                        const underPct   = (underCount / n * 100);

                        // Rise / Fall — based on recent price direction streaks
                        const recentPrices = rawHistoryRef.current.slice(-aiTicks);
                        let riseCount = 0, fallCount = 0;
                        for (let i = 1; i < recentPrices.length; i++) {
                            if (recentPrices[i] > recentPrices[i - 1]) riseCount++;
                            else if (recentPrices[i] < recentPrices[i - 1]) fallCount++;
                        }
                        const priceMoves = riseCount + fallCount || 1;
                        const risePct  = riseCount / priceMoves * 100;
                        const fallPct  = fallCount / priceMoves * 100;

                        // High Tick / Low Tick — last tick vs window
                        const windowHigh = recentPrices.length > 0 ? Math.max(...recentPrices) : 0;
                        const windowLow  = recentPrices.length > 0 ? Math.min(...recentPrices) : 0;
                        const lastPrice  = recentPrices[recentPrices.length - 1] ?? 0;
                        const priceRange = windowHigh - windowLow || 1;
                        const highTickScore = ((lastPrice - windowLow) / priceRange) * 100;
                        const lowTickScore  = ((windowHigh - lastPrice) / priceRange) * 100;

                        // Only Ups / Only Downs — streak detection
                        let upsStreak = 0, downsStreak = 0, curUpRun = 0, curDownRun = 0;
                        for (let i = 1; i < recentPrices.length; i++) {
                            if (recentPrices[i] > recentPrices[i - 1]) { curUpRun++; curDownRun = 0; }
                            else if (recentPrices[i] < recentPrices[i - 1]) { curDownRun++; curUpRun = 0; }
                            upsStreak   = Math.max(upsStreak, curUpRun);
                            downsStreak = Math.max(downsStreak, curDownRun);
                        }
                        const onlyUpsScore   = Math.min(100, (upsStreak / (n * 0.3)) * 100);
                        const onlyDownsScore = Math.min(100, (downsStreak / (n * 0.3)) * 100);

                        // Score each contract type
                        const scores: { contract: string; score: number; reason: string; tag: string }[] = [
                            {
                                contract: '↑ Rise (Call)',
                                score: risePct,
                                reason: `${riseCount}/${priceMoves} price moves upward`,
                                tag: risePct > 55 ? '✅ BULLISH' : risePct < 40 ? '❌ BEARISH' : '⚠ NEUTRAL',
                            },
                            {
                                contract: '↓ Fall (Put)',
                                score: fallPct,
                                reason: `${fallCount}/${priceMoves} price moves downward`,
                                tag: fallPct > 55 ? '✅ BEARISH' : fallPct < 40 ? '❌ BULLISH' : '⚠ NEUTRAL',
                            },
                            {
                                contract: 'Even',
                                score: evenPct,
                                reason: `${evenCount}/${n} digits even`,
                                tag: evenPct > oddPct ? '✅ DOMINANT' : '⚠ WEAK',
                            },
                            {
                                contract: 'Odd',
                                score: oddPct,
                                reason: `${oddCount}/${n} digits odd`,
                                tag: oddPct > evenPct ? '✅ DOMINANT' : '⚠ WEAK',
                            },
                            {
                                contract: `Over ${threshold}`,
                                score: overPct,
                                reason: `${overPct.toFixed(0)}% ticks above ${threshold}`,
                                tag: overPct > 55 ? '✅ STRONG' : overPct < 40 ? '❌ AVOID' : '⚠ NEUTRAL',
                            },
                            {
                                contract: `Under ${threshold}`,
                                score: underPct,
                                reason: `${underPct.toFixed(0)}% ticks below ${threshold}`,
                                tag: underPct > 55 ? '✅ STRONG' : underPct < 40 ? '❌ AVOID' : '⚠ NEUTRAL',
                            },
                            {
                                contract: `Differs (≠${minDigit})`,
                                score: (1 - freq[minDigit] / n) * 100,
                                reason: `Digit ${minDigit} appears least (${freq[minDigit]}×)`,
                                tag: freq[minDigit] < n * 0.07 ? '✅ RARE' : '⚠ COMMON',
                            },
                            {
                                contract: `Matches (=${maxDigit})`,
                                score: freq[maxDigit] / n * 100,
                                reason: `Digit ${maxDigit} appears most (${freq[maxDigit]}×)`,
                                tag: freq[maxDigit] > n * 0.14 ? '✅ HOT' : '⚠ NORMAL',
                            },
                            {
                                contract: '🔺 High Tick',
                                score: highTickScore,
                                reason: `Last price near window high (${(highTickScore).toFixed(0)}%)`,
                                tag: highTickScore > 70 ? '✅ NEAR HIGH' : highTickScore < 30 ? '❌ FAR' : '⚠ MID',
                            },
                            {
                                contract: '🔻 Low Tick',
                                score: lowTickScore,
                                reason: `Last price near window low (${(lowTickScore).toFixed(0)}%)`,
                                tag: lowTickScore > 70 ? '✅ NEAR LOW' : lowTickScore < 30 ? '❌ FAR' : '⚠ MID',
                            },
                            {
                                contract: '📈 Only Ups',
                                score: onlyUpsScore,
                                reason: `Max up-streak: ${upsStreak} consecutive rises`,
                                tag: upsStreak >= 4 ? '✅ STRONG' : upsStreak >= 2 ? '⚠ POSSIBLE' : '❌ WEAK',
                            },
                            {
                                contract: '📉 Only Downs',
                                score: onlyDownsScore,
                                reason: `Max down-streak: ${downsStreak} consecutive falls`,
                                tag: downsStreak >= 4 ? '✅ STRONG' : downsStreak >= 2 ? '⚠ POSSIBLE' : '❌ WEAK',
                            },
                        ];
                        scores.sort((a, b) => b.score - a.score);
                        const best = scores[0];

                        return (
                            <div style={{
                                marginTop: '10px',
                                padding: '12px',
                                borderRadius: '10px',
                                background: darkMode ? 'rgba(15,23,42,0.9)' : 'rgba(124,63,228,0.06)',
                                border: `1px solid ${darkMode ? '#334155' : 'rgba(124,63,228,0.18)'}`,
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    marginBottom: '8px', fontSize: '12px', fontWeight: 700,
                                    color: darkMode ? '#a78bfa' : '#7b3fe4',
                                }}>
                                    🤖 AI Contract Type Analyser
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        marginLeft: '2px', fontSize: '9px', fontWeight: 700,
                                        color: connectionStatus === 'opened' && lastLiveTickAt ? '#22c55e' : '#f59e0b',
                                    }}>
                                        <span style={{
                                            width: '6px', height: '6px', borderRadius: '50%',
                                            background: connectionStatus === 'opened' && lastLiveTickAt ? '#22c55e' : '#f59e0b',
                                        }} />
                                        {connectionStatus === 'opened' && lastLiveTickAt ? 'LIVE MARKET' : 'CONNECTING'}
                                    </span>
                                    {/* Adjustable AI tick count */}
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                                        <span style={{ fontSize: '10px', color: darkMode ? '#64748b' : '#9ca3af', fontWeight: 400 }}>Ticks:</span>
                                        <input
                                            type='number'
                                            min={5} max={100}
                                            value={aiTickInput}
                                            onChange={e => setAiTickInput(e.target.value)}
                                            onBlur={() => {
                                                const v = Math.min(100, Math.max(5, parseInt(aiTickInput, 10) || 50));
                                                setAiTickCount(v);
                                                setAiTickInput(String(v));
                                                try { localStorage.setItem('digit_widget_ai_ticks', String(v)); } catch {}
                                            }}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                            }}
                                            style={{
                                                width: '44px', padding: '1px 4px',
                                                fontSize: '11px', textAlign: 'center',
                                                background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                                border: `1px solid ${darkMode ? '#334155' : '#d1d5db'}`,
                                                borderRadius: '4px',
                                                color: darkMode ? '#e2e8f0' : '#374151',
                                                outline: 'none',
                                            }}
                                        />
                                    </span>
                                    <span style={{ fontSize: '10px', color: darkMode ? '#64748b' : '#9ca3af', fontWeight: 400, marginLeft: '4px' }}>
                                        {n} used • {currentMarket.label}
                                    </span>
                                </div>
                                {/* Best recommendation */}
                                <div style={{
                                    padding: '8px 10px',
                                    borderRadius: '8px',
                                    background: darkMode ? 'rgba(124,63,228,0.15)' : 'rgba(124,63,228,0.1)',
                                    border: '1px solid rgba(124,63,228,0.3)',
                                    marginBottom: '8px',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                }}>
                                    <span style={{ fontSize: '18px' }}>🏆</span>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 800, color: darkMode ? '#c4b5fd' : '#5b21b6' }}>
                                            {best.contract}
                                        </div>
                                        <div style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#6b7280' }}>
                                            {best.reason} — {best.tag}
                                        </div>
                                    </div>
                                    <span style={{ marginLeft: 'auto', fontSize: '15px', fontWeight: 800, color: '#22c55e' }}>
                                        {best.score.toFixed(0)}%
                                    </span>
                                </div>
                                {/* All scores */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {scores.map(s => (
                                        <div key={s.contract} style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            fontSize: '11px',
                                        }}>
                                            <span style={{
                                                minWidth: '90px', fontWeight: 600,
                                                color: darkMode ? '#e2e8f0' : '#374151',
                                            }}>{s.contract}</span>
                                            <div style={{
                                                flex: 1, height: '5px', borderRadius: '3px',
                                                background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                                                overflow: 'hidden',
                                            }}>
                                                <div style={{
                                                    width: `${Math.min(100, s.score)}%`, height: '100%',
                                                    borderRadius: '3px',
                                                    background: s.score > 60 ? '#22c55e' : s.score > 45 ? '#3b82f6' : '#94a3b8',
                                                    transition: 'width 0.5s ease',
                                                }} />
                                            </div>
                                            <span style={{
                                                minWidth: '30px', textAlign: 'right', fontWeight: 700,
                                                color: s.score > 60 ? '#22c55e' : darkMode ? '#94a3b8' : '#6b7280',
                                            }}>{s.score.toFixed(0)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Footer */}
                    <div className='digit-percent-widget__footer' style={darkMode ? { color: '#64748b' } : undefined}>
                        <span>{ticks.length} ticks loaded</span>
                        {currentDigit !== null && (
                            <span>
                                Current: <strong style={{ color: darkMode ? '#22d3ee' : '#7b3fe4' }}>{currentDigit}</strong>
                                {currentPrice && <span style={{ marginLeft: 8, color: darkMode ? '#94a3b8' : '#4b5563' }}>{currentPrice}</span>}
                            </span>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default DigitPercentWidget;
