import { evaluateAutoSignalCandidates } from './auto-signals-engine';

const repeatedDigitTicks = (digit: number) => Array.from({ length: 100 }, (_, index) => ({
    symbol: 'R_10',
    epoch: index + 1,
    quote: 100 + index / 100,
    digit,
    pip_size: 2,
}));

const risingPriceTicks = () => Array.from({ length: 100 }, (_, index) => ({
    symbol: 'R_10',
    epoch: index + 1,
    quote: 100 + index / 100,
    digit: 4,
    pip_size: 2,
}));

describe('Auto-Signals contract-family filtering', () => {
    it('returns only Matches contracts for the Matches card scan', () => {
        const candidates = evaluateAutoSignalCandidates({
            market: { symbol: 'R_10', label: 'Volatility 10' },
            ticks: repeatedDigitTicks(6),
            family: 'MATCHES',
        });

        expect(candidates.length).toBeGreaterThan(0);
        expect(candidates.every((candidate) => candidate.strategy === 'MATCHES')).toBe(true);
        expect(candidates.some((candidate) =>
            candidate.contractType === 'DIGITMATCH' && candidate.barrier === 6
        )).toBe(true);
    });

    it('returns Only Ups/Only Downs contracts, not Over routes, in that family', () => {
        const candidates = evaluateAutoSignalCandidates({
            market: { symbol: 'R_10', label: 'Volatility 10' },
            ticks: risingPriceTicks(),
            family: 'ONLY_UP_DOWN',
        });

        expect(candidates.length).toBeGreaterThan(0);
        expect(candidates.every((candidate) => candidate.strategy === 'ONLY_UPS')).toBe(true);
        expect(candidates.every((candidate) => candidate.contractType === 'RUNHIGH')).toBe(true);
    });
});
