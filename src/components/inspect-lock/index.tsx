// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import './inspect-lock.scss';

const CORRECT_PIN = 'AHMED2005';

const InspectLock: React.FC = () => {
    const [locked, setLocked] = useState(false);
    const [pin, setPin] = useState('');
    const [shake, setShake] = useState(false);
    const [error, setError] = useState('');
    const checkRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const detectDevTools = () => {
            const threshold = 160;
            const widthDiff = window.outerWidth - window.innerWidth;
            const heightDiff = window.outerHeight - window.innerHeight;
            if (widthDiff > threshold || heightDiff > threshold) {
                setLocked(true);
                if (inputRef.current) inputRef.current.focus();
            }
        };

        // Override console methods to detect usage
        const origConsoleOpen = window.console._commandLineAPI !== undefined;
        const devtools = { open: false };
        const element = new Image();
        Object.defineProperty(element, 'id', {
            get: () => { devtools.open = true; setLocked(true); return ''; },
        });

        checkRef.current = setInterval(() => {
            detectDevTools();
            devtools.open = false;
            console.log('%c', element);
        }, 1000);

        window.addEventListener('resize', detectDevTools);

        // Block right-click
        const noContext = (e: MouseEvent) => e.preventDefault();
        document.addEventListener('contextmenu', noContext);

        // Block F12 and common devtools shortcuts
        const noDevKeys = (e: KeyboardEvent) => {
            if (
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && ['I','J','C','U'].includes(e.key.toUpperCase())) ||
                (e.metaKey && e.altKey && ['I','J'].includes(e.key.toUpperCase()))
            ) {
                e.preventDefault();
                e.stopPropagation();
                setLocked(true);
                return false;
            }
        };
        document.addEventListener('keydown', noDevKeys, true);

        return () => {
            if (checkRef.current) clearInterval(checkRef.current);
            window.removeEventListener('resize', detectDevTools);
            document.removeEventListener('contextmenu', noContext);
            document.removeEventListener('keydown', noDevKeys, true);
        };
    }, []);

    const handleSubmit = () => {
        if (pin === CORRECT_PIN) {
            setLocked(false);
            setPin('');
            setError('');
        } else {
            setShake(true);
            setError('Incorrect PIN. Access denied.');
            setPin('');
            setTimeout(() => setShake(false), 600);
        }
    };

    if (!locked) return null;

    return (
        <div className='inspect-lock'>
            <div className={`inspect-lock__box ${shake ? 'shake' : ''}`}>
                <div className='inspect-lock__logo'>🔐</div>
                <h2 className='inspect-lock__title'>AHMED SYN TRADER</h2>
                <p className='inspect-lock__subtitle'>Security Lock — Enter PIN to continue</p>
                <div className='inspect-lock__dots'>
                    {Array.from({ length: CORRECT_PIN.length }, (_, i) => (
                        <span key={i} className={`inspect-lock__dot ${i < pin.length ? 'filled' : ''}`} />
                    ))}
                </div>
                <input
                    ref={inputRef}
                    className='inspect-lock__input'
                    type='password'
                    placeholder='Enter PIN'
                    value={pin}
                    maxLength={20}
                    onChange={e => { setPin(e.target.value); setError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                    autoFocus
                />
                {error && <p className='inspect-lock__error'>{error}</p>}
                <button className='inspect-lock__btn' onClick={handleSubmit}>
                    UNLOCK
                </button>
                <p className='inspect-lock__footer'>Unauthorized inspection is prohibited.</p>
            </div>
        </div>
    );
};

export default InspectLock;
