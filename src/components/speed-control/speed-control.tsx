import React from 'react';
import {
    ExecutionSpeed,
    getExecutionSpeed,
    isFastExecutionEnabled,
    setExecutionSpeed,
    setFastExecutionEnabled,
    subscribeExecutionSpeed,
    subscribeFastExecution,
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

const SpeedControl: React.FC<TSpeedControl> = ({ className, compact }) => {
    const [speed, setSpeed] = React.useState<ExecutionSpeed>(getExecutionSpeed());
    const [fastExec, setFastExec] = React.useState<boolean>(isFastExecutionEnabled());

    React.useEffect(() => subscribeExecutionSpeed(setSpeed), []);
    React.useEffect(() => subscribeFastExecution(setFastExec), []);

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
            {/* Fast — independent zero-delay toggle, combinable with any tier.
                Forces zero delay / zero cooldown for EVERY single trade.
                Has a vivid background so it's always clearly visible. */}
            <button
                type='button'
                title='Fast — single contracts at supersonic zero-delay speed. Zero wait between any two trades, regardless of speed tier.'
                aria-pressed={fastExec}
                className={`speed-control__fast ${fastExec ? 'active' : ''}`}
                onClick={() => setFastExecutionEnabled(!fastExec)}
            >
                ⚡ Fast
            </button>
        </div>
    );
};

export default SpeedControl;
