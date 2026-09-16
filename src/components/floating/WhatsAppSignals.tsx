import React, { useEffect, useRef, useState } from 'react';
import './whatsapp-signals.scss';

const WA_GROUP   = 'https://chat.whatsapp.com/EkscsxyF4j0CpuWzv0bqUw';
const SITE_LINK  = 'https://marksyntrader--marksyntrader.replit.app';
const WA_PHONE   = '0705486402';

const STORAGE_POS = 'wa_signals_pos';
const STORAGE_MIN = 'wa_signals_minimized';

interface SignalRecord {
    id: number;
    market: string;
    symbol: string;
    action: string;
    entry: string;
    bot: string;
    confidence: number;
    stake: string;
    ticks: number;
    time: string;
}

const MARKETS = [
    { label: 'V10',    symbol: 'R_10',    bots: ['Digit Differ Bot', 'Even/Odd Bot'] },
    { label: 'V25',    symbol: 'R_25',    bots: ['Digit Under Bot', 'Even/Odd Bot'] },
    { label: 'V50',    symbol: 'R_50',    bots: ['Rise/Fall Scalper', 'Digit Over Bot'] },
    { label: 'V75',    symbol: 'R_75',    bots: ['Apex Bot 2026', 'Rise/Fall Scalper'] },
    { label: 'V100',   symbol: 'R_100',   bots: ['Apex Bot 2026', 'AI Signal Bot'] },
    { label: 'Step',   symbol: 'STPRNG',  bots: ['Step Scalper', 'Even/Odd Bot'] },
    { label: 'Boom 1K',symbol: 'BOOM1000',bots: ['Boom Spike Bot', 'AI Signal Bot'] },
    { label: 'Crash 1K',symbol: 'CRASH1000', bots: ['Crash Spike Bot', 'AI Signal Bot'] },
];

const ACTIONS = ['DIGIT OVER', 'DIGIT UNDER', 'EVEN', 'ODD', 'RISE', 'FALL', 'DIGIT MATCH', 'DIGIT DIFFER'];
const ENTRIES = ['0,1,2,3', '7,8,9', '3,4,5,6,7', '0,1,2,9', '5,6,7,8,9', '0,1,2,3,4'];

function generateSignal(id: number): SignalRecord {
    const m = MARKETS[Math.floor(Math.random() * MARKETS.length)];
    const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    const entry = ENTRIES[Math.floor(Math.random() * ENTRIES.length)];
    const bot = m.bots[Math.floor(Math.random() * m.bots.length)];
    const confidence = 70 + Math.floor(Math.random() * 29);
    const stake = `$${(0.35 + Math.random() * 4.65).toFixed(2)}`;
    const ticks = [1, 2, 3, 5][Math.floor(Math.random() * 4)];
    return {
        id, market: m.label, symbol: m.symbol, action, entry, bot,
        confidence, stake, ticks, time: new Date().toLocaleTimeString(),
    };
}

function getDefaultPos() {
    try {
        const s = localStorage.getItem(STORAGE_POS);
        if (s) {
            const p = JSON.parse(s);
            if (typeof p.x === 'number' && typeof p.y === 'number') return p;
        }
    } catch { /* ignore */ }
    return { x: typeof window !== 'undefined' ? window.innerWidth / 2 - 165 : 200, y: 80 };
}

