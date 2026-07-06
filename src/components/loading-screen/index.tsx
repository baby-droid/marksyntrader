// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import './loading-screen.scss';

// The bar ramps quickly to a "fake ceiling" (below 100%) so it never looks
// frozen/stuck while the real app is still connecting/authorizing — it only
// jumps to 100% once the parent tells us the real content is actually ready.
const RAMP_MS   = 2200;  // 0 → FAKE_CEILING
const FAKE_CEILING = 92; // never shown as "stuck at 100%" while still loading
const FINISH_MS = 300;   // FAKE_CEILING → 100% once ready

interface LoadingScreenProps {
  /** True once the real app content is ready to be shown. When false, progress
   * holds just under 100% instead of freezing at a false "100%". */
  ready?: boolean;
  /** Called once the finish animation actually reaches 100% (only fires when
   * `ready` is true). The parent should wait for this before unmounting the
   * loading screen and swapping in the real content — otherwise the screen
   * gets replaced mid-ramp and the viewer never sees 100%. */
  onDone?: () => void;
}

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

const LoadingScreen: React.FC<LoadingScreenProps> = ({ ready = false, onDone }) => {
  const [progress, setProgress] = useState(0);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const startRef = useRef<number>(performance.now());
  const rafRef = useRef<number>(0);
  const readyRef = useRef(ready);
  const readyAtRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => { readyRef.current = ready; }, [ready]);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    startRef.current = performance.now();

    // Ramp quickly to a fake ceiling below 100% — if the real app isn't ready
    // yet we hold just under 100% (never freezing at a false "100%"), then once
    // `ready` flips true we finish the last stretch to 100% quickly.
    const tick = (now: number) => {
      if (readyRef.current) {
        if (readyAtRef.current === null) readyAtRef.current = now;
        const finishElapsed = now - readyAtRef.current;
        const pct = FAKE_CEILING + Math.min(finishElapsed / FINISH_MS, 1) * (100 - FAKE_CEILING);
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

    // Cycle phrases every ~560ms
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
