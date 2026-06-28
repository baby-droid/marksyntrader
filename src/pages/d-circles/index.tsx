import React, { useEffect, useRef, useState } from 'react';
import './d-circles.scss';

interface DigitStat {
    digit: number;
    count: number;
    pct: number;
}

const DIGIT_COLORS = [
    '#ef4444','#f97316','#eab308','#22c55e','#06b6d4',
    '#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f59e0b',
];

const PCT_GROUP_COLORS = [
    '#00ff88','#00e5ff','#ff6b6b','#ffd700','#c084fc',
    '#fb923c','#34d399','#60a5fa','#f472b6','#a3e635',
];

function getColorForPct(pct: number, allPcts: number[]): string {
    const unique = [...new Set(allPcts.map(p => Math.round(p * 10) / 10))].sort((a, b) => a - b);
    const idx = unique.indexOf(Math.round(pct * 10) / 10);
    return PCT_GROUP_COLORS[idx % PCT_GROUP_COLORS.length];
}

const DCircles: React.FC = () => {
    const [ticks, setTicks] = useState<number[]>([]);
    const [symbol, setSymbol] = useState('R_100');
    const [running, setRunning] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reqIdRef = useRef(1);

    const stats: DigitStat[] = Array.from({ length: 10 }, (_, d) => {
        const count = ticks.filter(t => t === d).length;
        const pct = ticks.length > 0 ? (count / ticks.length) * 100 : 0;
        return { digit: d, count, pct };
    });

    const allPcts = stats.map(s => s.pct);

    const connect = () => {
        if (wsRef.current) { wsRef.current.close(); }
        const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
        wsRef.current = ws;
        ws.onopen = () => {
            ws.send(JSON.stringify({ ticks: symbol, subscribe: 1, req_id: reqIdRef.current++ }));
        };
        ws.onmessage = (e) => {
            const d = JSON.parse(e.data);
            if (d.tick) {
                const quote = d.tick.quote;
                const last = Math.floor(((quote * 100) % 10 + 10) % 10);
                setTicks(prev => [...prev.slice(-999), last]);
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
        <div className='dcircles'>
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
                        <option value='1HZ10V'>Volatility 10 (1s)</option>
                    </select>
                    <button className={`dcircles__btn${running ? ' dcircles__btn--stop' : ''}`} onClick={toggle}>
                        {running ? '⏹ Stop' : '▶ Start'}
                    </button>
                    <button className='dcircles__btn dcircles__btn--clear' onClick={() => setTicks([])}>↺ Clear</button>
                </div>
            </div>

            <div className='dcircles__ticker'>
                <span className='dcircles__ticker-label'>Latest digits:</span>
                <div className='dcircles__ticker-digits'>
                    {ticks.slice(-30).reverse().map((d, i) => (
                        <span key={i} className='dcircles__ticker-dot' style={{ background: DIGIT_COLORS[d], opacity: 1 - i * 0.03 }}>
                            {d}
                        </span>
                    ))}
                </div>
            </div>

            <div className='dcircles__grid'>
                {stats.map(s => {
                    const color = ticks.length > 0 ? getColorForPct(s.pct, allPcts) : DIGIT_COLORS[s.digit];
                    const size = 80 + (s.count / maxCount) * 60;
                    return (
                        <div key={s.digit} className='dcircles__cell'>
                            <div className='dcircles__circle-wrap'>
                                <div
                                    className='dcircles__circle'
                                    style={{ width: size, height: size, background: `radial-gradient(circle at 35% 35%, ${color}55, ${color}22)`, border: `3px solid ${color}`, boxShadow: `0 0 24px ${color}55, 0 0 8px ${color}33` }}
                                >
                                    <span className='dcircles__digit' style={{ color }}>{s.digit}</span>
                                    <span className='dcircles__count'>{s.count}</span>
                                </div>
                            </div>
                            <div className='dcircles__bar-outer'>
                                <div className='dcircles__bar-inner' style={{ width: `${s.pct}%`, background: color }} />
                            </div>
                            <span className='dcircles__pct' style={{ color }}>{s.pct.toFixed(1)}%</span>
                        </div>
                    );
                })}
            </div>

            <div className='dcircles__stats'>
                <div className='dcircles__stat'><span>Total Ticks</span><strong>{ticks.length}</strong></div>
                <div className='dcircles__stat'><span>Most Common</span><strong style={{ color: DIGIT_COLORS[stats.sort((a,b)=>b.count-a.count)[0]?.digit ?? 0] }}>{stats.sort((a,b)=>b.count-a.count)[0]?.digit ?? '-'}</strong></div>
                <div className='dcircles__stat'><span>Least Common</span><strong>{stats.filter(s=>s.count>0).sort((a,b)=>a.count-b.count)[0]?.digit ?? '-'}</strong></div>
                <div className='dcircles__stat'><span>Status</span><strong style={{ color: running ? '#22c55e' : '#94a3b8' }}>{running ? '● LIVE' : '○ Stopped'}</strong></div>
            </div>
        </div>
    );
};

export default DCircles;
