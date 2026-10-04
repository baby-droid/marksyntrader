import { api_base } from '@/external/bot-skeleton';

export type KingFisherDirection = 'BELOW' | 'ABOVE';
export type KingFisherDigitSetup = {
    contract: 'DIGITOVER' | 'DIGITUNDER';
    direction: KingFisherDirection;
    barrier: number;
};

type KingFisherWorkspaceBlock = {
    type: string;
    getFieldValue?: (name: string) => string | null | undefined;
    getInputTargetBlock?: (name: string) => KingFisherWorkspaceBlock | null;
};

export type KingFisherMarket = {
    symbol: string;
    label: string;
    market: 'synthetic_index';
    submarket: 'random_index' | 'jump_index' | 'crash_index';
    group: 'plain' | '1s' | 'jump' | 'bear-bull';
    score: number;
    longestStreak: number;
    qualifyingTicks: number;
    lastDigit: number | null;
};

export const KING_FISHER_MARKETS = [
    { symbol: 'R_10', label: 'Volatility 10', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: 'plain' as const, pipSize: 3 },
    { symbol: 'R_25', label: 'Volatility 25', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: 'plain' as const, pipSize: 3 },
    { symbol: 'R_50', label: 'Volatility 50', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: 'plain' as const, pipSize: 4 },
    { symbol: 'R_75', label: 'Volatility 75', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: 'plain' as const, pipSize: 4 },
    { symbol: 'R_100', label: 'Volatility 100', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: 'plain' as const, pipSize: 2 },
    { symbol: '1HZ10V', label: 'Volatility 10 (1s)', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: '1s' as const, pipSize: 3 },
    { symbol: '1HZ25V', label: 'Volatility 25 (1s)', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: '1s' as const, pipSize: 2 },
    { symbol: '1HZ30V', label: 'Volatility 30 (1s)', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: '1s' as const, pipSize: 3 },
    { symbol: '1HZ50V', label: 'Volatility 50 (1s)', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: '1s' as const, pipSize: 4 },
    { symbol: '1HZ75V', label: 'Volatility 75 (1s)', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: '1s' as const, pipSize: 4 },
    { symbol: '1HZ90V', label: 'Volatility 90 (1s)', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: '1s' as const, pipSize: 3 },
    { symbol: '1HZ100V', label: 'Volatility 100 (1s)', market: 'synthetic_index' as const, submarket: 'random_index' as const, group: '1s' as const, pipSize: 2 },
    { symbol: 'JD10', label: 'Jump 10', market: 'synthetic_index' as const, submarket: 'jump_index' as const, group: 'jump' as const, pipSize: 3 },
    { symbol: 'JD25', label: 'Jump 25', market: 'synthetic_index' as const, submarket: 'jump_index' as const, group: 'jump' as const, pipSize: 2 },
    { symbol: 'JD50', label: 'Jump 50', market: 'synthetic_index' as const, submarket: 'jump_index' as const, group: 'jump' as const, pipSize: 4 },
    { symbol: 'JD75', label: 'Jump 75', market: 'synthetic_index' as const, submarket: 'jump_index' as const, group: 'jump' as const, pipSize: 4 },
    { symbol: 'JD100', label: 'Jump 100', market: 'synthetic_index' as const, submarket: 'jump_index' as const, group: 'jump' as const, pipSize: 2 },
    { symbol: 'RDBEAR', label: 'Bear Market Index', market: 'synthetic_index' as const, submarket: 'crash_index' as const, group: 'bear-bull' as const, pipSize: 4 },
    { symbol: 'RDBULL', label: 'Bull Market Index', market: 'synthetic_index' as const, submarket: 'crash_index' as const, group: 'bear-bull' as const, pipSize: 4 },
];

const getLastDigit = (price: unknown, pipSize: number) => {
    const value = Number(price);
    if (!Number.isFinite(value)) return null;
    const formatted = value.toFixed(pipSize);
    return Number(formatted[formatted.length - 1]);
};

export const scoreKingFisherDigits = (
    digits: number[],
    direction: KingFisherDirection,
    barrier: number,
): Omit<KingFisherMarket, 'symbol' | 'label' | 'market' | 'submarket' | 'group'> => {
    const qualifies = (digit: number) => direction === 'BELOW'
        ? digit < barrier
        : digit > barrier;
    let currentStreak = 0;
    let longestStreak = 0;
    let qualifyingTicks = 0;

    digits.forEach(digit => {
        if (qualifies(digit)) {
            currentStreak += 1;
            qualifyingTicks += 1;
            longestStreak = Math.max(longestStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    });

    // Prefer a recent qualifying run, then the market with the broadest
    // supporting sample. This is a selection signal, not a promise of profit.
    return {
        longestStreak,
        qualifyingTicks,
        score: longestStreak * 100 + qualifyingTicks,
        lastDigit: digits.length ? digits[digits.length - 1] : null,
    };
};

const digitBarrier = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '' || value === 'NONE' || value === 'LAST_DIGIT') {
        return null;
    }
    const barrier = Number(value);
    return Number.isInteger(barrier) && barrier >= 0 && barrier <= 9 ? barrier : null;
};

