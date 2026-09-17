// @ts-nocheck
import React, { useEffect, useRef, useState, useCallback } from 'react';
import './whatsapp-float.scss';

/* ─── Constants ─── */
const WA_GROUP_LINK = 'https://chat.whatsapp.com/EkscsxyF4j0CpuWzv0bqUw';
const WA_ADMIN_NUM  = '254705486402';   // admin number (no +, no spaces)
const SITE_LINK     = 'https://marksyntrader--marksyntrader.replit.app';

const SK_POS      = 'wa_float_pos';
const SK_OPEN     = 'wa_float_open';
const SK_PAIR     = 'wa_float_pair';
const SK_MIN      = 'wa_float_min';
const SK_SETTINGS = 'wa_float_settings';

/* ─── Options ─── */
const INTERVAL_OPTS = [
    { value: 0,    label: 'Every signal' },
    { value: 60,   label: 'Every 1 min' },
    { value: 300,  label: 'Every 5 min' },
    { value: 600,  label: 'Every 10 min' },
    { value: 1800, label: 'Every 30 min' },
];
const FILTER_OPTS = [
    { value: 'all',  label: 'All signals' },
    { value: 'live', label: 'Live scalper only' },
    { value: 'high', label: 'High confidence (≥85%)' },
];
const TIMEFRAME_OPTS = [
    { value: '1T',  label: '1 Tick' },
    { value: '2T',  label: '2 Ticks' },
    { value: '3T',  label: '3 Ticks' },
    { value: '5T',  label: '5 Ticks' },
    { value: '10T', label: '10 Ticks' },
    { value: '1m',  label: '1 Min bar' },
    { value: '5m',  label: '5 Min bar' },
    { value: 'any', label: 'Any timeframe' },
];

const MARKETS = [
    { label: 'V10',      symbol: 'R_10',      bots: ['Digit Differ Bot', 'Even/Odd Bot'] },
    { label: 'V25',      symbol: 'R_25',      bots: ['Digit Under Bot',  'Even/Odd Bot'] },
    { label: 'V50',      symbol: 'R_50',      bots: ['Rise/Fall Scalper','Digit Over Bot'] },
    { label: 'V75',      symbol: 'R_75',      bots: ['Apex Bot 2026',    'Rise/Fall Scalper'] },
    { label: 'V100',     symbol: 'R_100',     bots: ['Apex Bot 2026',    'AI Signal Bot'] },
    { label: 'Step',     symbol: 'STPRNG',    bots: ['Step Scalper',     'Even/Odd Bot'] },
    { label: 'Boom 1K',  symbol: 'BOOM1000',  bots: ['Boom Spike Bot',   'AI Signal Bot'] },
    { label: 'Crash 1K', symbol: 'CRASH1000', bots: ['Crash Spike Bot',  'AI Signal Bot'] },
];
const ACTIONS = ['DIGIT OVER','DIGIT UNDER','EVEN','ODD','RISE','FALL','DIGIT MATCH','DIGIT DIFFER'];
const ENTRIES = ['0,1,2,3','7,8,9','3,4,5,6,7','0,1,2,9','5,6,7,8,9','0,1,2,3,4'];

/* ─── Types ─── */
interface SignalRecord {
    id: number; market: string; action: string;
    entry: string; bot: string; confidence: number;
    stake: string; ticks: number; time: string; fromScalper?: boolean;
    date?: string;
}
interface PairConfig {
    phone: string;
    code: string;
    step: number;   // 0=enter phone, 1=show code+join, 2=active
}
interface SignalSettings {
    intervalSec: number;
    filter: string;
    timeframe: string;
    autoShare: boolean;   // open WA share dialog automatically on signal
}