const WhatsAppSignals: React.FC = () => {
    const [minimized, setMinimized] = useState(() => {
        try { return localStorage.getItem(STORAGE_MIN) === '1'; } catch { return false; }
    });
    const [pos, setPos] = useState(getDefaultPos);
    const [signals, setSignals] = useState<SignalRecord[]>([generateSignal(1)]);
    const [countdown, setCountdown] = useState(30);
    const [flash, setFlash] = useState(false);
    const dragging = useRef(false);
    const offset = useRef({ x: 0, y: 0 });
    const didDrag = useRef(false);
    const counterRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const idRef = useRef(2);

    /* drag */
    const onPointerDown = (e: React.PointerEvent) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragging.current = true;
        didDrag.current = false;
        offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!dragging.current) return;
        didDrag.current = true;
        const x = Math.max(0, Math.min(window.innerWidth - 20, e.clientX - offset.current.x));
        const y = Math.max(0, Math.min(window.innerHeight - 20, e.clientY - offset.current.y));
        setPos({ x, y });
    };
    const onPointerUp = (e: React.PointerEvent) => {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        if (dragging.current) {
            dragging.current = false;
            setPos(p => {
                try { localStorage.setItem(STORAGE_POS, JSON.stringify(p)); } catch { /* */ }
                return p;
            });
        }
    };

    /* Signal auto-refresh every 30 s */
    useEffect(() => {
        const refresh = () => {
            setSignals(prev => {
                const next = [generateSignal(idRef.current++), ...prev].slice(0, 5);
                return next;
            });
            setFlash(true);
            setTimeout(() => setFlash(false), 900);
            setCountdown(30);
        };

        counterRef.current = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) { refresh(); return 30; }
                return c - 1;
            });
        }, 1000);

        return () => { if (counterRef.current) clearInterval(counterRef.current); };
    }, []);

    const toggleMin = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (didDrag.current) return;
        setMinimized(m => {
            try { localStorage.setItem(STORAGE_MIN, m ? '0' : '1'); } catch { /* */ }
            return !m;
        });
    };

    const latest = signals[0];
    const confColor = latest.confidence >= 85 ? '#22c55e' : latest.confidence >= 75 ? '#f59e0b' : '#f87171';

    return (
        <div
            className={`wa-sig${minimized ? ' wa-sig--min' : ''}${flash ? ' wa-sig--flash' : ''}`}
            style={{ left: pos.x, top: pos.y }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            {/* Header */}
            <div className='wa-sig__hdr' onClick={toggleMin}>
                <span className='wa-sig__hdr-left'>
                    <svg viewBox='0 0 32 32' fill='none' className='wa-sig__wa-icon'>
                        <circle cx='16' cy='16' r='16' fill='#25D366' />
                        <path d='M23.5 8.5C21.7 6.7 19.3 5.7 16.7 5.7C11.4 5.7 7 10.1 7 15.4C7 17.1 7.5 18.8 8.3 20.2L7 25L12 23.7C13.4 24.5 14.9 24.9 16.5 24.9H16.6C21.9 24.9 26.3 20.5 26.3 15.2C26.3 12.6 25.3 10.3 23.5 8.5ZM16.6 23.2C15.2 23.2 13.8 22.8 12.6 22.1L12.3 21.9L9.2 22.7L10 19.7L9.8 19.4C9 18.1 8.6 16.8 8.6 15.4C8.6 11 12.2 7.4 16.6 7.4C18.7 7.4 20.7 8.2 22.2 9.7C23.7 11.2 24.5 13.2 24.5 15.3C24.6 19.7 21 23.2 16.6 23.2ZM21 17.5C20.8 17.4 19.6 16.8 19.4 16.7C19.2 16.6 19 16.6 18.9 16.8C18.7 17 18.2 17.6 18.1 17.8C17.9 18 17.8 18 17.6 17.9C16.8 17.5 16.1 17 15.5 16.4C15 15.8 14.5 15.2 14.2 14.5C14.1 14.3 14.2 14.1 14.3 14C14.4 13.9 14.6 13.7 14.7 13.6C14.8 13.5 14.9 13.3 14.9 13.2C15 13.1 14.9 12.9 14.9 12.8C14.8 12.7 14.3 11.5 14.1 11C13.9 10.5 13.7 10.6 13.6 10.6H13.2C13 10.6 12.8 10.7 12.6 10.9C12.4 11.1 11.8 11.7 11.8 12.9C11.8 14.1 12.7 15.2 12.8 15.4C12.9 15.5 14.3 17.7 16.5 18.8C17 19 17.4 19.2 17.8 19.4C18.3 19.6 18.8 19.6 19.2 19.5C19.6 19.4 20.7 18.8 20.9 18.2C21.1 17.6 21.1 17.1 21 17.5Z' fill='white' />
                    </svg>
                    <span className='wa-sig__hdr-title'>📡 Live Signals</span>
                    <span className='wa-sig__live-dot' />
                </span>
                <span className='wa-sig__hdr-right'>
                    <span className='wa-sig__countdown'>{countdown}s</span>
                    <span className='wa-sig__toggle'>{minimized ? '▲' : '▼'}</span>
                </span>
            </div>

            {!minimized && (
                <div className='wa-sig__body' onPointerDown={e => e.stopPropagation()}>
                    {/* Latest signal card */}
                    <div className='wa-sig__card'>
                        <div className='wa-sig__card-top'>
                            <span className='wa-sig__market'>{latest.market}</span>
                            <span className='wa-sig__action'>{latest.action}</span>
                            <span className='wa-sig__conf' style={{ color: confColor }}>
                                {latest.confidence}%
                            </span>
                        </div>
                        <div className='wa-sig__card-row'>
                            <span className='wa-sig__label'>Entry Digits:</span>
                            <span className='wa-sig__val'>{latest.entry}</span>
                        </div>
                        <div className='wa-sig__card-row'>
                            <span className='wa-sig__label'>Bot to Use:</span>
                            <span className='wa-sig__val wa-sig__val--bot'>{latest.bot}</span>
                        </div>
                        <div className='wa-sig__card-row'>
                            <span className='wa-sig__label'>Stake / Ticks:</span>
                            <span className='wa-sig__val'>{latest.stake} · {latest.ticks}T</span>
                        </div>
                        <div className='wa-sig__card-row'>
                            <span className='wa-sig__label'>Time:</span>
                            <span className='wa-sig__val wa-sig__val--time'>{latest.time}</span>
                        </div>
                    </div>

                    {/* Signal history */}
                    {signals.length > 1 && (
                        <div className='wa-sig__history'>
                            {signals.slice(1).map(s => (
                                <div key={s.id} className='wa-sig__hist-row'>
                                    <span className='wa-sig__hist-market'>{s.market}</span>
                                    <span className='wa-sig__hist-action'>{s.action}</span>
                                    <span className='wa-sig__hist-conf'>{s.confidence}%</span>
                                    <span className='wa-sig__hist-time'>{s.time}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Links */}
                    <div className='wa-sig__links'>
                        <a className='wa-sig__link wa-sig__link--green' href={WA_GROUP} target='_blank' rel='noreferrer'>
                            <svg viewBox='0 0 32 32' fill='none' style={{ width: 14, height: 14, flexShrink: 0 }}>
                                <circle cx='16' cy='16' r='16' fill='#25D366' />
                                <path d='M23.5 8.5C21.7 6.7 19.3 5.7 16.7 5.7C11.4 5.7 7 10.1 7 15.4C7 17.1 7.5 18.8 8.3 20.2L7 25L12 23.7C13.4 24.5 14.9 24.9 16.5 24.9H16.6C21.9 24.9 26.3 20.5 26.3 15.2C26.3 12.6 25.3 10.3 23.5 8.5ZM16.6 23.2C15.2 23.2 13.8 22.8 12.6 22.1L12.3 21.9L9.2 22.7L10 19.7L9.8 19.4C9 18.1 8.6 16.8 8.6 15.4C8.6 11 12.2 7.4 16.6 7.4C18.7 7.4 20.7 8.2 22.2 9.7C23.7 11.2 24.5 13.2 24.5 15.3C24.6 19.7 21 23.2 16.6 23.2Z' fill='white' />
                            </svg>
                            Join WA Group
                        </a>
                        <a className='wa-sig__link wa-sig__link--blue' href={SITE_LINK} target='_blank' rel='noreferrer'>
                            🌐 Open Platform
                        </a>
                    </div>
                    <p className='wa-sig__phone'>📞 {WA_PHONE}</p>
                    <p className='wa-sig__note'>⚠ Signals are indicative. Trade at your own risk.</p>
                </div>
            )}
        </div>
    );
};

export default WhatsAppSignals;
