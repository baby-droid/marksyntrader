/**
 * Global bot execution speed.
 *
 * Two independent axes:
 *  1. `speed` (normal | crazy | turbo) — how many purchases fan out per tick
 *     and how the engine reacts to rate limits.
 *  2. `fastExecution` (on/off) — an independent "Fast Execution" toggle that
 *     forces zero delay for EVERY single trade regardless of which speed
 *     tier is selected. It can be combined with Normal, Crazy, or Turbo —
 *     e.g. Crazy + Fast Execution fans out several purchases per tick AND
 *     removes any remaining inter-trade delay/cooldown/contract-switch pause
 *     for each of them.
 *
 * Both values are shared app-wide (speed toggle beside Run, the floating AI,
 * and the trade engine all read them) and persisted so they survive reloads.
 */
export type ExecutionSpeed = 'normal' | 'crazy' | 'turbo';

const STORAGE_KEY = 'execution_speed';
const FAST_EXEC_STORAGE_KEY = 'fast_execution_enabled';

// Inter-trade delay (ms) applied by the engine between purchases per speed,
// BEFORE the independent Fast Execution toggle is taken into account (see
// getExecutionSpeedDelay below, which forces 0 when Fast Execution is on).
export const SPEED_DELAY_MS: Record<ExecutionSpeed, number> = {
    normal: 200,  // reduced from 1000ms — fast like dBot.deriv.com
    crazy: 0,     // no artificial delay — fires the instant the engine is ready
    turbo: 0,     // no artificial delay — fastest re-entry the API allows
};

// Max concurrent in-flight contracts per speed tier. Fast Execution bumps
// whichever tier is active up to the highest practical cap (see
// getMaxInflight below).
export const SPEED_MAX_INFLIGHT: Record<ExecutionSpeed, number> = {
    normal: 1,    // sequential
    crazy: 100,   // high pipeline depth
    turbo: 500,   // unlimited practical cap — saturate the API
};
const FAST_EXEC_MAX_INFLIGHT = 1000;

// Purchases fired per tick for each speed tier. Normal fires a single
// purchase per tick (one contract at a time, as before). Crazy and Turbo
// fire several purchases in parallel on the SAME tick, each an independent
// contract. Fast Execution (see getPurchasesPerTick below) raises this
// further on top of whichever tier is selected — it never lowers it.
export const SPEED_PURCHASES_PER_TICK: Record<ExecutionSpeed, number> = {
    normal: 1,
    crazy: 5,
    turbo: 10,
};
const FAST_EXEC_PURCHASES_PER_TICK = 20;

const listeners = new Set<(speed: ExecutionSpeed) => void>();
const fastExecListeners = new Set<(enabled: boolean) => void>();

const readSpeed = (): ExecutionSpeed => {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === 'normal' || v === 'crazy' || v === 'turbo') return v;
    } catch {
        /* localStorage unavailable */
    }
    return 'normal';
};

const readFastExec = (): boolean => {
    try {
        return localStorage.getItem(FAST_EXEC_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
};

let current: ExecutionSpeed = readSpeed();
let fastExecutionEnabled: boolean = readFastExec();

export const getExecutionSpeed = (): ExecutionSpeed => current;

export const isFastExecutionEnabled = (): boolean => fastExecutionEnabled;

/**
 * Effective inter-trade delay (ms). Fast Execution always wins — 0ms,
 * seamless, no cooldown, no contract-switch pause, no next-execution reload
 * wait — no matter which speed tier (Normal/Crazy/Turbo) is selected.
 */
export const getExecutionSpeedDelay = (): number =>
    fastExecutionEnabled ? 0 : SPEED_DELAY_MS[current];

/** Effective max concurrent in-flight contracts — the higher of the active tier or Fast Execution's cap. */
export const getMaxInflight = (): number =>
    fastExecutionEnabled ? Math.max(SPEED_MAX_INFLIGHT[current], FAST_EXEC_MAX_INFLIGHT) : SPEED_MAX_INFLIGHT[current];

/** Effective purchases fired per tick — the higher of the active tier or Fast Execution's throughput. */
export const getPurchasesPerTick = (): number =>
    fastExecutionEnabled
        ? Math.max(SPEED_PURCHASES_PER_TICK[current], FAST_EXEC_PURCHASES_PER_TICK)
        : SPEED_PURCHASES_PER_TICK[current];

/** True when the engine should skip the proposal round-trip and buy directly. */
export const useDirectBuyForSpeed = (): boolean =>
    fastExecutionEnabled || current === 'crazy' || current === 'turbo';

export const setExecutionSpeed = (speed: ExecutionSpeed): void => {
    current = speed;
    try {
        localStorage.setItem(STORAGE_KEY, speed);
    } catch {
        /* localStorage unavailable */
    }
    listeners.forEach(fn => fn(speed));
};

export const setFastExecutionEnabled = (enabled: boolean): void => {
    fastExecutionEnabled = enabled;
    try {
        localStorage.setItem(FAST_EXEC_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
        /* localStorage unavailable */
    }
    fastExecListeners.forEach(fn => fn(enabled));
};

export const subscribeExecutionSpeed = (fn: (speed: ExecutionSpeed) => void): (() => void) => {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
};

export const subscribeFastExecution = (fn: (enabled: boolean) => void): (() => void) => {
    fastExecListeners.add(fn);
    return () => {
        fastExecListeners.delete(fn);
    };
};
