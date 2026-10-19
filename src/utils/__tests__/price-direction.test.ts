import { analyzePriceDirection } from '../price-direction';

describe('price direction analysis', () => {
    it('uses quote movement and ignores digit wrap-around', () => {
        expect(analyzePriceDirection([99.9, 100.1, 100.2])).toMatchObject({
            rises: 2,
            falls: 0,
            risePercent: 100,
            fallPercent: 0,
            allRising: true,
            trailingDirection: 'rise',
            trailingStreak: 2,
        });
    });

    it('does not count flat ticks as directional movement or include them in a streak', () => {
        expect(analyzePriceDirection([100, 101, 101, 100])).toMatchObject({
            rises: 1,
            falls: 1,
            flats: 1,
            risePercent: 50,
            fallPercent: 50,
            allRising: false,
            allFalling: false,
            trailingDirection: 'fall',
            trailingStreak: 1,
        });
    });

    it('returns neutral percentages when no valid directional movement exists', () => {
        expect(analyzePriceDirection([100, 100, Number.NaN])).toMatchObject({
            rises: 0,
            falls: 0,
            flats: 1,
            risePercent: 50,
            fallPercent: 50,
            trailingDirection: null,
            trailingStreak: 0,
        });
    });
});
