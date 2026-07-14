// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import './loading-screen.scss';

const RAMP_MS      = 2200;
const FAKE_CEILING = 92;
const FINISH_MS    = 300;

interface LoadingScreenProps {
    ready?: boolean;
    onDone?: () => void;
}

/* Phase-1 ticker */
const TICKER_ITEMS = [
    { name: 'Volatility 25',     change: '+0.88%', up: true  },
    { name: 'Bear Market Index', change: '+2.09%', up: true  },
    { name: 'Bull Market Index', change: '-0.31%', up: false },
    { name: 'Volatility 100',    change: '+0.14%', up: true  },
    { name: 'Volatility 75',     change: '+2.54%', up: true  },
    { name: 'Boom 1000 Index',   change: '+1.82%', up: true  },
    { name: 'Crash 500 Index',   change: '-0.94%', up: false },
    { name: 'Step Index',        change: '+0.41%', up: true  },
    { name: 'Range Break 100',   change: '+1.17%', up: true  },
    { name: 'Jump 50',           change: '+0.45%', up: true  },
    { name: 'Volatility 50',     change: '-0.22%', up: false },
    { name: 'Crash 1000 Index',  change: '+0.88%', up: true  },
];

const TESTIMONIALS = [
    { name: 'Grace Njeri', role: 'Part-time Trader — Kenya', avatar: 'GN', color: '#4f46e5', rating: 5, text: 'The free course + bot builder tutorial changed how I trade completely.' },
    { name: 'Emmanuel Owusu', role: 'Full-time Trader — Ghana', avatar: 'EO', color: '#ea7c2c', rating: 5, text: 'The Apex Bot 2026 is seriously on another level. It adapts, it learns.' },
    { name: 'Mercy Wanjiku', role: 'Step Index Trader — Kenya', avatar: 'MW', color: '#22c55e', rating: 5, text: 'The live charts with full technical indicators make me feel like a pro.' },
];

const FEATURES = [
    { icon: '🤖', title: 'Free',                         sub: 'BOT TEMPLATES' },
    { icon: '⏱', title: '24/7',                          sub: 'SYNTHETIC MARKET FOCUS' },
    { icon: '🌐', title: 'ahmedsyntrader.com',            sub: 'BRANDED WORKSPACE', small: true },
    { icon: '●',  title: 'Live',                          sub: 'MARKET STATUS', live: true },
];

const PHRASES = [
    'Initializing trading engines...',
    'Connecting to live markets...',
    'Loading AI signal scanner...',
    'Syncing real-time data feeds...',
    'Calibrating market algorithms...',
    'Warming up execution systems...',
    'Preparing your trading environment...',
    'Almost ready — stand by...',
];

/* Phase-2 feature cards (6 cards matching the screenshot) */
const P2_LEFT = [
    { icon: '📊', title: 'Market Analysis', sub: 'Real-time data' },
    { icon: '🔒', title: 'Secure Platform', sub: 'Encrypted & safe' },
    { icon: '⚡', title: 'Fast Execution', sub: 'Speed matters' },
];
const P2_RIGHT = [
    { icon: '🎯', title: 'Precise Strategy', sub: 'Accurate signals' },
    { icon: '👥', title: 'Copy Trading', sub: 'Follow experts' },
    { icon: '🏆', title: 'Grow Together', sub: 'Win as a team' },
];

