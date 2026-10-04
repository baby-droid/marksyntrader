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
    intermediatePhase1 = -1,
    intermediatePhase2 = -1,
): KingFisherRecoveryStep {
    const escalationPhases = [
        ...(Number.isInteger(intermediatePhase1) && intermediatePhase1 >= 0 ? [intermediatePhase1] : []),
        ...(Number.isInteger(intermediatePhase2) && intermediatePhase2 >= 0 ? [intermediatePhase2] : []),
        firstOver3Phase,
        secondOver3Phase,
    ];

    if (phaseAtSettlement === recoveryPhase) {
        if (won) return { phase: null, lossCount: 0 };

        const nextLossCount = Math.max(0, Math.floor(Number(lossCount) || 0)) + 1;
        return nextLossCount >= 2
            ? { phase: escalationPhases[0], lossCount: 0 }
            : { phase: recoveryPhase, lossCount: nextLossCount };
    }

    const escalationIndex = escalationPhases.indexOf(phaseAtSettlement);
    if (escalationIndex >= 0) {
        return {
            phase: escalationPhases[escalationIndex + 1] ?? returnPhase,
            lossCount: 0,
        };
    }

    if (won) {
        return { phase: null, lossCount: 0 };
    }

    // The visible cycle routes every other loss back to parity recovery.
    return { phase: null, lossCount: 0 };
}