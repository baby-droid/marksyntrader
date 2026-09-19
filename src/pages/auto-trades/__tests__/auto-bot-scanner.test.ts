jest.mock('@/external/bot-skeleton', () => ({ api_base: { api: null } }));

import {
    AUTO_BOT_TICK_DURATION,
    getFreshAutoBotMarkets,
    isSupportedAutoBotMarket,
    isAutoBotMarketStopped,
    scanAutoBotMarkets,
    selectAutoBotMarketsForExecution,
    type AutoBotDefinition,
    type AutoBotMarketCandidate,
    type AutoBotMarketSnapshot,
} from '../auto-bot-scanner';

const candidate = (
    symbol: string,
    score: number,
    tickVersion: number,
    qualifies = true,
    signal?: 'weak' | 'strong',
): AutoBotMarketCandidate => ({
    symbol,
    label: symbol,
    digits: Array.from({ length: 20 }, () => 5),
    prices: Array.from({ length: 20 }, (_, index) => 100 + index),
    trade: { contract: 'DIGITDIFF', barrier: 5, signal },
    score,
    qualifies,
    tickVersion,
    livePrice: 100,
    ticks: AUTO_BOT_TICK_DURATION,
    marketFamily: '1s Volatility',
});

describe('Auto Bot market execution rules', () => {
    it('evaluates qualifying markets independently on their own fresh ticks', () => {
        const lastEvaluated = new Map<string, number>([['V10', 4]]);
        const fresh = getFreshAutoBotMarkets([
            candidate('V10', 95, 4),
            candidate('V25', 80, 7),
            candidate('V50', 70, 7, false),
        ], lastEvaluated);

        expect(fresh.map(item => item.symbol)).toEqual(['V25']);
        expect(lastEvaluated.get('V25')).toBe(7);
        expect(lastEvaluated.get('V50')).toBe(7);
    });

    it('expires a signal after it has been evaluated for that market tick', () => {
        const lastEvaluated = new Map<string, number>();
        const first = candidate('V10', 95, 7);

        expect(getFreshAutoBotMarkets([first], lastEvaluated)).toHaveLength(1);
        expect(getFreshAutoBotMarkets([first], lastEvaluated)).toHaveLength(0);
        expect(getFreshAutoBotMarkets([candidate('V10', 95, 8)], lastEvaluated)).toHaveLength(1);
    });

    it('uses exactly one tick for Auto Bot contracts', () => {
        expect(AUTO_BOT_TICK_DURATION).toBe(1);
    });

    it('uses the current live signal as a one-tick entry', () => {
        const bot: AutoBotDefinition = {
            pickTrade: digits => digits[digits.length - 1] === 7
                ? { contract: 'DIGITOVER', barrier: 2, shouldTrade: true }
                : { contract: 'DIGITUNDER', barrier: 7, shouldTrade: false },
        };
        const snapshot = (digits: number[]): AutoBotMarketSnapshot => ({
            symbol: '1HZ10V',
            label: 'V10 (1s)',
            digits,
            prices: digits.map((_, index) => 100 + index),
            livePrice: 100,
            tickVersion: 1,
            ready: true,
        });

        const matching = scanAutoBotMarkets(bot, {
            match: snapshot(Array.from({ length: 20 }, () => 5).concat([7])),
        })[0];
        const changing = scanAutoBotMarkets(bot, {
            change: snapshot(Array.from({ length: 20 }, () => 5).concat([4])),
        })[0];

        expect(matching.trade.entryFrame).toBe('matched');
        expect(matching.qualifies).toBe(true);
        expect(changing.trade.entryFrame).toBe('waiting');
        expect(changing.qualifies).toBe(false);
    });

    it('ranks every ready market for continuous execution', () => {
        const mixed = selectAutoBotMarketsForExecution([
            candidate('V10', 95, 1, true, 'weak'),
            candidate('V25', 98, 1, true, 'weak'),
            candidate('V50', 85, 1, true, 'strong'),
        ]);
        expect(mixed.map(item => item.symbol)).toEqual(['V25', 'V10', 'V50']);

        const strongBurst = selectAutoBotMarketsForExecution(
            ['V10', 'V25', 'V50', 'V75', 'V100', 'JD10'].map((symbol, index) =>
                candidate(symbol, 95 - index, 1, true, 'strong')
            ),
        );
        expect(strongBurst.map(item => item.symbol)).toEqual(['V10', 'V25', 'V50', 'V75', 'V100', 'JD10']);
    });

    it('allows only the requested Auto Bot market families', () => {
        expect(isSupportedAutoBotMarket('1HZ100V')).toBe(true);
        expect(isSupportedAutoBotMarket('JD50')).toBe(true);
        expect(isSupportedAutoBotMarket('R_25')).toBe(true);
        expect(isSupportedAutoBotMarket('RDBEAR')).toBe(true);
        expect(isSupportedAutoBotMarket('RDBULL')).toBe(true);
        expect(isSupportedAutoBotMarket('BOOM1000')).toBe(false);
        expect(isSupportedAutoBotMarket('CRASH500')).toBe(false);
    });

    it('filters unsupported symbols before strategy evaluation', () => {
        const bot: AutoBotDefinition = {
            pickTrade: () => ({
                contract: 'CALL',
                barrier: null,
                shouldTrade: true,
                score: 75,
            }),
        };
        const snapshot = (symbol: string): AutoBotMarketSnapshot => ({
            symbol,
            label: symbol,
            digits: Array.from({ length: 20 }, () => 5),
            prices: Array.from({ length: 20 }, (_, index) => 100 + index),
            livePrice: 100,
            tickVersion: 1,
            ready: true,
        });

        expect(scanAutoBotMarkets(bot, {
            '1HZ10V': snapshot('1HZ10V'),
            BOOM1000: snapshot('BOOM1000'),
        }).map(item => item.symbol)).toEqual(['1HZ10V']);
    });

    it('stops only the market whose own TP or SL was reached', () => {
        expect(isAutoBotMarketStopped(5, { takeProfit: 5, stopLoss: 10 })).toBe(true);
        expect(isAutoBotMarketStopped(-10, { takeProfit: 5, stopLoss: 10 })).toBe(true);
        expect(isAutoBotMarketStopped(2, { takeProfit: 5, stopLoss: 10 })).toBe(false);
    });
});