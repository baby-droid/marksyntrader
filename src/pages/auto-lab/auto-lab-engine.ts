export type AutoLabMode =
    | 'Multimarket'
    | 'RC Even/Odd'
    | 'RC Over4/Under5'
    | '%Even/Odd'
    | 'Matches/Differs'
    | 'Rise/Fall';

export type AutoLabContractType =
    | 'ACCU' | 'ASIANU' | 'ASIAND' | 'CALL' | 'PUT' | 'CALLE' | 'PUTE'
    | 'CALLSPREAD' | 'PUTSPREAD' | 'DIGITMATCH' | 'DIGITDIFF'
    | 'DIGITEVEN' | 'DIGITODD' | 'DIGITOVER' | 'DIGITUNDER'
    | 'EXPIRYMISS' | 'EXPIRYRANGE' | 'LBFLOATCALL' | 'LBFLOATPUT'
    | 'LBHIGHLOW' | 'MULTUP' | 'MULTDOWN' | 'ONETOUCH' | 'NOTOUCH'
    | 'RANGE' | 'UPORDOWN' | 'RESETCALL' | 'RESETPUT' | 'RUNHIGH'
    | 'RUNLOW' | 'TICKHIGH' | 'TICKLOW';

export type AutoLabContractChoice = 'AUTO' | AutoLabContractType;

export const AUTO_LAB_MODES: AutoLabMode[] = [
    'Multimarket',
    'RC Even/Odd',
    'RC Over4/Under5',
    '%Even/Odd',
    'Matches/Differs',
    'Rise/Fall',
];

export const AUTO_LAB_CONTRACT_TYPES: AutoLabContractType[] = [
    'ACCU',
    'ASIANU',
    'ASIAND',
    'CALL',
    'PUT',
    'CALLE',
    'PUTE',
    'CALLSPREAD',
    'PUTSPREAD',
    'DIGITEVEN',
    'DIGITODD',
    'DIGITOVER',
    'DIGITUNDER',
    'DIGITMATCH',
    'DIGITDIFF',
    'EXPIRYMISS',
    'EXPIRYRANGE',
    'LBFLOATCALL',
    'LBFLOATPUT',
    'LBHIGHLOW',
    'MULTUP',
    'MULTDOWN',
    'ONETOUCH',
    'NOTOUCH',
    'RANGE',
    'UPORDOWN',
    'RESETCALL',
    'RESETPUT',
    'RUNHIGH',
    'RUNLOW',
    'TICKHIGH',
    'TICKLOW',
];

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
const barrierContracts = new Set<AutoLabContractType>([
    'DIGITMATCH', 'DIGITDIFF', 'DIGITOVER', 'DIGITUNDER',
    'ONETOUCH', 'NOTOUCH', 'RANGE', 'UPORDOWN', 'EXPIRYMISS',
    'EXPIRYRANGE', 'RESETCALL', 'RESETPUT',
]);
const digitBarrierContracts = new Set<AutoLabContractType>([
    'DIGITMATCH', 'DIGITDIFF', 'DIGITOVER', 'DIGITUNDER',
]);
const twoBarrierContracts = new Set<AutoLabContractType>([
    'RANGE', 'UPORDOWN', 'EXPIRYMISS', 'EXPIRYRANGE',
]);

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
): AutoLabCandidate | null => {
    const above = digits.filter(digit => digit > barrier).length;
    const below = digits.filter(digit => digit < barrier).length;
    const eligible = above + below;
    if (!eligible) return null;
    const abovePercent = (above / eligible) * 100;
    const belowPercent = (below / eligible) * 100;
    if (abovePercent >= threshold) {
        return candidate(
            market,
            'RC Over4/Under5',
            'DIGITOVER',
            abovePercent,
            `${abovePercent.toFixed(1)}% of non-barrier digits are above ${barrier}.`,
            barrier,
        );
    }
    if (belowPercent >= threshold) {
        return candidate(
            market,
            'RC Over4/Under5',
            'DIGITUNDER',
            belowPercent,
            `${belowPercent.toFixed(1)}% of non-barrier digits are below ${barrier}.`,
            barrier,
        );
    }
    return null;
};

