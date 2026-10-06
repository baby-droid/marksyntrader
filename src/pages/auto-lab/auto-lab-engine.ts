export type AutoLabMode =
    | 'Multimarket'
    | 'RC Even/Odd'
    | 'RC Over4/Under5'
    | '%Even/Odd'
    | 'Matches/Differs'
    | 'Rise/Fall';

export type AutoLabContractType =
    | 'CALL' | 'PUT' | 'DIGITEVEN' | 'DIGITODD'
    | 'DIGITMATCH' | 'DIGITDIFF' | 'DIGITOVER' | 'DIGITUNDER'
    | 'CALLSPREAD' | 'PUTSPREAD' | 'ONETOUCH' | 'RANGE'
    | 'TICKHIGH' | 'TICKLOW' | 'ACCU' | 'MULTUP' | 'MULTDOWN'
    | 'LBFLOATCALL' | 'LBFLOATPUT' | 'LBHIGHLOW';

export type AutoLabContractChoice = 'AUTO' | AutoLabContractType;
export type AutoLabDurationUnit = 't' | 's' | 'm' | 'h' | 'd';

export const getAutoLabDurationParams = (
    contractType: AutoLabContractType,
    duration: number,
    durationUnit: AutoLabDurationUnit,
): { duration: number; duration_unit: AutoLabDurationUnit } => {
    const normalizedDuration = Number.isFinite(duration)
        ? Math.max(1, Math.floor(duration))
        : 1;
    const tickOnly = contractType.startsWith('DIGIT')
        || contractType === 'TICKHIGH'
        || contractType === 'TICKLOW';

    return {
        duration: normalizedDuration,
        duration_unit: tickOnly ? 't' : durationUnit,
    };
};

export const AUTO_LAB_MODES: AutoLabMode[] = [
    'Multimarket',
    'RC Even/Odd',
    'RC Over4/Under5',
    '%Even/Odd',
    'Matches/Differs',
    'Rise/Fall',
];

export const AUTO_LAB_CONTRACT_TYPES: AutoLabContractType[] = [
    'CALL',
    'PUT',
    'DIGITEVEN',
    'DIGITODD',
    'DIGITOVER',
    'DIGITUNDER',
    'DIGITMATCH',
    'DIGITDIFF',
];

const MODE_CONTRACT_TYPES: Record<AutoLabMode, AutoLabContractType[]> = {
    Multimarket: AUTO_LAB_CONTRACT_TYPES,
    'RC Even/Odd': ['DIGITEVEN', 'DIGITODD'],
    'RC Over4/Under5': ['DIGITOVER', 'DIGITUNDER'],
    '%Even/Odd': ['DIGITEVEN', 'DIGITODD'],
    'Matches/Differs': ['DIGITMATCH', 'DIGITDIFF'],
    'Rise/Fall': ['CALL', 'PUT'],
};

export const getAutoLabSupportedContracts = (mode: AutoLabMode): AutoLabContractType[] =>
    [...MODE_CONTRACT_TYPES[mode]];

export type AutoLabTick = {
    symbol: string;
    digit: number;
    quote: number;
    epoch: number;
    pip_size: number;
};

export type AutoLabMarketWindow = {
    symbol: string;
    label: string;
    ticks: AutoLabTick[];
};

export type AutoLabStrategySettings = {
    ticksWindow: number;
    thresholdPercent: number;
    barrier: number;
    autoBarrier?: boolean;
    contractBarrier?: number;
    secondaryBarrier?: number;
    requiredStreak: number;
    contractType: AutoLabContractChoice;
};

export type AutoLabCandidate = {
    symbol: string;
    label: string;
    contract_type: AutoLabContractType;
    barrier?: number;
    barrier2?: number;
    strategy: Exclude<AutoLabMode, 'Multimarket'>;
    score: number;
    detail: string;
    epoch: number;
    entryQuote: number;
};

