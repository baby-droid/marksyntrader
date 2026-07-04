// @ts-nocheck
import React, { useEffect, useState } from 'react';
import './loading-screen.scss';

const PHRASES = [
  'Connecting to markets...',
  'Loading AI engines...',
  'Syncing live ticks...',
  'Initializing trade systems...',
  'Almost ready...',
];

const LoadingScreen: React.FC = () => {
  const [phrase, setPhrase] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const phraseTimer = setInterval(() => setPhrase(p => (p + 1) % PHRASES.length), 1800);
    const progressTimer = setInterval(() => setProgress(p => Math.min(p + Math.random() * 8, 95)), 400);
    return () => { clearInterval(phraseTimer); clearInterval(progressTimer); };
  }, []);

  return (
    <div className='loading-screen'>
      {/* Animated grid background */}
      <div className='loading-screen__grid' />

      {/* Floating particles */}
      <div className='loading-screen__particles'>
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className='loading-screen__particle'
            style={{
              left: `${(i * 5.5 + 3) % 100}%`,
              animationDelay: `${(i % 6) * 0.7}s`,
              animationDuration: `${6 + (i % 5)}s`,
            }}
          />
        ))}
      </div>

      {/* Orbiting rings */}
      <div className='loading-screen__rings'>
        <div className='loading-screen__ring loading-screen__ring--1' />
        <div className='loading-screen__ring loading-screen__ring--2' />
        <div className='loading-screen__ring loading-screen__ring--3' />
      </div>

      {/* Center card */}
      <div className='loading-screen__card'>
        {/* Logo */}
        <div className='loading-screen__logo-wrap'>
          <img src='/logo.jpeg' alt='Ahmed Syn Trader' className='loading-screen__logo' />
          <div className='loading-screen__logo-glow' />
        </div>

        {/* Brand name */}
        <div className='loading-screen__brand'>
          <h1 className='loading-screen__name'>AHMED SYN TRADER</h1>
          <p className='loading-screen__tagline'>Professional Deriv Trading Platform</p>
        </div>

        {/* Progress bar */}
        <div className='loading-screen__bar-wrap'>
          <div className='loading-screen__bar'>
            <div className='loading-screen__bar-fill' style={{ width: `${progress}%` }} />
            <div className='loading-screen__bar-glow' style={{ left: `${progress}%` }} />
          </div>
          <span className='loading-screen__percent'>{Math.floor(progress)}%</span>
        </div>

        {/* Phrase */}
        <p className='loading-screen__phrase' key={phrase}>{PHRASES[phrase]}</p>

        {/* Dots */}
        <div className='loading-screen__dots'>
          {[0,1,2,3,4].map(i => <span key={i} className='loading-screen__dot' style={{ animationDelay: `${i * 0.18}s` }} />)}
        </div>

        {/* Live market ticker */}
        <div className='loading-screen__ticker'>
          <div className='loading-screen__ticker-track'>
            {['V10','V25','V50','V75','V100','V10 1s','V25 1s','V50 1s','V100 1s','V10','V25','V50','V75','V100'].map((s, i) => (
              <span key={i} className='loading-screen__ticker-item'>
                {s}<i className={i % 2 ? 'down' : 'up'}>{i % 2 ? '▼' : '▲'}</i>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Corner decorations */}
      <div className='loading-screen__corner loading-screen__corner--tl' />
      <div className='loading-screen__corner loading-screen__corner--tr' />
      <div className='loading-screen__corner loading-screen__corner--bl' />
      <div className='loading-screen__corner loading-screen__corner--br' />

      {/* Bottom watermark */}
      <div className='loading-screen__footer'>
        <span>Powered by Deriv WebSocket API</span>
        <span className='loading-screen__version'>v2.0</span>
      </div>
    </div>
  );
};

export default LoadingScreen;
