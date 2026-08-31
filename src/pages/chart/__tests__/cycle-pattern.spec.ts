import {
    AI_CYCLE_ROUTE,
    barrierReturnPattern,
    cycleRouteLabels,
    parityRecoveryContract,
} from '@/utils/cycle-pattern';

describe('AI cycle pattern detector', () => {
    it('uses the requested four-route order', () => {
        expect(cycleRouteLabels()).toEqual(['Over 2', 'Under 7', 'Over 1', 'Under 2']);
        expect(AI_CYCLE_ROUTE.map(route => route.barrier)).toEqual([2, 7, 1, 2]);
    });

    it('reverses three evens into Odd and three odds into Even', () => {
        expect(parityRecoveryContract([8, 2, 4])).toBe('DIGITODD');
        expect(parityRecoveryContract([1, 7, 9])).toBe('DIGITEVEN');
        expect(parityRecoveryContract([8, 2, 5])).toBeNull();
    });

    it('detects two setup touches, a barrier cross, and a return', () => {
        expect(barrierReturnPattern([1, 2, 5, 2], 2, 'over')).toBe(true);
        expect(barrierReturnPattern([1, 2, 5, 3], 2, 'over')).toBe(false);
        expect(barrierReturnPattern([8, 7, 3, 7], 7, 'under')).toBe(true);
    });
});