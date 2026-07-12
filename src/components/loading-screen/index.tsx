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

/* Live-ish ticker items (mock data shown during loading before WS connects) */
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
    {
        name: 'Grace Njeri', role: 'Part-time Trader — Kenya',
        avatar: 'GN', color: '#4f46e5', rating: 5,
        text: 'The free course + bot builder tutorial changed how I trade completely.',
    },
    {
        name: 'Emmanuel Owusu', role: 'Full-time Trader — Ghana',
        avatar: 'EO', color: '#ea7c2c', rating: 5,
        text: 'The Apex Bot 2026 is seriously on another level. It adapts, it learns.',
    },
    {
        name: 'Mercy Wanjiku', role: 'Step Index Trader — Kenya',
        avatar: 'MW', color: '#22c55e', rating: 5,
        text: 'The live charts with full technical indicators make me feel like a pro.',
    },
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

const LoadingScreen: React.FC<LoadingScreenProps> = ({ ready = false, onDone }) => {
    const [progress, setProgress]   = useState(0);
    const [phraseIdx, setPhraseIdx] = useState(0);

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

    const pct = Math.floor(progress);

    return (
        <div className='ls-page'>
            {/* Background */}
            <div className='ls-bg' />
            <div className='ls-bg-text'>GEO WIN</div>

            {/* ── Ticker ── */}
            <div className='ls-ticker'>
                <div className='ls-ticker__track'>
                    {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                        <span key={i} className='ls-ticker__item'>
                            <span className={`ls-ticker__arrow ${item.up ? 'up' : 'down'}`}>
                                {item.up ? '↑' : '↓'}
                            </span>
                            <span className='ls-ticker__name'>{item.name}</span>
                            <span className={`ls-ticker__chg ${item.up ? 'up' : 'down'}`}>
                                {item.change}
                            </span>
                        </span>
                    ))}
                </div>
            </div>

            {/* ── Hero ── */}
            <div className='ls-hero'>
                <div className='ls-hero__badge'>
                    FREE DERIV BOTS, AUTOMATION, AND TRADING TOOLS IN ONE WORKSPACE
                </div>

                <h1 className='ls-hero__title'>
                    Trade with <span className='ls-hero__title-hl'>better structure</span>
                </h1>

                <p className='ls-hero__sub'>
                    Use manual trading, charts, copy tools, automation, and market analysis
                    without jumping between separate apps.
                </p>

                <div className='ls-hero__cta'>
                    <button className='ls-btn-primary'>
                        ↗ Log In and Trade &nbsp;→
                    </button>
                    <button className='ls-btn-secondary'>
                        ⚡ Create Free Account
                    </button>
                    <a href='#' className='ls-hero__explore'>Explore the course ↓</a>
                </div>
            </div>

            {/* ── Testimonials ── */}
            <div className='ls-testimonials'>
                {TESTIMONIALS.map((t, i) => (
                    <div key={i} className='ls-tc'>
                        <div className='ls-tc__stars'>{'★'.repeat(t.rating)}</div>
                        <div className='ls-tc__avatar' style={{ background: t.color }}>
                            {t.avatar}
                        </div>
                        <div className='ls-tc__name'>{t.name}</div>
                        <div className='ls-tc__role'>{t.role}</div>
                        <p className='ls-tc__text'>{t.text}</p>
                    </div>
                ))}
            </div>

            {/* ── Feature cards ── */}
            <div className='ls-features'>
                {FEATURES.map((f, i) => (
                    <div key={i} className='ls-feat'>
                        <div className={`ls-feat__icon ${f.live ? 'live' : ''}`}>{f.icon}</div>
                        <div className={`ls-feat__title ${f.small ? 'small' : ''}`}>{f.title}</div>
                        <div className='ls-feat__sub'>{f.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Loading progress bar (bottom strip) ── */}
            <div className='ls-loading-bar'>
                <div className='ls-loading-bar__phrase'>{PHRASES[phraseIdx]}</div>
                <div className='ls-loading-bar__track'>
                    <div
                        className='ls-loading-bar__fill'
                        style={{ width: `${progress}%`, transition: 'width 40ms linear' }}
                    />
                </div>
                <div className='ls-loading-bar__pct'>{pct}%</div>
            </div>
        </div>
    );
};

export default LoadingScreen;
