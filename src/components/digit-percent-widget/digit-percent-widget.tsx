import React, { useEffect, useRef, useState, useCallback } from 'react';
import './digit-percent-widget.scss';

const MARKETS: { value: string; label: string }[] = [
    { value: 'R_10',      label: 'Volatility 10 Index' },
    { value: 'R_25',      label: 'Volatility 25 Index' },
    { value: 'R_50',      label: 'Volatility 50 Index' },
    { value: 'R_75',      label: 'Volatility 75 Index' },
    { value: 'R_100',     label: 'Volatility 100 Index' },
    { value: '1HZ10V',    label: 'Volatility 10 (1s) Index' },
    { value: '1HZ25V',    label: 'Volatility 25 (1s) Index' },
    { value: '1HZ50V',    label: 'Volatility 50 (1s) Index' },
    { value: '1HZ75V',    label: 'Volatility 75 (1s) Index' },
    { value: '1HZ100V',   label: 'Volatility 100 (1s) Index' },
    { value: 'JD10',      label: 'Jump 10 Index' },
    { value: 'JD25',      label: 'Jump 25 Index' },
    { value: 'JD50',      label: 'Jump 50 Index' },
    { value: 'JD75',      label: 'Jump 75 Index' },
    { value: 'JD100',     label: 'Jump 100 Index' },
    { value: 'CRASH300N', label: 'Crash 300 Index' },
    { value: 'CRASH500',  label: 'Crash 500 Index' },
    { value: 'CRASH1000', label: 'Crash 1000 Index' },
    { value: 'BOOM300N',  label: 'Boom 300 Index' },
    { value: 'BOOM500',   label: 'Boom 500 Index' },
    { value: 'BOOM1000',  label: 'Boom 1000 Index' },
    { value: 'stpRNG',    label: 'Step Index' },
    { value: 'RDBEAR',    label: 'Bear Market Index' },
    { value: 'RDBULL',    label: 'Bull Market Index' },
    { value: 'RBREAKOUT100N', label: 'Range Break 100 Index' },
    { value: 'RBREAKOUT200N', label: 'Range Break 200 Index' },
];

type TDigitStat = { digit: number; count: number; pct: number };

