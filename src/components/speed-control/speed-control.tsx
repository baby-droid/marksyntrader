import React from 'react';
import {
    ExecutionSpeed,
    getExecutionSpeed,
    setExecutionSpeed,
    subscribeExecutionSpeed,
} from '@/utils/execution-speed';
import './speed-control.scss';

const OPTIONS: { value: ExecutionSpeed; label: string; title: string }[] = [
    { value: 'normal', label: 'Normal', title: 'Normal speed — waits for each contract to settle' },
    { value: 'crazy', label: 'Crazy', title: 'Crazy speed — much faster re-entry' },
    { value: 'turbo', label: 'Turbo', title: 'Turbo speed — fastest re-entry the API allows' },
];

type TSpeedControl = {
    className?: string;
    compact?: boolean;
};

const SpeedControl: React.FC<TSpeedControl> = ({ className, compact }) => {
    const [speed, setSpeed] = React.useState<ExecutionSpeed>(getExecutionSpeed());

    React.useEffect(() => subscribeExecutionSpeed(setSpeed), []);

    return (
        <div className={`speed-control ${compact ? 'speed-control--compact' : ''} ${className || ''}`}>
            {!compact && <span className='speed-control__label'>Speed</span>}
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
        </div>
    );
};

export default SpeedControl;