/* ─── Phase 2 loading screen ─── */
const Phase2Screen: React.FC<{ progress: number; phraseIdx: number }> = ({ progress, phraseIdx }) => (
    <div className='ls2-page'>
        {/* Top-right tagline */}
        <div className='ls2-tagline'>
            TRUST THE PLAN<br />TRADE THE FUTURE
        </div>

        {/* Left feature cards */}
        <div className='ls2-left-cards'>
            {P2_LEFT.map((c, i) => (
                <div key={i} className='ls2-feat-card'>
                    <span className='ls2-feat-icon'>{c.icon}</span>
                    <div>
                        <div className='ls2-feat-title'>{c.title}</div>
                        <div className='ls2-feat-sub'>{c.sub}</div>
                    </div>
                </div>
            ))}
        </div>

        {/* Center content */}
        <div className='ls2-center'>
            {/* AT Logo ring */}
            <div className='ls2-logo-ring'>
                <div className='ls2-logo-inner'>AT</div>
                <div className='ls2-logo-tick'>›</div>
            </div>

            <h1 className='ls2-brand'>
                AHMED <span>TRADE</span>
            </h1>
            <p className='ls2-brand-sub'>— SMART TRADING. BETTER FUTURE. —</p>

            <div className='ls2-loading-text'>L O A D I N G  <span>|||</span></div>

            <div className='ls2-bar-wrap'>
                <div className='ls2-bar-track'>
                    <div className='ls2-bar-fill' style={{ width: `${progress}%`, transition: 'width 40ms linear' }} />
                </div>
                <span className='ls2-bar-pct'>{Math.floor(progress)}%</span>
            </div>

            <div className='ls2-phrase'>{PHRASES[phraseIdx]}</div>
        </div>

        {/* Right feature cards */}
        <div className='ls2-right-cards'>
            {P2_RIGHT.map((c, i) => (
                <div key={i} className='ls2-feat-card right'>
                    <div>
                        <div className='ls2-feat-title'>{c.title}</div>
                        <div className='ls2-feat-sub'>{c.sub}</div>
                    </div>
                    <span className='ls2-feat-icon'>{c.icon}</span>
                </div>
            ))}
        </div>

        {/* Bottom bar */}
        <div className='ls2-bottom'>
            <span>📍 RELIABLE | TRANSPARENT | SECURE</span>
            <span>BUILT FOR TRADERS, BY TRADERS</span>
            <span>⊕ AHMEDTRADE.COM</span>
        </div>
    </div>
);

