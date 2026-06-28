import React, { useEffect, useState } from 'react';
import './pwa-install.scss';

const PWAInstall: React.FC = () => {
    const [prompt, setPrompt] = useState<any>(null);
    const [dismissed, setDismissed] = useState(() => !!sessionStorage.getItem('pwa_dismissed'));
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', () => setInstalled(true));
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const install = async () => {
        if (!prompt) return;
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
            setInstalled(true);
        }
        setPrompt(null);
    };

    const dismiss = () => {
        sessionStorage.setItem('pwa_dismissed', '1');
        setDismissed(true);
    };

    if (dismissed || installed || !prompt) return null;

    return (
        <div className='pwa-install'>
            <div className='pwa-install__icon'>📲</div>
            <div className='pwa-install__text'>
                <strong>Install AHMEDSYNTRADERSITE</strong>
                <span>Add to your home screen for the best experience</span>
            </div>
            <div className='pwa-install__actions'>
                <button className='pwa-install__btn pwa-install__btn--install' onClick={install}>Install</button>
                <button className='pwa-install__btn pwa-install__btn--dismiss' onClick={dismiss}>✕</button>
            </div>
        </div>
    );
};

export default PWAInstall;
