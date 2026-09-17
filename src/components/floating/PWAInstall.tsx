// @ts-nocheck
/**
 * PWAInstall — floating install banner shown on every page load.
 * Mirrors the InstallPrompt component but lives inside main.tsx's
 * component tree so it renders after auth is resolved.
 *
 * Shows on every load (no persistent dismissal).
 * Supports: Chrome/Edge/Android native prompt, iOS add-to-homescreen guide,
 *            Desktop install via address-bar icon.
 */
import React, { useEffect, useRef, useState } from 'react';
import './pwa-install.scss';

let deferredPrompt: any = null;

function isIos(): boolean {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
    );
}

const PWAInstall: React.FC = () => {
    const [visible, setVisible]     = useState(false);
    const [hasNative, setHasNative] = useState(false);
    const [ios, setIos]             = useState(false);
    const [installed, setInstalled] = useState(isStandalone());
    const timerRef = useRef<any>(null);

    useEffect(() => {
        if (isStandalone()) return; // already installed as PWA

        const iosDevice = isIos();
        setIos(iosDevice);

        const capturePrompt = (e: Event) => {
            e.preventDefault();
            deferredPrompt = e;
            setHasNative(true);
        };
        window.addEventListener('beforeinstallprompt', capturePrompt);
        window.addEventListener('appinstalled', () => {
            setInstalled(true);
            setVisible(false);
        });

        // Show after 2 s on every load
        timerRef.current = setTimeout(() => setVisible(true), 2000);

        return () => {
            window.removeEventListener('beforeinstallprompt', capturePrompt);
            clearTimeout(timerRef.current);
        };
    }, []);

    const install = async () => {
        if (hasNative && deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') setInstalled(true);
            deferredPrompt = null;
        }
        setVisible(false);
    };

    const close = () => setVisible(false);

    if (installed || !visible) return null;

    return (
        <div className='pwa-install'>
            <button className='pwa-install__close' onClick={close} aria-label='Close'>✕</button>

            <div className='pwa-install__top'>
                <div className='pwa-install__icon-wrap'>
                    <img src='/logo.jpeg' alt='logo' />
                </div>
                <div className='pwa-install__brand'>
                    <strong className='pwa-install__title'>Install App</strong>
                    <span className='pwa-install__sub'>Marksyntrader · Ahmed Syn Trader</span>
                </div>
            </div>

            <ul className='pwa-install__features'>
                <li>⚡ Faster launch — no browser chrome</li>
                <li>📲 Works on mobile &amp; desktop</li>
                <li>🔔 Instant trade notifications</li>
            </ul>

            {ios ? (
                <div className='pwa-install__ios'>
                    <p><strong>Add to Home Screen:</strong></p>
                    <ol>
                        <li>Tap the <strong>Share ⬆</strong> button in Safari</li>
                        <li>Tap <strong>"Add to Home Screen"</strong></li>
                        <li>Tap <strong>"Add"</strong></li>
                    </ol>
                </div>
            ) : hasNative ? (
                <button className='pwa-install__btn pwa-install__btn--install' onClick={install}>
                    ⬇ Install App
                </button>
            ) : (
                <div className='pwa-install__manual'>
                    Click the <strong>install ⊕</strong> icon in your browser's address bar.
                </div>
            )}

            <button className='pwa-install__later' onClick={close}>Maybe later</button>
        </div>
    );
};

export default PWAInstall;