function getLastDigit(quote: number): number {
    const s = quote.toFixed(2).replace('.', '');
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
        result[s.digit] = color ? { fill: color, ring: color } : { fill: '#ffffff', ring: '#000000' };
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

/** Compute even%, odd%, over%, under% for a given set of ticks */
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
    const [ticks, setTicks] = useState<number[]>([]);
    const [currentDigit, setCurrentDigit] = useState<number | null>(null);
    const [threshold, setThreshold] = useState(5);
    const wsRef = useRef<WebSocket | null>(null);

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

        const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
        wsRef.current = ws;
        ws.onopen = () => {
            ws.send(JSON.stringify({ ticks_history: symbol, count: tickCount, end: 'latest', style: 'ticks', subscribe: 1 }));
        };
        ws.onmessage = e => {
            const data = JSON.parse(e.data);
            if (data.history?.prices) {
                const digits = data.history.prices.map((p: number) => getLastDigit(Number(p)));
                setTicks(digits);
                setCurrentDigit(digits[digits.length - 1] ?? null);
            } else if (data.tick) {
                const digit = getLastDigit(Number(data.tick.quote));
                setCurrentDigit(digit);
                setTicks(prev => [...prev.slice(-(tickCount - 1)), digit]);
            }
        };

        return () => { ws.close(); };
    }, [open, symbol, tickCount]);

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
        ? { position: 'fixed', left: panelPos.x, top: panelPos.y, transform: 'none' }
        : { position: 'fixed', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' };

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

            {open && (
                <div className='digit-percent-widget__panel' ref={panelRef} style={panelStyle}>
                    {/* Drag header with X close */}
                    <div
                        className='digit-percent-widget__drag-header'
                        onPointerDown={onDragDown}
                        onPointerMove={onDragMove}
                        onPointerUp={onDragUp}
                        onPointerCancel={onDragUp}
                    >
                        <span className='digit-percent-widget__drag-icon'>⠿</span>
                        <span className='digit-percent-widget__drag-title'>Digit % Analyzer</span>
                        <button
                            className='digit-percent-widget__close-btn'
                            onClick={() => setOpen(false)}
                            title='Close'
                        >✕</button>
                    </div>

                    {/* Market dropdown */}
                    <div className='digit-percent-widget__header'>
                        <select
                            className='digit-percent-widget__select'
                            value={symbol}
                            onChange={e => setSymbol(e.target.value)}
                        >
                            {MARKETS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                        {ticks.length === 0 && <span className='digit-percent-widget__loading'>Loading…</span>}
                    </div>

                    {/* Ticks slider */}
                    <div className='digit-percent-widget__ticks-row'>
                        <label className='digit-percent-widget__ticks-label'>
                            Ticks: <strong>{tickCount}</strong>
                        </label>
                        <input
                            className='digit-percent-widget__ticks-slider'
                            type='range' min={100} max={2000} step={100}
                            value={tickCount}
                            onChange={e => setTickCount(Number(e.target.value))}
                        />
                        <span className='digit-percent-widget__ticks-range'>100–2000</span>
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
                                return (
                                    <div key={s.digit} className='digit-percent-widget__cell'>
                                        <div
                                            className={`digit-percent-widget__circle ${isCurrent ? 'digit-percent-widget__circle--current' : ''}`}
                                            style={{ background: c.fill, border: `2px solid ${c.ring}` }}
                                        >
                                            <span className='digit-percent-widget__digit' style={{ color: c.fill === '#ffffff' ? '#000' : '#fff' }}>
                                                {s.digit}
                                            </span>
                                        </div>
                                        <span className='digit-percent-widget__pct'>{s.pct.toFixed(1)}%</span>
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
                                return (
                                    <div key={s.digit} className='digit-percent-widget__cell'>
                                        <div
                                            className={`digit-percent-widget__circle ${isCurrent ? 'digit-percent-widget__circle--current' : ''}`}
                                            style={{ background: c.fill, border: `2px solid ${c.ring}` }}
                                        >
                                            <span className='digit-percent-widget__digit' style={{ color: c.fill === '#ffffff' ? '#000' : '#fff' }}>
                                                {s.digit}
                                            </span>
                                        </div>
                                        <span className='digit-percent-widget__pct'>{s.pct.toFixed(1)}%</span>
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
                        <div className='digit-percent-widget__stats100'>
                            <div className='digit-percent-widget__stats100-title'>
                                Last 100 ticks &nbsp;
                                <span className='digit-percent-widget__stats100-sub'>({Math.min(last100Ticks.length, 100)} loaded)</span>
                            </div>
                            <div className='digit-percent-widget__stats100-row'>
                                <div className='digit-percent-widget__stats100-pill stats100-even'>
                                    <span>Even</span><strong>{stats100.evenPct}%</strong>
                                </div>
                                <div className='digit-percent-widget__stats100-pill stats100-odd'>
                                    <span>Odd</span><strong>{stats100.oddPct}%</strong>
                                </div>
                                <div className='digit-percent-widget__stats100-pill stats100-over'>
                                    <span>Over {threshold}</span><strong>{stats100.overPct}%</strong>
                                </div>
                                <div className='digit-percent-widget__stats100-pill stats100-under'>
                                    <span>Under {threshold}</span><strong>{stats100.underPct}%</strong>
                                </div>
                                {stats100.eqPct > 0 && (
                                    <div className='digit-percent-widget__stats100-pill stats100-eq'>
                                        <span>={threshold}</span><strong>{stats100.eqPct}%</strong>
                                    </div>
                                )}
                            </div>
                            {statsAll && statsAll.n > 100 && (
                                <div className='digit-percent-widget__stats100-row' style={{ marginTop: '0.3rem', opacity: 0.65 }}>
                                    <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginRight: 6 }}>All {statsAll.n}:</span>
                                    <span className='digit-percent-widget__stats100-pill stats100-even' style={{ padding: '1px 6px' }}>E {statsAll.evenPct}%</span>
                                    <span className='digit-percent-widget__stats100-pill stats100-odd' style={{ padding: '1px 6px' }}>O {statsAll.oddPct}%</span>
                                    <span className='digit-percent-widget__stats100-pill stats100-over' style={{ padding: '1px 6px' }}>Ov {statsAll.overPct}%</span>
                                    <span className='digit-percent-widget__stats100-pill stats100-under' style={{ padding: '1px 6px' }}>Un {statsAll.underPct}%</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Threshold control */}
                    <div className='digit-percent-widget__threshold-row'>
                        <label>Threshold digit:</label>
                        <select
                            className='digit-percent-widget__threshold-select'
                            value={threshold}
                            onChange={e => setThreshold(Number(e.target.value))}
                        >
                            {[0,1,2,3,4,5,6,7,8,9].map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>

                    {/* Stream display: E/O and Over/Under */}
                    {recentTicks.length > 0 && (
                        <div className='digit-percent-widget__stream-section'>
                            <div className='digit-percent-widget__stream-label'>Even / Odd stream (E=even, O=odd)</div>
                            <div className='digit-percent-widget__stream'>
                                {recentTicks.map((d, i) => {
                                    const { tag, cls } = getStreamTag(d);
                                    return (
                                        <span key={i} className={`digit-percent-widget__stream-tag ${cls} ${i === recentTicks.length - 1 ? 'current' : ''}`}>
                                            {tag}
                                        </span>
                                    );
                                })}
                            </div>
                            <div className='digit-percent-widget__stream-label'>Over / Under / Equal (threshold={threshold})</div>
                            <div className='digit-percent-widget__stream'>
                                {recentTicks.map((d, i) => {
                                    const { tag, cls } = getOverUnderTag(d, threshold);
                                    return (
                                        <span key={i} className={`digit-percent-widget__stream-tag ${cls} ${i === recentTicks.length - 1 ? 'current' : ''}`}>
                                            {tag}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className='digit-percent-widget__footer'>
                        <span>{ticks.length} ticks loaded</span>
                        {currentDigit !== null && <span>Current: <strong>{currentDigit}</strong></span>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DigitPercentWidget;
