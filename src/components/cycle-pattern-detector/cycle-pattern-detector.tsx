import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import {
    AI_CYCLE_ROUTE,
    barrierReturnPattern,
    nextCycleRouteIndex,
    parityRecoveryContract,
} from '@/utils/cycle-pattern';
import './cycle-pattern-detector.scss';

const MAX_DIGITS = 24;

function lastDigit(quote: number, pipSize: number) {
    const text = quote.toFixed(Math.max(0, pipSize));
    return Number(text[text.length - 1]);
}

const CyclePatternDetector: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [digits, setDigits] = useState<number[]>([]);
    const [routeIndex, setRouteIndex] = useState(0);
    const [status, setStatus] = useState('Waiting for an authenticated tick stream');
    const [lastSignal, setLastSignal] = useState<string | null>(null);
    const pipSizeRef = useRef<number | null>(null);
    const subscriptionRef = useRef<any>(null);
    const subscriptionIdRef = useRef<string | null>(null);
    const routeIndexRef = useRef(0);

    useEffect(() => { routeIndexRef.current = routeIndex; }, [routeIndex]);

    const route = AI_CYCLE_ROUTE[routeIndex % AI_CYCLE_ROUTE.length];
    const recovery = useMemo(() => parityRecoveryContract(digits), [digits]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const symbol = '1HZ50V';
        const stop = () => {
            subscriptionRef.current?.unsubscribe?.();
            subscriptionRef.current = null;
            if (subscriptionIdRef.current && api_base.api) {
                try { api_base.api.send({ forget: subscriptionIdRef.current }); } catch {}
            }
            subscriptionIdRef.current = null;
        };

        const start = () => {
            if (cancelled || !(api_base as any).api) return;
            try {
                const stream = (api_base as any).api.subscribe({ ticks: symbol, subscribe: 1 });
                subscriptionRef.current = stream.subscribe({
                    next: (response: any) => {
                        if (cancelled || !response?.tick) return;
                        if (response.subscription?.id) {
                            subscriptionIdRef.current = String(response.subscription.id);
                        }
                        const tick = response.tick;
                        if (tick.pip_size != null) pipSizeRef.current = Number(tick.pip_size);
                        const quote = Number(tick.quote);
                        if (!Number.isFinite(quote) || pipSizeRef.current == null) return;
                        const digit = lastDigit(quote, pipSizeRef.current);
                        setDigits(previous => {
                            const next = [...previous, digit].slice(-MAX_DIGITS);
                            const currentRoute = AI_CYCLE_ROUTE[routeIndexRef.current % AI_CYCLE_ROUTE.length];
                            if (barrierReturnPattern(next, currentRoute.barrier, currentRoute.side)) {
                                setLastSignal(`${currentRoute.label} return ready`);
                                setStatus(`${currentRoute.label} · one-tick entry pattern detected`);
                                setRouteIndex(index => {
                                    const nextIndex = nextCycleRouteIndex(index);
                                    routeIndexRef.current = nextIndex;
                                    return nextIndex;
                                });
                            } else {
                                setStatus(`Scanning ${currentRoute.label} · ${next.length}/${MAX_DIGITS} ticks`);
                            }
                            return next;
                        });
                    },
                    error: () => { if (!cancelled) setStatus('Tick stream paused · waiting to reconnect'); },
                });
            } catch {
                if (!cancelled) setStatus('Not connected · open a Deriv account session to scan');
            }
        };

        start();
        const retry = window.setInterval(start, 1500);
        return () => {
            cancelled = true;
            window.clearInterval(retry);
            stop();
        };
    }, [open]);

    return (
        <div className='cycle-pattern-detector'>
            <button
                type='button'
                className='run-panel__cycle-trigger'
                title='Open AI Engine Cycle Pattern Detector'
                aria-label='Open AI Engine Cycle Pattern Detector'
                aria-expanded={open}
                onClick={() => setOpen(value => !value)}
            >
                <span /><span /><span /><span />
            </button>
            {open && (
                <section className='cycle-pattern-detector__panel' role='dialog' aria-label='AI Engine Cycle Pattern Detector'>
                    <header className='cycle-pattern-detector__header'>
                        <div>
                            <strong>AI Engine Cycle Pattern Detector</strong>
                            <small>Authenticated live ticks · 1HZ50V</small>
                        </div>
                        <button type='button' onClick={() => setOpen(false)} aria-label='Close detector'>✕</button>
                    </header>
                    <div className='cycle-pattern-detector__route'>
                        {AI_CYCLE_ROUTE.map((item, index) => (
                            <span key={item.label} className={index === routeIndex ? 'active' : ''}>{item.label}</span>
                        ))}
                    </div>
                    <div className='cycle-pattern-detector__status'>
                        <span className={lastSignal ? 'signal' : 'live'} />
                        <b>{lastSignal ?? status}</b>
                    </div>
                    <div className='cycle-pattern-detector__pattern'>
                        <span>Pattern</span>
                        <strong>below · below · above · return</strong>
                        <small>Current return is the one-tick entry trigger.</small>
                    </div>
                    <div className='cycle-pattern-detector__digits' aria-label='Recent live digits'>
                        {digits.slice(-12).map((digit, index) => <span key={`${index}-${digit}`}>{digit}</span>)}
                        {!digits.length && <small>Collecting live digits…</small>}
                    </div>
                    <div className='cycle-pattern-detector__recovery'>
                        <span>Parity recovery</span>
                        <strong>{recovery === 'DIGITODD' ? '3 evens → Odd' : recovery === 'DIGITEVEN' ? '3 odds → Even' : 'Watching three-of-a-kind'}</strong>
                    </div>
                    <footer>Detection only. Real purchases remain on the official Bot Builder / Chart AI engine.</footer>
                </section>
            )}
        </div>
    );
};

export default CyclePatternDetector;