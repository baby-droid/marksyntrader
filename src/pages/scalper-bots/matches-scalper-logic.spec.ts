import {
    evaluateMatchesScalperEntry,
    rankMatchesScalperTargets,
} from './matches-scalper-logic';

describe('matches scalper scanner', () => {
    it('prioritizes digits active in both the 20- and 10-tick windows and sets the try counts', () => {
        const latestTen = [4, 1, 0, 4, 0, 1, 4, 3, 2, 5];
        const latestTwenty = [...latestTen, 2, 2, 2, 2, 4, 0, 3, 5, 2, 0];
        const plan = rankMatchesScalperTargets(latestTwenty, '0-5');

        expect(plan.map(target => target.digit)).toEqual([4, 0, 1, 2]);
        expect(plan.map(target => target.attempts)).toEqual([3, 3, 2, 2]);
    });

    it('keeps target digits inside each bot range', () => {
        const digits = Array.from({ length: 20 }, (_, index) => index % 10);
        expect(rankMatchesScalperTargets(digits, '0-5').every(item => item.digit <= 5)).toBe(true);
        expect(rankMatchesScalperTargets(digits, '6-9').every(item => item.digit >= 6)).toBe(true);
    });

    it('waits for the highest-frequency selected entry digit to touch the latest tick', () => {
        expect(evaluateMatchesScalperEntry([8, 7, 8, 6, 9], 'selected', '0-5').ready).toBe(true);
        expect(evaluateMatchesScalperEntry([7, 8, 8, 6, 9], 'selected', '0-5').ready).toBe(false);
        expect(evaluateMatchesScalperEntry([2, 3, 2, 0, 1], 'selected', '6-9').ready).toBe(true);
    });

    it('uses the five-tick distribution for random-entry gating', () => {
        expect(evaluateMatchesScalperEntry([9, 8, 0, 4, 9], 'random', '0-5').ready).toBe(true);
        expect(evaluateMatchesScalperEntry([5, 9, 8, 4, 9], 'random', '0-5').ready).toBe(false);
    });
});
