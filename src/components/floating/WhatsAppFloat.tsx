// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import './whatsapp-float.scss';

/* ─── Constants ─── */
const WA_GROUP   = 'https://chat.whatsapp.com/EkscsxyF4j0CpuWzv0bqUw';
const WA_PHONE   = '0705486402';
const SITE_LINK  = 'https://marksyntrader--marksyntrader.replit.app';

const SK_POS     = 'wa_float_pos';
const SK_OPEN    = 'wa_float_open';
const SK_PAIR    = 'wa_float_pair';
const SK_MIN     = 'wa_float_min';

const MARKETS = [
    { label: 'V10',     symbol: 'R_10',      bots: ['Digit Differ Bot', 'Even/Odd Bot'] },
    { label: 'V25',     symbol: 'R_25',      bots: ['Digit Under Bot', 'Even/Odd Bot'] },
    { label: 'V50',     symbol: 'R_50',      bots: ['Rise/Fall Scalper', 'Digit Over Bot'] },
    { label: 'V75',     symbol: 'R_75',      bots: ['Apex Bot 2026', 'Rise/Fall Scalper'] },
    { label: 'V100',    symbol: 'R_100',     bots: ['Apex Bot 2026', 'AI Signal Bot'] },
    { label: 'Step',    symbol: 'STPRNG',    bots: ['Step Scalper', 'Even/Odd Bot'] },
    { label: 'Boom 1K', symbol: 'BOOM1000',  bots: ['Boom Spike Bot', 'AI Signal Bot'] },
    { label: 'Crash 1K',symbol: 'CRASH1000', bots: ['Crash Spike Bot', 'AI Signal Bot'] },
];
const ACTIONS = ['DIGIT OVER', 'DIGIT UNDER', 'EVEN', 'ODD', 'RISE', 'FALL', 'DIGIT MATCH', 'DIGIT DIFFER'];
const ENTRIES = ['0,1,2,3', '7,8,9', '3,4,5,6,7', '0,1,2,9', '5,6,7,8,9', '0,1,2,3,4'];

interface SignalRecord {
    id: number; market: string; symbol: string; action: string;
    entry: string; bot: string; confidence: number; stake: string;
    ticks: number; time: string; fromScalper?: boolean;
}

let _sigSeq = 1;
function generateSignal(id: number): SignalRecord {
    const m = MARKETS[Math.floor(Math.random() * MARKETS.length)];
    const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    const entry = ENTRIES[Math.floor(Math.random() * ENTRIES.length)];
    const bot = m.bots[Math.floor(Math.random() * m.bots.length)];
    const confidence = 70 + Math.floor(Math.random() * 29);
    const stake = `$${(0.35 + Math.random() * 4.65).toFixed(2)}`;
    const ticks = [1, 2, 3, 5][Math.floor(Math.random() * 4)];
    return { id, market: m.label, symbol: m.symbol, action, entry, bot, confidence, stake, ticks, time: new Date().toLocaleTimeString() };
}

function ls<T>(key: string, fallback: T): T {
    try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key: string, val: any) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

function getDefaultPos() {
    const saved = ls<null>(SK_POS, null);
    if (saved && typeof saved.x === 'number') return saved;
    return { x: 20, y: 100 };
}

