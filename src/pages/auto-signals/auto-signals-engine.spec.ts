import { evaluateAutoSignal, evaluateAutoSignalCandidates } from './auto-signals-engine';
import type { AutoLabTick } from '@/pages/auto-lab/auto-lab-engine';

const makeOneTickTrend = (): AutoLabTick[] =>
    Array.from({ length: 120 }, (_, index) => ({
        symbol: 'R_10',
        digit: index % 10,
        quote: [100, 102, 103][index % 3],
        epoch: index + 1,
        pip_size: 2,
    }));

describe('Auto-Signals one-tick analysis', () => {
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
});
