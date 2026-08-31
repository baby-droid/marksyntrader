import {
    AI_CYCLE_ROUTE,
    barrierReturnPattern,
    cycleRouteLabels,
    nextCycleRouteIndex,
    parityRecoveryContract,
} from '@/utils/cycle-pattern';
import fs from 'fs';
import path from 'path';

describe('AI cycle pattern detector', () => {
    it('uses the requested four-route order', () => {
        expect(cycleRouteLabels()).toEqual(['Over 2', 'Under 7', 'Over 1', 'Under 2']);
        expect(AI_CYCLE_ROUTE.map(route => route.barrier)).toEqual([2, 7, 1, 2]);
        expect(nextCycleRouteIndex(0)).toBe(1);
        expect(nextCycleRouteIndex(3)).toBe(0);
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

    it('keeps the executable Differs Edge Scanner route and parity recovery', () => {
        const xml = fs.readFileSync(
            path.resolve(__dirname, '../../../../public/bots/differs-edge-scanner.xml'),
            'utf8',
        );
        expect(xml).toContain('Main rotation: Differs → Over 2 → Over 3 → Differs → Under 7 → Under 6.');
        expect(xml).toMatch(/PURCHASE_1">DIGITOVER[\s\S]*PREDICTION">2/);
        expect(xml).toMatch(/PURCHASE_1">DIGITOVER[\s\S]*PREDICTION">3/);
        expect(xml).toMatch(/PURCHASE_1">DIGITUNDER[\s\S]*PREDICTION">7/);
        expect(xml).toMatch(/PURCHASE_1">DIGITUNDER[\s\S]*PREDICTION">6/);
        expect(xml).toContain('parity_streak');
        expect(xml).toContain('NUM">3');
        expect(xml).toContain('DIGITODD');
        expect(xml).toContain('DIGITEVEN');
        expect(xml).toContain('trade_again');
    });

    it('keeps Ahmedabad recovery on Differs plus contrarian parity', () => {
        const xml = fs.readFileSync(
            path.resolve(__dirname, '../../../../public/bots/ahmed-differs-cycle.xml'),
            'utf8',
        );
        expect(xml).toContain('DIGITDIFF');
        expect(xml).toContain('after three evens, buy DIGITODD');
        expect(xml).toContain('DIGITEVEN');
        expect(xml).toContain('trade_again');
    });
});