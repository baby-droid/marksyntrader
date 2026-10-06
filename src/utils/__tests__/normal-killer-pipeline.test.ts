import {
    configureNormalKillerPipeline,
    createNormalKillerPipeline,
    getNormalKillerOpenCount,
    hasNormalKillerRiskLimitReached,
    reserveNormalKillerEntry,
    settleNormalKillerEntry,
} from '../normal-killer-pipeline';

describe('Normal Killer V3 contract pipeline', () => {
    it('caps unsettled contracts at three and prevents duplicate entries on one tick', () => {
        const pipeline = createNormalKillerPipeline();
        configureNormalKillerPipeline(pipeline, {
            currentStake: 0.35,
            baseStake: 0.35,
            multiplier: 2,
            takeProfit: 5,
            stopLoss: 15,
        });

        const main = reserveNormalKillerEntry(pipeline, { epoch: 100, kind: 'main', stake: 0.35 });
        const side1 = reserveNormalKillerEntry(pipeline, { epoch: 101, kind: 'side', stake: 0.35 });
        const side2 = reserveNormalKillerEntry(pipeline, { epoch: 102, kind: 'side', stake: 0.35 });

        expect(main).not.toBeNull();
        expect(side1).not.toBeNull();
        expect(side2).not.toBeNull();
        expect(getNormalKillerOpenCount(pipeline)).toBe(3);
        expect(reserveNormalKillerEntry(pipeline, { epoch: 103, kind: 'side', stake: 0.35 })).toBeNull();
        expect(reserveNormalKillerEntry(pipeline, { epoch: 102, kind: 'side', stake: 0.35 })).toBeNull();
    });

    it('applies settled outcomes in entry order even when contracts settle out of order', () => {
        const pipeline = createNormalKillerPipeline();
        configureNormalKillerPipeline(pipeline, {
            currentStake: 0.35,
            baseStake: 0.35,
            multiplier: 2,
        });
        const main = reserveNormalKillerEntry(pipeline, { epoch: 200, kind: 'main', stake: 0.35 });
        const side1 = reserveNormalKillerEntry(pipeline, { epoch: 201, kind: 'side', stake: 0.35 });
        const side2 = reserveNormalKillerEntry(pipeline, { epoch: 202, kind: 'side', stake: 0.35 });

        expect(settleNormalKillerEntry(pipeline, side2, false)).toEqual([]);
        expect(settleNormalKillerEntry(pipeline, side1, true)).toEqual([]);
        expect(pipeline.currentStake).toBe(0.35);

        expect(settleNormalKillerEntry(pipeline, main, false)).toEqual([
            expect.objectContaining({ sequence: 1, won: false, nextStake: 0.7 }),
            expect.objectContaining({ sequence: 2, won: true, nextStake: 0.35 }),
            expect.objectContaining({ sequence: 3, won: false, nextStake: 0.7 }),
        ]);
        expect(pipeline.currentStake).toBe(0.7);
    });

    it('trips the configured realized-profit limits', () => {
        const pipeline = createNormalKillerPipeline();
        configureNormalKillerPipeline(pipeline, {
            currentStake: 0.35,
            baseStake: 0.35,
            multiplier: 2,
            takeProfit: 5,
            stopLoss: 15,
        });

        expect(hasNormalKillerRiskLimitReached(pipeline, 5)).toBe(true);
        expect(hasNormalKillerRiskLimitReached(pipeline, -15)).toBe(true);
        expect(hasNormalKillerRiskLimitReached(pipeline, 4.99)).toBe(false);
    });
});
