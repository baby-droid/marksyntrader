jest.mock('@/external/bot-skeleton', () => ({ api_base: { api: null } }));

import {
    scoreKingFisherDigits,
    type KingFisherDirection,
} from './king-fisher-market-scanner';

describe('King Fisher market scoring', () => {
    const repeated = (digit: number) => Array.from({ length: 20 }, () => digit);

    it('scores the actual contract barrier instead of assuming five', () => {
        const digits = repeated(3);

        expect(scoreKingFisherDigits(digits, 'BELOW', 2).qualifyingTicks).toBe(20);
        expect(scoreKingFisherDigits(digits, 'BELOW', 5).qualifyingTicks).toBe(0);
        expect(scoreKingFisherDigits(digits, 'ABOVE', 7).qualifyingTicks).toBe(20);
        expect(scoreKingFisherDigits(digits, 'ABOVE', 2).qualifyingTicks).toBe(0);
    });

    it.each([
        ['BELOW', 2],
        ['BELOW', 3],
        ['ABOVE', 6],
        ['ABOVE', 7],
    ] as [KingFisherDirection, number][])(
        'supports the barrier used by the bundled %s %s bot',
        (direction, barrier) => {
            const qualifyingDigit = direction === 'BELOW' ? barrier + 1 : barrier - 1;
            expect(
                scoreKingFisherDigits(repeated(qualifyingDigit), direction, barrier).qualifyingTicks
            ).toBe(20);
        },
    );
});