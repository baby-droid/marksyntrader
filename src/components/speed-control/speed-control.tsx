import React from 'react';
import {
    ExecutionSpeed,
    getExecutionSpeed,
    getMetrics,
    isFastExecutionEnabled,
    setExecutionSpeed,
    setFastExecutionEnabled,
    subscribeExecutionSpeed,
    subscribeFastExecution,
    subscribeMetrics,
    ExecutionMetrics,
} from '@/utils/execution-speed';
import './speed-control.scss';

const OPTIONS: { value: ExecutionSpeed; label: string; title: string }[] = [
    { value: 'normal', label: 'Normal', title: 'Normal — waits for each contract to settle before next' },
    { value: 'crazy',  label: 'Crazy',  title: 'Crazy — much faster re-entry, some contracts in flight' },
    { value: 'turbo',  label: 'Turbo',  title: 'Turbo — fastest re-entry the API allows, max in-flight' },
];

type TSpeedControl = {
    className?: string;
    compact?: boolean;
};

function fmtMs(v: number | null): string {
    if (v == null) return '—';
    return v < 1 ? `<1ms` : `${v.toFixed(0)}ms`;
}

const SpeedControl: React.FC<TSpeedControl> = ({ className, compact }) => {
    const [speed, setSpeed] = React.useState<ExecutionSpeed>(getExecutionSpeed());
    const [fastExec, setFastExec] = React.useState<boolean>(isFastExecutionEnabled());
    const [metrics, setMetrics] = React.useState<ExecutionMetrics>(getMetrics());
    const [showDiag, setShowDiag] = React.useState(false);
    const diagRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => subscribeExecutionSpeed(setSpeed), []);
    React.useEffect(() => subscribeFastExecution(setFastExec), []);
    React.useEffect(() => subscribeMetrics(setMetrics), []);

    /* Close diagnostics panel on outside click */
    React.useEffect(() => {
        if (!showDiag) return;
        const handler = (e: MouseEvent) => {
            if (diagRef.current && !diagRef.current.contains(e.target as Node)) {
                setShowDiag(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showDiag]);

    const totalMs = metrics.totalLatency;
    const totalLabel = totalMs != null
        ? totalMs < 5   ? '🟢 Excellent'
        : totalMs < 20  ? '🟡 Good'
        : totalMs < 50  ? '🟠 Moderate'
        :                  '🔴 Slow'
        : null;

    return (
        <div className={`speed-control ${compact ? 'speed-control--compact' : ''} ${className || ''}`}>
            {/* Normal / Crazy / Turbo tier selector */}
            <div className='speed-control__group' role='group' aria-label='Execution speed'>
                {OPTIONS.map(opt => (
                    <button
                        key={opt.value}
                        type='button'
                        title={opt.title}
                        aria-pressed={speed === opt.value}
                        className={`speed-control__btn speed-control__btn--${opt.value} ${
                            speed === opt.value ? 'active' : ''
                        }`}
                        onClick={() => setExecutionSpeed(opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* ⚡ Fast — event-driven zero-latency mode.
                When active, the engine:
                  • Skips proposal round-trip → direct buy
                  • Pre-validates all contract params on each tick
                  • Defers all UI updates via rAF (async, never blocks trades)
                  • Batches logging/stats after purchase dispatch
                  • Maintains a single persistent WS connection with instant reconnect */}
            <button
                type='button'
                title='Fast — single contracts at supersonic zero-delay speed. Pre-validates params, skips proposal, defers UI rendering. Click ⓘ for latency diagnostics.'
                aria-pressed={fastExec}
                className={`speed-control__fast ${fastExec ? 'active' : ''}`}
                onClick={() => setFastExecutionEnabled(!fastExec)}
            >
                ⚡ Fast
            </button>

            {/* Diagnostics toggle — only visible when Fast is enabled */}
            {fastExec && (
                <div className='speed-control__diag-wrap' ref={diagRef}>
                    <button
                        type='button'
                        className='speed-control__diag-btn'
                        title='View execution latency metrics'
                        onClick={() => setShowDiag(v => !v)}
                    >
                        {totalMs != null ? `${totalMs.toFixed(0)}ms` : 'ⓘ'}
                    </button>

                    {showDiag && (
                        <div className='speed-control__diag-panel'>
                            <div className='speed-control__diag-title'>
                                ⚡ Fast Execution — Latency Diagnostics
                            </div>
                            {totalLabel && (
                                <div className='speed-control__diag-status'>{totalLabel}</div>
                            )}
                            <table className='speed-control__diag-table'>
                                <tbody>
                                    <tr>
                                        <td>Tick → Eval</td>
                                        <td>{fmtMs(metrics.tickToEval)}</td>
                                    </tr>
                                    <tr>
                                        <td>Eval → Buy</td>
                                        <td>{fmtMs(metrics.evalToBuy)}</td>
                                    </tr>
                                    <tr>
                                        <td>Buy → Response</td>
                                        <td>{fmtMs(metrics.buyToResponse)}</td>
                                    </tr>
                                    <tr className='speed-control__diag-total'>
                                        <td>Total internal</td>
                                        <td>{fmtMs(metrics.totalLatency)}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className='speed-control__diag-note'>
                                Measures software-internal pipeline latency only.
                                Network and broker latency are not included.
                            </div>
                            <div className='speed-control__diag-features'>
                                <span>✓ Persistent WebSocket</span>
                                <span>✓ Direct buy (no proposal)</span>
                                <span>✓ Async UI updates</span>
                                <span>✓ Pre-validated params</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SpeedControl;
