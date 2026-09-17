import { api_base } from '@/external/bot-skeleton';

export type KingFisherDirection = 'BELOW' | 'ABOVE';

export type KingFisherMarket = {
    symbol: string;
    label: string;
    score: number;
    longestStreak: number;
    qualifyingTicks: number;
};

const KING_FISHER_MARKETS = [
    { symbol: '1HZ10V', label: 'Volatility 10 (1s)' },
    { symbol: '1HZ25V', label: 'Volatility 25 (1s)' },
    { symbol: '1HZ50V', label: 'Volatility 50 (1s)' },
    { symbol: '1HZ75V', label: 'Volatility 75 (1s)' },
    { symbol: '1HZ100V', label: 'Volatility 100 (1s)' },
];

const getLastDigit = (price: unknown) => {
    const value = Number(price);
    if (!Number.isFinite(value)) return null;
    // The 1-second synthetic indices use three decimal places. Keeping this
    // conversion here also avoids the string-formatting digit-0 bug.
    const formatted = value.toFixed(3);
    return Number(formatted[formatted.length - 1]);
};

const scoreMarket = (prices: unknown[], direction: KingFisherDirection): Omit<KingFisherMarket, 'symbol' | 'label'> => {
    const digits = prices.map(getLastDigit).filter((digit): digit is number => digit !== null);
    const qualifies = (digit: number) => (direction === 'BELOW' ? digit <= 5 : digit >= 5);
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
    };
};

export const scanKingFisherMarket = async (direction: KingFisherDirection): Promise<KingFisherMarket> => {
    const api = api_base.api as any;
    if (!api) throw new Error('The authenticated market connection is not ready yet.');

    const results = await Promise.all(
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
            return { ...market, ...scoreMarket(prices, direction) };
        })
    );

    return results.sort((a, b) => b.score - a.score)[0];
};