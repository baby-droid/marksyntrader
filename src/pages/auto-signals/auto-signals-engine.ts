import {
    evaluateAutoLabCandidates,
    type AutoLabTick,
} from '@/pages/auto-lab/auto-lab-engine';
import type {
    AutoSignalCandidate,
    AutoSignalFamily,
    AutoSignalMarket,
    AutoSignalStrategy,
    AutoSignalWindowResult,
    AutoSignalWindowSize,
} from './types';

type Route = {
    strategy: AutoSignalStrategy;
    contractType: string;
    barrier: number | null;
    direction: AutoSignalCandidate['direction'];
    baseline: number;
};

const WINDOW_SIZES: AutoSignalWindowSize[] = [1000, 100, 50, 20, 10];
const WINDOW_WEIGHTS: Record<AutoSignalWindowSize, number> = {
    1000: 0.38,
    100: 0.28,
    50: 0.2,
    20: 0.1,
    10: 0.04,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const routeId = (symbol: string, route: Route) =>
    `${symbol}:${route.strategy}:${route.contractType}:${route.barrier ?? 'none'}`;

const isRouteInFamily = (route: Route, family: AutoSignalFamily) => {
    if (family === 'AUTO') return true;
    if (family === 'PARITY') return route.strategy === 'EVEN' || route.strategy === 'ODD';
    if (family === 'OVER_UNDER') return route.strategy === 'OVER' || route.strategy === 'UNDER';
    if (family === 'RISE_FALL') return route.strategy === 'RISE' || route.strategy === 'FALL';
    if (family === 'ONLY_UP_DOWN') return route.strategy === 'ONLY_UPS' || route.strategy === 'ONLY_DOWNS';
    if (family === 'DIFFERS') return route.strategy === 'DIFFERS';
    return route.strategy === 'MATCHES';
};

const digitRoutes = (): Route[] => {
    const routes: Route[] = [
        { strategy: 'EVEN', contractType: 'DIGITEVEN', barrier: null, direction: 'even', baseline: 50 },
        { strategy: 'ODD', contractType: 'DIGITODD', barrier: null, direction: 'odd', baseline: 50 },
    ];
    for (let barrier = 1; barrier <= 7; barrier += 1) {
        routes.push({
            strategy: 'OVER', contractType: 'DIGITOVER', barrier, direction: 'over',
            baseline: ((9 - barrier) / 10) * 100,
        });
    }
    for (let barrier = 1; barrier <= 8; barrier += 1) {
        routes.push({
            strategy: 'UNDER', contractType: 'DIGITUNDER', barrier, direction: 'under',
            baseline: (barrier / 10) * 100,
        });
    }
    for (let barrier = 0; barrier <= 9; barrier += 1) {
        routes.push({
            strategy: 'MATCHES', contractType: 'DIGITMATCH', barrier, direction: 'matches', baseline: 10,
        });
        routes.push({
            strategy: 'DIFFERS', contractType: 'DIGITDIFF', barrier, direction: 'differs', baseline: 90,
        });
    }
    return routes;
};

const priceRoutes: Route[] = [
    { strategy: 'RISE', contractType: 'CALL', barrier: null, direction: 'rise', baseline: 50 },
    { strategy: 'FALL', contractType: 'PUT', barrier: null, direction: 'fall', baseline: 50 },
    { strategy: 'ONLY_UPS', contractType: 'RUNHIGH', barrier: null, direction: 'up', baseline: 25 },
    { strategy: 'ONLY_DOWNS', contractType: 'RUNLOW', barrier: null, direction: 'down', baseline: 25 },
];

const routeWins = (route: Route, tick: AutoLabTick) => {
    switch (route.strategy) {
        case 'EVEN': return tick.digit % 2 === 0;
        case 'ODD': return tick.digit % 2 === 1;
        case 'OVER': return route.barrier != null && tick.digit > route.barrier;
        case 'UNDER': return route.barrier != null && tick.digit < route.barrier;
        case 'MATCHES': return route.barrier != null && tick.digit === route.barrier;
        case 'DIFFERS': return route.barrier != null && tick.digit !== route.barrier;
        default: return false;
    }
};

const probabilityFor = (route: Route, ticks: AutoLabTick[]) => {
    if (route.strategy === 'RISE' || route.strategy === 'FALL') {
        const sampleSize = Math.max(0, ticks.length - 2);
        if (!sampleSize) return { probability: 0, sampleSize };
        const wins = ticks.slice(0, sampleSize).reduce((count, tick, index) => {
            const exit = ticks[index + 2];
            const up = exit.quote > tick.quote;
            const down = exit.quote < tick.quote;
            return count + Number(route.strategy === 'RISE' ? up : down);
        }, 0);
        return { probability: (wins / sampleSize) * 100, sampleSize };
    }

    if (route.strategy === 'ONLY_UPS' || route.strategy === 'ONLY_DOWNS') {
        const sampleSize = Math.max(0, ticks.length - 2);
        if (!sampleSize) return { probability: 0, sampleSize };
        const wins = ticks.slice(0, sampleSize).reduce((count, tick, index) => {
            const middle = ticks[index + 1];
            const end = ticks[index + 2];
            const allUp = middle.quote > tick.quote && end.quote > middle.quote;
            const allDown = middle.quote < tick.quote && end.quote < middle.quote;
            return count + Number(route.strategy === 'ONLY_UPS' ? allUp : allDown);
        }, 0);
        return { probability: (wins / sampleSize) * 100, sampleSize };
    }

    const wins = ticks.reduce((count, tick) => count + Number(routeWins(route, tick)), 0);
    return {
        probability: ticks.length ? (wins / ticks.length) * 100 : 0,
        sampleSize: ticks.length,
    };
};

const entryDigitFor = (route: Route, ticks: AutoLabTick[]) => {
    if (route.strategy === 'MATCHES') return route.barrier;
    const counts = Array.from({ length: 10 }, (_, digit) => ({
        digit,
        count: ticks.reduce((total, tick) => total + Number(tick.digit === digit), 0),
    }));
    const eligible = counts.filter(({ digit }) => {
        if (route.strategy === 'EVEN') return digit % 2 === 0;
        if (route.strategy === 'ODD') return digit % 2 === 1;
        if (route.strategy === 'OVER') return route.barrier != null && digit > route.barrier;
        if (route.strategy === 'UNDER') return route.barrier != null && digit < route.barrier;
        if (route.strategy === 'DIFFERS') return digit !== route.barrier;
        return true;
    });
    return eligible.sort((left, right) => right.count - left.count || left.digit - right.digit)[0]?.digit ?? null;
};

const entryConditionConfirmed = (route: Route, ticks: AutoLabTick[], entryDigit: number | null) => {
    const latest = ticks[ticks.length - 1];
    if (!latest || entryDigit == null || latest.digit !== entryDigit) return false;

    if (route.strategy === 'RISE' || route.strategy === 'FALL') {
        const start = ticks[ticks.length - 3];
        return Boolean(start && (route.strategy === 'RISE'
            ? latest.quote > start.quote
            : latest.quote < start.quote));
    }
    if (route.strategy === 'ONLY_UPS' || route.strategy === 'ONLY_DOWNS') {
        const before = ticks[ticks.length - 2];
        const start = ticks[ticks.length - 3];
        if (!before || !start) return false;
        return route.strategy === 'ONLY_UPS'
            ? before.quote > start.quote && latest.quote > before.quote
            : before.quote < start.quote && latest.quote < before.quote;
    }
    return routeWins(route, latest);
};

const getPatternCandidates = (ticks: AutoLabTick[]) => {
    if (ticks.length < 20) return [];
    const window = ticks.slice(-Math.min(100, ticks.length));
    return evaluateAutoLabCandidates('Multimarket', [{
        symbol: window[0].symbol,
        label: window[0].symbol,
        ticks: window,
    }], {
        ticksWindow: window.length,
        thresholdPercent: 55,
        barrier: 5,
        autoBarrier: true,
        requiredStreak: 2,
        contractType: 'AUTO',
    });
};

const strategyPatternBoost = (route: Route, ticks: AutoLabTick[], patterns: ReturnType<typeof getPatternCandidates>) => {
    const matching = patterns.some((pattern) =>
        pattern.contract_type === route.contractType
        && (route.barrier == null || pattern.barrier == null || pattern.barrier === route.barrier)
    );
    if (matching) return 9;

    if (route.strategy === 'ONLY_UPS' || route.strategy === 'ONLY_DOWNS') {
        return entryConditionConfirmed(route, ticks, ticks[ticks.length - 1]?.digit ?? null) ? 8 : 0;
    }
    return 0;
};

const makeWindowResults = (route: Route, ticks: AutoLabTick[]): AutoSignalWindowResult[] =>
    WINDOW_SIZES.flatMap((window) => {
        if (ticks.length < window) return [];
        const sample = ticks.slice(-window);
        const { probability, sampleSize } = probabilityFor(route, sample);
        return [{
            window,
            sampleSize,
            probability,
            agrees: probability > route.baseline,
        }];
    });

export const evaluateAutoSignal = ({
    market,
    ticks,
    family,
    previous,
    now = Date.now(),
}: {
    market: Pick<AutoSignalMarket, 'symbol' | 'label'>;
    ticks: AutoLabTick[];
    family: AutoSignalFamily;
    previous?: AutoSignalCandidate | null;
    now?: number;
}): AutoSignalCandidate | null => {
    if (ticks.length < 20) return null;

    const patternCandidates = getPatternCandidates(ticks);
    const digitOptions = digitRoutes();
    const latestQuote = ticks[ticks.length - 1].quote;
    const previousQuote = ticks[ticks.length - 2]?.quote;
    const latestMovement = previousQuote == null ? 0 : Math.sign(latestQuote - previousQuote);
    const movementRoutes = priceRoutes.filter((route) => {
        if (route.strategy === 'RISE' || route.strategy === 'ONLY_UPS') return latestMovement > 0;
        if (route.strategy === 'FALL' || route.strategy === 'ONLY_DOWNS') return latestMovement < 0;
        return false;
    });
    const routes = [...digitOptions, ...movementRoutes].filter((route) => isRouteInFamily(route, family));

    const ranked = routes.flatMap((route) => {
        const windows = makeWindowResults(route, ticks);
        if (!windows.length) return [];
        const relevant = windows.filter((item) => item.window >= 50);
        const evidenceWindows = relevant.length ? relevant : windows;
        const weightTotal = evidenceWindows.reduce((sum, item) => sum + WINDOW_WEIGHTS[item.window], 0);
        const weightedEdge = weightTotal
            ? evidenceWindows.reduce((sum, item) =>
                sum + (item.probability - route.baseline) * WINDOW_WEIGHTS[item.window], 0) / weightTotal
            : 0;
        const agreements = evidenceWindows.filter((item) => item.agrees).length;
        const agreementRatio = agreements / evidenceWindows.length;
        const patternBoost = strategyPatternBoost(route, ticks, patternCandidates);
        if (weightedEdge < 1.25 && patternBoost === 0) return [];

        const score = clamp(48 + weightedEdge * 2.2 + agreementRatio * 19 + patternBoost, 0, 99.9);
        const entryDigit = entryDigitFor(route, ticks.slice(-100));
        const entryReady = entryConditionConfirmed(route, ticks, entryDigit);
        const sameSignal = previous?.id === routeId(market.symbol, route);
        const stillValid = Boolean(sameSignal && previous?.expiresAt && previous.expiresAt > now);
        const createdAt = stillValid ? previous!.createdAt : now;
        const expiresAt = stillValid ? previous!.expiresAt : now + 5 * 60 * 1000;
        const tier = score >= 82 ? 'ELITE' : score >= 72 ? 'STRONG' : score >= 60 ? 'SETUP' : 'WATCH';
        const state = score >= 70 && entryReady && agreements >= 2
            ? 'ready'
            : score >= 58
                ? 'setup'
                : 'watch';
        const latest = ticks[ticks.length - 1];
        const reason = `${agreements}/${evidenceWindows.length} longer windows show an edge over baseline; entry digit ${entryDigit ?? '—'}${entryReady ? ' is confirmed' : ' is waiting'}.`;

        return [{
            id: routeId(market.symbol, route),
            strategy: route.strategy,
            label: ({
                EVEN: 'Even', ODD: 'Odd', OVER: 'Over', UNDER: 'Under',
                RISE: 'Rise', FALL: 'Fall', ONLY_UPS: 'Only Ups',
                ONLY_DOWNS: 'Only Downs', DIFFERS: 'Differs', MATCHES: 'Matches',
            } as Record<AutoSignalStrategy, string>)[route.strategy],
            contractType: route.contractType,
            barrier: route.barrier,
            direction: route.direction,
            score,
            tier,
            state,
            reason,
            windows,
            entryDigit,
            entryReady,
            createdAt,
            expiresAt,
            updatedAt: now,
            recommendedRuns: 1,
        } satisfies AutoSignalCandidate];
    });

    return ranked.sort((left, right) =>
        right.score - left.score
        || right.windows.filter((item) => item.agrees).length - left.windows.filter((item) => item.agrees).length
        || String(left.strategy).localeCompare(String(right.strategy))
        || (left.barrier ?? -1) - (right.barrier ?? -1)
    )[0] ?? null;
};

export const shouldExcludeAutoSignalMarket = (market: {
    symbol?: unknown;
    display_name?: unknown;
    underlying_symbol_name?: unknown;
    market?: unknown;
    exchange_is_open?: unknown;
    is_trading_suspended?: unknown;
}) => {
    const symbol = String(market.symbol ?? '').trim().toUpperCase();
    const label = `${String(market.display_name ?? '')} ${String(market.underlying_symbol_name ?? '')}`;
    const isOpen = market.exchange_is_open !== false
        && Number(market.exchange_is_open) !== 0
        && !market.is_trading_suspended;
    return !isOpen
        || String(market.market ?? '').toLowerCase() !== 'synthetic_index'
        || symbol === 'JD100'
        || /\bjump\s*100\b/i.test(label);
};

