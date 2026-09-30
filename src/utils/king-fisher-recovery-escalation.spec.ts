import { advanceKingFisherRecoveryEscalation } from './king-fisher-recovery-escalation';

describe('King Fisher parity recovery escalation', () => {
    const config = { recovery: 4, firstOver3: 7, secondOver3: 8 };

    it('keeps the first parity loss in recovery and escalates after the second', () => {
        const firstLoss = advanceKingFisherRecoveryEscalation(
            config.recovery,
            0,
            false,
            config.recovery,
            config.firstOver3,
            config.secondOver3,
        );
        expect(firstLoss).toEqual({ phase: config.recovery, lossCount: 1 });

        const secondLoss = advanceKingFisherRecoveryEscalation(
            config.recovery,
            firstLoss.lossCount,
            false,
            config.recovery,
            config.firstOver3,
            config.secondOver3,
        );
        expect(secondLoss).toEqual({ phase: config.firstOver3, lossCount: 0 });
    });

    it('runs two Over 3 phases after losses, then returns to parity recovery', () => {
        expect(advanceKingFisherRecoveryEscalation(
            config.firstOver3,
            0,
            false,
            config.recovery,
            config.firstOver3,
            config.secondOver3,
        )).toEqual({ phase: config.secondOver3, lossCount: 0 });
        expect(advanceKingFisherRecoveryEscalation(
            config.secondOver3,
            0,
            false,
            config.recovery,
            config.firstOver3,
            config.secondOver3,
        )).toEqual({ phase: config.recovery, lossCount: 0 });
    });

    it('clears the parity-loss counter after a win without overriding the cycle win phase', () => {
        expect(advanceKingFisherRecoveryEscalation(
            config.recovery,
            1,
            true,
            config.recovery,
            config.firstOver3,
            config.secondOver3,
        )).toEqual({ phase: null, lossCount: 0 });
    });
});