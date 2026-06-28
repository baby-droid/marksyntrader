import React, { useEffect, useRef, useState } from 'react';
import './d-circles.scss';

const DIGIT_COLORS: Record<number,string> = {
    0: '#D9D9D9', 1: '#D9D9D9', 2: '#D9D9D9',
    3: '#D88B1F', 4: '#D9D9D9', 5: '#D9D9D9',
    6: '#42B883', 7: '#E24A43', 8: '#42B883', 9: '#4E7CF5',
};

const DIGIT_BG: Record<number,string> = {
    0: '#fff', 1: '#fff', 2: '#fff',
    3: '#D88B1F', 4: '#fff', 5: '#fff',
    6: '#42B883', 7: '#E24A43', 8: '#42B883', 9: '#4E7CF5',
};

const DIGIT_TEXT: Record<number,string> = {
    3: '#fff', 6: '#fff', 7: '#fff', 8: '#fff', 9: '#fff',
};

function getLastDigit(quote: number): number {
    const s = quote.toFixed(2).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

const DCircles: React.FC = () => {
    const [ticks, setTicks] = useState<number[]>([]);
    const [symbol, setSymbol] = useState('R_100');
    const [running, setRunning] = useState(false);
    const [currentDigit, setCurrentDigit] = useState<number | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const wsRef = useRef<WebSocket | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const onMouseMove = (e: React.MouseEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const stats = Array.from({ length: 10 }, (_, d) => {
        const count = ticks.filter(t => t === d).length;
        const pct = ticks.length > 0 ? (count / ticks.length) * 100 : 0;
        return { digit: d, count, pct };
    });

    const connect = () => {
        if (wsRef.current) wsRef.current.close();
        const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
        wsRef.current = ws;
        ws.onopen = () => ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        ws.onmessage = (e) => {
            const d = JSON.parse(e.data);
            if (d.tick) {
                const digit = getLastDigit(d.tick.quote);
                setCurrentDigit(digit);
                setTicks(prev => [...prev.slice(-999), digit]);
            }
        };
    };

    const toggle = () => {
        if (running) {
            wsRef.current?.close();
            setRunning(false);
        } else {
            setTicks([]);
            connect();
            setRunning(true);
        }
    };

    useEffect(() => () => { wsRef.current?.close(); }, []);

    const maxCount = Math.max(...stats.map(s => s.count), 1);

    return (
        <div
            className='dcircles'
            ref={containerRef}
            onMouseMove={onMouseMove}
        >
            {/* Custom pink triangle cursor */}
            <svg
                className='dcircles__cursor'
                style={{ left: mousePos.x, top: mousePos.y }}
                width='20' height='20' viewBox='0 0 20 20'
            >
                <polygon points='0,0 20,10 0,20 4,10' fill='#ec4899' opacity='0.9' />
            </svg>

            <div className='dcircles__header'>
                <div>
                    <h2 className='dcircles__title'>⬤ D-Circles Digit Analyzer</h2>
                    <p className='dcircles__sub'>Live digit frequency — same % groups share color</p>
                </div>
                <div className='dcircles__controls'>
                    <select className='dcircles__select' value={symbol} onChange={e => { setSymbol(e.target.value); if (running) { wsRef.current?.close(); setRunning(false); } }}>
                        <option value='R_100'>Volatility 100</option>
                        <option value='R_75'>Volatility 75</option>
                        <option value='R_50'>Volatility 50</option>
                        <option value='R_25'>Volatility 25</option>
                        <option value='R_10'>Volatility 10</option>
                        <option value='1HZ100V'>Volatility 100 (1s)</option>
                        <option value='1HZ75V'>Volatility 75 (1s)</option>
                        <option value='1HZ25V'>Volatility 25 (1s)</option>
                        <option value='1HZ10V'>Volatility 10 (1s)</option>
                    </select>
                    <button className={`dcircles__btn${running ? ' dcircles__btn--stop' : ''}`} onClick={toggle}>
                        {running ? '⏹ Stop' : '▶ Start'}
                    </button>
                    <button className='dcircles__btn dcircles__btn--clear' onClick={() => setTicks([])}>↺ Clear</button>
                </div>
            </div>

            {/* Ticker */}
            <div className='dcircles__ticker'>
                <span className='dcircles__ticker-label'>Last digits:</span>
                <div className='dcircles__ticker-digits'>
                    {ticks.slice(-30).reverse().map((d, i) => (
                        <span key={i} className='dcircles__ticker-dot' style={{
                            background: DIGIT_BG[d],
                            color: DIGIT_TEXT[d] || '#1F2937',
                            border: `2px solid ${DIGIT_COLORS[d]}`,
                            opacity: Math.max(0.2, 1 - i * 0.03),
                        }}>
                            {d}
                        </span>
                    ))}
                </div>
            </div>

            {/* Circles grid - 5 per row */}
            <div className='dcircles__grid'>
                {stats.map(s => {
                    const isCurrent = currentDigit === s.digit;
                    const fillColor = DIGIT_BG[s.digit];
                    const textColor = DIGIT_TEXT[s.digit] || '#1F2937';
                    const borderColor = DIGIT_COLORS[s.digit];

                    return (
                        <div key={s.digit} className='dcircles__cell'>
                            <div className='dcircles__circle-wrap'>
                                <div
                                    className={`dcircles__circle ${isCurrent ? 'dcircles__circle--current' : ''}`}
                                    style={{
                                        background: fillColor,
                                        border: isCurrent
                                            ? `3px solid #4C7DFF`
                                            : `2px solid ${borderColor}`,
                                        width: isCurrent ? 84 : 72,
                                        height: isCurrent ? 84 : 72,
                                        boxShadow: isCurrent
                                            ? '0 0 0 3px rgba(76,125,255,0.25), 0 2px 6px rgba(0,0,0,0.1)'
                                            : '0 2px 6px rgba(0,0,0,0.1)',
                                    }}
                                >
                                    <span className='dcircles__digit' style={{ color: textColor }}>{s.digit}</span>
                                    <span className='dcircles__count' style={{ color: textColor, opacity: 0.65 }}>{s.count}</span>
                                </div>
                            </div>
                            <div className='dcircles__bar-outer'>
                                <div className='dcircles__bar-inner' style={{
                                    width: `${s.pct}%`,
                                    background: s.pct === Math.max(...stats.map(x => x.pct)) ? '#22c55e' :
                                                s.pct === Math.min(...stats.filter(x => x.count > 0).map(x => x.pct)) ? '#ef4444' :
                                                borderColor,
                                }} />
                            </div>
                            <span className='dcircles__pct' style={{ color: borderColor === '#D9D9D9' ? '#555' : borderColor }}>
                                {s.pct.toFixed(1)}%
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className='dcircles__stats'>
                <div className='dcircles__stat'><span>Total Ticks</span><strong>{ticks.length}</strong></div>
                <div className='dcircles__stat'><span>Current Digit</span><strong style={{ color: currentDigit !== null ? DIGIT_COLORS[currentDigit] : '#94a3b8' }}>{currentDigit ?? '-'}</strong></div>
                <div className='dcircles__stat'><span>Highest %</span><strong style={{color:'#22c55e'}}>{stats.reduce((a,b)=>b.pct>a.pct?b:a,stats[0]).digit}</strong></div>
                <div className='dcircles__stat'><span>Lowest %</span><strong style={{color:'#ef4444'}}>{stats.filter(s=>s.count>0).reduce((a,b)=>b.pct<a.pct?b:a,stats.filter(s=>s.count>0)[0])?.digit ?? '-'}</strong></div>
                <div className='dcircles__stat'><span>Status</span><strong style={{color: running ? '#22c55e' : '#94a3b8'}}>{running ? '● LIVE' : '○ Idle'}</strong></div>
            </div>
        </div>
    );
};

export default DCircles;
