export type SmartCardId = 'risefall' | 'evenodd' | 'overunder' | 'matchdiffer';

export interface SmartCardConfig {
    stake: number;
    ticks: number;
    martingale: number;
    barrier: number;
    lookback: number;
    ifValue: string;
    thenAction: string;
    bulkEnabled: boolean;
    bulkCount: number;
}

export interface SmartTradeDecision {
    contract: string;
    barrier: number | null;
    meetsCondition: boolean;
    riseProb?: number;
    evenProb?: number;
    overProb?: number;
    freq?: number[];
}

export function normalizeSmartBarrier(value: unknown, action: string): number {
    const parsed = Number(value);
    const fallback = Number.isFinite(parsed) ? Math.floor(parsed) : 5;

    // Deriv digit barriers are exclusive: Over cannot use 9 and Under cannot
    // use 0. Normalize at the decision boundary, before a buy is attempted.
    if (action === 'Buy Over') return Math.max(0, Math.min(8, fallback));
    if (action === 'Buy Under') return Math.max(1, Math.min(9, fallback));
    return Math.max(0, Math.min(9, fallback));
}

export function pickSmartTradeDecision(
    id: SmartCardId,
    digits: number[],
    cfg: SmartCardConfig | undefined,
    sharedDepth = 100,
): SmartTradeDecision {
    if (!cfg) return { contract: 'DIGITEVEN', barrier: null, meetsCondition: false };

    const depth = Math.min(Math.max(1, sharedDepth), digits.length);
    const last = digits.slice(-Math.max(depth, 20));
    const requiredDigits = Math.max(1, Math.min(10, Math.floor(Number(cfg.lookback) || 3)));
    const sample = digits.slice(-requiredDigits);
    const matchesAction = (name: string) => cfg.thenAction === name;

    if (id === 'risefall') {
        const movementSample = digits.slice(-Math.max(2, requiredDigits + 1));
        const rising = movementSample.length >= 2
            && movementSample.slice(1).every((digit, index) => digit > movementSample[index]);
        const falling = movementSample.length >= 2
            && movementSample.slice(1).every((digit, index) => digit < movementSample[index]);
        return {
            contract: matchesAction('Buy Rise') ? 'CALL' : 'PUT',
            barrier: null,
            meetsCondition: cfg.ifValue === 'Rise' ? rising : falling,
            riseProb: rising ? 100 : 0,
        };
    }

    if (id === 'evenodd') {
        const paritySample = digits.slice(-requiredDigits);
        const meetsCondition = paritySample.length === requiredDigits
            && paritySample.every(digit => (digit % 2 === 0) === (cfg.ifValue === 'Even'));
        return {
            contract: matchesAction('Buy Even') ? 'DIGITEVEN' : 'DIGITODD',
            barrier: null,
            meetsCondition,
            evenProb: paritySample.filter(digit => digit % 2 === 0).length
                / Math.max(1, paritySample.length) * 100,
        };
    }

    if (id === 'overunder') {
        const action = matchesAction('Buy Over') ? 'Buy Over' : 'Buy Under';
        const barrier = normalizeSmartBarrier(cfg.barrier, action);
        const isOver = sample.length === requiredDigits && sample.every(digit => digit > barrier);
        const isUnder = sample.length === requiredDigits && sample.every(digit => digit < barrier);
        return {
            contract: action === 'Buy Over' ? 'DIGITOVER' : 'DIGITUNDER',
            barrier,
            meetsCondition: cfg.ifValue === 'Over' ? isOver : isUnder,
            overProb: sample.filter(digit => digit > barrier).length
                / Math.max(1, sample.length) * 100,
        };
    }

    const freq = Array.from({ length: 10 }, (_, digit) => last.filter(value => value === digit).length);
    const maxDigit = freq.indexOf(Math.max(...freq));
    const isMatch = sample.length === requiredDigits && sample.every(digit => digit === sample[0]);
    const isDifferent = sample.length === requiredDigits
        && new Set(sample).size > 1
        && sample[sample.length - 1] !== maxDigit;

    return {
        contract: matchesAction('Buy Matches') ? 'DIGITMATCH' : 'DIGITDIFF',
        barrier: matchesAction('Buy Matches') ? (sample[0] ?? 0) : maxDigit,
        meetsCondition: cfg.ifValue === 'Matches' ? isMatch : isDifferent,
        freq,
    };
}

export function beginSmartRun(tokens: Record<string, number>, id: SmartCardId): number {
    const token = (tokens[id] ?? 0) + 1;
    tokens[id] = token;
    return token;
}

export function invalidateSmartRun(tokens: Record<string, number>, id: SmartCardId): number {
    return beginSmartRun(tokens, id);
}

export function isSmartRunCurrent(
    tokens: Record<string, number>,
    id: SmartCardId,
    runToken: number,
): boolean {
    return tokens[id] === runToken;
}

export function isSmartRunActive(
    tokens: Record<string, number>,
    id: SmartCardId,
    runToken: number,
    stopRequested: boolean,
): boolean {
    return isSmartRunCurrent(tokens, id, runToken) && !stopRequested;
}