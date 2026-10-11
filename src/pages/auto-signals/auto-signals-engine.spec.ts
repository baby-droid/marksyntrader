import {
    evaluateAutoSignal,
    evaluateAutoSignalCandidates,
    hasAutoSignalPriceEntryPattern,
    recommendedAutoSignalRuns,
    selectAutoSignalEntryDigit,
} from './auto-signals-engine';
import type { AutoLabTick } from '@/pages/auto-lab/auto-lab-engine';

const makeOneTickTrend = (): AutoLabTick[] => {
    const ticks = Array.from({ length: 120 }, (_, index) => ({
        symbol: 'R_10',
        digit: index % 10,
        quote: [100, 102, 103][index % 3],
        epoch: index + 1,
        pip_size: 2,
    }));
    const lastQuote = ticks[ticks.length - 1].quote;
    return [
        ...ticks,
        { symbol: 'R_10', digit: 1, quote: lastQuote - 3, epoch: 121, pip_size: 2 },
        { symbol: 'R_10', digit: 2, quote: lastQuote - 6, epoch: 122, pip_size: 2 },
        { symbol: 'R_10', digit: 3, quote: lastQuote - 5, epoch: 123, pip_size: 2 },
    ];
};

describe('Auto-Signals one-tick analysis', () => {
    it.each([
        [59.9, 'EVEN', 0],
        [60, 'EVEN', 1],
        [69.9, 'EVEN', 1],
        [70, 'EVEN', 2],
        [75, 'EVEN', 3],
        [80, 'EVEN', 4],
        [85, 'EVEN', 5],
        [90, 'EVEN', 7],
        [95, 'EVEN', 10],
        [64.9, 'UNDER', 0],
        [65, 'UNDER', 1],
        [90, 'OVER', 7],
    ] as const)('selects %i score runs for %s', (score, strategy, expected) => {
        expect(recommendedAutoSignalRuns(score, strategy)).toBe(expected);
    });

    it('evaluates Rise using the next adjacent tick and does not gate price entries on a digit', () => {
        const candidate = evaluateAutoSignal({
            market: { symbol: 'R_10', label: 'Volatility 10' },
            ticks: makeOneTickTrend(),
            family: 'RISE_FALL',
            now: 1_000,
        });

        expect(candidate).toMatchObject({
            strategy: 'RISE',
            contractType: 'CALL',
            entryDigit: null,
            entryReady: true,
        });
        expect(candidate?.windows.find((item) => item.window === 100)?.probability).toBeGreaterThan(60);
    });

    it('keeps qualified barrier alternatives and reports the exact last-20 rate per barrier', () => {
        const ticks: AutoLabTick[] = [
            ...Array.from({ length: 100 }, (_, index) => ({
                symbol: 'R_10',
                digit: 1,
                quote: 100.01,
                epoch: index + 1,
                pip_size: 2,
            })),
            ...Array.from({ length: 20 }, (_, index) => {
                const digit = index < 10 ? 5 : 1;
                return {
                    symbol: 'R_10',
                    digit,
                    quote: 100 + digit / 100,
                    epoch: 101 + index,
                    pip_size: 2,
                };
            }),
        ];
        const candidates = evaluateAutoSignalCandidates({
            market: { symbol: 'R_10', label: 'Volatility 10' },
            ticks,
            family: 'OVER_UNDER',
            now: 1_000,
        });
        const under4 = candidates.find((candidate) => candidate.strategy === 'UNDER' && candidate.barrier === 4);
        const under7 = candidates.find((candidate) => candidate.strategy === 'UNDER' && candidate.barrier === 7);

        expect(under4?.windows.find((item) => item.window === 20)).toMatchObject({
            probability: 50,
            sampleSize: 20,
        });
        expect(under7?.windows.find((item) => item.window === 20)).toMatchObject({
            probability: 100,
            sampleSize: 20,
        });
        expect(candidates.filter((candidate) => candidate.strategy === 'UNDER').length).toBeGreaterThan(1);
    });

    it.each([
        ['FALL', [1, 1, 1, -1]],
        ['FALL', [1, 1, 1, 1, -1]],
        ['FALL', [1, 1, 1, 1, 1]],
        ['RISE', [-1, -1]],
        ['RISE', [-1, -1, 1]],
        ['RISE', [-1, -1, -1]],
    ] as const)('confirms the requested %s entry pattern %j', (strategy, moves) => {
        const ticks: AutoLabTick[] = [{
            symbol: 'R_10',
            digit: 0,
            quote: 100,
            epoch: 1,
            pip_size: 2,
        }];
        moves.forEach((move, index) => {
            ticks.push({
                symbol: 'R_10',
                digit: (index + 1) % 10,
                quote: ticks[ticks.length - 1].quote + move,
                epoch: index + 2,
                pip_size: 2,
            });
        });

        expect(hasAutoSignalPriceEntryPattern(strategy, ticks)).toBe(true);
    });

    it('chooses Over 1/8 and Under 2/9 entries using recent observed outcomes', () => {
        const digits = Array.from({ length: 100 }, () => 9);
        for (let index = 50; index < 90; index += 5) {
            const isOverEntry = (index - 50) % 10 === 0;
            digits[index] = isOverEntry ? 1 : 8;
            digits[index + 1] = isOverEntry ? 9 : 0;
        }
        digits[99] = 1;
        const ticks: AutoLabTick[] = digits.map((digit, index) => ({
            symbol: 'R_10',
            digit,
            quote: 100 + digit / 100,
            epoch: index + 1,
            pip_size: 2,
        }));

        expect(selectAutoSignalEntryDigit('OVER', 4, ticks)).toBe(1);
        const underDigits = Array.from({ length: 100 }, () => 0);
        for (let index = 50; index < 90; index += 5) {
            const isUnderEntry = (index - 50) % 10 === 0;
            underDigits[index] = isUnderEntry ? 2 : 9;
            underDigits[index + 1] = isUnderEntry ? 0 : 8;
        }
        underDigits[99] = 2;
        const underTicks: AutoLabTick[] = underDigits.map((digit, index) => ({
            symbol: 'R_10',
            digit,
            quote: 100 + digit / 100,
            epoch: index + 1,
            pip_size: 2,
        }));

        expect(selectAutoSignalEntryDigit('UNDER', 4, underTicks)).toBe(2);
    });

    it('can confirm an Over entry digit separately from the selected trade barrier', () => {
        const digits = Array.from({ length: 120 }, () => 9);
        for (let index = 60; index < 100; index += 10) {
            digits[index] = 1;
            digits[index + 1] = 9;
        }
        digits[119] = 1;
        const ticks: AutoLabTick[] = digits.map((digit, index) => ({
            symbol: 'R_10',
            digit,
            quote: 100 + digit / 100,
            epoch: index + 1,
            pip_size: 2,
        }));
        const candidates = evaluateAutoSignalCandidates({
            market: { symbol: 'R_10', label: 'Volatility 10' },
            ticks,
            family: 'OVER_UNDER',
            now: 1_000,
        });
        const over4 = candidates.find((candidate) =>
            candidate.strategy === 'OVER' && candidate.barrier === 4
        );

        expect(over4).toMatchObject({
            entryDigit: 1,
            entryReady: true,
        });
    });
});
