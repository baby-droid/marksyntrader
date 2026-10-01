export type KingFisherRecoveryStep = {
    phase: number | null;
    lossCount: number;
};

export function advanceKingFisherRecoveryEscalation(
    phaseAtSettlement: number,
    lossCount: number,
    won: boolean,
    recoveryPhase: number,
    firstOver3Phase: number,
    secondOver3Phase: number,
    returnPhase = recoveryPhase,
): KingFisherRecoveryStep {
    if (won) {
        if (phaseAtSettlement === firstOver3Phase) {
            return { phase: secondOver3Phase, lossCount: 0 };
        }
        if (phaseAtSettlement === secondOver3Phase) {
            return { phase: returnPhase, lossCount: 0 };
        }
        return { phase: null, lossCount: 0 };
    }

    if (phaseAtSettlement === recoveryPhase) {
        const nextLossCount = Math.max(0, Math.floor(Number(lossCount) || 0)) + 1;
        return nextLossCount >= 2
            ? { phase: firstOver3Phase, lossCount: 0 }
            : { phase: recoveryPhase, lossCount: nextLossCount };
    }

    if (phaseAtSettlement === firstOver3Phase) {
        return { phase: secondOver3Phase, lossCount: 0 };
    }

    if (phaseAtSettlement === secondOver3Phase) {
        return { phase: recoveryPhase, lossCount: 0 };
    }

    // The visible cycle routes every other loss back to parity recovery.
    return { phase: null, lossCount: 0 };
}