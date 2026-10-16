import type { AutoLabMarket, AutoLabTrade } from '../auto-lab/AutoLabView';
import {
    createMoneyPrintNeuralReport,
    findMoneyPrintLosingSide,
    isMoneyPrintMatchMarket,
    rankMoneyPrintMatchRoutes,
    summarizeMoneyPrintTrades,
} from './money-print-neural-analysis';

const makeMarket = (symbol: string, label: string, digits: number[]): AutoLabMarket => ({
    symbol,
    label,
    digit: digits[digits.length - 1] ?? null,
    quote: 100,
    tickCount: digits.length,
    digitHistory: digits,
    score: null,
    signal: 'Tracking',
});

const trade = (id: string, status: AutoLabTrade['status'], profit: number, contract = 'DIGITMATCH'): AutoLabTrade => ({
    id,
    time: id,
    market: 'Volatility 10 Index',
    contract,
    stake: 0.35,
    profit,
    status,
});

describe('Money Print Neural Link analysis', () => {
    it('scans only the Volatility, Bear, Bull, and eligible Jump smart markets', () => {
        expect(isMoneyPrintMatchMarket(makeMarket('R_10', 'Volatility 10 Index', [1]))).toBe(true);
        expect(isMoneyPrintMatchMarket(makeMarket('1HZ10V', 'Volatility 10 (1s) Index', [1]))).toBe(true);
        expect(isMoneyPrintMatchMarket(makeMarket('RDBEAR', 'Bear Market', [1]))).toBe(true);
        expect(isMoneyPrintMatchMarket(makeMarket('RDBULL', 'Bull Market', [1]))).toBe(true);
        expect(isMoneyPrintMatchMarket(makeMarket('JD50', 'Jump 50 Index', [1]))).toBe(true);
        expect(isMoneyPrintMatchMarket(makeMarket('JD100', 'Jump 100 Index', [1]))).toBe(false);
        expect(isMoneyPrintMatchMarket(makeMarket('1HZ100V', 'Volatility 100 (1s) Index', [1]))).toBe(true);
        expect(isMoneyPrintMatchMarket(makeMarket('stpRNG', 'Step Index', [1]))).toBe(false);
        expect(isMoneyPrintMatchMarket(makeMarket('frxEURUSD', 'EUR/USD', [1]))).toBe(false);
    });

    it('ranks a repeated entry-to-target pattern and returns only the best route', () => {
        const digits = Array.from({ length: 200 }, () => [5, 8]).flat().concat(5);
        const routes = rankMoneyPrintMatchRoutes([makeMarket('R_10', 'Volatility 10 Index', digits)]);

        expect(routes).toHaveLength(1);
        expect(routes[0]).toMatchObject({
            symbol: 'R_10',
            entryDigit: 5,
            targetDigit: 8,
            eligible: true,
            observations: 80,
        });
        expect(routes[0]?.conditionalRate).toBe(100);
        expect(routes[0]?.confidenceLowerBound).toBeGreaterThan(routes[0]?.baselineRate ?? 100);
    });

    it('keeps unproven or undersampled history out of the eligible set', () => {
        let randomSeed = 7;
        const uniformDigits = Array.from({ length: 500 }, () => {
            randomSeed = (Math.imul(randomSeed, 1_664_525) + 1_013_904_223) >>> 0;
            return Math.floor((randomSeed / 4_294_967_296) * 10);
        });
        const weak = rankMoneyPrintMatchRoutes([makeMarket('R_10', 'Volatility 10 Index', uniformDigits)]);
        const short = rankMoneyPrintMatchRoutes([makeMarket('R_10', 'Volatility 10 Index', [5, 8, 5, 8])]);

        expect(weak.some(route => route.eligible)).toBe(false);
        expect(short).toHaveLength(0);
    });

    it('summarizes only settled trades and identifies a losing side for the five-hour guard', () => {
        const trades = [
            trade('6', 'LOSS', -0.35),
            trade('5', 'LOSS', -0.35),
            trade('4', 'LOSS', -0.35),
            trade('3', 'WIN', 0.25),
            trade('2', 'LOSS', -0.35),
            trade('1', 'LOSS', -0.35),
            trade('open', 'OPEN', 0),
        ];
        const performance = summarizeMoneyPrintTrades(trades);

        expect(performance).toEqual([expect.objectContaining({
            side: 'Matches',
            trades: 6,
            wins: 1,
            losses: 5,
            consecutiveLosses: 3,
        })]);
        expect(findMoneyPrintLosingSide(performance)).toBe('Matches');
    });

    it('returns WAIT when evidence is insufficient and a non-promissory route report when qualified', () => {
        const routeDigits = Array.from({ length: 200 }, () => [5, 8]).flat().concat(5);
        const matches = rankMoneyPrintMatchRoutes([makeMarket('R_10', 'Volatility 10 Index', routeDigits)]);
        const wait = createMoneyPrintNeuralReport({ challenge: 'Review this setup', trades: [], matches: [] });
        const plan = createMoneyPrintNeuralReport({
            challenge: 'Review this setup',
            trades: [],
            matches,
            now: 1_800_000_000_000,
        });

        expect(wait.verdict).toBe('WAIT');
        expect(plan.verdict).toBe('PLAN');
        expect(plan.route?.contract).toBe('DIGITMATCH 8');
        expect(plan.route?.targetDigits).toEqual([8]);
        expect(plan.riskNotes.join(' ')).toContain('do not guarantee');
        expect(plan.generatedAt).toBe(1_800_000_000_000);
    });
});
