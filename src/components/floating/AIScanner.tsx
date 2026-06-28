import React, { useEffect, useRef, useState } from 'react';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import './ai-scanner.scss';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import ahmedBotXml from './ahmed-syn-bot.xml';

const SCAN_SYMBOLS = [
    { label: 'V10',    symbol: 'R_10'     },
    { label: 'V25',    symbol: 'R_25'     },
    { label: 'V50',    symbol: 'R_50'     },
    { label: 'V75',    symbol: 'R_75'     },
    { label: 'V100',   symbol: 'R_100'    },
    { label: 'V10 1s', symbol: '1HZ10V'   },
    { label: 'V25 1s', symbol: '1HZ25V'   },
    { label: 'V50 1s', symbol: '1HZ50V'   },
    { label: 'V100 1s',symbol: '1HZ100V'  },
];

interface DigitFreq {
    symbol: string;
    label: string;
    pcts: number[];
    ticks: number[];
    total: number;
}

interface Signal {
    id: number;
    symbol: string;
    label: string;
    type: 'OVER' | 'UNDER' | 'EVEN' | 'ODD';
    barrier?: number;
    confidence: 'EXCELLENT' | 'STRONG' | 'GOOD';
    ticks: number;
    entryDigits: number[];
    shieldDigit?: number;
    shieldPct?: number;
    time: string;
    isAhmedBotSignal: boolean;
}

function analyzePDF(freq: DigitFreq): Signal | null {
    const { pcts, label, symbol } = freq;
    const is1s = symbol.includes('HZ');

    // Under market analysis
    for (let barrier = 9; barrier >= 5; barrier--) {
        const digitsBelow = Array.from({ length: barrier + 1 }, (_, i) => i + (9 - barrier));
        const allBelow = digitsBelow.every(d => pcts[d] < 10.0);
        if (!allBelow) continue;

        const shieldDigit = barrier - 1;
        const shieldPct = shieldDigit >= 0 ? pcts[shieldDigit] : 0;
        if (shieldPct < 10.3) continue;

        let confidence: Signal['confidence'];
        if (shieldPct > 10.6) confidence = 'EXCELLENT';
        else if (shieldPct >= 10.3) confidence = 'STRONG';
        else confidence = 'GOOD';

        const entrys = [9, 0, 1, 6, 2];
        const numTicks = is1s ? 2 : 1;
        const isAhmedBot = (barrier === 9 || barrier === 5);

        return {
            id: Date.now() + Math.random(),
            symbol, label,
            type: 'UNDER', barrier,
            confidence, ticks: numTicks,
            entryDigits: entrys,
            shieldDigit, shieldPct,
            time: new Date().toLocaleTimeString(),
            isAhmedBotSignal: isAhmedBot,
        };
    }

    // Over market analysis
    for (let barrier = 0; barrier <= 7; barrier++) {
        const digitsBelow = Array.from({ length: barrier + 1 }, (_, i) => i);
        const allBelow = digitsBelow.every(d => pcts[d] < 10.0);
        if (!allBelow) continue;

        const shieldDigit = barrier + 1;
        const shieldPct = shieldDigit <= 9 ? pcts[shieldDigit] : 0;
        if (shieldPct < 10.3) continue;

        let confidence: Signal['confidence'];
        if (shieldPct > 10.6) confidence = 'EXCELLENT';
        else if (shieldPct >= 10.3) confidence = 'STRONG';
        else confidence = 'GOOD';

        const numTicks = barrier === 0 && !is1s ? 1 : 2;
        const isAhmedBot = false;

        return {
            id: Date.now() + Math.random(),
            symbol, label,
            type: 'OVER', barrier,
            confidence, ticks: numTicks,
            entryDigits: [3, 4, 1, 0, 9],
            shieldDigit, shieldPct,
            time: new Date().toLocaleTimeString(),
            isAhmedBotSignal: isAhmedBot,
        };
    }

    // Even/Odd skew
    const evenPct = [0,2,4,6,8].reduce((s,d) => s + pcts[d], 0);
    if (evenPct > 55) return { id: Date.now() + Math.random(), symbol, label, type: 'ODD', confidence: 'GOOD', ticks: 1, entryDigits: [], time: new Date().toLocaleTimeString(), isAhmedBotSignal: true };
    if (evenPct < 45) return { id: Date.now() + Math.random(), symbol, label, type: 'EVEN', confidence: 'GOOD', ticks: 1, entryDigits: [], time: new Date().toLocaleTimeString(), isAhmedBotSignal: true };

    return null;
}

