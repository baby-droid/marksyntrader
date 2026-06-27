import React, { useEffect, useRef, useState } from 'react';
import './risk-disclaimer.scss';

const RiskDisclaimer: React.FC = () => {
    const [dismissed, setDismissed] = useState(() => !!localStorage.getItem('risk_disclaimer_dismissed'));
    const [minimized, setMinimized] = useState(false);
    const [pos, setPos] = useState({ x: 20, y: 480 });
    const dragging = useRef(false);
    const offset = useRef({ x: 0, y: 0 });

    const onMouseDown = (e: React.MouseEvent) => {
        dragging.current = true;
        offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    };

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragging.current) return;
            setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
        };
        const onUp = () => { dragging.current = false; };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, []);

    const dismiss = () => {
        localStorage.setItem('risk_disclaimer_dismissed', '1');
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