const LoadingScreen: React.FC<LoadingScreenProps> = ({ ready = false, onDone }) => {
    const [progress, setProgress]   = useState(0);
    const [phraseIdx, setPhraseIdx] = useState(0);
    const [phase, setPhase]         = useState<1 | 2>(1);

    const startRef   = useRef<number>(performance.now());
    const rafRef     = useRef<number>(0);
    const readyRef   = useRef(ready);
    const readyAtRef = useRef<number | null>(null);
    const doneRef    = useRef(false);
    const onDoneRef  = useRef(onDone);

    useEffect(() => { readyRef.current  = ready;  }, [ready]);
    useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

    useEffect(() => {
        startRef.current = performance.now();

        const tick = (now: number) => {
            if (readyRef.current) {
                if (readyAtRef.current === null) readyAtRef.current = now;
                const fe  = now - readyAtRef.current;
                const pct = FAKE_CEILING + Math.min(fe / FINISH_MS, 1) * (100 - FAKE_CEILING);
                setProgress(pct);
                if (pct < 100) {
                    rafRef.current = requestAnimationFrame(tick);
                } else if (!doneRef.current) {
                    doneRef.current = true;
                    onDoneRef.current?.();
                }
                return;
            }
            const elapsed = now - startRef.current;
            const pct = Math.min((elapsed / RAMP_MS) * FAKE_CEILING, FAKE_CEILING);
            setProgress(pct);
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);

        const phraseInterval = setInterval(() => {
            setPhraseIdx(p => (p + 1) % PHRASES.length);
        }, 560);

        return () => {
            cancelAnimationFrame(rafRef.current);
            clearInterval(phraseInterval);
        };
    }, []);

    /* Switch to phase 2 at 50% */
    useEffect(() => {
        if (progress >= 50 && phase === 1) {
            setPhase(2);
        }
    }, [progress, phase]);

    const pct = Math.floor(progress);

    /* ── Phase 2 ── */
    if (phase === 2) {
        return <Phase2Screen progress={pct} phraseIdx={phraseIdx} />;
    }

    /* ── Phase 1 (landing) ── */
    return (
        <div className='ls-page'>
            <div className='ls-bg' />
            <div className='ls-bg-text'>GEO WIN</div>

            <div className='ls-ticker'>
                <div className='ls-ticker__track'>
                    {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                        <span key={i} className='ls-ticker__item'>
                            <span className={`ls-ticker__arrow ${item.up ? 'up' : 'down'}`}>{item.up ? '↑' : '↓'}</span>
                            <span className='ls-ticker__name'>{item.name}</span>
                            <span className={`ls-ticker__chg ${item.up ? 'up' : 'down'}`}>{item.change}</span>
                        </span>
                    ))}
                </div>
            </div>

            <div className='ls-hero'>
                {/* Marksyntrader logo + wordmark */}
                <div className='ls-logo'>
                    <div className='ls-logo__ring'>
                        <svg viewBox='0 0 48 48' fill='none' xmlns='http://www.w3.org/2000/svg' className='ls-logo__svg'>
                            <circle cx='24' cy='24' r='22' stroke='#22c55e' strokeWidth='2.5' />
                            <circle cx='24' cy='24' r='16' fill='rgba(34,197,94,0.12)' />
                            <text x='24' y='29' textAnchor='middle' fontSize='14' fontWeight='900' fontFamily='Orbitron,sans-serif' fill='#22c55e'>M</text>
                        </svg>
                        <div className='ls-logo__glow' />
                    </div>
                    <div className='ls-logo__wordmark'>
                        <span className='ls-logo__name'>Marksyn<span className='ls-logo__name-hl'>trader</span></span>
                        <span className='ls-logo__tagline'>SMART TRADING WORKSPACE</span>
                    </div>
                </div>

                <div className='ls-hero__badge'>FREE DERIV BOTS, AUTOMATION, AND TRADING TOOLS IN ONE WORKSPACE</div>
                <h1 className='ls-hero__title'>Trade with <span className='ls-hero__title-hl'>better structure</span></h1>
                <p className='ls-hero__sub'>Use manual trading, charts, copy tools, automation, and market analysis without jumping between separate apps.</p>
                <div className='ls-hero__cta'>
                    <button className='ls-btn-primary'>↗ Log In and Trade &nbsp;→</button>
                    <button className='ls-btn-secondary'>⚡ Create Free Account</button>
                    <a href='https://chat.whatsapp.com/EkscsxyF4j0CpuWzv0bqUw' target='_blank' rel='noreferrer' className='ls-hero__wa-link'>
                        <svg viewBox='0 0 32 32' fill='none' style={{ width: 16, height: 16 }}>
                            <circle cx='16' cy='16' r='16' fill='#25D366' />
                            <path d='M23.5 8.5C21.7 6.7 19.3 5.7 16.7 5.7C11.4 5.7 7 10.1 7 15.4C7 17.1 7.5 18.8 8.3 20.2L7 25L12 23.7C13.4 24.5 14.9 24.9 16.5 24.9H16.6C21.9 24.9 26.3 20.5 26.3 15.2C26.3 12.6 25.3 10.3 23.5 8.5ZM16.6 23.2C15.2 23.2 13.8 22.8 12.6 22.1L12.3 21.9L9.2 22.7L10 19.7L9.8 19.4C9 18.1 8.6 16.8 8.6 15.4C8.6 11 12.2 7.4 16.6 7.4C18.7 7.4 20.7 8.2 22.2 9.7C23.7 11.2 24.5 13.2 24.5 15.3C24.6 19.7 21 23.2 16.6 23.2Z' fill='white' />
                        </svg>
                        Join WhatsApp Group
                    </a>
                </div>
            </div>

            <div className='ls-testimonials'>
                {TESTIMONIALS.map((t, i) => (
                    <div key={i} className='ls-tc'>
                        <div className='ls-tc__stars'>{'★'.repeat(t.rating)}</div>
                        <div className='ls-tc__avatar' style={{ background: t.color }}>{t.avatar}</div>
                        <div className='ls-tc__name'>{t.name}</div>
                        <div className='ls-tc__role'>{t.role}</div>
                        <p className='ls-tc__text'>{t.text}</p>
                    </div>
                ))}
            </div>

            <div className='ls-features'>
                {FEATURES.map((f, i) => (
                    <div key={i} className='ls-feat'>
                        <div className={`ls-feat__icon ${f.live ? 'live' : ''}`}>{f.icon}</div>
                        <div className={`ls-feat__title ${f.small ? 'small' : ''}`}>{f.title}</div>
                        <div className='ls-feat__sub'>{f.sub}</div>
                    </div>
                ))}
            </div>

            <div className='ls-loading-bar'>
                <div className='ls-loading-bar__phrase'>{PHRASES[phraseIdx]}</div>
                <div className='ls-loading-bar__track'>
                    <div className='ls-loading-bar__fill' style={{ width: `${progress}%`, transition: 'width 40ms linear' }} />
                </div>
                <div className='ls-loading-bar__pct'>{pct}%</div>
            </div>
        </div>
    );
};

export default LoadingScreen;