const evaluateParityPercentage = (
    market: AutoLabMarketWindow,
    digits: number[],
    threshold: number,
): AutoLabCandidate | null => {
    if (!digits.length) return null;
    const even = digits.filter(digit => digit % 2 === 0).length;
    const evenPercent = (even / digits.length) * 100;
    const oddPercent = 100 - evenPercent;
    if (evenPercent >= threshold) {
        return candidate(market, '%Even/Odd', 'DIGITEVEN', evenPercent, `${evenPercent.toFixed(1)}% even in the selected window.`);
    }
    if (oddPercent >= threshold) {
        return candidate(market, '%Even/Odd', 'DIGITODD', oddPercent, `${oddPercent.toFixed(1)}% odd in the selected window.`);
    }
    return null;
};

const evaluateMatchesDiffers = (
    market: AutoLabMarketWindow,
    digits: number[],
    barrier: number,
    threshold: number,
): AutoLabCandidate | null => {
    if (!digits.length) return null;
    const matches = digits.filter(digit => digit === barrier).length;
    const matchPercent = (matches / digits.length) * 100;
    const differsPercent = 100 - matchPercent;
    if (matchPercent >= threshold) {
        return candidate(
            market,
            'Matches/Differs',
            'DIGITMATCH',
            matchPercent,
            `Digit ${barrier} appeared on ${matchPercent.toFixed(1)}% of the selected ticks.`,
            barrier,
        );
    }
    if (differsPercent >= threshold) {
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
        case 'RC Over4/Under5':
            return evaluateOverUnder({ ...market, ticks }, digits, barrier, threshold);
        case '%Even/Odd':
            return evaluateParityPercentage({ ...market, ticks }, digits, threshold);
        case 'Matches/Differs':
            return evaluateMatchesDiffers({ ...market, ticks }, digits, barrier, threshold);
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
            output.push({
                ...result,
                contract_type: selectedContract,
                ...(digitBarrierContracts.has(selectedContract)
                    ? { barrier: settings.barrier }
                    : barrierContracts.has(selectedContract)
                        ? { barrier: settings.contractBarrier ?? settings.barrier }
                        : { barrier: undefined }),
                ...(twoBarrierContracts.has(selectedContract) && settings.secondaryBarrier != null
                    ? { barrier2: settings.secondaryBarrier }
                    : { barrier2: undefined }),
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
        case 'CALLE':
        case 'ASIANU':
        case 'MULTUP':
        case 'CALLSPREAD':
        case 'RESETCALL':
        case 'RUNHIGH':
        case 'LBFLOATCALL':
            return exitTick.quote > entryQuote;
        case 'PUT':
        case 'PUTE':
        case 'ASIAND':
        case 'MULTDOWN':
        case 'PUTSPREAD':
        case 'RESETPUT':
        case 'RUNLOW':
        case 'LBFLOATPUT':
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
        case 'ONETOUCH':
            return barrier != null && (
                exitTick.quote === barrier
                || (entryQuote < barrier && exitTick.quote > barrier)
                || (entryQuote > barrier && exitTick.quote < barrier)
            );
        case 'NOTOUCH':
            return barrier != null && !(
                exitTick.quote === barrier
                || (entryQuote < barrier && exitTick.quote > barrier)
                || (entryQuote > barrier && exitTick.quote < barrier)
            );
        case 'RANGE':
        case 'EXPIRYRANGE':
            return barrier != null && barrier2 != null
                && exitTick.quote > Math.min(barrier, barrier2)
                && exitTick.quote < Math.max(barrier, barrier2);
        case 'UPORDOWN':
        case 'EXPIRYMISS':
            return barrier != null && barrier2 != null
                && (exitTick.quote < Math.min(barrier, barrier2) || exitTick.quote > Math.max(barrier, barrier2));
        case 'ACCU':
        case 'LBHIGHLOW':
        case 'TICKHIGH':
            return exitTick.quote >= entryQuote;
        case 'TICKLOW':
            return exitTick.quote <= entryQuote;
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