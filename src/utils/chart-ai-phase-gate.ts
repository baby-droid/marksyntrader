export type ChartAiPhaseDirection = 'HIGH' | 'LOW';

export type ChartAiPhaseState = {
    symbol: string;
    lastEpoch: number | null;
    digits: number[];
};

export type ChartAiPhaseGateResult = {
    passed: boolean;
    updated: boolean;
    windows: Record<5 | 12 | 15, { ratio: number; passed: boolean }>;
    strategyVotes: Record<
        'reversal' | 'tick-concept' | 'entry-loop' | 'conservative' | 'number-losses' | 'digit-distribution' | 'momentum',
        boolean
    >;
    votes: number;
};

const WINDOW_SIZES = [5, 12, 15] as const;

export function createChartAiPhaseState(): ChartAiPhaseState {
    return { symbol: '', lastEpoch: null, digits: [] };
}

export function evaluateChartAiPhaseGate(
    state: ChartAiPhaseState,
    direction: ChartAiPhaseDirection,
    barrier: number,
    epoch: number,
    digit: number,
    symbol: string,
): ChartAiPhaseGateResult {
    if (!Number.isFinite(epoch) || !Number.isInteger(digit) || digit < 0 || digit > 9) {
        return {
            passed: false,
            updated: false,
            windows: {
                5: { ratio: 0, passed: false },
                12: { ratio: 0, passed: false },
                15: { ratio: 0, passed: false },
            },
            strategyVotes: {
                reversal: false,
                'tick-concept': false,
                'entry-loop': false,
                conservative: false,
                'number-losses': false,
                'digit-distribution': false,
                momentum: false,
            },
            votes: 0,
        };
    }

    if (state.symbol !== symbol) {
        state.symbol = symbol;
        state.lastEpoch = null;
        state.digits = [];
    }

    let updated = false;
    if (state.lastEpoch !== epoch) {
        state.lastEpoch = epoch;
        state.digits.push(digit);
        while (state.digits.length > 15) state.digits.shift();
        updated = true;
    }

    const qualifiesDigit = (value: number) => direction === 'HIGH'
        ? value >= 5
        : value <= 4;
    const windows = {} as ChartAiPhaseGateResult['windows'];

    for (const size of WINDOW_SIZES) {
        const sample = state.digits.slice(-size);
        const ratio = sample.length === size
            ? sample.filter(qualifiesDigit).length / size
            : 0;
        windows[size] = { ratio, passed: sample.length === size && ratio >= 0.6 };
    }

    const distributionPassed = windows[15].passed
        && WINDOW_SIZES.filter(size => windows[size].passed).length >= 2;
    const currentDigit = state.digits[state.digits.length - 1];
    const previousDigit = state.digits[state.digits.length - 2];
    const currentQualifies = direction === 'HIGH'
        ? currentDigit > barrier
        : currentDigit < barrier;
    const distance = direction === 'HIGH'
        ? currentDigit - barrier
        : barrier - currentDigit;

    let qualifyingStreak = 0;
    for (let i = state.digits.length - 1; i >= 0; i -= 1) {
        const qualifies = direction === 'HIGH'
            ? state.digits[i] > barrier
            : state.digits[i] < barrier;
        if (!qualifies) break;
        qualifyingStreak += 1;
    }

    // These are the same seven checks used by Chart AI's entryMatches().
    // Over/Under signals use a reference entry, so Reversal and Entry Loop
    // confirm a valid digit on the selected side of the barrier.
    const momentum = previousDigit == null
        || (direction === 'HIGH' ? currentDigit >= previousDigit : currentDigit <= previousDigit);
    const strategyVotes: ChartAiPhaseGateResult['strategyVotes'] = {
        reversal: currentQualifies,
        'tick-concept': currentQualifies && distance >= 1,
        'entry-loop': currentQualifies && (qualifyingStreak === 2 || qualifyingStreak === 3),
        conservative: currentQualifies && distance >= 1,
        'number-losses': true,
        'digit-distribution': distributionPassed,
        momentum,
    };
    const votes = Object.values(strategyVotes).filter(Boolean).length;

    return {
        passed: distributionPassed && votes >= Math.ceil(Object.keys(strategyVotes).length * 0.5),
        updated,
        windows,
        strategyVotes,
        votes,
    };
}