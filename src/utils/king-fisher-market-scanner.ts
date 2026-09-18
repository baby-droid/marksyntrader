import { api_base } from '@/external/bot-skeleton';

export type KingFisherDirection = 'BELOW' | 'ABOVE';

export type KingFisherMarket = {
    symbol: string;
    label: string;
    market: 'synthetic_index';
    submarket: 'random_index' | 'jump_index' | 'crash_index';
    group: 'plain' | '1s' | 'jump' | 'bear-bull';
    score: number;
    longestStreak: number;
    qualifyingTicks: number;
    lastDigit: number | null;
};

export const KING_FISHER_MARKETS = [
    { symbol: 'R_10', label: 'Volatility 10', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: 'plain' as const, pipSize: 3 },
    { symbol: 'R_25', label: 'Volatility 25', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: 'plain' as const, pipSize: 3 },
    { symbol: 'R_50', label: 'Volatility 50', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: 'plain' as const, pipSize: 4 },
    { symbol: 'R_75', label: 'Volatility 75', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: 'plain' as const, pipSize: 4 },
    { symbol: 'R_100', label: 'Volatility 100', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: 'plain' as const, pipSize: 2 },
    { symbol: '1HZ10V', label: 'Volatility 10 (1s)', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: '1s' as const, pipSize: 3 },
    { symbol: '1HZ25V', label: 'Volatility 25 (1s)', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: '1s' as const, pipSize: 2 },
    { symbol: '1HZ50V', label: 'Volatility 50 (1s)', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: '1s' as const, pipSize: 4 },
    { symbol: '1HZ75V', label: 'Volatility 75 (1s)', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: '1s' as const, pipSize: 4 },
    { symbol: '1HZ100V', label: 'Volatility 100 (1s)', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: '1s' as const, pipSize: 2 },
    { symbol: 'JD10', label: 'Jump 10', market: 'synthetic_index' as const, submarket: 'jump_index' as const, group: 'jump' as const, pipSize: 3 },
    { symbol: 'JD25', label: 'Jump 25', market: 'synthetic_index' as const, submarket: 'jump_index' as const, group: 'jump' as const, pipSize: 2 },
    { symbol: 'JD50', label: 'Jump 50', market: 'synthetic_index' as const, submarket: 'jump_index' as const, group: 'jump' as const, pipSize: 4 },
    { symbol: 'JD75', label: 'Jump 75', market: 'synthetic_index' as const, submarket: 'jump_index' as const, group: 'jump' as const, pipSize: 4 },
    { symbol: 'JD100', label: 'Jump 100', market: 'synthetic_index' as const, submarket: 'jump_index' as const, group: 'jump' as const, pipSize: 2 },
    { symbol: 'RDBEAR', label: 'Bear Market Index', market: 'synthetic_index' as const, submarket: 'crash_index' as const, group: 'bear-bull' as const, pipSize: 4 },
    { symbol: 'RDBULL', label: 'Bull Market Index', market: 'synthetic_index' as const, submarket: 'crash_index' as const, group: 'bear-bull' as const, pipSize: 4 },
];

const getLastDigit = (price: unknown, pipSize: number) => {
    const value = Number(price);
    if (!Number.isFinite(value)) return null;
    const formatted = value.toFixed(pipSize);
    return Number(formatted[formatted.length - 1]);
};

const scoreMarket = (
    prices: unknown[],
    direction: KingFisherDirection,
    pipSize: number
): Omit<KingFisherMarket, 'symbol' | 'label' | 'market' | 'submarket' | 'group'> => {
    const digits = prices.map(price => getLastDigit(price, pipSize)).filter((digit): digit is number => digit !== null);
    const qualifies = (digit: number) => (direction === 'BELOW' ? digit < 5 : digit > 5);
    let currentStreak = 0;
    let longestStreak = 0;
    let qualifyingTicks = 0;

    digits.forEach(digit => {
        if (qualifies(digit)) {
            currentStreak += 1;
            qualifyingTicks += 1;
            longestStreak = Math.max(longestStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    });

    // Prefer a recent qualifying run, then the market with the broadest
    // supporting sample. This is a selection signal, not a promise of profit.
    return {
        longestStreak,
        qualifyingTicks,
        score: longestStreak * 100 + qualifyingTicks,
        lastDigit: digits.length ? digits[digits.length - 1] : null,
    };
};

export const scanKingFisherMarket = async (direction: KingFisherDirection): Promise<KingFisherMarket | null> => {
    const api = api_base.api as any;
    if (!api) throw new Error('The authenticated market connection is not ready yet.');

    const results = (await Promise.allSettled(
        KING_FISHER_MARKETS.map(async market => {
            const response = await api.send({
                ticks_history: market.symbol,
                count: 120,
                end: 'latest',
                style: 'ticks',
            });
            const prices = response?.history?.prices;
            if (!Array.isArray(prices) || prices.length < 20) {
                throw new Error(`No tick history was returned for ${market.label}.`);
            }
            return { ...market, ...scoreMarket(prices, direction, market.pipSize) };
        })
    )).flatMap(result => result.status === 'fulfilled' ? [result.value] : []);

    return results.sort((a, b) => b.score - a.score)[0] ?? null;
};