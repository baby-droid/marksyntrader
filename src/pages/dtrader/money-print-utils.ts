export const MIN_DERIV_STAKE = 0.35;

export interface GoalPlanInput {
    currentBalance: number | null | undefined;
    targetBalance: number;
    days: number;
    stake: number;
    riskPercent: number;
    takeProfit: number;
    stopLoss: number;
}

export interface GoalPlanResult {
    startBalance: number;
    targetBalance: number;
    remaining: number;
    days: number;
    requiredDailyProfit: number;
    requiredDailyReturnPercent: number;
    stake: number;
    stakeRiskPercent: number | null;
    takeProfit: number;
    stopLoss: number;
    minimumBalanceForConfiguredRisk: number | null;
    planStatus: 'ready' | 'goal-reached' | 'invalid';
}

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

/**
 * Calculates required growth transparently; it is a target calculation, not a
 * prediction. The risk controls are reported as configured and never changed.
 */
export const calculateGoalPlan = (input: GoalPlanInput): GoalPlanResult => {
    const startBalance = Number(input.currentBalance);
    const targetBalance = Number(input.targetBalance);
    const days = Math.floor(Number(input.days));
    const stake = Number(input.stake);
    const riskPercent = Number(input.riskPercent);
    const takeProfit = Number(input.takeProfit);
    const stopLoss = Number(input.stopLoss);
    const valid = Number.isFinite(startBalance) && startBalance > 0
        && Number.isFinite(targetBalance) && targetBalance > 0
        && Number.isFinite(days) && days > 0;

    if (!valid) {
        return {
            startBalance: Number.isFinite(startBalance) && startBalance > 0 ? startBalance : 0,
            targetBalance: Number.isFinite(targetBalance) && targetBalance > 0 ? targetBalance : 0,
            remaining: 0,
            days: Number.isFinite(days) && days > 0 ? days : 0,
            requiredDailyProfit: 0,
            requiredDailyReturnPercent: 0,
            stake: Number.isFinite(stake) && stake > 0 ? stake : 0,
            stakeRiskPercent: null,
            takeProfit: Number.isFinite(takeProfit) && takeProfit > 0 ? takeProfit : 0,
            stopLoss: Number.isFinite(stopLoss) && stopLoss > 0 ? stopLoss : 0,
            minimumBalanceForConfiguredRisk: null,
            planStatus: 'invalid',
        };
    }

    const remaining = Math.max(0, targetBalance - startBalance);
    const requiredDailyReturnPercent = remaining === 0
        ? 0
        : (Math.pow(targetBalance / startBalance, 1 / days) - 1) * 100;
    const safeStake = Number.isFinite(stake) && stake > 0 ? stake : 0;
    const safeRiskPercent = Number.isFinite(riskPercent) && riskPercent > 0 ? riskPercent : 0;

    return {
        startBalance,
        targetBalance,
        remaining,
        days,
        requiredDailyProfit: remaining / days,
        requiredDailyReturnPercent,
        stake: safeStake,
        stakeRiskPercent: safeStake ? (safeStake / startBalance) * 100 : null,
        takeProfit: Number.isFinite(takeProfit) && takeProfit > 0 ? takeProfit : 0,
        stopLoss: Number.isFinite(stopLoss) && stopLoss > 0 ? stopLoss : 0,
        minimumBalanceForConfiguredRisk: safeRiskPercent ? safeStake / (safeRiskPercent / 100) : null,
        planStatus: remaining === 0 ? 'goal-reached' : 'ready',
    };
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
