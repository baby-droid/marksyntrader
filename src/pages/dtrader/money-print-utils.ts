export const MIN_DERIV_STAKE = 0.35;

/**
 * Balance-based stake is a cap, not a request to round up to the broker minimum.
 * If the risk budget is too small, return the smaller value so the UI can block
 * execution and let the user deliberately switch to a fixed stake.
 */
export const calculateAutoStake = (
    balance: number | null | undefined,
    riskPercent: number,
    maxStake: number,
): number => {
    if (
        balance == null ||
        !Number.isFinite(balance) ||
        balance <= 0 ||
        !Number.isFinite(riskPercent) ||
        riskPercent <= 0 ||
        !Number.isFinite(maxStake) ||
        maxStake <= 0
    ) return 0;

    const stake = Math.min(maxStake, balance * (riskPercent / 100));
    return Math.round((stake + Number.EPSILON) * 100) / 100;
};

export const usesUnchangedLegacyAutoStakeDefaults = (prefs: Record<string, unknown>) =>
    prefs.autoStake === true
    && Number(prefs.riskPercent) === 0.5
    && Number(prefs.maxStake) === 2
    && prefs.mode === 'accumulation'
    && prefs.martingaleEnabled === false
    && prefs.scheduledSessions === false
    && prefs.strategyMode === 'Multimarket'
    && prefs.challenge === ''
    && Number(prefs.goalBalance) === 20
    && Number(prefs.days) === 7
    && Number(prefs.hourlyTarget) === 1.8;
