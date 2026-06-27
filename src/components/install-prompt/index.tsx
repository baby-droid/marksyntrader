// @ts-nocheck
import React, { useEffect, useState } from 'react';
import './install-prompt.scss';

let deferredPrompt: any = null;

const InstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: any) => {
      e.preventDefault();
      deferredPrompt = e;
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setShowPrompt(false);
    deferredPrompt = null;
  };

  const handleDismiss = () => setShowPrompt(false);

  if (isInstalled || !showPrompt) return null;

  return (
    <div className='install-prompt'>
      <div className='install-prompt__content'>
        <div className='install-prompt__icon'>
          <img src='/logo.jpeg' alt='Marksyntrader' />
        </div>
        <div className='install-prompt__text'>
          <p className='install-prompt__title'>Install Marksyntrader</p>
          <p className='install-prompt__subtitle'>Fast access on PC & mobile</p>
        </div>
        <div className='install-prompt__actions'>
          <button className='install-prompt__btn install-prompt__btn--install' onClick={handleInstall}>
            Install
          </button>
          <button className='install-prompt__btn install-prompt__btn--dismiss' onClick={handleDismiss}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