interface AhmedBotPopup {
    signal: Signal;
}

const AIScanner: React.FC = () => {
    const { dashboard } = useStore();
    const [signals, setSignals] = useState<Signal[]>([]);
    const [scanning, setScanning] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [pos, setPos] = useState({ x: 20, y: 120 });
    const [ahmedPopup, setAhmedPopup] = useState<AhmedBotPopup | null>(null);
    const dragging = useRef(false);
    const offset = useRef({ x: 0, y: 0 });
    const wsRefs = useRef<WebSocket[]>([]);
    const freqRef = useRef<Map<string, DigitFreq>>(new Map());

    const onMouseDown = (e: React.MouseEvent) => {
        dragging.current = true;
        offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    };

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragging.current) return;
            const newX = Math.max(0, Math.min(window.innerWidth - 270, e.clientX - offset.current.x));
            const newY = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - offset.current.y));
            setPos({ x: newX, y: newY });
        };
        const onUp = () => { dragging.current = false; };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, []);

    const startScan = () => {
        setScanning(true);
        SCAN_SYMBOLS.forEach(({ symbol, label }) => {
            freqRef.current.set(symbol, { symbol, label, pcts: new Array(10).fill(10), ticks: [], total: 0 });
            const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
            wsRefs.current.push(ws);
            ws.onopen = () => {
                ws.send(JSON.stringify({ ticks_history: symbol, count: 500, end: 'latest', style: 'ticks' }));
                ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
            };
            ws.onmessage = (e) => {
                const d = JSON.parse(e.data);
                const freq = freqRef.current.get(symbol);
                if (!freq) return;

                if (d.history?.prices) {
                    const prices = d.history.prices;
                    const counts = new Array(10).fill(0);
                    prices.forEach((p: number) => {
                        const s = p.toFixed(2).replace('.','');
                        counts[parseInt(s[s.length-1], 10)]++;
                    });
                    freq.pcts = counts.map(c => (c / prices.length) * 100);
                    freq.total = prices.length;
                }

                if (d.tick) {
                    const q = d.tick.quote;
                    const s = q.toFixed(2).replace('.','');
                    const digit = parseInt(s[s.length-1], 10);
                    freq.ticks = [...freq.ticks.slice(-499), digit];
                    freq.total = freq.ticks.length;
                    const counts = new Array(10).fill(0);
                    freq.ticks.forEach(t => counts[t]++);
                    freq.pcts = counts.map(c => freq.total > 0 ? (c / freq.total) * 100 : 10);

                    if (freq.total > 50 && freq.total % 20 === 0) {
                        const sig = analyzePDF(freq);
                        if (sig && sig.confidence !== 'GOOD') {
                            setSignals(prev => {
                                const dedup = prev.filter(p => p.symbol !== symbol || p.type !== sig.type);
                                const newSig = { ...sig, id: Date.now() + Math.random() };
                                if (newSig.isAhmedBotSignal && (newSig.confidence === 'EXCELLENT' || newSig.confidence === 'STRONG')) {
                                    setAhmedPopup({ signal: newSig });
                                }
                                return [newSig, ...dedup].slice(0, 15);
                            });
                        }
                    }
                }
            };
        });
    };

    const stopScan = () => {
        wsRefs.current.forEach(ws => ws.close());
        wsRefs.current = [];
        setScanning(false);
    };

    const toggleScan = () => {
        if (scanning) stopScan();
        else startScan();
    };

    useEffect(() => () => stopScan(), []);

    const loadAhmedBot = () => {
        if (ahmedPopup && window.Blockly?.derivWorkspace && ahmedBotXml) {
            try {
                const xmlDom = window.Blockly.Xml.textToDom(ahmedBotXml);
                window.Blockly.Xml.clearWorkspaceAndLoadFromXml(xmlDom, window.Blockly.derivWorkspace);
            } catch { /* workspace not ready */ }
        }
        dashboard.setActiveTab(DBOT_TABS.FREE_BOTS);
        setAhmedPopup(null);
    };

    const confColor = (c: string) => ({ EXCELLENT: '#22c55e', STRONG: '#f59e0b', GOOD: '#94a3b8' })[c] || '#94a3b8';
    const typeColor = (t: string) => ({ OVER: '#06b6d4', UNDER: '#f87171', EVEN: '#8b5cf6', ODD: '#ec4899' })[t] || '#94a3b8';

    return (
        <>
            <div className='ai-scanner' style={{ left: pos.x, top: pos.y }}>
                <div className='ai-scanner__header' onMouseDown={onMouseDown}>
                    <div className='ai-scanner__header-left'>
                        <span className='ai-scanner__icon'>🤖</span>
                        <span className='ai-scanner__title'>AI Scanner</span>
                        {scanning && <span className='ai-scanner__live-badge'>LIVE</span>}
                    </div>
                    <div className='ai-scanner__header-actions'>
                        <button className={`ai-scanner__scan-btn ${scanning ? 'active' : ''}`}
                            onMouseDown={e => e.stopPropagation()} onClick={toggleScan}>
                            {scanning ? '⏹' : '▶'}
                        </button>
                        <button className='ai-scanner__min-btn'
                            onMouseDown={e => e.stopPropagation()} onClick={() => setMinimized(m => !m)}>
                            {minimized ? '▲' : '▼'}
                        </button>
                    </div>
                </div>

                {!minimized && (
                    <div className='ai-scanner__body'>
                        {scanning && signals.length === 0 && (
                            <div className='ai-scanner__scanning'>
                                <div className='ai-scanner__pulse' />
                                <span>Scanning {SCAN_SYMBOLS.length} markets…</span>
                            </div>
                        )}

                        {!scanning && signals.length === 0 && (
                            <div className='ai-scanner__empty'>
                                <p>Press ▶ to scan using PDF rules</p>
                                <p className='ai-scanner__empty-sub'>Analyzes Over/Under, Even/Odd setups</p>
                            </div>
                        )}

                        {signals.map(s => (
                            <div key={s.id}
                                className='ai-scanner__signal'
                                style={{ borderLeftColor: typeColor(s.type) }}>
                                <div className='ai-scanner__signal-top'>
                                    <span className='ai-scanner__signal-label'>{s.label}</span>
                                    <span className='ai-scanner__signal-type' style={{ color: typeColor(s.type) }}>
                                        {s.type}{s.barrier !== undefined ? ` ${s.barrier}` : ''}
                                    </span>
                                    <span className='ai-scanner__signal-conf' style={{ color: confColor(s.confidence) }}>
                                        {s.confidence}
                                    </span>
                                </div>
                                <div className='ai-scanner__signal-bottom'>
                                    {s.shieldDigit !== undefined && (
                                        <span className='ai-scanner__shield'>🛡 D{s.shieldDigit}: {s.shieldPct?.toFixed(1)}%</span>
                                    )}
                                    <span className='ai-scanner__ticks'>{s.ticks}T</span>
                                    <span className='ai-scanner__time'>{s.time}</span>
                                    {s.isAhmedBotSignal && (
                                        <button className='ai-scanner__ahmed-btn'
                                            onClick={() => setAhmedPopup({ signal: s })}>
                                            🤖 Ahmed Bot
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Ahmed Bot Popup */}
            {ahmedPopup && (
                <div className='ai-scanner__ahmed-popup'>
                    <div className='ai-scanner__ahmed-popup-inner'>
                        <div className='ai-scanner__ahmed-popup-header'>
                            <span>🤖 Ahmed SYN Signal Detected</span>
                            <button onClick={() => setAhmedPopup(null)}>✕</button>
                        </div>
                        <div className='ai-scanner__ahmed-popup-body'>
                            <p><strong>{ahmedPopup.signal.label}</strong> — {ahmedPopup.signal.type}{ahmedPopup.signal.barrier !== undefined ? ` ${ahmedPopup.signal.barrier}` : ''}</p>
                            <p>Confidence: <span style={{ color: confColor(ahmedPopup.signal.confidence) }}>{ahmedPopup.signal.confidence}</span></p>
                            {ahmedPopup.signal.shieldDigit !== undefined && (
                                <p>Shield digit {ahmedPopup.signal.shieldDigit}: {ahmedPopup.signal.shieldPct?.toFixed(1)}%</p>
                            )}
                            <p className='ai-scanner__ahmed-bot-name'>Ahmed SYN Even/Odd Market Killer v1.2</p>
                            <p className='ai-scanner__ahmed-bot-settings'>
                                V25 1s · Even/Odd · 1T · Stake $0.50 · Martingale 2.2x · TP $2 · SL $1000
                            </p>
                        </div>
                        <div className='ai-scanner__ahmed-popup-actions'>
                            <button className='ai-scanner__ahmed-load-btn' onClick={loadAhmedBot}>
                                📂 Load &amp; Run Ahmed Bot
                            </button>
                            <button className='ai-scanner__ahmed-dismiss-btn' onClick={() => setAhmedPopup(null)}>
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIScanner;
