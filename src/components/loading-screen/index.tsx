// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import './loading-screen.scss';

const TOTAL_MS = 4500; // exactly 4.5 seconds 0 → 100%
const TICK_MS  = 40;   // ~25fps updates, super smooth
const INCREMENT = 100 / (TOTAL_MS / TICK_MS); // ~0.89% per tick

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

const FEATURES_LEFT = [
  { icon: '📊', title: 'MARKET ANALYSIS', sub: 'REAL-TIME DATA' },
  { icon: '🛡️', title: 'SECURE PLATFORM', sub: 'ENCRYPTED & SAFE' },
  { icon: '⚡', title: 'FAST EXECUTION', sub: 'SPEED MATTERS' },
];

const FEATURES_RIGHT = [
  { icon: '🎯', title: 'PRECISE STRATEGY', sub: 'ACCURATE SIGNALS' },
  { icon: '👥', title: 'COPY TRADING', sub: 'FOLLOW EXPERTS' },
  { icon: '🏆', title: 'GROW TOGETHER', sub: 'WIN AS A TEAM' },
];

const LoadingScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const startRef = useRef<number>(performance.now());
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = performance.now();

    // Smooth linear progress via requestAnimationFrame
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const pct = Math.min((elapsed / TOTAL_MS) * 100, 100);
      setProgress(pct);
      if (pct < 100) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    // Cycle phrases every ~560ms (8 phrases over 4.5s)
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
    <div className='at-loading'>
      {/* Plain animated gradient backdrop (from loading-screen.scss) — the mockup
          PNG is NOT used here since it bakes in its own static "LOADING 78%" text,
          which visually duplicated/clashed with the real live progress bar below. */}
      <div className='at-loading__bg' />
      <div className='at-loading__overlay' />

      {/* Corner labels */}
      <div className='at-loading__corner-tl'>
        <span className='at-loading__corner-logo'>AT</span>
        <span className='at-loading__corner-name'>AHMED TRADE</span>
      </div>
      <div className='at-loading__corner-tr'>
        <span>TRUST THE PLAN</span>
        <span>TRADE THE FUTURE</span>
      </div>
      <div className='at-loading__corner-bl'>
        <span>🛡️ RELIABLE | TRANSPARENT | SECURE</span>
      </div>
      <div className='at-loading__corner-br'>
        <span className='at-loading__globe'>🌐</span>
        <span>AHMEDTRADE.COM</span>
      </div>
      <div className='at-loading__bottom-center'>BUILT FOR TRADERS, BY TRADERS</div>

      {/* Main content */}
      <div className='at-loading__main'>
        {/* Left features */}
        <div className='at-loading__features at-loading__features--left'>
          {FEATURES_LEFT.map((f, i) => (
            <div key={i} className='at-loading__feature'>
              <span className='at-loading__feature-icon'>{f.icon}</span>
              <div>
                <div className='at-loading__feature-title'>{f.title}</div>
                <div className='at-loading__feature-sub'>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Center branding */}
        <div className='at-loading__center'>
          <div className='at-loading__logo-ring'>
            <div className='at-loading__logo-ring-inner'>
              <span className='at-loading__logo-text'>AT</span>
              <div className='at-loading__logo-arrow'>↗</div>
            </div>
          </div>

          <h1 className='at-loading__brand'>
            <span className='at-loading__brand-ahmed'>AHMED</span>
            <span className='at-loading__brand-trade'> TRADE</span>
          </h1>
          <p className='at-loading__tagline'>— SMART TRADING. BETTER FUTURE. —</p>

          {/* Loading section */}
          <div className='at-loading__loading-label'>
            L O A D I N G <span className='at-loading__bars'>▐▐▐</span>
          </div>

          {/* Progress bar — smooth linear 0→100% over 4.5s */}
          <div className='at-loading__bar-wrap'>
            <div className='at-loading__bar'>
              <div
                className='at-loading__bar-fill'
                style={{
                  width: `${progress}%`,
                  transition: 'width 40ms linear',
                }}
              >
                <div className='at-loading__bar-glow' />
              </div>
            </div>
            <span className='at-loading__percent'>{pct}%</span>
          </div>

          <p className='at-loading__phrase' key={phraseIdx}>{PHRASES[phraseIdx]}</p>

          {/* Hologram circle */}
          <div className='at-loading__hologram'>
            <div className='at-loading__hologram-ring at-loading__hologram-ring--1' />
            <div className='at-loading__hologram-ring at-loading__hologram-ring--2' />
            <div className='at-loading__hologram-core' />
          </div>

          {/* Chart bars decoration */}
          <div className='at-loading__chart-bars'>
            {[3,5,2,7,4,6,3,5,8,4,6,3].map((h, i) => (
              <div key={i} className='at-loading__chart-bar' style={{ height: `${h * 4}px` }} />
            ))}
          </div>
        </div>

        {/* Right features */}
        <div className='at-loading__features at-loading__features--right'>
          {FEATURES_RIGHT.map((f, i) => (
            <div key={i} className='at-loading__feature at-loading__feature--right'>
              <div>
                <div className='at-loading__feature-title'>{f.title}</div>
                <div className='at-loading__feature-sub'>{f.sub}</div>
              </div>
              <span className='at-loading__feature-icon'>{f.icon}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
