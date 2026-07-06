import React, { useEffect, useRef, useState } from 'react';
import './digit-percent-widget.scss';

const MARKETS: { value: string; label: string }[] = [
    // Volatility Indices
    { value: 'R_10',      label: 'Volatility 10 Index' },
    { value: 'R_25',      label: 'Volatility 25 Index' },
    { value: 'R_50',      label: 'Volatility 50 Index' },
    { value: 'R_75',      label: 'Volatility 75 Index' },
    { value: 'R_100',     label: 'Volatility 100 Index' },
    // Volatility 1s Indices
    { value: '1HZ10V',    label: 'Volatility 10 (1s) Index' },
    { value: '1HZ25V',    label: 'Volatility 25 (1s) Index' },
    { value: '1HZ50V',    label: 'Volatility 50 (1s) Index' },
    { value: '1HZ75V',    label: 'Volatility 75 (1s) Index' },
    { value: '1HZ100V',   label: 'Volatility 100 (1s) Index' },
    // Jump Indices
    { value: 'JD10',      label: 'Jump 10 Index' },
    { value: 'JD25',      label: 'Jump 25 Index' },
    { value: 'JD50',      label: 'Jump 50 Index' },
    { value: 'JD75',      label: 'Jump 75 Index' },
    { value: 'JD100',     label: 'Jump 100 Index' },
    // Crash / Boom
    { value: 'CRASH300N', label: 'Crash 300 Index' },
    { value: 'CRASH500',  label: 'Crash 500 Index' },
    { value: 'CRASH1000', label: 'Crash 1000 Index' },
    { value: 'BOOM300N',  label: 'Boom 300 Index' },
    { value: 'BOOM500',   label: 'Boom 500 Index' },
    { value: 'BOOM1000',  label: 'Boom 1000 Index' },
    // Step / Bear / Bull
    { value: 'stpRNG',    label: 'Step Index' },
    { value: 'RDBEAR',    label: 'Bear Market Index' },
    { value: 'RDBULL',    label: 'Bull Market Index' },
    // Range Break
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

/** Build the E/O/U/=/Ov stream tag for a digit given a threshold digit */
function getStreamTag(digit: number, threshold: number): { tag: string; cls: string } {
    if (digit % 2 === 0) return { tag: 'E', cls: 'stream-even' };
    return { tag: 'O', cls: 'stream-odd' };
}

function getOverUnderTag(digit: number, threshold: number): { tag: string; cls: string } {
    if (digit > threshold) return { tag: 'ov', cls: 'stream-over' };
    if (digit < threshold) return { tag: 'u', cls: 'stream-under' };
    return { tag: '=', cls: 'stream-eq' };
}

const DigitPercentWidget: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [symbol, setSymbol] = useState('R_100');
    const [tickCount, setTickCount] = useState(1000);
    const [ticks, setTicks] = useState<number[]>([]);
    const [currentDigit, setCurrentDigit] = useState<number | null>(null);
    const [threshold, setThreshold] = useState(5);
    const wsRef = useRef<WebSocket | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        if (!open) return;
        const onClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [open]);

    const stats: TDigitStat[] = Array.from({ length: 10 }, (_, d) => {
        const count = ticks.filter(t => t === d).length;
        const pct = ticks.length > 0 ? (count / ticks.length) * 100 : 0;
        return { digit: d, count, pct };
    });

    const colors = computeRankColors(stats);
    const currentIndex = currentDigit ?? 0;

    // Top row: digits 0-4, bottom row: digits 5-9
    const topRow = stats.slice(0, 5);
    const bottomRow = stats.slice(5, 10);

    // Recent 40 ticks for stream display
    const recentTicks = ticks.slice(-40);

    return (
        <div className='digit-percent-widget' ref={containerRef}>
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
                <div className='digit-percent-widget__panel'>
                    {/* Header */}
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
                            type='range'
                            min={100}
                            max={2000}
                            step={100}
                            value={tickCount}
                            onChange={e => setTickCount(Number(e.target.value))}
                        />
                        <span className='digit-percent-widget__ticks-range'>100–2000</span>
                    </div>

                    {/* Triangle above TOP row — centered on current digit if 0-4 */}
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

                        {/* TOP row: digits 0-4 */}
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

                    {/* Gap between rows */}
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

                        {/* Triangle BELOW bottom row — shows when current digit is 5-9 */}
                        {ticks.length > 0 && currentDigit !== null && currentDigit >= 5 && (
                            <div className='digit-percent-widget__triangle-track digit-percent-widget__triangle-track--below'>
                                <div
                                    className='digit-percent-widget__triangle digit-percent-widget__triangle--up'
                                    style={{ left: `calc(${currentDigit - 5} * (100% / 5) + (100% / 10))` }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Threshold control */}
                    <div className='digit-percent-widget__threshold-row'>
                        <label>Threshold digit:</label>
                        <select
                            className='digit-percent-widget__threshold-select'
                            value={threshold}
                            onChange={e => setThreshold(Number(e.target.value))}
                        >
                            {[0,1,2,3,4,5,6,7,8,9].map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    {/* Stream display: E/O / Over/Under/= */}
                    {recentTicks.length > 0 && (
                        <div className='digit-percent-widget__stream-section'>
                            <div className='digit-percent-widget__stream-label'>Even / Odd stream (E=even, O=odd)</div>
                            <div className='digit-percent-widget__stream'>
                                {recentTicks.map((d, i) => {
                                    const { tag, cls } = getStreamTag(d, threshold);
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

                    {/* Loaded tick count */}
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
