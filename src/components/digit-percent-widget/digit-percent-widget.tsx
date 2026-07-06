import React, { useEffect, useRef, useState } from 'react';
import './digit-percent-widget.scss';

const MARKETS: { value: string; label: string }[] = [
    { value: 'R_10', label: 'Volatility 10 Index' },
    { value: 'R_25', label: 'Volatility 25 Index' },
    { value: 'R_50', label: 'Volatility 50 Index' },
    { value: 'R_75', label: 'Volatility 75 Index' },
    { value: 'R_100', label: 'Volatility 100 Index' },
    { value: '1HZ10V', label: 'Volatility 10 (1s) Index' },
    { value: '1HZ25V', label: 'Volatility 25 (1s) Index' },
    { value: '1HZ50V', label: 'Volatility 50 (1s) Index' },
    { value: '1HZ75V', label: 'Volatility 75 (1s) Index' },
    { value: '1HZ100V', label: 'Volatility 100 (1s) Index' },
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

const DigitPercentWidget: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [symbol, setSymbol] = useState('R_100');
    const [ticks, setTicks] = useState<number[]>([]);
    const [currentDigit, setCurrentDigit] = useState<number | null>(null);
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
            ws.send(JSON.stringify({ ticks_history: symbol, count: 200, end: 'latest', style: 'ticks', subscribe: 1 }));
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
                setTicks(prev => [...prev.slice(-199), digit]);
            }
        };

        return () => {
            ws.close();
        };
    }, [open, symbol]);

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
    const trianglePos = ticks.length > 0 ? `calc(${currentIndex} * (100% / 10) + (100% / 20))` : undefined;

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

                    {ticks.length > 0 && trianglePos && (
                        <div className='digit-percent-widget__triangle-track'>
                            <div
                                className='digit-percent-widget__triangle'
                                style={{ left: trianglePos }}
                            />
                        </div>
                    )}

                    <div className='digit-percent-widget__circles'>
                        {stats.map(s => {
                            const isCurrent = currentDigit === s.digit;
                            const c = colors[s.digit];
                            return (
                                <div key={s.digit} className='digit-percent-widget__cell'>
                                    <div
                                        className={`digit-percent-widget__circle ${isCurrent ? 'digit-percent-widget__circle--current' : ''}`}
                                        style={{
                                            background: c.fill,
                                            border: `2px solid ${c.ring}`,
                                        }}
                                    >
                                        <span
                                            className='digit-percent-widget__digit'
                                            style={{ color: c.fill === '#ffffff' ? '#000' : '#fff' }}
                                        >
                                            {s.digit}
                                        </span>
                                    </div>
                                    <span className='digit-percent-widget__pct'>{s.pct.toFixed(1)}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DigitPercentWidget;
