import {
    evaluateAutoSignal,
    evaluateAutoSignalCandidates,
    getSuggestedAutoSignalRuns,
    hasAutoSignalPriceEntryPattern,
    isAutoSignalStrategyAllowedForMarket,
    recommendedAutoSignalRuns,
    selectAutoSignalEntryDigit,
    shouldExcludeAutoSignalMarket,
} from './auto-signals-engine';
import type { AutoLabTick } from '@/pages/auto-lab/auto-lab-engine';

const makeOneTickTrend = (): AutoLabTick[] => {
    const ticks = Array.from({ length: 1000 }, (_, index) => ({
        symbol: 'R_10',
        digit: index % 10,
        quote: [100, 102, 103][index % 3],
        epoch: index + 1,
        pip_size: 2,
    }));
    const lastQuote = ticks[ticks.length - 1].quote;
    return [
        ...ticks,
        { symbol: 'R_10', digit: 1, quote: lastQuote + 1, epoch: 1001, pip_size: 2 },
        { symbol: 'R_10', digit: 2, quote: lastQuote - 2, epoch: 1002, pip_size: 2 },
        { symbol: 'R_10', digit: 3, quote: lastQuote - 5, epoch: 1003, pip_size: 2 },
        { symbol: 'R_10', digit: 4, quote: lastQuote - 4, epoch: 1004, pip_size: 2 },
    ];
};

