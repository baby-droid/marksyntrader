import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './digit-percent-widget.scss';

const APP_ID = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DERIV_APP_ID) || '36300';

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

const DigitPercentWidget: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [symbol, setSymbol] = useState('R_100');
    const [tickCount, setTickCount] = useState(1000);
    const [tickInput, setTickInput] = useState('1000');
    const [ticks, setTicks] = useState<number[]>([]);
    const [currentDigit, setCurrentDigit] = useState<number | null>(null);
    const [currentPrice, setCurrentPrice] = useState<string | null>(null);
    const [threshold, setThreshold] = useState(5);
    const [darkMode, setDarkMode] = useState(() => {
        try { return localStorage.getItem('digit_widget_dark') === '1'; } catch { return false; }
    });
    const wsRef    = useRef<WebSocket | null>(null);
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
        wsRef.current?.close();
        setTicks([]);
        setCurrentDigit(null);
        setCurrentPrice(null);

        const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        // Reset state for this new subscription
        pipSizeRef.current = currentMarket.pipSize;
        rawHistoryRef.current = [];
        pipSizeConfirmedRef.current = false;

        ws.onopen = () => {
            ws.send(JSON.stringify({
                ticks_history: symbol,
                count: tickCount,
                end: 'latest',
                style: 'ticks',
                subscribe: 1,
            }));
        };

        ws.onmessage = e => {
            try {
                const data = JSON.parse(e.data);
                if (data.error) {
                    console.warn('[DigitWidget] WS error:', data.error.message);
                    return;
                }

                if (data.history?.prices && Array.isArray(data.history.prices)) {
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

                } else if (data.tick) {
                    // Live tick — this is the authoritative pip_size source.
                    if (data.tick.pip_size != null) {
                        const confirmedPs = Number(data.tick.pip_size);

                        if (!pipSizeConfirmedRef.current) {
                            // First live tick: confirm pip_size and retroactively
                            // recompute any history that was stored with the wrong default.
                            pipSizeRef.current = confirmedPs;
                            pipSizeConfirmedRef.current = true;

                            const stored = rawHistoryRef.current;
                            if (stored.length > 0) {
                                const digits = stored.map(p => getLastDigit(p, confirmedPs));
                                setTicks(digits);
                                if (digits.length > 0) setCurrentDigit(digits[digits.length - 1]);
                                const last = stored[stored.length - 1];
                                if (last != null) setCurrentPrice(last.toFixed(confirmedPs));
                                rawHistoryRef.current = [];
                            }
                        } else {
                            // Subsequent ticks — update pip_size in case API changes it
                            pipSizeRef.current = confirmedPs;
                        }
                    }

                    const ps = pipSizeRef.current;
                    const quote = Number(data.tick.quote);
                    const digit = getLastDigit(quote, ps);
                    setCurrentDigit(digit);
                    setCurrentPrice(quote.toFixed(ps));
                    setTicks(prev => [...prev.slice(-(tickCount - 1)), digit]);
                }
            } catch (err) {
                console.warn('[DigitWidget] parse error', err);
            }
        };

        ws.onerror = err => console.warn('[DigitWidget] WS error', err);

        return () => { ws.close(); };
    }, [open, symbol, tickCount]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        return () => { wsRef.current?.close(); };
    }, []);

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

    const panelStyle: React.CSSProperties = panelPos
        ? { position: 'fixed', left: panelPos.x, top: panelPos.y, transform: 'none', zIndex: 9999 }
        : { position: 'fixed', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', zIndex: 9999 };

    const dmBg    = darkMode ? '#0f172a' : undefined;
    const dmBd    = darkMode ? '#334155' : undefined;
    const dmText  = darkMode ? '#e2e8f0' : undefined;
    const dmSec   = darkMode ? '#1e293b' : undefined;

    return (
        <div className='digit-percent-widget'>
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
                            onChange={e => setSymbol(e.target.value)}
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
