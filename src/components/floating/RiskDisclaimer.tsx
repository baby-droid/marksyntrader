import React, { useEffect, useRef, useState } from 'react';
import './risk-disclaimer.scss';

const STORAGE_KEY_DISMISSED = 'risk_disclaimer_dismissed';
const STORAGE_KEY_POS = 'risk_disclaimer_pos';

function getDefaultPos() {
    if (typeof window === 'undefined') return { x: 20, y: 480 };
    try {
        const saved = localStorage.getItem(STORAGE_KEY_POS);
        if (saved) {
            const p = JSON.parse(saved);
            if (typeof p.x === 'number' && typeof p.y === 'number') return p;
        }
    } catch { /* ignore */ }
    // Default: bottom-left, 20px from left, 90px from bottom
    return { x: 20, y: Math.max(20, window.innerHeight - 310) };
}

const RiskDisclaimer: React.FC = () => {
    const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(STORAGE_KEY_DISMISSED));
    const [minimized, setMinimized] = useState(false);
    const [pos, setPos] = useState(getDefaultPos);
    const dragging = useRef(false);
    const offset = useRef({ x: 0, y: 0 });

    const onMouseDown = (e: React.MouseEvent) => {
        dragging.current = true;
        offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    };

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragging.current) return;
            const x = Math.max(0, Math.min(window.innerWidth - 20, e.clientX - offset.current.x));
            const y = Math.max(0, Math.min(window.innerHeight - 20, e.clientY - offset.current.y));
            setPos({ x, y });
        };
        const onUp = () => {
            if (dragging.current) {
                dragging.current = false;
                // Persist final position
                setPos(p => {
                    try { localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(p)); } catch { /* ignore */ }
                    return p;
                });
            }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, []);

    const dismiss = () => {
        localStorage.setItem(STORAGE_KEY_DISMISSED, '1');
        setDismissed(true);
    };

    if (dismissed) return null;

    return (
        <div
            className='risk-disclaimer'
            style={{ left: pos.x, top: pos.y }}
        >
            <div className='risk-disclaimer__header' onMouseDown={onMouseDown}>
                <span className='risk-disclaimer__title'>⚠ Risk Disclaimer</span>
                <div className='risk-disclaimer__header-actions'>
                    <button className='risk-disclaimer__min-btn' onMouseDown={e => e.stopPropagation()} onClick={() => setMinimized(m => !m)}>
                        {minimized ? '▲' : '▼'}
                    </button>
                </div>
            </div>

            {!minimized && (
                <div className='risk-disclaimer__body'>
                    <p>
                        <strong>Trading involves significant risk.</strong> Binary options and volatility indices
                        carry a high risk of losing money rapidly due to leverage. Past performance is not
                        indicative of future results.
                    </p>
                    <p>
                        Only trade with funds you can afford to lose. Never trade with borrowed money.
                        This platform is for educational and analysis purposes.
                    </p>
                    <p className='risk-disclaimer__legal'>
                        By using this platform you acknowledge you understand these risks fully.
                    </p>
                    <button className='risk-disclaimer__accept-btn' onClick={dismiss}>
                        ✓ I Understand the Risks
                    </button>
                </div>
            )}
        </div>
    );
};

export default RiskDisclaimer;
