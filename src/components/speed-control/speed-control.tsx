import React from 'react';
import {
    ExecutionSpeed,
    getExecutionSpeed,
    getMetrics,
    getPingMs,
    getTicksPerSec,
    isFastExecutionEnabled,
    setExecutionSpeed,
    setFastExecutionEnabled,
    subscribeExecutionSpeed,
    subscribeFastExecution,
    subscribeMetrics,
    subscribePing,
    subscribeTickRate,
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

function pingColor(ms: number | null): string {
    if (ms == null) return '#475569';
    if (ms < 50)  return '#22c55e';
    if (ms < 120) return '#eab308';
    if (ms < 250) return '#f97316';
    return '#ef4444';
}

function pingLabel(ms: number | null): string {
    if (ms == null) return '⬤ Measuring…';
    if (ms < 50)  return `⬤ ${ms}ms — Excellent`;
    if (ms < 120) return `⬤ ${ms}ms — Good`;
    if (ms < 250) return `⬤ ${ms}ms — Moderate`;
    return `⬤ ${ms}ms — Slow`;
}

const SpeedControl: React.FC<TSpeedControl> = ({ className, compact }) => {
    const [speed,    setSpeed]    = React.useState<ExecutionSpeed>(getExecutionSpeed());
    const [fastExec, setFastExec] = React.useState<boolean>(isFastExecutionEnabled());
    const [metrics,  setMetrics]  = React.useState<ExecutionMetrics>(getMetrics());
    const [pingMs,   setPingMs]   = React.useState<number | null>(getPingMs());
    const [ticksPs,  setTicksPs]  = React.useState<number>(getTicksPerSec());
    const [showDiag, setShowDiag] = React.useState(false);
    const diagRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => subscribeExecutionSpeed(setSpeed), []);
    React.useEffect(() => subscribeFastExecution(setFastExec), []);
    React.useEffect(() => subscribeMetrics(setMetrics), []);
    React.useEffect(() => subscribePing(setPingMs), []);
    React.useEffect(() => subscribeTickRate(setTicksPs), []);

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

            {/* ⚡ Fast — supersonic zero-latency execution toggle
                When active, the engine:
                  • Forces POST_DELAY = 0 across all speed tiers
                  • Skips inter-contract delays in scalper / multi-contract runs
                  • Reduces first-trade init wait from 800ms → 100ms
                  • Records proposal + buy round-trip latency for diagnostics
                  • Defers POC subscription to rAF so the trade path is unblocked
                  • Monitors WS ping every 3s and tick rate in real-time */}
            <button
                type='button'
                title={fastExec
                    ? 'FAST MODE ACTIVE — zero inter-trade delay, async UI, live latency monitoring. Click to disable.'
                    : 'Fast — supersonic zero-delay mode. Removes all artificial delays, defers UI updates, monitors WS latency.'}
                aria-pressed={fastExec}
                className={`speed-control__fast ${fastExec ? 'active' : ''}`}
                onClick={() => setFastExecutionEnabled(!fastExec)}
            >
                ⚡ Fast
            </button>

            {/* Diagnostics toggle — visible when Fast is enabled */}
            {fastExec && (
                <div className='speed-control__diag-wrap' ref={diagRef}>
                    <button
                        type='button'
                        className='speed-control__diag-btn'
                        title='View execution latency diagnostics'
                        onClick={() => setShowDiag(v => !v)}
                    >
                        {pingMs != null ? `${pingMs}ms` : totalMs != null ? `${totalMs.toFixed(0)}ms` : 'ⓘ'}
                    </button>

                    {showDiag && (
                        <div className='speed-control__diag-panel'>
                            {/* Header */}
                            <div className='speed-control__diag-title'>
                                ⚡ FAST MODE ENABLED
                            </div>

                            {/* WS Ping */}
                            <div className='speed-control__diag-ping' style={{ color: pingColor(pingMs) }}>
                                {pingLabel(pingMs)}
                            </div>

                            {/* Tick rate */}
                            <div className='speed-control__diag-tickrate'>
                                <span>Tick rate</span>
                                <span>{ticksPs > 0 ? `${ticksPs} ticks/s` : '—'}</span>
                            </div>

                            {/* Internal latency */}
                            {totalLabel && (
                                <div className='speed-control__diag-status'>{totalLabel}</div>
                            )}
                            <table className='speed-control__diag-table'>
                                <tbody>
                                    <tr>
                                        <td>Proposal round-trip</td>
                                        <td>{fmtMs(metrics.evalToBuy)}</td>
                                    </tr>
                                    <tr>
                                        <td>Buy confirmation</td>
                                        <td>{fmtMs(metrics.buyToResponse)}</td>
                                    </tr>
                                    <tr className='speed-control__diag-total'>
                                        <td>Total internal</td>
                                        <td>{fmtMs(metrics.totalLatency)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div className='speed-control__diag-note'>
                                Software-internal pipeline only.
                                Network + broker latency shown as WS ping above.
                            </div>

                            {/* Active optimisations checklist */}
                            <div className='speed-control__diag-features'>
                                <span>✓ Zero inter-trade delay</span>
                                <span>✓ 100ms init (vs 800ms)</span>
                                <span>✓ Async POC subscription</span>
                                <span>✓ Latency metrics</span>
                                <span>✓ Live WS ping monitor</span>
                                <span>✓ Tick rate counter</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SpeedControl;
