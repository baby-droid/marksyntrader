import {
    calculateAutoStake,
    calculateGoalPlan,
    MIN_DERIV_STAKE,
    usesUnchangedLegacyAutoStakeDefaults,
} from './money-print-utils';

describe('Money Print risk defaults', () => {
    it('does not round an account-risk stake up to Deriv minimum', () => {
        const stake = calculateAutoStake(10, 0.5, 2);

        expect(stake).toBe(0.05);
        expect(stake).toBeLessThan(MIN_DERIV_STAKE);
    });

    it('respects the configured maximum stake', () => {
        expect(calculateAutoStake(1000, 1, 2)).toBe(2);
    });

    it('returns zero when the account balance is unavailable', () => {
        expect(calculateAutoStake(null, 1, 2)).toBe(0);
        expect(calculateAutoStake(0, 1, 2)).toBe(0);
    });

    it('detects only the unchanged legacy auto-stake defaults for migration', () => {
        const legacyDefaults = {
            mode: 'accumulation',
            autoStake: true,
            riskPercent: 0.5,
            maxStake: 2,
            martingaleEnabled: false,
            scheduledSessions: false,
            strategyMode: 'Multimarket',
            challenge: '',
            goalBalance: 20,
            days: 7,
            hourlyTarget: 1.8,
        };

        expect(usesUnchangedLegacyAutoStakeDefaults(legacyDefaults)).toBe(true);
        expect(usesUnchangedLegacyAutoStakeDefaults({ ...legacyDefaults, riskPercent: 1 })).toBe(false);
    });

    it('calculates a transparent daily target without changing the configured risk limits', () => {
        const plan = calculateGoalPlan({
            currentBalance: 10,
            targetBalance: 60,
            days: 10,
            stake: 0.35,
            riskPercent: 2,
            takeProfit: 1.8,
            stopLoss: 3,
        });

        expect(plan.requiredDailyProfit).toBe(5);
        expect(plan.requiredDailyReturnPercent).toBeCloseTo(19.62, 1);
        expect(plan.stakeRiskPercent).toBe(3.5);
        expect(plan.minimumBalanceForConfiguredRisk).toBe(17.5);
        expect(plan.takeProfit).toBe(1.8);
        expect(plan.stopLoss).toBe(3);
        expect(plan.planStatus).toBe('ready');
    });

    it('reports completed and invalid goals distinctly', () => {
        const completed = calculateGoalPlan({
            currentBalance: 60,
            targetBalance: 60,
            days: 10,
            stake: 0.35,
            riskPercent: 2,
            takeProfit: 1.8,
            stopLoss: 3,
        });
        const invalid = calculateGoalPlan({
            currentBalance: null,
            targetBalance: 60,
            days: 10,
            stake: 0.35,
            riskPercent: 2,
            takeProfit: 1.8,
            stopLoss: 3,
        });

        expect(completed.planStatus).toBe('goal-reached');
        expect(completed.remaining).toBe(0);
        expect(invalid.planStatus).toBe('invalid');
        expect(invalid.stakeRiskPercent).toBeNull();
    });
});
