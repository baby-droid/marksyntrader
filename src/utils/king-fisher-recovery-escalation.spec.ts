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

    it('runs both Over 3 phases regardless of outcome, then returns to parity recovery', () => {
        expect(advanceKingFisherRecoveryEscalation(
            config.firstOver3,
            0,
            true,
            config.recovery,
            config.firstOver3,
            config.secondOver3,
        )).toEqual({ phase: config.secondOver3, lossCount: 0 });
        expect(advanceKingFisherRecoveryEscalation(
            config.secondOver3,
            0,
            true,
            config.recovery,
            config.firstOver3,
            config.secondOver3,
        )).toEqual({ phase: config.recovery, lossCount: 0 });
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

    it('can return to the main phase after the second configured escalation phase wins', () => {
        expect(advanceKingFisherRecoveryEscalation(
            3,
            0,
            true,
            1,
            2,
            3,
            0,
        )).toEqual({ phase: 0, lossCount: 0 });
    });

    it('runs both Rise/Fall stages before the two Over 3 stages after two parity losses', () => {
        const sequence = {
            recovery: 1,
            fallAfterRises: 2,
            riseAfterFalls: 3,
            firstOver3: 4,
            secondOver3: 5,
            returnPhase: 0,
        };

        const firstParityLoss = advanceKingFisherRecoveryEscalation(
            sequence.recovery, 0, false, sequence.recovery,
            sequence.firstOver3, sequence.secondOver3, sequence.returnPhase,
            sequence.fallAfterRises, sequence.riseAfterFalls,
        );
        expect(firstParityLoss).toEqual({ phase: sequence.recovery, lossCount: 1 });

        const secondParityLoss = advanceKingFisherRecoveryEscalation(
            sequence.recovery, firstParityLoss.lossCount, false, sequence.recovery,
            sequence.firstOver3, sequence.secondOver3, sequence.returnPhase,
            sequence.fallAfterRises, sequence.riseAfterFalls,
        );
        expect(secondParityLoss).toEqual({ phase: sequence.fallAfterRises, lossCount: 0 });

        expect(advanceKingFisherRecoveryEscalation(
            sequence.fallAfterRises, 0, false, sequence.recovery,
            sequence.firstOver3, sequence.secondOver3, sequence.returnPhase,
            sequence.fallAfterRises, sequence.riseAfterFalls,
        )).toEqual({ phase: sequence.riseAfterFalls, lossCount: 0 });
        expect(advanceKingFisherRecoveryEscalation(
            sequence.riseAfterFalls, 0, true, sequence.recovery,
            sequence.firstOver3, sequence.secondOver3, sequence.returnPhase,
            sequence.fallAfterRises, sequence.riseAfterFalls,
        )).toEqual({ phase: sequence.firstOver3, lossCount: 0 });
        expect(advanceKingFisherRecoveryEscalation(
            sequence.firstOver3, 0, false, sequence.recovery,
            sequence.firstOver3, sequence.secondOver3, sequence.returnPhase,
            sequence.fallAfterRises, sequence.riseAfterFalls,
        )).toEqual({ phase: sequence.secondOver3, lossCount: 0 });
        expect(advanceKingFisherRecoveryEscalation(
            sequence.secondOver3, 0, true, sequence.recovery,
            sequence.firstOver3, sequence.secondOver3, sequence.returnPhase,
            sequence.fallAfterRises, sequence.riseAfterFalls,
        )).toEqual({ phase: sequence.returnPhase, lossCount: 0 });
    });

    it('skips the Over 3 phases when disabled for a Rise/Fall-only recovery', () => {
        expect(advanceKingFisherRecoveryEscalation(
            -1, 1, false, -1, -1, -1, 0, 10, 11,
        )).toEqual({ phase: 10, lossCount: 0 });
        expect(advanceKingFisherRecoveryEscalation(
            10, 0, true, -1, -1, -1, 0, 10, 11,
        )).toEqual({ phase: 11, lossCount: 0 });
        expect(advanceKingFisherRecoveryEscalation(
            11, 0, false, -1, -1, -1, 0, 10, 11,
        )).toEqual({ phase: 0, lossCount: 0 });
    });
});