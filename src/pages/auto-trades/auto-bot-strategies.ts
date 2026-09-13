export type DirectionalStrategy = 'rise' | 'fall' | 'bias';
export type ParityStrategy = 'odd' | 'even';
export type AutoBotStrategyId = DirectionalStrategy | ParityStrategy;

export interface StrategyTrade {
    contract: string;
    barrier: number | null;
    shouldTrade: boolean;
    signal?: 'weak' | 'strong';
    score: number;
    reason: string;
    direction?: 'rise' | 'fall' | 'odd' | 'even';
    state: string;
}

interface MovementStats {
    upPct: number;
    downPct: number;
    flatPct: number;
    momentum: number;
    persistence: number;
    chop: number;
    direction: 'up' | 'down' | 'mixed';
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function classifyAutoBotMarket(symbol: string): string {
    const value = String(symbol).toUpperCase();
    if (value.startsWith('1HZ')) return '1s Volatility';
    if (value.startsWith('JD')) return 'Jump';
    if (value.startsWith('R_')) return 'Plain Volatility';
    if (value === 'RDBEAR') return 'Bear';
    if (value === 'RDBULL') return 'Bull';
    return 'Supported Synthetic';
}

function movementStats(prices: number[], window: number): MovementStats {
    const sample = prices.slice(-window).filter(Number.isFinite);
    const moves = sample.slice(1).map((price, index) => price - sample[index]);
    const up = moves.filter(move => move > 0).length;
    const down = moves.filter(move => move < 0).length;
    const flat = moves.length - up - down;
    const total = Math.max(1, moves.length);
    const signs = moves.map(move => move > 0 ? 1 : move < 0 ? -1 : 0).filter(Boolean);
    const changes = signs.slice(1).filter((sign, index) => sign !== signs[index]).length;
    const absoluteMoves = moves.map(Math.abs).filter(Boolean);
    const displacement = Math.abs(mean(moves)) / Math.max(1e-12, mean(absoluteMoves));
    const direction = up / total > down / total + 0.04
        ? 'up'
        : down / total > up / total + 0.04 ? 'down' : 'mixed';

    let longestRun = 0;
    let currentRun = 0;
    let previousSign = 0;
    signs.forEach(sign => {
        currentRun = sign === previousSign ? currentRun + 1 : 1;
        longestRun = Math.max(longestRun, currentRun);
        previousSign = sign;
    });

    return {
        upPct: up / total * 100,
        downPct: down / total * 100,
        flatPct: flat / total * 100,
        momentum: clamp(50 + (moves.length ? (mean(moves) / Math.max(1e-12, mean(absoluteMoves))) * 50 : 0)),
        persistence: clamp(longestRun / Math.max(1, signs.length) * 100 + displacement * 20),
        chop: signs.length > 1 ? changes / Math.max(1, signs.length - 1) * 100 : 100,
        direction,
    };
}

function structureScore(prices: number[], direction: 'rise' | 'fall'): number {
    const sample = prices.slice(-100);
    if (sample.length < 12) return 0;
    const segmentSize = Math.max(3, Math.floor(sample.length / 5));
    const segments = Array.from({ length: 5 }, (_, index) =>
        mean(sample.slice(index * segmentSize, (index + 1) * segmentSize)),
    );
    const aligned = segments.slice(1).filter((value, index) =>
        direction === 'rise' ? value >= segments[index] : value <= segments[index],
    ).length;
    const slope = sample[sample.length - 1] - sample[0];
    const slopeAgrees = direction === 'rise' ? slope > 0 : slope < 0;
    return clamp((aligned / 4) * 80 + (slopeAgrees ? 20 : 0));
}

function directionalScore(
    prices: number[],
    direction: 'rise' | 'fall',
): { score: number; confirmed: boolean; reason: string; state: string } {
    const windows = [20, 50, 100, 1000].map(window => movementStats(prices, window));
    const [flow20, confirm50, trend100, regime1000] = windows;
    const ratios = windows.map(stats => direction === 'rise' ? stats.upPct : stats.downPct);
    const momentum = direction === 'rise'
        ? mean(windows.map(stats => stats.momentum))
        : mean(windows.map(stats => 100 - stats.momentum));
    const structure = structureScore(prices, direction);
    const persistence = mean(windows.map(stats => stats.persistence));
    const chopPenalty = mean(windows.slice(0, 3).map(stats => Math.max(0, stats.chop - 35) * 0.8));
    const averageMove = mean(prices.slice(-100).slice(1).map((price, index) => Math.abs(price - prices.slice(-100)[index])).filter(Boolean));
    const latestMove = Math.abs(prices[prices.length - 1] - prices[prices.length - 2]);
    const jumpPenalty = averageMove > 0 && latestMove > averageMove * 4 ? 22 : 0;
    const volatilityQuality = jumpPenalty ? 35 : averageMove > 0 ? 82 : 0;
    const score = clamp(
        ratios[0] * 0.20
        + ratios[1] * 0.20
        + ratios[2] * 0.20
        + ratios[3] * 0.15
        + momentum * 0.10
        + structure * 0.05
        + persistence * 0.05
        + volatilityQuality * 0.05
        - chopPenalty
        - jumpPenalty,
    );
    const windowsAgree = ratios.every(ratio => ratio >= 60);
    const lowChop = windows.slice(0, 3).every(stats => stats.chop < 62);
    const regimeAgrees = direction === 'rise'
        ? regime1000.upPct >= 50
        : regime1000.downPct >= 50;
    const confirmed = prices.length >= 1000
        && windowsAgree
        && lowChop
        && regimeAgrees
        && structure >= 50
        && jumpPenalty === 0
        && score >= 60;
    const state = confirmed
        ? score >= 80 ? 'SIGNAL READY' : 'CANDIDATE'
        : score >= 60 ? 'WATCH' : 'NO TRADE';
    return {
        score,
        confirmed,
        state,
        reason: `${direction === 'rise' ? 'Rise' : 'Fall'} ${score.toFixed(0)} · 20/50/100 ${ratios.slice(0, 3).map(value => `${value.toFixed(0)}%`).join('/')} · ${flow20.direction.toUpperCase()} flow · ${trend100.direction.toUpperCase()} structure`,
    };
}

function directionalTrade(
    strategy: DirectionalStrategy,
    prices: number[],
): StrategyTrade {
    if (prices.length < 1000) {
        return {
            contract: strategy === 'fall' ? 'PUT' : 'CALL',
            barrier: null,
            shouldTrade: false,
            score: 0,
            reason: 'Waiting for the 1000-tick baseline',
            direction: strategy === 'fall' ? 'fall' : 'rise',
            state: 'SCANNING',
        };
    }
    const rise = directionalScore(prices, 'rise');
    const fall = directionalScore(prices, 'fall');
    const chosen = strategy === 'rise'
        ? { ...rise, direction: 'rise' as const }
        : strategy === 'fall'
            ? { ...fall, direction: 'fall' as const }
            : rise.score - fall.score >= 10
                ? { ...rise, direction: 'rise' as const }
                : fall.score - rise.score >= 10
                    ? { ...fall, direction: 'fall' as const }
                    : {
                        score: Math.max(rise.score, fall.score),
                        confirmed: false,
                        state: 'NO TRADE',
                        direction: 'rise' as const,
                        reason: `Balanced bias · Rise ${rise.score.toFixed(0)} / Fall ${fall.score.toFixed(0)}`,
                    };
    const isConfirmed = strategy === 'bias'
        ? chosen.confirmed && Math.abs(rise.score - fall.score) >= 10
        : chosen.confirmed;
    const direction = chosen.direction;
    return {
        contract: direction === 'rise' ? 'CALL' : 'PUT',
        barrier: null,
        shouldTrade: isConfirmed,
        signal: chosen.score >= 80 ? 'strong' : chosen.score >= 60 ? 'weak' : undefined,
        score: clamp(chosen.score),
        reason: strategy === 'bias'
            ? `${chosen.reason} · gap ${Math.abs(rise.score - fall.score).toFixed(0)}`
            : chosen.reason,
        direction,
        state: isConfirmed ? 'SIGNAL READY' : chosen.state,
    };
}

function parityStats(digits: number[], target: 'odd' | 'even', window: number) {
    const sample = digits.slice(-window);
    const targetCount = sample.filter(digit =>
        target === 'even' ? digit % 2 === 0 : digit % 2 !== 0,
    ).length;
    return {
        percentage: sample.length ? targetCount / sample.length * 100 : 0,
        sample,
    };
}

function parityEntryPattern(digits: number[], target: 'odd' | 'even'): boolean {
    const sample = digits.slice(-10);
    if (sample.length < 10) return false;
    const isTarget = (digit: number) => target === 'even' ? digit % 2 === 0 : digit % 2 !== 0;
    const lastFive = sample.slice(-5);
    const firstThreeOpposite = sample.slice(0, 3).every(digit => !isTarget(digit));
    const lastTwoTarget = lastFive.slice(-2).every(isTarget);
    const continuation = lastFive.filter(isTarget).length >= 3 && isTarget(lastFive[lastFive.length - 1]);
    const alternation = sample.slice(1).filter((digit, index) => isTarget(digit) !== isTarget(sample[index])).length;
    return (firstThreeOpposite && lastTwoTarget) || continuation || (alternation <= 6 && isTarget(sample[sample.length - 1]));
}

function parityTrade(strategy: ParityStrategy, digits: number[]): StrategyTrade {
    const baseline = parityStats(digits, strategy, 1000);
    const confirm = parityStats(digits, strategy, 50);
    const flow = parityStats(digits, strategy, 20);
    const entry = parityStats(digits, strategy, 10);
    const olderHalf = parityStats(baseline.sample.slice(0, 50), strategy, 25).percentage;
    const recentHalf = parityStats(baseline.sample.slice(-25), strategy, 25).percentage;
    const acceleration = recentHalf - olderHalf;
    const targetDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(digit =>
        strategy === 'even' ? digit % 2 === 0 : digit % 2 !== 0,
    );
    const counts = targetDigits.map(digit => baseline.sample.filter(value => value === digit).length);
    const targetMean = mean(counts);
    const distributionQuality = targetMean > 0
        ? clamp(100 - Math.max(...counts.map(count => Math.abs(count - targetMean))) / targetMean * 100)
        : 0;
    const sequenceChanges = flow.sample.slice(1).filter((digit, index) =>
        (digit % 2 === 0) !== (flow.sample[index] % 2 === 0),
    ).length;
    const chopPenalty = sequenceChanges / Math.max(1, flow.sample.length - 1) * 25;
    const score = clamp(
        baseline.percentage * 0.25
        + confirm.percentage * 0.20
        + flow.percentage * 0.20
        + entry.percentage * 0.15
        + distributionQuality * 0.10
        + clamp(50 + acceleration) * 0.05
        + clamp(50 + (flow.percentage - 50)) * 0.05
        - chopPenalty,
    );
    const agreement = [baseline.percentage, confirm.percentage, flow.percentage, entry.percentage]
        .filter(value => value >= 54).length;
    const confirmed = digits.length >= 1000
        && baseline.percentage >= 54
        && confirm.percentage >= 54
        && flow.percentage >= 55
        && entry.percentage >= 50
        && agreement >= 3
        && parityEntryPattern(digits, strategy)
        && score >= 60;
    const contract = strategy === 'odd' ? 'DIGITODD' : 'DIGITEVEN';
    return {
        contract,
        barrier: null,
        shouldTrade: confirmed,
        signal: score >= 80 ? 'strong' : score >= 60 ? 'weak' : undefined,
        score,
        reason: `${strategy.toUpperCase()} ${score.toFixed(0)} · 1000/50/20/10 ${[baseline, confirm, flow, entry].map(item => `${item.percentage.toFixed(0)}%`).join('/')} · ${agreement}/4 windows`,
        direction: strategy,
        state: confirmed ? 'SIGNAL READY' : score >= 60 ? 'WATCH' : 'NO TRADE',
    };
}

export function evaluateAutoBotStrategy(
    strategy: AutoBotStrategyId,
    digits: number[],
    prices: number[],
): StrategyTrade {
    return strategy === 'rise' || strategy === 'fall' || strategy === 'bias'
        ? directionalTrade(strategy, prices)
        : parityTrade(strategy, digits);
}