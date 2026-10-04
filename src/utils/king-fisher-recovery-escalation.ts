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
    recoveryPhase2 = -1,
): KingFisherRecoveryStep {
    const escalationPhases = [
        ...(Number.isInteger(intermediatePhase1) && intermediatePhase1 >= 0 ? [intermediatePhase1] : []),
        ...(Number.isInteger(intermediatePhase2) && intermediatePhase2 >= 0 ? [intermediatePhase2] : []),
        ...(Number.isInteger(firstOver3Phase) && firstOver3Phase >= 0 ? [firstOver3Phase] : []),
        ...(Number.isInteger(secondOver3Phase) && secondOver3Phase >= 0 ? [secondOver3Phase] : []),
    ];

    const recoveryPhases = [
        recoveryPhase,
        ...(Number.isInteger(recoveryPhase2) && recoveryPhase2 >= 0 ? [recoveryPhase2] : []),
    ];
    if (recoveryPhases.includes(phaseAtSettlement)) {
        if (won) return { phase: null, lossCount: 0 };

        const nextLossCount = Math.max(0, Math.floor(Number(lossCount) || 0)) + 1;
        return nextLossCount >= 2
            ? { phase: escalationPhases[0] ?? returnPhase, lossCount: 0 }
            : {
                // With two alternating default phases, the visible XML result
                // logic selects the next phase after the first loss. Do not
                // force it back to the first phase.
                phase: recoveryPhases.length > 1 ? null : recoveryPhase,
                lossCount: nextLossCount,
            };
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