let _sigSeq = 1;
function generateSignal(id: number): SignalRecord {
    const m  = MARKETS[Math.floor(Math.random() * MARKETS.length)];
    const ac = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    const en = ENTRIES[Math.floor(Math.random() * ENTRIES.length)];
    const bt = m.bots[Math.floor(Math.random() * m.bots.length)];
    return {
        id, market: m.label, action: ac, entry: en, bot: bt,
        confidence: 70 + Math.floor(Math.random() * 29),
        stake: `$${(0.35 + Math.random() * 4.65).toFixed(2)}`,
        ticks: [1,2,3,5][Math.floor(Math.random() * 4)],
        time: new Date().toLocaleTimeString(),
    };
}

function ls<T>(key: string, fb: T): T {
    try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fb; } catch { return fb; }
}
function lsSet(key: string, val: any) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function getDefaultPos() {
    const s = ls<any>(SK_POS, null);
    return (s && typeof s.x === 'number') ? s : { x: 20, y: 100 };
}

/* ─── Pairing code: deterministic 8-char alphanum from phone + salt ─── */
function generatePairCode(phone: string): string {
    let h = 0xdeadbeef;
    const str = phone + 'MSYN_SALT_2026';
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
        h ^= h >>> 16;
    }
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'MSYN-';
    let n = Math.abs(h) >>> 0;
    for (let i = 0; i < 4; i++) { code += chars[n % chars.length]; n = Math.floor(n / chars.length); }
    return code;
}

/* ─── Format signal as a polished WA "flyer" message.
   Leads with the bot name (the thing the user actually asked for), then a
   clean bordered card layout so it reads like a designed signal flyer
   instead of a plain log line when pasted into WhatsApp. ─── */
function formatSignalText(s: SignalRecord, tf: string): string {
    const tfLbl = TIMEFRAME_OPTS.find(o => o.value === tf)?.label ?? tf;
    const confBar = '▰'.repeat(Math.round(s.confidence / 10)) + '▱'.repeat(10 - Math.round(s.confidence / 10));
    const dateStr = s.date ?? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return (
        `╔═══════════════════╗\n` +
        `   🚀 *MARKSYNTRADER*\n` +
        `   ⚡ LIVE SIGNAL ALERT\n` +
        `╚═══════════════════╝\n\n` +
        `🤖 *Bot:* ${s.bot}\n` +
        `📊 *Market:* ${s.market}\n` +
        `🎯 *Action:* *${s.action}*\n` +
        `⏱ *Timeframe:* ${tfLbl}\n` +
        `💰 *Stake:* ${s.stake}  ·  ${s.ticks}T\n\n` +
        `✅ *Confidence:* ${s.confidence}%\n` +
        `${confBar}\n\n` +
        `🗓 ${dateStr}  ⏰ ${s.time}\n` +
        `───────────────────\n` +
        `📲 Trade this signal live:\n` +
        `🌐 ${SITE_LINK}\n\n` +
        `_Signals are for informational purposes — trade responsibly._`
    );
}

