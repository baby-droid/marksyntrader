import { evaluateAutoSignal } from './auto-signals-engine';
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
});
