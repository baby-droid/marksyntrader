import { evaluateSide } from '../chart-ai';

describe('chart AI Over/Under market qualification', () => {
    const overUnderGroup = {
        id: 'over_under',
        typeA: 'DIGITOVER',
        typeB: 'DIGITUNDER',
        needsBarrier: true,
    };

    it('selects Under 7 from a qualifying chart distribution even when the private sample is neutral', () => {
        // A neutral private sample represents the case where the chart's
        // longer digit circles are already showing the stronger market:
        // Under 7 loses on 7, 8, 9, while 5 and 6 are above 10.5%.
        const digits = Array.from({ length: 50 }, (_, index) => index % 10);
        const prices = digits.map((_, index) => 100 + index / 1000);
        const chartPcts = [11.0, 11.0, 10.8, 9.8, 9.8, 11.8, 10.9, 9.0, 8.0, 8.8];

        const signal = evaluateSide(
            digits,
            prices,
            chartPcts,
            'under',
            7,
            2,
            true,
            'R_100',
            overUnderGroup,
        );

        expect(signal).toEqual(expect.objectContaining({
            side: 'under',
            barrier: 7,
            requiresReferenceEntry: true,
        }));
        expect(signal?.note).toContain('Under 7');
    });

    it('does not qualify Under 7 when one losing digit reaches the threshold', () => {
        const digits = Array.from({ length: 50 }, (_, index) => index % 10);
        const prices = digits.map((_, index) => 100 + index / 1000);
        const chartPcts = [11.0, 11.0, 10.8, 9.8, 9.8, 11.8, 10.9, 10.5, 8.0, 8.8];

        const signal = evaluateSide(
            digits,
            prices,
            chartPcts,
            'under',
            7,
            2,
            true,
            'R_100',
            overUnderGroup,
        );

        expect(signal).toBeNull();
    });
});