export type AutoLabDigitStat = { digit: number; count: number; percent: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const minimumSampleSize = (window: number) => Math.min(20, Math.max(1, Math.floor(window) || 1));

const candidate = (
    market: AutoLabMarketWindow,
    strategy: AutoLabCandidate['strategy'],
    contract_type: AutoLabContractType,
    score: number,
    detail: string,
    barrier?: number,
): AutoLabCandidate | null => {
    const latest = market.ticks[market.ticks.length - 1];
    if (!latest) return null;
    return {
        symbol: market.symbol,
        label: market.label,
        contract_type,
        ...(barrier == null ? {} : { barrier }),
        strategy,
        score: clamp(score, 0, 99.9),
        detail,
        epoch: latest.epoch,
        entryQuote: latest.quote,
    };
};

const evaluateParityCycle = (
    market: AutoLabMarketWindow,
    requiredStreak: number,
): AutoLabCandidate | null => {
    const last = market.ticks[market.ticks.length - 1];
    if (!last) return null;
    const parity = last.digit % 2;
    let streak = 0;
    for (let index = market.ticks.length - 1; index >= 0; index -= 1) {
        if (market.ticks[index].digit % 2 !== parity) break;
        streak += 1;
    }
    if (streak < requiredStreak) return null;
    const contract = parity === 0 ? 'DIGITODD' : 'DIGITEVEN';
    return candidate(
        market,
        'RC Even/Odd',
        contract,
        62 + (streak - requiredStreak) * 4,
        `${streak} consecutive ${parity === 0 ? 'even' : 'odd'} digits; cycle entry is ${parity === 0 ? 'odd' : 'even'}.`,
    );
};

const evaluateOverUnder = (
    market: AutoLabMarketWindow,
    digits: number[],
    barrier: number,
    threshold: number,
    contractChoice: AutoLabContractChoice,
): AutoLabCandidate[] => {
    const above = digits.filter(digit => digit > barrier).length;
    const below = digits.filter(digit => digit < barrier).length;
    if (digits.length < minimumSampleSize(digits.length)) return [];
    const abovePercent = (above / digits.length) * 100;
    const belowPercent = (below / digits.length) * 100;
    const output: AutoLabCandidate[] = [];
    if ((contractChoice === 'AUTO' || contractChoice === 'DIGITOVER') && abovePercent >= threshold) {
        const result = candidate(
            market,
            'RC Over4/Under5',
            'DIGITOVER',
            abovePercent,
            `${above}/${digits.length} observed ticks (${abovePercent.toFixed(1)}%) were above barrier ${barrier}; a tie is a loss.`,
            barrier,
        );
        if (result) output.push(result);
    }
    if ((contractChoice === 'AUTO' || contractChoice === 'DIGITUNDER') && belowPercent >= threshold) {
        const result = candidate(
            market,
            'RC Over4/Under5',
            'DIGITUNDER',
            belowPercent,
            `${below}/${digits.length} observed ticks (${belowPercent.toFixed(1)}%) were below barrier ${barrier}; a tie is a loss.`,
            barrier,
        );
        if (result) output.push(result);
    }
    return output;
};

const evaluateParityPercentage = (
    market: AutoLabMarketWindow,
    digits: number[],
    threshold: number,
    contractChoice: AutoLabContractChoice,
): AutoLabCandidate | null => {
    if (!digits.length) return null;
    const even = digits.filter(digit => digit % 2 === 0).length;
    const evenPercent = (even / digits.length) * 100;
    const oddPercent = 100 - evenPercent;
    if ((contractChoice === 'AUTO' || contractChoice === 'DIGITEVEN') && evenPercent >= threshold) {
        return candidate(market, '%Even/Odd', 'DIGITEVEN', evenPercent, `${evenPercent.toFixed(1)}% even in the selected window.`);
    }
    if ((contractChoice === 'AUTO' || contractChoice === 'DIGITODD') && oddPercent >= threshold) {
        return candidate(market, '%Even/Odd', 'DIGITODD', oddPercent, `${oddPercent.toFixed(1)}% odd in the selected window.`);
    }
    return null;
};

const evaluateMatchesDiffers = (
    market: AutoLabMarketWindow,
    digits: number[],
    barrier: number,
    threshold: number,
    contractChoice: AutoLabContractChoice,
): AutoLabCandidate | null => {
    if (!digits.length) return null;
    const matches = digits.filter(digit => digit === barrier).length;
    const matchPercent = (matches / digits.length) * 100;
    const differsPercent = 100 - matchPercent;
    if ((contractChoice === 'AUTO' || contractChoice === 'DIGITMATCH') && matchPercent >= threshold) {
        return candidate(
            market,
            'Matches/Differs',
            'DIGITMATCH',
            matchPercent,
            `Digit ${barrier} appeared on ${matchPercent.toFixed(1)}% of the selected ticks.`,
            barrier,
        );
    }
    if ((contractChoice === 'AUTO' || contractChoice === 'DIGITDIFF') && differsPercent >= threshold) {
        return candidate(
            market,
            'Matches/Differs',
            'DIGITDIFF',
            differsPercent,
            `Digits differed from ${barrier} on ${differsPercent.toFixed(1)}% of the selected ticks.`,
            barrier,
        );
    }
    return null;
};

const evaluateRiseFall = (
    market: AutoLabMarketWindow,
    requiredStreak: number,
): AutoLabCandidate | null => {
    if (market.ticks.length < requiredStreak + 1) return null;
    let direction = 0;
    let streak = 0;
    for (let index = market.ticks.length - 1; index > 0; index -= 1) {
        const delta = market.ticks[index].quote - market.ticks[index - 1].quote;
        const nextDirection = delta > 0 ? 1 : delta < 0 ? -1 : 0;
        if (nextDirection === 0 || (direction !== 0 && nextDirection !== direction)) break;
        direction = nextDirection;
        streak += 1;
    }
    if (!direction || streak < requiredStreak) return null;
    const contract = direction > 0 ? 'CALL' : 'PUT';
    return candidate(
        market,
        'Rise/Fall',
        contract,
        62 + (streak - requiredStreak) * 4,
        `${streak} consecutive ${direction > 0 ? 'upward' : 'downward'} price moves.`,
    );
};

const getOverUnderBarriers = (settings: AutoLabStrategySettings): number[] => {
    if (settings.autoBarrier) return Array.from({ length: 10 }, (_, digit) => digit);
    if (!Number.isFinite(settings.barrier)) return [];
    return [clamp(Math.floor(settings.barrier), 0, 9)];
};

const evaluateOneMode = (
    mode: Exclude<AutoLabMode, 'Multimarket'>,
    market: AutoLabMarketWindow,
    settings: AutoLabStrategySettings,
): AutoLabCandidate | null => {
    const sampleCount = clamp(Math.floor(settings.ticksWindow) || 1, 1, 5000);
    const ticks = market.ticks.slice(-sampleCount);
    if (ticks.length < minimumSampleSize(sampleCount)) return null;
    const digits = ticks.map(tick => tick.digit);
    const barrier = clamp(Math.floor(settings.barrier), 0, 9);
    const threshold = clamp(settings.thresholdPercent, 50, 100);
    const requiredStreak = clamp(Math.floor(settings.requiredStreak) || 1, 1, 100);

    switch (mode) {
        case 'RC Even/Odd':
            return evaluateParityCycle({ ...market, ticks }, requiredStreak);
        case 'RC Over4/Under5': {
            const barriers = getOverUnderBarriers(settings);
            return barriers
                .flatMap(selectedBarrier => evaluateOverUnder(
                    { ...market, ticks },
                    digits,
                    selectedBarrier,
                    threshold,
                    settings.contractType,
                ))
                .sort((left, right) => right.score - left.score || (left.barrier ?? 0) - (right.barrier ?? 0))[0] ?? null;
        }
        case '%Even/Odd':
            return evaluateParityPercentage({ ...market, ticks }, digits, threshold, settings.contractType);
        case 'Matches/Differs':
            return evaluateMatchesDiffers({ ...market, ticks }, digits, barrier, threshold, settings.contractType);
        case 'Rise/Fall':
            return evaluateRiseFall({ ...market, ticks }, requiredStreak);
    }
};

const strategyModes: Exclude<AutoLabMode, 'Multimarket'>[] = [
    'RC Even/Odd',
    'RC Over4/Under5',
    '%Even/Odd',
    'Matches/Differs',
    'Rise/Fall',
];

export const evaluateAutoLabCandidates = (
    mode: AutoLabMode,
    markets: AutoLabMarketWindow[],
    settings: AutoLabStrategySettings,
): AutoLabCandidate[] => {
    const modes = mode === 'Multimarket' ? strategyModes : [mode];
    const output: AutoLabCandidate[] = [];
    for (const market of markets) {
        for (const strategy of modes) {
            const result = evaluateOneMode(strategy, market, settings);
            if (!result) continue;
            if (settings.contractType === 'AUTO') {
                output.push(result);
                continue;
            }
            const selectedContract = settings.contractType;
            const isPriceBarrierContract =
                selectedContract === 'ONETOUCH' || selectedContract === 'RANGE';
            if (
                !isPriceBarrierContract
                && !MODE_CONTRACT_TYPES[result.strategy].includes(selectedContract)
            ) continue;
            if (result.strategy === 'Rise/Fall') {
                // A fixed directional contract must agree with the quote-momentum
                // signal. Other fixed contracts have no meaningful Rise/Fall
                // relationship, so do not emit a contradictory candidate.
                if (
                    (selectedContract !== 'CALL' && selectedContract !== 'PUT')
                    || selectedContract !== result.contract_type
                ) continue;
            }
            if (
                !isPriceBarrierContract
                && result.strategy !== 'RC Even/Odd'
                && result.contract_type !== selectedContract
            ) continue;
            if (isPriceBarrierContract) {
                const barrier = Number(settings.contractBarrier);
                if (!Number.isFinite(barrier)) continue;
                const normalizedBarrier = Number(barrier.toFixed(2));
                if (selectedContract === 'RANGE') {
                    const secondaryBarrier = Number(settings.secondaryBarrier);
                    if (!Number.isFinite(secondaryBarrier)) continue;
                    const normalizedSecondaryBarrier = Number(secondaryBarrier.toFixed(2));
                    if (normalizedSecondaryBarrier <= normalizedBarrier) continue;
                    output.push({
                        ...result,
                        contract_type: selectedContract,
                        barrier: normalizedBarrier,
                        barrier2: normalizedSecondaryBarrier,
                    });
                    continue;
                }
                output.push({
                    ...result,
                    contract_type: selectedContract,
                    barrier: normalizedBarrier,
                });
                continue;
            }
            output.push({
                ...result,
                ...(result.strategy === 'RC Even/Odd' ? { contract_type: selectedContract } : {}),
            });
        }
    }
    return output.sort((left, right) => right.score - left.score || right.epoch - left.epoch);
};

export const getAutoLabDigitStats = (ticks: AutoLabTick[]): AutoLabDigitStat[] => {
    const counts = Array.from({ length: 10 }, (_, digit) => ({ digit, count: 0, percent: 0 }));
    for (const tick of ticks) {
        if (Number.isInteger(tick.digit) && tick.digit >= 0 && tick.digit <= 9) counts[tick.digit].count += 1;
    }
    const total = counts.reduce((sum, item) => sum + item.count, 0);
    return counts.map(item => ({ ...item, percent: total ? (item.count / total) * 100 : 0 }));
};

export const isAutoLabContractWin = (
    contractType: AutoLabContractType,
    barrier: number | undefined,
    exitTick: AutoLabTick,
    entryQuote: number,
    barrier2?: number,
): boolean => {
    switch (contractType) {
        case 'CALL':
            return exitTick.quote > entryQuote;
        case 'PUT':
            return exitTick.quote < entryQuote;
        case 'DIGITEVEN':
            return exitTick.digit % 2 === 0;
        case 'DIGITODD':
            return exitTick.digit % 2 === 1;
        case 'DIGITOVER':
            return barrier != null && exitTick.digit > barrier;
        case 'DIGITUNDER':
            return barrier != null && exitTick.digit < barrier;
        case 'DIGITMATCH':
            return barrier != null && exitTick.digit === barrier;
        case 'DIGITDIFF':
            return barrier != null && exitTick.digit !== barrier;
        default:
            // Fail closed for execution-only contract types that do not have a
            // matching local win predicate in the digit/momentum evaluator.
            return false;
    }
};

export type AutoLabGatePhase = 'losses' | 'wins' | 'armed';
export type AutoLabGateState = {
    phase: AutoLabGatePhase;
    consecutiveLosses: number;
    consecutiveWins: number;
    armedEpoch: number | null;
};

export const createAutoLabGate = (lossesRequired: number, winsRequired: number): AutoLabGateState => ({
    phase: lossesRequired <= 0 ? 'armed' : 'losses',
    consecutiveLosses: 0,
    consecutiveWins: 0,
    armedEpoch: lossesRequired <= 0 ? 0 : null,
});

export const advanceAutoLabGate = (
    state: AutoLabGateState,
    won: boolean,
    epoch: number,
    lossesRequired: number,
    winsRequired: number,
): AutoLabGateState => {
    if (state.phase === 'armed') return state;

    if (state.phase === 'losses') {
        const consecutiveLosses = won ? 0 : state.consecutiveLosses + 1;
        if (!won && consecutiveLosses >= Math.max(1, lossesRequired)) {
            if (winsRequired <= 0) {
                return { phase: 'armed', consecutiveLosses, consecutiveWins: 0, armedEpoch: epoch };
            }
            return { phase: 'wins', consecutiveLosses, consecutiveWins: 0, armedEpoch: null };
        }
        return { ...state, consecutiveLosses, consecutiveWins: 0 };
    }

    const consecutiveWins = won ? state.consecutiveWins + 1 : 0;
    if (won && consecutiveWins >= Math.max(1, winsRequired)) {
        return { ...state, phase: 'armed', consecutiveWins, armedEpoch: epoch };
    }
    return { ...state, consecutiveWins };
};

export const resetAutoLabGateAfterTrade = (
    lossesRequired: number,
    winsRequired: number,
): AutoLabGateState => createAutoLabGate(lossesRequired, winsRequired);