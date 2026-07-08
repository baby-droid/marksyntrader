// @ts-nocheck
import React, { useEffect, useRef, useState, useCallback } from 'react';
import './d-circles.scss';

const APP_ID = import.meta?.env?.NEXT_PUBLIC_DERIV_APP_ID || '1089';
const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`;

const SYMBOLS = [
    { label: 'V10',     value: 'R_10'    },
    { label: 'V25',     value: 'R_25'    },
    { label: 'V50',     value: 'R_50'    },
    { label: 'V75',     value: 'R_75'    },
    { label: 'V100',    value: 'R_100'   },
    { label: 'V10 1s',  value: '1HZ10V'  },
    { label: 'V25 1s',  value: '1HZ25V'  },
    { label: 'V50 1s',  value: '1HZ50V'  },
    { label: 'V75 1s',  value: '1HZ75V'  },
    { label: 'V100 1s', value: '1HZ100V' },
];

const DIGIT_COLORS = ['#a78bfa','#60a5fa','#34d399','#fbbf24','#f87171','#c084fc','#38bdf8','#4ade80','#fb923c','#e879f9'];

function getLastDigit(quote: number): number {
    const s = quote.toFixed(2).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

function getStreak(ticks: number[], digit: number): number {
    let streak = 0;
    for (let i = ticks.length - 1; i >= 0; i--) {
        if (ticks[i] === digit) streak++;
        else break;
    }
    return streak;
}

const DCircles: React.FC = () => {
    const [ticks, setTicks] = useState<number[]>([]);
    const [symbol, setSymbol] = useState('1HZ100V');
    const [running, setRunning] = useState(false);
    const [currentDigit, setCurrentDigit] = useState<number | null>(null);
    const [currentPrice, setCurrentPrice] = useState<string>('');
    const [tickCount, setTickCount] = useState(0);
    const wsRef = useRef<WebSocket | null>(null);

    const stats = Array.from({ length: 10 }, (_, d) => {
        const count = ticks.filter(t => t === d).length;
        const pct = ticks.length > 0 ? (count / ticks.length) * 100 : 10;
        return { digit: d, count, pct };
    });

    const maxPct = Math.max(...stats.map(s => s.pct));
    const minPct = ticks.length > 0 ? Math.min(...stats.filter(s => s.count > 0).map(s => s.pct)) : 0;
    const hotDigit = stats.reduce((a, b) => b.pct > a.pct ? b : a, stats[0]);
    const coldDigit = ticks.length > 0 ? stats.filter(s => s.count > 0).reduce((a, b) => b.pct < a.pct ? b : a, stats.filter(s => s.count > 0)[0]) : null;

    const overPct = stats.filter(s => s.digit > 4).reduce((acc, s) => acc + s.count, 0) / Math.max(ticks.length, 1) * 100;
    const underPct = stats.filter(s => s.digit < 5).reduce((acc, s) => acc + s.count, 0) / Math.max(ticks.length, 1) * 100;
    const evenPct = stats.filter(s => s.digit % 2 === 0).reduce((acc, s) => acc + s.count, 0) / Math.max(ticks.length, 1) * 100;
    const oddPct = stats.filter(s => s.digit % 2 !== 0).reduce((acc, s) => acc + s.count, 0) / Math.max(ticks.length, 1) * 100;

    const aiSuggestion = (() => {
        if (ticks.length < 20) return null;
        const suggestions: Array<{ label: string; confidence: number; color: string }> = [];
        if (Math.abs(overPct - 50) > 5) suggestions.push({ label: overPct > 50 ? `OVER ${hotDigit.digit > 4 ? hotDigit.digit - 1 : 4}` : `UNDER ${coldDigit?.digit ?? 5}`, confidence: Math.abs(overPct - 50), color: overPct > 50 ? '#22c55e' : '#f97316' });
        if (Math.abs(evenPct - 50) > 5) suggestions.push({ label: evenPct > 50 ? 'EVEN' : 'ODD', confidence: Math.abs(evenPct - 50), color: evenPct > 50 ? '#60a5fa' : '#a78bfa' });
        return suggestions.sort((a, b) => b.confidence - a.confidence)[0] ?? null;
    })();

    const connect = useCallback(() => {
        if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        ws.onmessage = (e) => {
            const d = JSON.parse(e.data);
            if (d.tick) {
                const digit = getLastDigit(d.tick.quote);
                setCurrentDigit(digit);
                setCurrentPrice(d.tick.quote?.toFixed(2) ?? '');
                setTickCount(c => c + 1);
                setTicks(prev => [...prev.slice(-999), digit]);
            }
        };
        ws.onerror = () => {};
        ws.onclose = () => {};
    }, [symbol]);

    const toggle = useCallback(() => {
        if (running) {
            wsRef.current?.close();
            wsRef.current = null;
            setRunning(false);
        } else {
            setTicks([]);
            setTickCount(0);
            connect();
            setRunning(true);
        }
    }, [running, connect]);

    const clear = useCallback(() => {
        setTicks([]);
        setTickCount(0);
        setCurrentDigit(null);
    }, []);

    useEffect(() => {
        if (running) { connect(); }
        return () => {};
    }, [symbol]);

    useEffect(() => () => { wsRef.current?.close(); }, []);

    return (
        <div className='dcircles'>
            {/* Header */}
            <div className='dcircles__header'>
                <div className='dcircles__title-wrap'>
                    <h2 className='dcircles__title'>⬤ D-Circles — Digit Analyzer</h2>
                    <p className='dcircles__sub'>Real-time digit frequency · AHMED AI signals · Live market stats</p>
                </div>
                <div className='dcircles__controls'>
                    <select
                        className='dcircles__select'
                        value={symbol}
                        onChange={e => { setSymbol(e.target.value); }}
                    >
                        {SYMBOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <button className={`dcircles__btn ${running ? 'dcircles__btn--stop' : 'dcircles__btn--run'}`} onClick={toggle}>
                        {running ? '⏹ Stop' : '▶ Start'}
                    </button>
                    <button className='dcircles__btn dcircles__btn--clear' onClick={clear}>↺ Clear</button>
                </div>
            </div>

            {/* Live ticker */}
            <div className='dcircles__ticker'>
                <div className='dcircles__ticker-left'>
                    <span className='dcircles__live-dot' style={{ background: running ? '#22c55e' : '#475569' }} />
                    <span className='dcircles__ticker-price'>{currentPrice || '---'}</span>
                    {currentDigit !== null && (
                        <span className='dcircles__ticker-digit' style={{ background: DIGIT_COLORS[currentDigit] }}>
                            {currentDigit}
                        </span>
                    )}
                </div>
                <div className='dcircles__ticker-stream'>
                    {ticks.slice(-32).reverse().map((d, i) => (
                        <span
                            key={i}
                            className='dcircles__tick-chip'
                            style={{
                                background: DIGIT_COLORS[d] + (i === 0 ? 'ff' : '55'),
                                color: i === 0 ? '#fff' : 'rgba(255,255,255,0.7)',
                                transform: i === 0 ? 'scale(1.15)' : 'scale(1)',
                                fontWeight: i === 0 ? 700 : 400,
                            }}
                        >
                            {d}
                        </span>
                    ))}
                </div>
                <span className='dcircles__tick-count'>{tickCount} ticks</span>
            </div>

            {/* AI Suggestion bar */}
            {aiSuggestion && (
                <div className='dcircles__ai-bar' style={{ borderColor: aiSuggestion.color + '44', background: aiSuggestion.color + '11' }}>
                    <span className='dcircles__ai-icon'>🤖</span>
                    <span className='dcircles__ai-text'>
                        <strong style={{ color: aiSuggestion.color }}>AHMED AI: {aiSuggestion.label}</strong>
                        {' '} — {aiSuggestion.confidence.toFixed(1)}% confidence signal
                    </span>
                    <span className='dcircles__ai-badge' style={{ background: aiSuggestion.color }}>SIGNAL</span>
                </div>
            )}

            {/* Main digit circles grid */}
            <div className='dcircles__grid'>
                {stats.map(s => {
                    const isCurrent = currentDigit === s.digit;
                    const isHot = s.pct === maxPct && ticks.length > 0;
                    const isCold = ticks.length > 0 && s.count > 0 && s.pct === minPct;
                    const color = DIGIT_COLORS[s.digit];
                    const barPct = ticks.length > 0 ? s.pct : 10;
                    const streak = getStreak(ticks, s.digit);

                    return (
                        <div key={s.digit} className={`dcircles__cell ${isCurrent ? 'dcircles__cell--current' : ''} ${isHot ? 'dcircles__cell--hot' : ''} ${isCold ? 'dcircles__cell--cold' : ''}`}>
                            <div className='dcircles__circle' style={{
                                '--digit-color': color,
                                borderColor: isCurrent ? '#fff' : color + '88',
                                boxShadow: isCurrent ? `0 0 0 3px ${color}55, 0 0 16px ${color}44` : isHot ? `0 0 14px ${color}55` : 'none',
                                transform: isCurrent ? 'scale(1.08)' : 'scale(1)',
                            } as React.CSSProperties}>
                                <span className='dcircles__digit-num' style={{ color }}>{s.digit}</span>
                                <span className='dcircles__digit-pct' style={{ color: color + 'bb' }}>{s.pct.toFixed(1)}%</span>
                                {streak > 1 && <span className='dcircles__streak'>×{streak}</span>}
                                {isHot && <span className='dcircles__badge dcircles__badge--hot'>🔥</span>}
                                {isCold && <span className='dcircles__badge dcircles__badge--cold'>🧊</span>}
                            </div>
                            <div className='dcircles__bar-wrap'>
                                <div className='dcircles__bar' style={{ width: `${barPct}%`, background: color, opacity: isHot ? 1 : 0.6 }} />
                            </div>
                            <span className='dcircles__count'>{s.count}</span>
                        </div>
                    );
                })}
            </div>

            {/* Stats panel */}
            <div className='dcircles__stats'>
                <div className='dcircles__stat-card'>
                    <span className='dcircles__stat-label'>📊 Total Ticks</span>
                    <strong className='dcircles__stat-val'>{ticks.length}</strong>
                </div>
                <div className='dcircles__stat-card'>
                    <span className='dcircles__stat-label'>🔥 Hottest</span>
                    <strong className='dcircles__stat-val' style={{ color: DIGIT_COLORS[hotDigit.digit] }}>
                        {hotDigit.digit} ({hotDigit.pct.toFixed(1)}%)
                    </strong>
                </div>
                <div className='dcircles__stat-card'>
                    <span className='dcircles__stat-label'>🧊 Coldest</span>
                    <strong className='dcircles__stat-val' style={{ color: coldDigit ? DIGIT_COLORS[coldDigit.digit] : '#94a3b8' }}>
                        {coldDigit ? `${coldDigit.digit} (${coldDigit.pct.toFixed(1)}%)` : '-'}
                    </strong>
                </div>
                <div className='dcircles__stat-card'>
                    <span className='dcircles__stat-label'>⬆ OVER %</span>
                    <strong className='dcircles__stat-val' style={{ color: overPct > 55 ? '#22c55e' : overPct < 45 ? '#ef4444' : '#94a3b8' }}>
                        {ticks.length > 0 ? overPct.toFixed(1) + '%' : '-'}
                    </strong>
                </div>
                <div className='dcircles__stat-card'>
                    <span className='dcircles__stat-label'>⬇ UNDER %</span>
                    <strong className='dcircles__stat-val' style={{ color: underPct > 55 ? '#22c55e' : underPct < 45 ? '#ef4444' : '#94a3b8' }}>
                        {ticks.length > 0 ? underPct.toFixed(1) + '%' : '-'}
                    </strong>
                </div>
                <div className='dcircles__stat-card'>
                    <span className='dcircles__stat-label'>🔢 EVEN %</span>
                    <strong className='dcircles__stat-val' style={{ color: evenPct > 55 ? '#60a5fa' : '#94a3b8' }}>
                        {ticks.length > 0 ? evenPct.toFixed(1) + '%' : '-'}
                    </strong>
                </div>
                <div className='dcircles__stat-card'>
                    <span className='dcircles__stat-label'>🔢 ODD %</span>
                    <strong className='dcircles__stat-val' style={{ color: oddPct > 55 ? '#a78bfa' : '#94a3b8' }}>
                        {ticks.length > 0 ? oddPct.toFixed(1) + '%' : '-'}
                    </strong>
                </div>
                <div className='dcircles__stat-card'>
                    <span className='dcircles__stat-label'>📡 Status</span>
                    <strong className='dcircles__stat-val' style={{ color: running ? '#22c55e' : '#94a3b8' }}>
                        {running ? '● LIVE' : '○ Idle'}
                    </strong>
                </div>
            </div>

            {/* Digit distribution legend */}
            <div className='dcircles__legend'>
                <span className='dcircles__legend-item'><span style={{ background: '#22c55e' }} />Highest</span>
                <span className='dcircles__legend-item'><span style={{ background: '#ef4444' }} />Lowest</span>
                <span className='dcircles__legend-item'><span style={{ background: '#fff', border: '2px solid #fff' }} />Current</span>
                <span className='dcircles__legend-item'>🔥 = Over 10% | 🧊 = Under 10%</span>
                <span className='dcircles__legend-item'>×N = consecutive streak</span>
            </div>
        </div>
    );
};

export default DCircles;
