import {
    createChartAiPhaseState,
    evaluateChartAiPhaseGate,
} from './chart-ai-phase-gate';

describe('Chart AI phase gate', () => {
    it('requires 15 ticks and a 60% majority in the 5, 12, and 15-tick windows', () => {
        const state = createChartAiPhaseState();
        const digits = [0, 1, 2, 5, 6, 7, 8, 9, 5, 6, 7, 8, 9, 6, 7];
        let result = evaluateChartAiPhaseGate(state, 'HIGH', 1, 1, digits[0], 'R_50');

        for (let i = 1; i < digits.length; i += 1) {
            result = evaluateChartAiPhaseGate(state, 'HIGH', 1, i + 1, digits[i], 'R_50');
        }

        expect(result.windows[5].passed).toBe(true);
        expect(result.windows[12].passed).toBe(true);
        expect(result.windows[15].passed).toBe(true);
        expect(result.strategyVotes['digit-distribution']).toBe(true);
        expect(result.votes).toBeGreaterThanOrEqual(4);
        expect(result.passed).toBe(true);
    });

    it('deduplicates repeated epochs and clears its sample when the market changes', () => {
        const state = createChartAiPhaseState();

        evaluateChartAiPhaseGate(state, 'HIGH', 1, 10, 8, 'R_50');
        evaluateChartAiPhaseGate(state, 'HIGH', 1, 10, 7, 'R_50');
        expect(state.digits).toEqual([8]);

        evaluateChartAiPhaseGate(state, 'HIGH', 1, 11, 6, '1HZ100V');
        expect(state.symbol).toBe('1HZ100V');
        expect(state.digits).toEqual([6]);
    });

    it('rejects invalid digits and does not pass a low-digit distribution for a high phase', () => {
        const state = createChartAiPhaseState();
        expect(evaluateChartAiPhaseGate(state, 'HIGH', 1, 1, 10, 'R_50').passed).toBe(false);

        let result = evaluateChartAiPhaseGate(state, 'HIGH', 1, 2, 0, 'R_50');
        for (let i = 1; i < 15; i += 1) {
            result = evaluateChartAiPhaseGate(state, 'HIGH', 1, i + 2, i % 4, 'R_50');
        }
        expect(result.windows[15].passed).toBe(false);
        expect(result.passed).toBe(false);
    });
});