/**
 * Global bot execution speed.
 *
 * Controls how aggressively the trading engine re-purchases contracts:
 *  - normal : default pacing (waits for a contract to settle before the next).
 *  - crazy  : reduced inter-trade delay for faster re-entry.
 *  - turbo  : minimal delay — fastest re-entry the API allows.
 *
 * The value is shared app-wide (speed toggle beside Run, the floating AI, and
 * the trade engine all read it) and persisted so it survives reloads.
 */
export type ExecutionSpeed = 'normal' | 'crazy' | 'turbo';

const STORAGE_KEY = 'execution_speed';

// Inter-trade delay (ms) applied by the engine between purchases per speed.
export const SPEED_DELAY_MS: Record<ExecutionSpeed, number> = {
    normal: 1000,
    crazy: 1, // ~0.001s between re-entries
    turbo: 0, // no artificial delay — fastest the API allows
};

const listeners = new Set<(speed: ExecutionSpeed) => void>();

const read = (): ExecutionSpeed => {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === 'normal' || v === 'crazy' || v === 'turbo') return v;
    } catch {
        /* localStorage unavailable */
    }
    return 'normal';
};

let current: ExecutionSpeed = read();

export const getExecutionSpeed = (): ExecutionSpeed => current;

export const getExecutionSpeedDelay = (): number => SPEED_DELAY_MS[current];

export const setExecutionSpeed = (speed: ExecutionSpeed): void => {
    current = speed;
    try {
        localStorage.setItem(STORAGE_KEY, speed);
    } catch {
        /* localStorage unavailable */
    }
    listeners.forEach(fn => fn(speed));
};

export const subscribeExecutionSpeed = (fn: (speed: ExecutionSpeed) => void): (() => void) => {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
};
