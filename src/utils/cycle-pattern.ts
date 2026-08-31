export const AI_CYCLE_ROUTE = [
    { label: 'Over 2', side: 'over' as const, barrier: 2 },
    { label: 'Under 7', side: 'under' as const, barrier: 7 },
    { label: 'Over 1', side: 'over' as const, barrier: 1 },
    { label: 'Under 2', side: 'under' as const, barrier: 2 },
];

/**
 * Returns the contrarian parity contract after three consecutive digits with
 * the same parity. A mixed or incomplete sequence is not a signal.
 */
export function parityRecoveryContract(digits: number[]): 'DIGITODD' | 'DIGITEVEN' | null {
    const recent = digits.slice(-3);
    if (recent.length < 3 || recent.some(digit => !Number.isInteger(digit))) return null;
    if (recent.every(digit => digit % 2 === 0)) return 'DIGITODD';
    if (recent.every(digit => digit % 2 !== 0)) return 'DIGITEVEN';
    return null;
}

/**
 * Pattern detector for a one-tick Over/Under entry:
 * two touches on the setup side, one move through the barrier, then a return
 * to the barrier/setup side. The current digit is the buy trigger.
 */
export function barrierReturnPattern(
    digits: number[],
    barrier: number,
    side: 'over' | 'under' = 'over',
): boolean {
    const recent = digits.slice(-4);
    if (recent.length < 4) return false;
    const b = Math.max(0, Math.min(9, Math.round(Number(barrier))));
    const [first, second, crossing, returning] = recent;

    if (side === 'over') {
        return first <= b && second <= b && crossing > b && returning <= b;
    }
    return first >= b && second >= b && crossing < b && returning >= b;
}

export function cycleRouteLabels() {
    return AI_CYCLE_ROUTE.map(route => route.label);
}