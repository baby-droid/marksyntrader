import React from 'react';
import classNames from 'classnames';
import {
    ExecutionSpeed,
    getExecutionSpeed,
    isFastExecutionEnabled,
    setExecutionSpeed,
    setFastExecutionEnabled,
    subscribeExecutionSpeed,
    subscribeFastExecution,
} from '@/utils/execution-speed';

const SPEED_OPTIONS: { value: ExecutionSpeed; label: string; title: string }[] = [
    { value: 'normal', label: 'Normal', title: 'One contract at a time' },
    { value: 'crazy', label: 'Crazy', title: 'Up to two contracts in flight' },
    { value: 'turbo', label: 'Turbo', title: 'Up to three contracts in flight' },
];

type TExecutionSpeedControl = {
    disabled?: boolean;
};

const ExecutionSpeedControl = ({ disabled = false }: TExecutionSpeedControl) => {
    const [speed, setSpeed] = React.useState<ExecutionSpeed>(getExecutionSpeed());
    const [fastEnabled, setFastEnabled] = React.useState(isFastExecutionEnabled());

    React.useEffect(() => {
        setSpeed(getExecutionSpeed());
        setFastEnabled(isFastExecutionEnabled());
        const unsubscribeSpeed = subscribeExecutionSpeed(setSpeed);
        const unsubscribeFast = subscribeFastExecution(setFastEnabled);

        return () => {
            unsubscribeSpeed();
            unsubscribeFast();
        };
    }, []);

    return (
        <div className='animation__execution-controls' role='group' aria-label='Bot execution speed'>
            <div className='animation__execution-speeds' role='group' aria-label='Concurrent contract mode'>
                {SPEED_OPTIONS.map(option => (
                    <button
                        key={option.value}
                        type='button'
                        className={classNames('animation__speed-button', `animation__speed-button--${option.value}`, {
                            'animation__speed-button--active': speed === option.value,
                        })}
                        aria-label={option.label}
                        aria-pressed={speed === option.value}
                        title={option.title}
                        disabled={disabled}
                        onClick={() => setExecutionSpeed(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
            <button
                type='button'
                className={classNames('animation__speed-button', 'animation__speed-button--fast', {
                    'animation__speed-button--active': fastEnabled,
                })}
                aria-label='Fast'
                aria-pressed={fastEnabled}
                title='Removes app-added delay; the XML strategy still controls entry timing'
                disabled={disabled}
                onClick={() => setFastExecutionEnabled(!fastEnabled)}
            >
                Fast
            </button>
        </div>
    );
};

export default ExecutionSpeedControl;