/* ─── CallMeBot helpers ─── */
async function callMeBotSend(phone: string, apiKey: string, text: string) {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apiKey)}`;
    try { await fetch(url, { mode: 'no-cors' }); } catch { /* best-effort */ }
}

function formatSignalText(s: SignalRecord): string {
    return `📡 MARKSYNTRADER SIGNAL\n🎯 ${s.action}\n📊 Market: ${s.market}\n💰 ${s.stake} · ${s.ticks}T\n🤖 ${s.bot}\n✅ Confidence: ${s.confidence}%\n⏰ ${s.time}\n⚠️ Trade at your own risk.`;
}

/* ─── WhatsApp SVG ─── */
const WaSvg = ({ size = 22 }) => (
    <svg viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ width: size, height: size, flexShrink: 0 }}>
        <circle cx='16' cy='16' r='16' fill='#25D366'/>
        <path d='M23.5 8.5C21.7 6.7 19.3 5.7 16.7 5.7C11.4 5.7 7 10.1 7 15.4C7 17.1 7.5 18.8 8.3 20.2L7 25L12 23.7C13.4 24.5 14.9 24.9 16.5 24.9H16.6C21.9 24.9 26.3 20.5 26.3 15.2C26.3 12.6 25.3 10.3 23.5 8.5ZM16.6 23.2C15.2 23.2 13.8 22.8 12.6 22.1L12.3 21.9L9.2 22.7L10 19.7L9.8 19.4C9 18.1 8.6 16.8 8.6 15.4C8.6 11 12.2 7.4 16.6 7.4C18.7 7.4 20.7 8.2 22.2 9.7C23.7 11.2 24.5 13.2 24.5 15.3C24.6 19.7 21 23.2 16.6 23.2ZM21 17.5C20.8 17.4 19.6 16.8 19.4 16.7C19.2 16.6 19 16.6 18.9 16.8C18.7 17 18.2 17.6 18.1 17.8C17.9 18 17.8 18 17.6 17.9C16.8 17.5 16.1 17 15.5 16.4C15 15.8 14.5 15.2 14.2 14.5C14.1 14.3 14.2 14.1 14.3 14C14.4 13.9 14.6 13.7 14.7 13.6C14.8 13.5 14.9 13.3 14.9 13.2C15 13.1 14.9 12.9 14.9 12.8C14.8 12.7 14.3 11.5 14.1 11C13.9 10.5 13.7 10.6 13.6 10.6H13.2C13 10.6 12.8 10.7 12.6 10.9C12.4 11.1 11.8 11.7 11.8 12.9C11.8 14.1 12.7 15.2 12.8 15.4C12.9 15.5 14.3 17.7 16.5 18.8C17 19 17.4 19.2 17.8 19.4C18.3 19.6 18.8 19.6 19.2 19.5C19.6 19.4 20.7 18.8 20.9 18.2C21.1 17.6 21.1 17.1 21 17.5Z' fill='white'/>
    </svg>
);

/* ─── Main Component ─── */
const WhatsAppFloat: React.FC = () => {
    const [pos, setPos]             = useState(getDefaultPos);
    const [open, setOpen]           = useState(() => ls(SK_OPEN, false));
    const [tab, setTab]             = useState<'signals' | 'pair'>('signals');
    const [minimized, setMinimized] = useState(() => ls(SK_MIN, false));
    const [flash, setFlash]         = useState(false);
    const [signals, setSignals]     = useState<SignalRecord[]>([generateSignal(_sigSeq++)]);
    const [countdown, setCountdown] = useState(30);

    /* pairing state */
    const [paired, setPaired]       = useState(() => ls(SK_PAIR, { phone: '', apiKey: '', enabled: false }));
    const [pairPhone, setPairPhone] = useState(paired.phone);
    const [pairKey, setPairKey]     = useState(paired.apiKey);
    const [pairEnabled, setPairEnabled] = useState(paired.enabled);
    const [testStatus, setTestStatus] = useState('');

    const dragging = useRef(false);
    const offset   = useRef({ x: 0, y: 0 });
    const didDrag  = useRef(false);
    const idRef    = useRef(_sigSeq);
    const counterRef = useRef<any>(null);

    /* ─── Pointer drag ─── */
    const onPointerDown = (e: React.PointerEvent) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragging.current = true;
        didDrag.current  = false;
        offset.current   = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!dragging.current) return;
        didDrag.current = true;
        const x = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - offset.current.x));
        const y = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - offset.current.y));
        setPos({ x, y });
    };
    const onPointerUp = (e: React.PointerEvent) => {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        if (dragging.current) {
            dragging.current = false;
            setPos(p => { lsSet(SK_POS, p); return p; });
        }
    };
    const handleFabClick = () => {
        if (didDrag.current) return;
        setOpen(v => { lsSet(SK_OPEN, !v); return !v; });
    };

    /* ─── Signal auto-refresh ─── */
    useEffect(() => {
        const refresh = () => {
            setSignals(prev => {
                const sig = generateSignal(idRef.current++);
                const next = [sig, ...prev].slice(0, 6);
                /* auto-send via CallMeBot if paired + enabled */
                const p = ls<any>(SK_PAIR, { phone: '', apiKey: '', enabled: false });
                if (p.enabled && p.phone && p.apiKey) {
                    callMeBotSend(p.phone, p.apiKey, formatSignalText(sig));
                }
                return next;
            });
            setFlash(true);
            setTimeout(() => setFlash(false), 900);
            setCountdown(30);
        };
        counterRef.current = setInterval(() => {
            setCountdown(c => { if (c <= 1) { refresh(); return 30; } return c - 1; });
        }, 1000);
        return () => clearInterval(counterRef.current);
    }, []);

    /* ─── Listen for scalper live signals ─── */
    useEffect(() => {
        const handler = (e: any) => {
            const d = e.detail as { market: string; action: string; stake: string; ticks: number; confidence?: number };
            if (!d) return;
            const sig: SignalRecord = {
                id: idRef.current++, market: d.market, symbol: d.market,
                action: d.action, entry: '—', bot: 'Scalper Terminal',
                confidence: d.confidence ?? 85, stake: d.stake,
                ticks: d.ticks, time: new Date().toLocaleTimeString(), fromScalper: true,
            };
            setSignals(prev => [sig, ...prev].slice(0, 6));
            setFlash(true);
            setTimeout(() => setFlash(false), 900);
            setCountdown(30);
            /* auto-send via CallMeBot */
            const p = ls<any>(SK_PAIR, { phone: '', apiKey: '', enabled: false });
            if (p.enabled && p.phone && p.apiKey) {
                callMeBotSend(p.phone, p.apiKey, formatSignalText(sig));
            }
        };
        window.addEventListener('wa:signal', handler);
        return () => window.removeEventListener('wa:signal', handler);
    }, []);

    const savePairing = () => {
        const cfg = { phone: pairPhone, apiKey: pairKey, enabled: pairEnabled };
        lsSet(SK_PAIR, cfg);
        setPaired(cfg);
        setTestStatus('✅ Saved!');
        setTimeout(() => setTestStatus(''), 2000);
    };
    const testSend = async () => {
        if (!pairPhone || !pairKey) { setTestStatus('❌ Enter phone + API key first'); return; }
        setTestStatus('⏳ Sending test...');
        await callMeBotSend(pairPhone, pairKey, '🧪 Test from Marksyntrader — WhatsApp pairing is working!');
        setTestStatus('✅ Test sent! Check WhatsApp.');
        setTimeout(() => setTestStatus(''), 4000);
    };

    const latest = signals[0];
    const confColor = latest.confidence >= 85 ? '#22c55e' : latest.confidence >= 75 ? '#f59e0b' : '#f87171';

    /* popup position — to the right if enough space, else left */
    const panelLeft = pos.x + 70;
    const panelRight = pos.x - 340;
    const usePanelRight = panelLeft + 330 > window.innerWidth - 10;
    const panelX = usePanelRight ? panelRight : panelLeft;

    return (
        <>
            {/* ─── Circular FAB ─── */}
            <div
                className={`wa-float-fab${flash ? ' flash' : ''}`}
                style={{ left: pos.x, top: pos.y }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onClick={handleFabClick}
                title='Live Signals & WhatsApp'
            >
                <WaSvg size={28} />
                <span className='wa-float-fab__pulse' />
                {open && <span className='wa-float-fab__live'>●</span>}
            </div>

            {/* ─── Signal popup panel ─── */}
            {open && (
                <div
                    className={`wa-float-panel${minimized ? ' minimized' : ''}${flash ? ' flash' : ''}`}
                    style={{ left: Math.max(4, panelX), top: Math.max(4, pos.y - 10) }}
                >
                    {/* Header */}
                    <div className='wa-float-panel__hdr'>
                        <div className='wa-float-panel__hdr-left'>
                            <WaSvg size={18} />
                            <span className='wa-float-panel__title'>📡 Live Signals</span>
                            <span className='wa-float-panel__dot' />
                        </div>
                        <div className='wa-float-panel__hdr-right'>
                            <span className='wa-float-panel__cd'>{countdown}s</span>
                            <button className='wa-float-panel__min' onClick={() => setMinimized(v => { lsSet(SK_MIN, !v); return !v; })}>
                                {minimized ? '▲' : '▼'}
                            </button>
                            <button className='wa-float-panel__close' onClick={() => { setOpen(false); lsSet(SK_OPEN, false); }}>✕</button>
                        </div>
                    </div>

                    {!minimized && (
                        <>
                            {/* Tab bar */}
                            <div className='wa-float-tabs'>
                                <button className={`wa-float-tabs__btn${tab === 'signals' ? ' active' : ''}`} onClick={() => setTab('signals')}>📡 Signals</button>
                                <button className={`wa-float-tabs__btn${tab === 'pair' ? ' active' : ''}`} onClick={() => setTab('pair')}>🔗 Pair WA</button>
                            </div>

                            {/* Signals tab */}
                            {tab === 'signals' && (
                                <div className='wa-float-body'>
                                    <div className='wa-float-card'>
                                        <div className='wa-float-card__top'>
                                            <span className='wa-float-card__market'>{latest.market}</span>
                                            <span className='wa-float-card__action'>{latest.action}</span>
                                            <span className='wa-float-card__conf' style={{ color: confColor }}>{latest.confidence}%</span>
                                            {latest.fromScalper && <span className='wa-float-card__live-badge'>LIVE</span>}
                                        </div>
                                        <div className='wa-float-row'><span className='wa-float-lbl'>Entry:</span><span className='wa-float-val'>{latest.entry}</span></div>
                                        <div className='wa-float-row'><span className='wa-float-lbl'>Bot:</span><span className='wa-float-val bot'>{latest.bot}</span></div>
                                        <div className='wa-float-row'><span className='wa-float-lbl'>Stake/Ticks:</span><span className='wa-float-val'>{latest.stake} · {latest.ticks}T</span></div>
                                        <div className='wa-float-row'><span className='wa-float-lbl'>Time:</span><span className='wa-float-val dim'>{latest.time}</span></div>
                                    </div>

                                    {signals.length > 1 && (
                                        <div className='wa-float-history'>
                                            {signals.slice(1).map(s => (
                                                <div key={s.id} className='wa-float-hist-row'>
                                                    <span className='wa-float-hist-mkt'>{s.market}</span>
                                                    <span className='wa-float-hist-act'>{s.action}</span>
                                                    <span className='wa-float-hist-conf'>{s.confidence}%</span>
                                                    <span className='wa-float-hist-time'>{s.time}</span>
                                                    {s.fromScalper && <span className='wa-float-hist-live'>LIVE</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className='wa-float-links'>
                                        <a className='wa-float-link green' href={WA_GROUP} target='_blank' rel='noreferrer'>
                                            <WaSvg size={13} /> Join WA Group
                                        </a>
                                        <a className='wa-float-link blue' href={SITE_LINK} target='_blank' rel='noreferrer'>
                                            🌐 Open Platform
                                        </a>
                                    </div>
                                    <p className='wa-float-phone'>📞 {WA_PHONE}</p>
                                    <p className='wa-float-note'>⚠ Signals are indicative. Trade at your own risk.</p>
                                </div>
                            )}

                            {/* Pair WA tab */}
                            {tab === 'pair' && (
                                <div className='wa-float-body wa-float-pair'>
                                    <div className='wa-float-pair__intro'>
                                        <p>Send live scalper signals directly to your WhatsApp using <strong>CallMeBot</strong> (free).</p>
                                        <ol>
                                            <li>Add <strong>+34 644 59 22 46</strong> to your WA contacts.</li>
                                            <li>Send: <code>I allow callmebot to send me messages</code></li>
                                            <li>You'll receive an API key — paste it below.</li>
                                        </ol>
                                    </div>
                                    <div className='wa-float-pair__field'>
                                        <label>Your WhatsApp Phone (with country code)</label>
                                        <input type='text' placeholder='+254712345678' value={pairPhone} onChange={e => setPairPhone(e.target.value)} />
                                    </div>
                                    <div className='wa-float-pair__field'>
                                        <label>CallMeBot API Key</label>
                                        <input type='text' placeholder='e.g. 1234567' value={pairKey} onChange={e => setPairKey(e.target.value)} />
                                    </div>
                                    <div className='wa-float-pair__toggle-row'>
                                        <label>Auto-send signals</label>
                                        <button className={`wa-float-pair__toggle ${pairEnabled ? 'on' : 'off'}`} onClick={() => setPairEnabled(v => !v)}>
                                            {pairEnabled ? 'ON' : 'OFF'}
                                        </button>
                                    </div>
                                    <div className='wa-float-pair__btns'>
                                        <button className='wa-float-pair__save' onClick={savePairing}>💾 Save Pairing</button>
                                        <button className='wa-float-pair__test' onClick={testSend}>📲 Test Send</button>
                                    </div>
                                    {testStatus && <p className='wa-float-pair__status'>{testStatus}</p>}
                                    {paired.enabled && paired.phone && (
                                        <p className='wa-float-pair__active'>✅ Active — sending signals to {paired.phone}</p>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </>
    );
};

export default WhatsAppFloat;