const fixedTradePrediction = (blocks: readonly KingFisherWorkspaceBlock[]): number | null => {
    const tradeOptions = blocks.find(block => block.type === 'trade_definition_tradeoptions');
    return digitBarrier(tradeOptions?.getInputTargetBlock?.('PREDICTION')?.getFieldValue?.('NUM'));
};

const phasePrediction = (value: unknown, defaultPrediction: number | null): number | null => {
    if (value === 'LAST_DIGIT') return null;
    if (value === 'NONE' || value === null || value === undefined || value === '') {
        return defaultPrediction;
    }
    return digitBarrier(value);
};

const setupForContract = (contract: unknown, prediction: unknown): KingFisherDigitSetup | null => {
    if (contract !== 'DIGITOVER' && contract !== 'DIGITUNDER') return null;
    const barrier = digitBarrier(prediction);
    if (barrier === null) return null;
    return {
        contract,
        direction: contract === 'DIGITOVER' ? 'BELOW' : 'ABOVE',
        barrier,
    };
};

/**
 * Read an actual phase purchase rather than the generic contract-category
 * dropdown. Strategy bots often advertise "both" there while selecting their
 * digit contract and barrier in a purchase block.
 */
export const getKingFisherDigitSetup = (
    blocks: readonly KingFisherWorkspaceBlock[],
): KingFisherDigitSetup | null => {
    const defaultPrediction = fixedTradePrediction(blocks);
    for (const block of blocks) {
        if (
            block.type === 'king_fisher_pair_purchase'
            || block.type === 'king_fisher_pair_purchase_with_stakes'
        ) {
            for (const index of [1, 2]) {
                const setup = setupForContract(
                    block.getFieldValue?.(`CONTRACT_${index}`),
                    phasePrediction(block.getFieldValue?.(`PREDICTION_${index}`), defaultPrediction),
                );
                if (setup) return setup;
            }
        }

        if (block.type === 'multiple_purchase') {
            const prediction = phasePrediction(block.getFieldValue?.('PREDICTION'), defaultPrediction);
            for (const index of [1, 2, 3, 4, 5, 6]) {
                const setup = setupForContract(block.getFieldValue?.(`PURCHASE_${index}`), prediction);
                if (setup) return setup;
            }
        }

        if (block.type === 'purchase') {
            const prediction = phasePrediction(block.getFieldValue?.('PREDICTION'), defaultPrediction);
            const setup = setupForContract(block.getFieldValue?.('PURCHASE_LIST'), prediction);
            if (setup) return setup;
        }
    }
    return null;
};

const PAIR_CYCLE_PHASES = [
    { contract: 'DIGITDIFF', barrier: 9 },
    { contract: 'DIGITOVER', barrier: 2 },
    { contract: 'DIGITOVER', barrier: 3 },
    { contract: 'DIGITOVER', barrier: 0 },
    { contract: 'DIGITOVER', barrier: 1 },
    { contract: 'DIGITDIFF', barrier: 9 },
    { contract: 'DIGITUNDER', barrier: 6 },
    { contract: 'DIGITUNDER', barrier: 7 },
    { contract: 'DIGITUNDER', barrier: 8 },
] as const;

