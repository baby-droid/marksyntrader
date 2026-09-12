import {
    AUTO_BOT_TICK_DURATION,
    getFreshAutoBotMarkets,
    isAutoBotMarketStopped,
    selectAutoBotMarketsForExecution,
    type AutoBotMarketCandidate,
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
    trade: { contract: 'DIGITDIFF', barrier: 5, signal },
    score,
    qualifies,
    tickVersion,
    livePrice: 100,
    ticks: AUTO_BOT_TICK_DURATION,
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

    it('uses exactly one tick for Auto Bot contracts', () => {
        expect(AUTO_BOT_TICK_DURATION).toBe(1);
    });

    it('executes every fresh eligible market in the ranked set', () => {
        const mixed = selectAutoBotMarketsForExecution([
            candidate('V10', 95, 1, true, 'strong'),
            candidate('V25', 90, 1, true, 'weak'),
            candidate('V50', 85, 1, true, 'strong'),
        ]);
        expect(mixed.map(item => item.symbol)).toEqual(['V10', 'V25', 'V50']);

        const five = selectAutoBotMarketsForExecution(
            ['V10', 'V25', 'V50', 'V75', 'V100', 'JD10'].map((symbol, index) =>
                candidate(symbol, 95 - index, 1, true, 'weak')
            ),
        );
        expect(five).toHaveLength(5);
    });

    it('stops only the market whose own TP or SL was reached', () => {
        expect(isAutoBotMarketStopped(5, { takeProfit: 5, stopLoss: 10 })).toBe(true);
        expect(isAutoBotMarketStopped(-10, { takeProfit: 5, stopLoss: 10 })).toBe(true);
        expect(isAutoBotMarketStopped(2, { takeProfit: 5, stopLoss: 10 })).toBe(false);
    });
});