describe('Auto-Signals one-tick analysis', () => {
    it('includes supported synthetic families and excludes unsupported markets and Jump 100', () => {
        expect(shouldExcludeAutoSignalMarket({
            symbol: 'JD100',
            market: 'synthetic_index',
            exchange_is_open: 1,
        })).toBe(true);
        expect(shouldExcludeAutoSignalMarket({
            symbol: 'OTHER',
            display_name: 'Jump 100 Index',
            market: 'synthetic_index',
            exchange_is_open: 1,
        })).toBe(true);
        expect(shouldExcludeAutoSignalMarket({
            symbol: 'JD50',
            display_name: 'Jump 50 Index',
            market: 'synthetic_index',
            exchange_is_open: 1,
        })).toBe(false);
        expect(shouldExcludeAutoSignalMarket({
            symbol: '1HZ50V',
            display_name: 'Volatility 50 (1s) Index',
            market: 'synthetic_index',
            exchange_is_open: 1,
        })).toBe(false);
        expect(shouldExcludeAutoSignalMarket({
            symbol: 'RDBEAR',
            display_name: 'Bear Market Index',
            market: 'synthetic_index',
            exchange_is_open: 1,
        })).toBe(false);
        expect(shouldExcludeAutoSignalMarket({
            symbol: 'RDBULL',
            display_name: 'Bull Market Index',
            market: 'synthetic_index',
            exchange_is_open: 1,
        })).toBe(false);
        expect(shouldExcludeAutoSignalMarket({
            symbol: 'stpRNG',
            display_name: 'Step Index',
            market: 'synthetic_index',
            exchange_is_open: 1,
        })).toBe(false);
        expect(shouldExcludeAutoSignalMarket({
            symbol: 'OTHER',
            display_name: 'Unlisted Synthetic',
            market: 'synthetic_index',
            exchange_is_open: 1,
        })).toBe(true);
    });

    it('restricts Step markets to Rise/Fall while permitting other signal routes on volatility markets', () => {
        const step = { symbol: 'stpRNG', label: 'Step Index', market: 'synthetic_index', submarket: 'step_index' };
        expect(isAutoSignalStrategyAllowedForMarket('RISE', step)).toBe(true);
        expect(isAutoSignalStrategyAllowedForMarket('FALL', step)).toBe(true);
        expect(isAutoSignalStrategyAllowedForMarket('OVER', step)).toBe(false);
        expect(isAutoSignalStrategyAllowedForMarket('ONLY_UPS', step)).toBe(false);
        expect(isAutoSignalStrategyAllowedForMarket('MATCHES', {
            symbol: 'R_10',
            label: 'Volatility 10',
            market: 'synthetic_index',
            submarket: 'random_index',
        })).toBe(true);
    });

    it('includes Over 8 as a tradeable digit barrier', () => {
        const ticks: AutoLabTick[] = Array.from({ length: 1000 }, (_, index) => ({
            symbol: 'R_10',
            digit: 9,
            quote: 100 + index / 100,
            epoch: index + 1,
            pip_size: 2,
        }));
        const over8 = evaluateAutoSignalCandidates({
            market: { symbol: 'R_10', label: 'Volatility 10' },
            ticks,
            family: 'OVER_UNDER',
            now: 1_000,
        }).find((candidate) => candidate.strategy === 'OVER' && candidate.barrier === 8);
        expect(over8).toMatchObject({
            contractType: 'DIGITOVER',
            barrier: 8,
            recommendedRuns: 20,
        });
    });

    it.each([
        [64.9, 'EVEN', 0],
        [65, 'EVEN', 1],
        [69.9, 'EVEN', 1],
        [70, 'EVEN', 2],
        [75, 'EVEN', 3],
        [80, 'EVEN', 5],
        [85, 'EVEN', 8],
        [90, 'EVEN', 10],
        [93, 'EVEN', 12],
        [96, 'EVEN', 15],
        [98, 'EVEN', 20],
        [64.9, 'UNDER', 0],
        [65, 'UNDER', 1],
        [90, 'OVER', 10],
        [99.9, 'OVER', 20],
    ] as const)('selects %i score runs for %s', (score, strategy, expected) => {
        expect(recommendedAutoSignalRuns(score, strategy)).toBe(expected);
    });

    it.each([
        [4, 10, 4],
        [4, 2, 2],
        [10, 25, 10],
        [20, 25, 20],
        [25, 25, 20],
        [0, 10, 0],
        [5, 0, 0],
    ])('uses the suggested count %i under the configured cap %i', (suggested, cap, expected) => {
        expect(getSuggestedAutoSignalRuns(suggested, cap)).toBe(expected);
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

    it('does not produce candidates before the full 1000-tick baseline is available', () => {
        expect(evaluateAutoSignalCandidates({
            market: { symbol: 'R_10', label: 'Volatility 10' },
            ticks: makeOneTickTrend().slice(0, 999),
            family: 'AUTO',
            now: 1_000,
        })).toEqual([]);
    });

    it('rejects long-window outcomes that do not beat the fair baseline with confidence', () => {
        const nextEdgeByDigit = Array(10).fill(0);
        const stack = [0];
        const circuit: number[] = [];
        while (stack.length) {
            const current = stack[stack.length - 1];
            if (nextEdgeByDigit[current] < 10) {
                stack.push(nextEdgeByDigit[current]++);
            } else {
                circuit.push(stack.pop()!);
            }
        }
        const balancedCycle = circuit.reverse().slice(0, -1);
        const balancedTicks: AutoLabTick[] = Array.from({ length: 1000 }, (_, index) => {
            const digit = balancedCycle[index % balancedCycle.length];
            return {
                symbol: 'R_10',
                digit,
                quote: 100 + digit / 100,
                epoch: index + 1,
                pip_size: 2,
            };
        });
        expect(evaluateAutoSignalCandidates({
            market: { symbol: 'R_10', label: 'Volatility 10' },
            ticks: balancedTicks,
            family: 'AUTO',
            now: 1_000,
        })).toEqual([]);
    });

    it('uses a 50 percent fair baseline for one-tick price-direction contracts', () => {
        const alternatingPrices: AutoLabTick[] = Array.from({ length: 1000 }, (_, index) => ({
            symbol: 'R_10',
            digit: index % 10,
            quote: 100 + (index % 2),
            epoch: index + 1,
            pip_size: 2,
        }));
        expect(evaluateAutoSignalCandidates({
            market: { symbol: 'R_10', label: 'Volatility 10' },
            ticks: alternatingPrices,
            family: 'ONLY_UP_DOWN',
            now: 1_000,
        })).toEqual([]);
    });

    it('keeps qualified barrier alternatives and reports the exact last-20 rate per barrier', () => {
        const ticks: AutoLabTick[] = [
            ...Array.from({ length: 880 }, (_, index) => ({
                symbol: 'R_10',
                digit: 1,
                quote: 100.01,
                epoch: index + 1,
                pip_size: 2,
            })),
            ...Array.from({ length: 100 }, (_, index) => ({
                symbol: 'R_10',
                digit: 1,
                quote: 100.01,
                epoch: index + 881,
                pip_size: 2,
            })),
            ...Array.from({ length: 20 }, (_, index) => {
                const digit = index < 10 ? 5 : 1;
                return {
                    symbol: 'R_10',
                    digit,
                    quote: 100 + digit / 100,
                    epoch: 981 + index,
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

    it('uses the exact Match digit as the DIGITMATCH barrier and waits until that digit is current', () => {
        const makeTicks = (matchAtEnd: boolean): AutoLabTick[] => [
            ...Array.from({ length: 900 }, (_, index) => ({
                symbol: 'R_10',
                digit: 6,
                quote: 100.06,
                epoch: index + 1,
                pip_size: 2,
            })),
            ...Array.from({ length: matchAtEnd ? 80 : 79 }, (_, index) => ({
                symbol: 'R_10',
                digit: 1,
                quote: 100.01,
                epoch: index + 901,
                pip_size: 2,
            })),
            ...Array.from({ length: 20 }, (_, index) => ({
                symbol: 'R_10',
                digit: 6,
                quote: 100.06,
                epoch: (matchAtEnd ? 980 : 979) + index + 1,
                pip_size: 2,
            })),
            ...(!matchAtEnd ? [{
                symbol: 'R_10',
                digit: 1,
                quote: 100.01,
                epoch: 1000,
                pip_size: 2,
            }] : []),
        ];
        const readyCandidates = evaluateAutoSignalCandidates({
            market: { symbol: 'R_10', label: 'Volatility 10' },
            ticks: makeTicks(true),
            family: 'MATCHES',
            now: 1_000,
        });
        const digitSix = readyCandidates.find((candidate) =>
            candidate.strategy === 'MATCHES' && candidate.barrier === 6
        );
        const waitingCandidates = evaluateAutoSignalCandidates({
            market: { symbol: 'R_10', label: 'Volatility 10' },
            ticks: makeTicks(false),
            family: 'MATCHES',
            now: 1_000,
        });
        const digitSixWaiting = waitingCandidates.find((candidate) =>
            candidate.strategy === 'MATCHES' && candidate.barrier === 6
        );

        expect(readyCandidates.every((candidate) => candidate.contractType === 'DIGITMATCH')).toBe(true);
        expect(digitSix).toMatchObject({
            contractType: 'DIGITMATCH',
            barrier: 6,
            entryDigit: 6,
            entryReady: true,
        });
        expect(digitSixWaiting).toMatchObject({
            contractType: 'DIGITMATCH',
            barrier: 6,
            entryDigit: 6,
            entryReady: false,
        });
    });

    it('selects a Matches target from a training segment and confirms it on held-out next-tick transitions', () => {
        const digits = [0];
        for (let index = 0; index < 999; index += 1) {
            const current = digits[digits.length - 1];
            digits.push(current === 2 ? 7 : (current + 1) % 10);
        }
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
            family: 'MATCHES',
            now: 1_000,
        });
        const predictedSeven = candidates.find((candidate) =>
            candidate.strategy === 'MATCHES' && candidate.barrier === 7
        );

        expect(predictedSeven).toMatchObject({
            strategy: 'MATCHES',
            contractType: 'DIGITMATCH',
            barrier: 7,
            entryDigit: 2,
            entryReady: false,
        });
        expect(predictedSeven?.windows.find((item) => item.window === 1000)).toMatchObject({
            sampleSize: expect.any(Number),
            probability: 100,
            agrees: true,
        });
        expect(predictedSeven?.reason).toMatch(/held-out ticks: target 7 followed entry 2/i);
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
        const digits = Array.from({ length: 1000 }, () => 9);
        for (let index = 60; index < 100; index += 10) {
            digits[index] = 1;
            digits[index + 1] = 9;
        }
        digits[990] = 1;
        digits[991] = 9;
        digits[999] = 1;
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