export const scoreKingFisherPairCycle = (
    digits: number[],
): Omit<KingFisherMarket, 'symbol' | 'label' | 'market' | 'submarket' | 'group'> => {
    let phase = 0;
    let trades = 0;
    let wins = 0;
    let currentWinStreak = 0;
    let longestWinStreak = 0;
    const recoveryDigits: number[] = [];
    let lastRecoveryDigitIndex = -1;

    for (let entryIndex = 0; entryIndex < digits.length - 1; entryIndex += 1) {
        const entryDigit = digits[entryIndex];
        const exitDigit = digits[entryIndex + 1];
        if (![entryDigit, exitDigit].every(digit => Number.isInteger(digit) && digit >= 0 && digit <= 9)) continue;

        if (phase < PAIR_CYCLE_PHASES.length) {
            const contract = PAIR_CYCLE_PHASES[phase];
            const won = contract.contract === 'DIGITDIFF'
                ? exitDigit !== contract.barrier
                : contract.contract === 'DIGITOVER'
                    ? exitDigit > contract.barrier
                    : exitDigit < contract.barrier;
            trades += 1;
            if (won) {
                wins += 1;
                currentWinStreak += 1;
                longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
                phase = phase === PAIR_CYCLE_PHASES.length - 1 ? 0 : phase + 1;
                recoveryDigits.length = 0;
                lastRecoveryDigitIndex = -1;
            } else {
                currentWinStreak = 0;
                phase = PAIR_CYCLE_PHASES.length;
                recoveryDigits.length = 0;
                lastRecoveryDigitIndex = -1;
            }
            continue;
        }

        if (lastRecoveryDigitIndex !== entryIndex) {
            recoveryDigits.push(entryDigit);
            while (recoveryDigits.length > 4) recoveryDigits.shift();
            lastRecoveryDigitIndex = entryIndex;
        }
        const length = recoveryDigits.length;
        let recoveryContract: 'DIGITEVEN' | 'DIGITODD' | null = null;
        if (length >= 3) {
            const [first, second, third] = recoveryDigits.slice(-3).map(digit => digit % 2);
            if (first === 1 && second === 0 && third === 0) recoveryContract = 'DIGITEVEN';
            else if (first === 0 && second === 0 && third === 1) recoveryContract = 'DIGITODD';
        }
        if (!recoveryContract && length >= 4) {
            const [first, second, third, fourth] = recoveryDigits.slice(-4).map(digit => digit % 2);
            if (first === 0 && second === 1 && third === 1 && fourth === 0) recoveryContract = 'DIGITODD';
        }
        if (!recoveryContract) continue;

        const won = recoveryContract === 'DIGITEVEN' ? exitDigit % 2 === 0 : exitDigit % 2 === 1;
        trades += 1;
        if (won) {
            wins += 1;
            currentWinStreak += 1;
            longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
            phase = 0;
        } else {
            currentWinStreak = 0;
        }
        // The runtime recovery block resets its sequence after a completed
        // recovery contract, then starts its next scan with the exit tick.
        recoveryDigits.splice(0, recoveryDigits.length, exitDigit);
        lastRecoveryDigitIndex = entryIndex + 1;
    }

    return {
        score: trades ? (wins / trades) * 1000 + Math.min(trades, 120) : 0,
        longestStreak: longestWinStreak,
        qualifyingTicks: trades,
        lastDigit: digits.length ? digits[digits.length - 1] : null,
    };
};

const scoreMarket = (
    prices: unknown[],
    direction: KingFisherDirection,
    barrier: number,
    pipSize: number
): Omit<KingFisherMarket, 'symbol' | 'label' | 'market' | 'submarket' | 'group'> => {
    const digits = prices
        .map(price => getLastDigit(price, pipSize))
        .filter((digit): digit is number => digit !== null);
    return scoreKingFisherDigits(digits, direction, barrier);
};

export const scanKingFisherMarket = async (
    direction: KingFisherDirection,
    barrier: number,
    allowedSymbols?: readonly string[],
): Promise<KingFisherMarket | null> => {
    if (!Number.isInteger(barrier) || barrier < 0 || barrier > 9) {
        throw new Error(`King Fisher requires a digit barrier from 0 to 9; received "${barrier}".`);
    }

    const api = api_base.api as any;
    if (!api) throw new Error('The authenticated market connection is not ready yet.');

    const allowed = allowedSymbols ? new Set(allowedSymbols) : null;
    const candidates = allowed
        ? KING_FISHER_MARKETS.filter(market => allowed.has(market.symbol))
        : KING_FISHER_MARKETS;
    if (!candidates.length) return null;

    const results = (await Promise.allSettled(
        candidates.map(async market => {
            const response = await api.send({
                ticks_history: market.symbol,
                count: 120,
                end: 'latest',
                style: 'ticks',
            });
            const prices = response?.history?.prices;
            if (!Array.isArray(prices) || prices.length < 20) {
                throw new Error(`No tick history was returned for ${market.label}.`);
            }
            return { ...market, ...scoreMarket(prices, direction, barrier, market.pipSize) };
        })
    )).flatMap(result => result.status === 'fulfilled' ? [result.value] : []);

    return results
        .filter(result => result.qualifyingTicks > 0)
        .sort((a, b) => b.score - a.score)[0] ?? null;
};

export const scanKingFisherPairCycleMarket = async (
    allowedSymbols?: readonly string[],
): Promise<KingFisherMarket | null> => {
    const api = api_base.api as any;
    if (!api) throw new Error('The authenticated market connection is not ready yet.');

    const allowed = allowedSymbols ? new Set(allowedSymbols) : null;
    const candidates = allowed
        ? KING_FISHER_MARKETS.filter(market => allowed.has(market.symbol))
        : KING_FISHER_MARKETS;
    if (!candidates.length) return null;

    const results = (await Promise.allSettled(
        candidates.map(async market => {
            const response = await api.send({
                ticks_history: market.symbol,
                count: 120,
                end: 'latest',
                style: 'ticks',
            });
            const prices = response?.history?.prices;
            if (!Array.isArray(prices) || prices.length < 20) {
                throw new Error(`No tick history was returned for ${market.label}.`);
            }
            const digits = prices
                .map(price => getLastDigit(price, market.pipSize))
                .filter((digit): digit is number => digit !== null);
            return { ...market, ...scoreKingFisherPairCycle(digits) };
        }),
    )).flatMap(result => result.status === 'fulfilled' ? [result.value] : []);

    return results
        .filter(result => result.qualifyingTicks > 0)
        .sort((left, right) => right.score - left.score)[0] ?? null;
};