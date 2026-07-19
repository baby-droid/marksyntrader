// @ts-nocheck
/**
 * InstallPrompt — shows on every page load/refresh.
 * • Android/Chrome/Edge: triggers native "Add to Home Screen" via beforeinstallprompt
 * • iOS Safari:          shows manual instructions (no native API on iOS)
 * • Desktop Chrome/Edge: shows native install dialog
 * • Already installed:   hidden
 * • Close button dismisses for this session only (reappears on next load)
 */
import React, { useEffect, useRef, useState } from 'react';
import './install-prompt.scss';

let deferredPrompt: any = null;

function isIos(): boolean {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
    );
}

const InstallPrompt: React.FC = () => {
    const [visible, setVisible]     = useState(false);
    const [hasNative, setHasNative] = useState(false);
    const [ios, setIos]             = useState(false);
    const [installed, setInstalled] = useState(false);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }

        // Already running as installed PWA — never show
        if (isInStandaloneMode()) {
            setInstalled(true);
            return;
        }

        const iosDevice = isIos();
        setIos(iosDevice);

        // Capture the native browser install prompt (Chrome/Edge/Android)
        const capturePrompt = (e: Event) => {
            e.preventDefault();
            deferredPrompt = e;
            setHasNative(true);
        };
        window.addEventListener('beforeinstallprompt', capturePrompt);

        // Track when the app gets installed via browser UI
        window.addEventListener('appinstalled', () => {
            setInstalled(true);
            setVisible(false);
        });

        // Show popup after a short delay on every load
        // (user can close it; it comes back on next refresh)
        timerRef.current = setTimeout(() => {
            setVisible(true);
        }, 1800);

        return () => {
            window.removeEventListener('beforeinstallprompt', capturePrompt);
            clearTimeout(timerRef.current);
        };
    }, []);

    const handleInstall = async () => {
        if (hasNative && deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') setInstalled(true);
            deferredPrompt = null;
        }
        setVisible(false);
    };

    const handleClose = () => setVisible(false);

    if (installed || !visible) return null;

    return (
        <div className='install-popup' role='dialog' aria-label='Install App'>
            {/* Card */}
            <div className='install-popup__card'>
                {/* Close button (top-right) */}
                <button className='install-popup__close' onClick={handleClose} aria-label='Close'>
                    ✕
                </button>

                {/* Icon + branding */}
                <div className='install-popup__top'>
                    <div className='install-popup__icon'>
                        <img src='/logo.jpeg' alt='Marksyntrader' />
                    </div>
                    <div className='install-popup__brand'>
                        <span className='install-popup__title'>Install App</span>
                        <span className='install-popup__sub'>Marksyntrader · Ahmed Syn Trader</span>
                    </div>
                </div>

                {/* Features list */}
                <ul className='install-popup__features'>
                    <li>⚡ Faster launch — no browser needed</li>
                    <li>📲 Works on mobile &amp; desktop</li>
                    <li>🔔 Instant trade notifications</li>
                    <li>🌐 Works offline (cached assets)</li>
                </ul>

                {/* Install action */}
                {ios ? (
                    /* iOS instructions — no native prompt API */
                    <div className='install-popup__ios'>
                        <p className='install-popup__ios-title'>Add to Home Screen</p>
                        <ol className='install-popup__ios-steps'>
                            <li>Tap the <strong>Share</strong> button <span className='install-popup__ios-icon'>⬆</span> in Safari</li>
                            <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                            <li>Tap <strong>"Add"</strong></li>
                        </ol>
                    </div>
                ) : hasNative ? (
                    <button className='install-popup__btn install-popup__btn--primary' onClick={handleInstall}>
                        ⬇ Install App
                    </button>
                ) : (
                    /* Desktop fallback — guide user to browser's install button */
                    <div className='install-popup__manual'>
                        <p>Click the <strong>install</strong> icon <span>⊕</span> in your browser's address bar to add this app.</p>
                    </div>
                )}

                {/* Dismiss link */}
                <button className='install-popup__later' onClick={handleClose}>
                    Maybe later
                </button>
            </div>
        </div>
    );
};

export default InstallPrompt;
