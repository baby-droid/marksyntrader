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
// Crazy and Turbo both fire with zero artificial delay — any positive value
// (even 1ms) adds a real setTimeout/event-loop tick per trade, which is not
// "no delay". Turbo additionally skips proposal pre-checks where possible
// (see Purchase.js) so it re-enters purchase the instant the engine allows it.
export const SPEED_DELAY_MS: Record<ExecutionSpeed, number> = {
    normal: 200,  // reduced from 1000ms — fast like dBot.deriv.com
    crazy: 0,     // no artificial delay — fires the instant the engine is ready
    turbo: 0,     // no artificial delay — fastest re-entry the API allows
};

// Max concurrent in-flight contracts per speed tier.
// Higher = more contracts processing simultaneously = higher throughput.
export const SPEED_MAX_INFLIGHT: Record<ExecutionSpeed, number> = {
    normal: 1,    // sequential
    crazy: 100,   // high pipeline depth
    turbo: 500,   // unlimited practical cap — saturate the API
};

// Purchases fired per tick for each speed tier. Normal fires a single
// purchase per tick (one contract at a time, as before). Crazy and Turbo
// fire several purchases in parallel on the SAME tick, each an independent
// contract — this is what actually multiplies throughput per tick rather
// than just relaxing the inter-trade delay.
export const SPEED_PURCHASES_PER_TICK: Record<ExecutionSpeed, number> = {
    normal: 1,
    crazy: 5,
    turbo: 10,
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