/* ─── Open WA share dialog (group share UX) ─── */
function shareToWA(text: string) {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

/* ─── Open WhatsApp directly to the admin chat with the pairing code pre-filled.
   Called the instant a code is generated (and on re-pair) so the user actually
   lands in WhatsApp instead of just seeing a code with no connection. ─── */
function connectPairCodeToWhatsApp(code: string, phone: string) {
    const link = `https://wa.me/${WA_ADMIN_NUM}?text=${encodeURIComponent(`PAIR ${code} — ${phone}`)}`;
    window.open(link, '_blank', 'noopener,noreferrer');
    return link;
}

/* ─── SVGs ─── */
const WaSvg = ({ size = 22 }: { size?: number }) => (
    <svg viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ width: size, height: size, flexShrink: 0 }}>
        <circle cx='16' cy='16' r='16' fill='#25D366'/>
        <path d='M23.5 8.5C21.7 6.7 19.3 5.7 16.7 5.7C11.4 5.7 7 10.1 7 15.4C7 17.1 7.5 18.8 8.3 20.2L7 25L12 23.7C13.4 24.5 14.9 24.9 16.5 24.9H16.6C21.9 24.9 26.3 20.5 26.3 15.2C26.3 12.6 25.3 10.3 23.5 8.5ZM16.6 23.2C15.2 23.2 13.8 22.8 12.6 22.1L12.3 21.9L9.2 22.7L10 19.7L9.8 19.4C9 18.1 8.6 16.8 8.6 15.4C8.6 11 12.2 7.4 16.6 7.4C18.7 7.4 20.7 8.2 22.2 9.7C23.7 11.2 24.5 13.2 24.5 15.3C24.6 19.7 21 23.2 16.6 23.2ZM21 17.5C20.8 17.4 19.6 16.8 19.4 16.7C19.2 16.6 19 16.6 18.9 16.8C18.7 17 18.2 17.6 18.1 17.8C17.9 18 17.8 18 17.6 17.9C16.8 17.5 16.1 17 15.5 16.4C15 15.8 14.5 15.2 14.2 14.5C14.1 14.3 14.2 14.1 14.3 14C14.4 13.9 14.6 13.7 14.7 13.6C14.8 13.5 14.9 13.3 14.9 13.2C15 13.1 14.9 12.9 14.9 12.8C14.8 12.7 14.3 11.5 14.1 11C13.9 10.5 13.7 10.6 13.6 10.6H13.2C13 10.6 12.8 10.7 12.6 10.9C12.4 11.1 11.8 11.7 11.8 12.9C11.8 14.1 12.7 15.2 12.8 15.4C12.9 15.5 14.3 17.7 16.5 18.8C17 19 17.4 19.2 17.8 19.4C18.3 19.6 18.8 19.6 19.2 19.5C19.6 19.4 20.7 18.8 20.9 18.2C21.1 17.6 21.1 17.1 21 17.5Z' fill='white'/>
    </svg>
);

/* ─── Copy button ─── */
const CopyBtn = ({ text, label = 'Copy' }: { text: string; label?: string }) => {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        try { navigator.clipboard.writeText(text); } catch { /* ignore */ }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };
    return <button className='wa-copy-btn' onClick={copy}>{copied ? '✅ Copied!' : `📋 ${label}`}</button>;
};

/* ─── Step dots ─── */
const StepDots = ({ step, total }: { step: number; total: number }) => (
    <div className='wa-step-dots'>
        {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`wa-step-dot${i === step ? ' active' : i < step ? ' done' : ''}`} />
        ))}
    </div>
);

/* ─── Previous / Next wizard navigation — shown on every pairing step ─── */
const StepNav = ({
    onPrev, onNext, prevDisabled, hideNext, nextLabel = 'Next →', prevLabel = '← Previous',
}: {
    onPrev: () => void; onNext?: () => void; prevDisabled?: boolean; hideNext?: boolean;
    nextLabel?: string; prevLabel?: string;
}) => (
    <div className='wa-pair-stepnav'>
        <button className='wa-pair-stepnav__btn prev' onClick={onPrev} disabled={prevDisabled}>{prevLabel}</button>
        {!hideNext && (
            <button className='wa-pair-stepnav__btn next' onClick={onNext}>{nextLabel}</button>
        )}
    </div>
);

