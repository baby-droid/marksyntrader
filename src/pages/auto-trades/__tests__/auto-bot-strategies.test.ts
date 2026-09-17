import { evaluateAutoBotStrategy } from '../auto-bot-strategies';

const risingPrices = Array.from({ length: 1000 }, (_, index) => 100 + index * 0.01);
const fallingPrices = Array.from({ length: 1000 }, (_, index) => 200 - index * 0.01);

function paritySeries(target: 'odd' | 'even'): number[] {
    const targetDigits = target === 'odd' ? [1, 3, 5, 7, 9] : [0, 2, 4, 6, 8];
    const oppositeDigits = target === 'odd' ? [0, 2, 4, 6, 8] : [1, 3, 5, 7, 9];
    const digits: number[] = [];
    for (let index = 0; index < 440; index++) digits.push(oppositeDigits[index % oppositeDigits.length]);
    for (let index = 0; index < 550; index++) digits.push(targetDigits[index % targetDigits.length]);
    const entry = target === 'odd'
        ? [0, 2, 4, 1, 3, 5, 7, 9, 1, 3]
        : [1, 3, 5, 0, 2, 4, 6, 8, 0, 2];
    return [...digits.slice(0, 990), ...entry];
}

describe('Auto Bot strategy cards', () => {
    it('creates a Rise-only signal from aligned bullish price flow', () => {
        const trade = evaluateAutoBotStrategy('rise', [], risingPrices);
        expect(trade.contract).toBe('CALL');
        expect(trade.shouldTrade).toBe(true);
        expect(trade.direction).toBe('rise');
    });

    it('creates a Fall-only signal from aligned bearish price flow', () => {
        const trade = evaluateAutoBotStrategy('fall', [], fallingPrices);
        expect(trade.contract).toBe('PUT');
        expect(trade.shouldTrade).toBe(true);
        expect(trade.direction).toBe('fall');
    });

    it('keeps the adaptive bias card out of a balanced market', () => {
        const flatPrices = Array.from({ length: 1000 }, () => 100);
        const trade = evaluateAutoBotStrategy('bias', [], flatPrices);
        expect(trade.shouldTrade).toBe(false);
        expect(trade.state).toBe('NO TRADE');
    });

    it('requires multi-window Odd confirmation before DIGITODD', () => {
        const trade = evaluateAutoBotStrategy('odd', paritySeries('odd'), []);
        expect(trade.contract).toBe('DIGITODD');
        expect(trade.shouldTrade).toBe(true);
        expect(trade.reason).toContain('1000/50');
    });

    it('requires multi-window Even confirmation before DIGITEVEN', () => {
        const trade = evaluateAutoBotStrategy('even', paritySeries('even'), []);
        expect(trade.contract).toBe('DIGITEVEN');
        expect(trade.shouldTrade).toBe(true);
    });
});