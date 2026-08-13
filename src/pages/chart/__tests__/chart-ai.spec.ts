import {
    analyzeEntryFlow,
    calculateNextAiStake,
    countQualifyingTouches,
    durationCandidates,
    entryMatches,
    evaluateSide,
    touchMatches,
    validBarrierEntries,
} from '../chart-ai';

describe('chart AI duration and entry selection', () => {
    it('checks every duration up to the selected limit when Auto Ticks is enabled', () => {
        expect(durationCandidates(3, true)).toEqual([1, 2, 3]);
        expect(durationCandidates(5, true)).toEqual([1, 2, 3, 4, 5]);
        expect(durationCandidates(5, false)).toEqual([5]);
    });

    it('derives all valid entry points from the selected prediction digit', () => {
        expect(validBarrierEntries('over', 3)).toEqual([4, 5, 6, 7, 8, 9]);
        expect(validBarrierEntries('under', 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('uses the setup-tick offset for 1s and Jump flows but not plain indices', () => {
        const flow = [7, 0, 9, 2, 3, 8, 1];
        expect(analyzeEntryFlow(flow, 7, 'over', 2, '1HZ50V', [1, 2, 3, 4, 5])).toEqual(
            expect.objectContaining({
                offset: 1,
                skippedDigit: 0,
                flow: [9, 2, 3, 8, 1],
            }),
        );
        expect(analyzeEntryFlow(flow, 7, 'over', 2, 'R_50', [1, 2, 3, 4, 5])).toEqual(
            expect.objectContaining({
                offset: 0,
                skippedDigit: null,
                flow: [0, 9, 2, 3, 8],
            }),
        );
    });

    it('confirms a non-barrier digit contract using its selected entry digit', () => {
        const signal = {
            side: 'over',
            entryType: 'DIGITEVEN',
            entryDigit: 4,
            requiresReferenceEntry: false,
            marketQualified: true,
        };

        expect(entryMatches(
            signal,
            [1, 4, 2, 6],
            4,
            ['reversal', 'tick-concept', 'entry-loop'],
            4,
            { id: 'even_odd', typeA: 'DIGITEVEN', typeB: 'DIGITODD' },
            [100, 100.1, 100.2, 100.3],
        )).toBe(true);
    });

    it('counts Over and Under barrier-side touches without requiring one entry digit', () => {
        const over = {
            side: 'over',
            barrier: 2,
            entryType: 'DIGITOVER',
            requiresReferenceEntry: true,
            marketQualified: true,
        };
        const under = {
            side: 'under',
            barrier: 7,
            entryType: 'DIGITUNDER',
            requiresReferenceEntry: true,
            marketQualified: true,
        };

        expect(touchMatches(over, 0, 4)).toBe(true);
        expect(touchMatches(over, 2, 0)).toBe(true);
        expect(touchMatches(over, 3, 2)).toBe(false);
        expect(touchMatches(under, 9, 2)).toBe(true);
        expect(touchMatches(under, 7, 9)).toBe(true);
        expect(touchMatches(under, 6, 7)).toBe(false);
        expect(countQualifyingTouches(over, [0, 4, 1, 2, 3, 0])).toBe(4);
    });

    it('counts type-appropriate touches for parity, match/differ, and direction', () => {
        expect(countQualifyingTouches(
            { side: 'over', entryType: 'DIGITEVEN', marketQualified: true },
            [2, 3, 8, 5],
        )).toBe(2);
        expect(countQualifyingTouches(
            { side: 'over', entryType: 'DIGITMATCH', expectedDigit: 4, marketQualified: true },
            [4, 1, 4, 4],
        )).toBe(3);
        expect(countQualifyingTouches(
            { side: 'over', entryType: 'DIGITDIFF', expectedDigit: 4, marketQualified: true },
            [4, 1, 4, 5],
        )).toBe(2);
        expect(countQualifyingTouches(
            { side: 'over', entryType: 'CALL', marketQualified: true },
            [1, 2, 3],
            [100, 99, 100],
        )).toBe(1);
    });

    it('keeps Fixed Stake, Full Margin, and Martingale progression distinct', () => {
        const base = {
            activeStake: 2,
            initialStake: 2,
            martingale: 2,
        };
        expect(calculateNextAiStake({
            ...base, won: false, profit: -2, fullMargin: false, fixedStake: true, martingaleEnabled: true,
        })).toBe(2);
        expect(calculateNextAiStake({
            ...base, won: true, profit: 1.5, fullMargin: true, fixedStake: false, martingaleEnabled: false,
        })).toBe(3.5);
        expect(calculateNextAiStake({
            ...base, won: false, profit: -2, fullMargin: false, fixedStake: false, martingaleEnabled: true,
        })).toBe(4);
    });
});

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