/* ════════════════════════════════════════════════ */
const WhatsAppFloat: React.FC = () => {
    const [pos, setPos]             = useState(getDefaultPos);
    const [open, setOpen]           = useState(() => ls(SK_OPEN, false));
    const [tab, setTab]             = useState<'signals'|'pair'>('signals');
    const [minimized, setMinimized] = useState(() => ls(SK_MIN, false));
    const [flash, setFlash]         = useState(false);
    const [signals, setSignals]     = useState<SignalRecord[]>([generateSignal(_sigSeq++)]);
    const [countdown, setCountdown] = useState(30);

    const defaultPair: PairConfig = { phone: '', code: '', step: 0 };
    const [pair, setPairState]    = useState<PairConfig>(() => ls(SK_PAIR, defaultPair));
    const [phoneInput, setPhoneInput] = useState(pair.phone);

    const defaultSettings: SignalSettings = { intervalSec: 0, filter: 'all', timeframe: 'any', autoShare: false };
    const [settings, setSettings] = useState<SignalSettings>(() => ls(SK_SETTINGS, defaultSettings));
    const lastSentRef             = useRef<number>(0);

    const dragging = useRef(false);
    const offset   = useRef({ x: 0, y: 0 });
    const didDrag  = useRef(false);
    const idRef    = useRef(_sigSeq);
    const timerRef = useRef<any>(null);

    /* helpers */
    const savePair = (update: Partial<PairConfig>) =>
        setPairState(prev => { const n = { ...prev, ...update }; lsSet(SK_PAIR, n); return n; });
    const saveSettings = (update: Partial<SignalSettings>) =>
        setSettings(prev => { const n = { ...prev, ...update }; lsSet(SK_SETTINGS, n); return n; });

    /* ─── Drag ─── */
    const onPointerDown = (e: React.PointerEvent) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragging.current = true; didDrag.current = false;
        offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!dragging.current) return;
        didDrag.current = true;
        setPos({
            x: Math.max(0, Math.min(window.innerWidth  - 60, e.clientX - offset.current.x)),
            y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - offset.current.y)),
        });
    };
    const onPointerUp = (e: React.PointerEvent) => {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        if (dragging.current) { dragging.current = false; setPos(p => { lsSet(SK_POS, p); return p; }); }
    };
    const handleFabClick = () => { if (didDrag.current) return; setOpen(v => { lsSet(SK_OPEN, !v); return !v; }); };

    /* ─── Auto-share gate ─── */
    const maybeShare = useCallback((sig: SignalRecord) => {
        const s = ls<SignalSettings>(SK_SETTINGS, defaultSettings);
        if (!s.autoShare) return;
        if (s.filter === 'live' && !sig.fromScalper) return;
        if (s.filter === 'high' && sig.confidence < 85) return;
        const now = Date.now();
        if (s.intervalSec > 0 && now - lastSentRef.current < s.intervalSec * 1000) return;
        lastSentRef.current = now;
        shareToWA(formatSignalText(sig, s.timeframe));
    }, []);

    /* ─── Auto-refresh ─── */
    useEffect(() => {
        const refresh = () => {
            const sig = generateSignal(idRef.current++);
            setSignals(prev => [sig, ...prev].slice(0, 8));
            setFlash(true); setTimeout(() => setFlash(false), 900);
            setCountdown(30);
            maybeShare(sig);
        };
        timerRef.current = setInterval(() => setCountdown(c => { if (c <= 1) { refresh(); return 30; } return c - 1; }), 1000);
        return () => clearInterval(timerRef.current);
    }, [maybeShare]);

    /* ─── Live scalper signals ─── */
    useEffect(() => {
        const handler = (e: any) => {
            const d = e.detail;
            if (!d) return;
            const sig: SignalRecord = {
                id: idRef.current++, market: d.market, action: d.action,
                entry: '—', bot: d.bot || 'Scalper Terminal',
                confidence: d.confidence ?? 85, stake: d.stake,
                ticks: d.ticks, time: new Date().toLocaleTimeString(),
                date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                fromScalper: true,
            };
            setSignals(prev => [sig, ...prev].slice(0, 8));
            setFlash(true); setTimeout(() => setFlash(false), 900);
            setCountdown(30);
            maybeShare(sig);
        };
        window.addEventListener('wa:signal', handler);
        return () => window.removeEventListener('wa:signal', handler);
    }, [maybeShare]);

    /* ─── Step 0: enter phone ─── */
    const [phoneError, setPhoneError] = useState('');
    const handlePhoneSubmit = () => {
        const cleaned = phoneInput.trim().replace(/\s/g, '');
        if (!cleaned) { setPhoneError('Enter your WhatsApp number.'); return; }
        if (!/^\+?\d{7,15}$/.test(cleaned)) { setPhoneError('Use international format — e.g. +254712345678'); return; }
        const code = generatePairCode(cleaned);
        savePair({ phone: cleaned, code, step: 1 });
        setPhoneError('');
        // Take the user straight into WhatsApp with the code pre-filled — don't
        // just show a code and hope they find the right button.
        connectPairCodeToWhatsApp(code, cleaned);
    };

    /* ─── Re-pair: regenerate a fresh code for the already-linked number and
       jump straight back into WhatsApp with it — without losing the number. ─── */
    const handleRepair = () => {
        const code = generatePairCode(pair.phone);
        savePair({ code, step: 1 });
        connectPairCodeToWhatsApp(code, pair.phone);
    };

    /* ─── Step 1: join group + send code ─── */
    // WA deep-link to message the admin with the code
    const adminVerifyLink = `https://wa.me/${WA_ADMIN_NUM}?text=${encodeURIComponent(`PAIR ${pair.code} — ${pair.phone}`)}`;
    // WA deep-link to join group
    const groupJoinLink   = WA_GROUP_LINK;

    /* ─── Panel position ─── */
    const panelLeft     = pos.x + 70;
    const usePanelRight = panelLeft + 335 > window.innerWidth - 10;
    const panelX        = usePanelRight ? pos.x - 340 : panelLeft;

    /* ─── Signals tab ─── */
    const latest    = signals[0];
    const confColor = latest.confidence >= 85 ? '#22c55e' : latest.confidence >= 75 ? '#f59e0b' : '#f87171';

    /* ─── Pair tab renderer ─── */
    const renderPairTab = () => {
        /* STEP 0 — enter phone */
        if (pair.step === 0) return (
            <div className='wa-float-body wa-float-pair'>
                <div className='wa-pair-step-header'>
                    <StepDots step={0} total={2} />
                    <span className='wa-pair-step-label'>Step 1 of 2</span>
                </div>

                <div className='wa-pair-hero'>
                    <WaSvg size={34} />
                    <p className='wa-pair-hero-title'>Link your WhatsApp</p>
                    <p className='wa-pair-hero-sub'>Get a unique pairing code, join the signals group, and share live scalper signals in one tap.</p>
                </div>

                <div className='wa-float-pair__field'>
                    <label>Your WhatsApp number (with country code)</label>
                    <input
                        type='tel'
                        placeholder='+254712345678'
                        value={phoneInput}
                        onChange={e => { setPhoneInput(e.target.value); setPhoneError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handlePhoneSubmit()}
                        autoComplete='off'
                    />
                    {phoneError && <span className='wa-pair-field-error'>{phoneError}</span>}
                </div>

                <button className='wa-pair-cta' onClick={handlePhoneSubmit}>
                    Generate My Pairing Code →
                </button>

                <StepNav prevDisabled onPrev={() => {}} onNext={handlePhoneSubmit} nextLabel='Next →' />

                <p className='wa-pair-fine'>
                    Signals are shared via WhatsApp's built-in share — no third-party bots.
                </p>
            </div>
        );

        /* STEP 1 — show code, join group */
        if (pair.step === 1) return (
            <div className='wa-float-body wa-float-pair'>
                <div className='wa-pair-step-header'>
                    <StepDots step={1} total={2} />
                    <span className='wa-pair-step-label'>Step 2 of 2</span>
                </div>

                {/* Pairing code display */}
                <div className='wa-pair-code-card'>
                    <p className='wa-pair-code-label'>🔑 Your pairing code</p>
                    <div className='wa-pair-code-value'>
                        <span>{pair.code}</span>
                        <CopyBtn text={pair.code} label='Copy' />
                    </div>
                    <p className='wa-pair-code-hint'>This code is unique to your number.</p>
                </div>

                {/* Action 1: join group */}
                <div className='wa-pair-action-row'>
                    <span className='wa-pair-action-num'>1</span>
                    <div className='wa-pair-action-body'>
                        <p className='wa-pair-action-title'>Join the Marksyntrader signals group</p>
                        <a className='wa-pair-wa-btn' href={groupJoinLink} target='_blank' rel='noreferrer'>
                            <WaSvg size={15} /> Join WhatsApp Group
                        </a>
                    </div>
                </div>

                {/* Action 2: send code to admin */}
                <div className='wa-pair-action-row'>
                    <span className='wa-pair-action-num'>2</span>
                    <div className='wa-pair-action-body'>
                        <p className='wa-pair-action-title'>Send your code to admin to confirm pairing</p>
                        <a className='wa-pair-wa-btn secondary' href={adminVerifyLink} target='_blank' rel='noreferrer'>
                            <WaSvg size={15} /> Send Code to Admin
                        </a>
                        <p className='wa-pair-action-sub'>Opens WA with your code pre-filled — just tap Send.</p>
                    </div>
                </div>

                {/* Fallback if the automatic WhatsApp popup was blocked by the browser */}
                <button className='wa-pair-reconnect' onClick={() => connectPairCodeToWhatsApp(pair.code, pair.phone)}>
                    <WaSvg size={14} /> Not connected? Tap to open WhatsApp again
                </button>

                <div className='wa-pair-divider'><span>after joining & sending code</span></div>

                <button className='wa-pair-cta' onClick={() => savePair({ step: 2 })}>
                    ✅ I've Joined &amp; Sent My Code
                </button>

                <StepNav
                    onPrev={() => { savePair({ step: 0 }); setPhoneInput(pair.phone); }}
                    onNext={() => savePair({ step: 2 })}
                    prevLabel={`← Previous (${pair.phone})`}
                    nextLabel='Next →'
                />
            </div>
        );

        /* STEP 2 — active, settings */
        return (
            <div className='wa-float-body wa-float-pair'>
                {/* Active badge */}
                <div className='wa-pair-active-badge'>
                    <span className='wa-pair-active-dot' />
                    <div>
                        <p className='wa-pair-active-title'>Linked &amp; Active</p>
                        <p className='wa-pair-active-phone'>{pair.phone} · code: {pair.code}</p>
                    </div>
                    <a className='wa-pair-active-group' href={groupJoinLink} target='_blank' rel='noreferrer' title='Open group'>
                        <WaSvg size={18} />
                    </a>
                </div>

                {/* Signal settings */}
                <div className='wa-pair-settings-section'>
                    <p className='wa-pair-settings-title'>⚙️ Signal Settings</p>

                    <div className='wa-pair-settings-row'>
                        <label>Signal filter</label>
                        <select value={settings.filter} onChange={e => saveSettings({ filter: e.target.value })}>
                            {FILTER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    <div className='wa-pair-settings-row'>
                        <label>Min. interval</label>
                        <select value={settings.intervalSec} onChange={e => saveSettings({ intervalSec: Number(e.target.value) })}>
                            {INTERVAL_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    <div className='wa-pair-settings-row'>
                        <label>Timeframe</label>
                        <select value={settings.timeframe} onChange={e => saveSettings({ timeframe: e.target.value })}>
                            {TIMEFRAME_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    <div className='wa-pair-settings-row toggle-row'>
                        <div>
                            <label>Auto-share to WA</label>
                            <p className='wa-pair-settings-sub'>Opens WA share dialog on each signal</p>
                        </div>
                        <button
                            className={`wa-pair-toggle ${settings.autoShare ? 'on' : 'off'}`}
                            onClick={() => saveSettings({ autoShare: !settings.autoShare })}
                        >
                            {settings.autoShare ? 'ON' : 'OFF'}
                        </button>
                    </div>
                </div>

                {/* Quick share latest */}
                <button className='wa-pair-share-now' onClick={() => shareToWA(formatSignalText(signals[0], settings.timeframe))}>
                    <WaSvg size={15} /> Share Latest Signal to Group
                </button>

                <div className='wa-pair-action-btns-row'>
                    <button className='wa-pair-repair' onClick={handleRepair}>
                        🔁 Re-pair (new code)
                    </button>
                    <button className='wa-pair-disconnect' onClick={() => { savePair(defaultPair); setPhoneInput(''); }}>
                        🔌 Unlink / Change Number
                    </button>
                </div>

                <StepNav hideNext onPrev={() => savePair({ step: 1 })} prevLabel='← Previous' />

                <p className='wa-pair-fine'>
                    Signals open WhatsApp share — choose the group, tap Send. · {INTERVAL_OPTS.find(o => o.value === settings.intervalSec)?.label}
                </p>
            </div>
        );
    };

    /* ════════ render ════════ */
    return (
        <>
            {/* FAB */}
            <div
                className={`wa-float-fab${flash ? ' flash' : ''}${pair.step === 2 ? ' paired' : ''}`}
                style={{ left: pos.x, top: pos.y }}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                onClick={handleFabClick}
                title='Live Signals & WhatsApp'
            >
                <WaSvg size={28} />
                <span className='wa-float-fab__pulse' />
                {open && <span className='wa-float-fab__live' />}
                {pair.step === 2 && <span className='wa-float-fab__paired-dot' />}
            </div>

            {/* Panel */}
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
                            <button className='wa-float-panel__min' onClick={() => setMinimized(v => { lsSet(SK_MIN,!v); return !v; })}>
                                {minimized ? '▲' : '▼'}
                            </button>
                            <button className='wa-float-panel__close' onClick={() => { setOpen(false); lsSet(SK_OPEN, false); }}>✕</button>
                        </div>
                    </div>

                    {!minimized && (
                        <>
                            {/* Tabs */}
                            <div className='wa-float-tabs'>
                                <button className={`wa-float-tabs__btn${tab==='signals'?' active':''}`} onClick={() => setTab('signals')}>📡 Signals</button>
                                <button className={`wa-float-tabs__btn${tab==='pair'?' active':''}`} onClick={() => setTab('pair')}>
                                    {pair.step === 2 ? '✅ Linked' : '🔗 Link WA'}
                                </button>
                            </div>

                            {/* Signals tab */}
                            {tab === 'signals' && (
                                <div className='wa-float-body'>
                                    {/* Latest card */}
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
                                        {/* Share button on card */}
                                        <button
                                            className='wa-float-share-btn'
                                            onClick={() => shareToWA(formatSignalText(latest, settings.timeframe))}
                                            title='Share to WhatsApp group'
                                        >
                                            <WaSvg size={12} /> Share to Group
                                        </button>
                                    </div>

                                    {/* History */}
                                    {signals.length > 1 && (
                                        <div className='wa-float-history'>
                                            {signals.slice(1).map(s => (
                                                <div key={s.id} className='wa-float-hist-row'>
                                                    <span className='wa-float-hist-mkt'>{s.market}</span>
                                                    <span className='wa-float-hist-act'>{s.action}</span>
                                                    <span className='wa-float-hist-conf'>{s.confidence}%</span>
                                                    <span className='wa-float-hist-time'>{s.time}</span>
                                                    {s.fromScalper && <span className='wa-float-hist-live'>LIVE</span>}
                                                    <button
                                                        className='wa-float-hist-share'
                                                        onClick={() => shareToWA(formatSignalText(s, settings.timeframe))}
                                                        title='Share'
                                                    >📤</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Links */}
                                    <div className='wa-float-links'>
                                        <a className='wa-float-link green' href={WA_GROUP_LINK} target='_blank' rel='noreferrer'>
                                            <WaSvg size={13} /> Join Group
                                        </a>
                                        <a className='wa-float-link blue' href={SITE_LINK} target='_blank' rel='noreferrer'>
                                            🌐 Platform
                                        </a>
                                    </div>
                                    <p className='wa-float-note'>⚠ Indicative signals only. Trade at your own risk.</p>
                                </div>
                            )}

                            {/* Pair tab */}
                            {tab === 'pair' && renderPairTab()}
                        </>
                    )}
                </div>
            )}
        </>
    );
};

export default WhatsAppFloat;
