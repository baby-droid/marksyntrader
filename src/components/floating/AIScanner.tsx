import React, { useEffect, useRef, useState } from 'react';
import './ai-scanner.scss';

interface Signal {
    id: number;
    symbol: string;
    direction: 'RISE' | 'FALL';
    confidence: number;
    time: string;
}

const SYMBOLS = ['R_100','R_75','R_50','R_25','1HZ100V','1HZ10V'];

const AIScanner: React.FC = () => {
    const [signals, setSignals] = useState<Signal[]>([]);
    const [scanning, setScanning] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [pos, setPos] = useState({ x: 20, y: 120 });
    const dragging = useRef(false);
    const offset = useRef({ x: 0, y: 0 });
    const idRef = useRef(0);
    const scanRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const onMouseDown = (e: React.MouseEvent) => {
        dragging.current = true;
        offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    };

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragging.current) return;
            setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
        };
        const onUp = () => { dragging.current = false; };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, []);

    const toggleScan = () => {
        if (scanning) {
            if (scanRef.current) clearInterval(scanRef.current);
            setScanning(false);
        } else {
            setScanning(true);
            scanRef.current = setInterval(() => {
                const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
                const direction = Math.random() > 0.5 ? 'RISE' : 'FALL';
                const confidence = Math.floor(60 + Math.random() * 35);
                const signal: Signal = { id: idRef.current++, symbol, direction, confidence, time: new Date().toLocaleTimeString() };
                setSignals(p => [signal, ...p].slice(0, 10));
            }, 2000 + Math.random() * 1000);
        }
    };

    useEffect(() => () => { if (scanRef.current) clearInterval(scanRef.current); }, []);

    return (
        <div
            className='ai-scanner'
            style={{ left: pos.x, top: pos.y }}
        >
            <div className='ai-scanner__header' onMouseDown={onMouseDown}>
                <span className='ai-scanner__title'>🤖 AI Scanner</span>
                <div className='ai-scanner__header-actions'>
                    <button className={`ai-scanner__scan-btn ${scanning ? 'active' : ''}`} onMouseDown={e => e.stopPropagation()} onClick={toggleScan}>
                        {scanning ? '⏹' : '▶'}
                    </button>
                    <button className='ai-scanner__min-btn' onMouseDown={e => e.stopPropagation()} onClick={() => setMinimized(m => !m)}>
                        {minimized ? '▲' : '▼'}
                    </button>
                </div>
            </div>

            {!minimized && (
                <div className='ai-scanner__body'>
                    {scanning && (
                        <div className='ai-scanner__scanning'>
                            <div className='ai-scanner__pulse' />
                            <span>Scanning markets…</span>
                        </div>
                    )}
                    {signals.length === 0 && !scanning && (
                        <div className='ai-scanner__empty'>Press ▶ to start scanning</div>
                    )}
                    {signals.map(s => (
                        <div key={s.id} className={`ai-scanner__signal ${s.direction.toLowerCase()}`}>
                            <span className='ai-scanner__signal-symbol'>{s.symbol}</span>
                            <span className={`ai-scanner__signal-dir ${s.direction.toLowerCase()}`}>{s.direction === 'RISE' ? '↑' : '↓'} {s.direction}</span>
                            <span className='ai-scanner__signal-conf' style={{ color: s.confidence >= 80 ? '#22c55e' : s.confidence >= 70 ? '#f59e0b' : '#94a3b8' }}>
                                {s.confidence}%
                            </span>
                            <span className='ai-scanner__signal-time'>{s.time}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AIScanner;
