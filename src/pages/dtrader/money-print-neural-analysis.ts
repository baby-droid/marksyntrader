import type { AutoLabMarket, AutoLabSignal, AutoLabTrade } from '../auto-lab/AutoLabView';
import { isAutoLabMarketExcluded } from '../auto-lab/auto-lab-engine';
import type { AutoLabContractType, AutoLabMode } from '../auto-lab/auto-lab-engine';

export type MoneyPrintTradeSide = {
    side: string;
    trades: number;
    wins: number;
    losses: number;
    netProfit: number;
    winRate: number | null;
    consecutiveLosses: number;
};

export type MoneyPrintMatchRoute = {
    key: string;
    symbol: string;
    label: string;
    entryDigit: number;
    targetDigit: number;
    conditionalRate: number;
    baselineRate: number;
    lift: number;
    observations: number;
    confidenceLowerBound: number;
    score: number;
    eligible: boolean;
    latestDigit: number | null;
    tickCount: number;
    reason: string;
};

export type MoneyPrintNeuralReport = {
    generatedAt: number;
    verdict: 'PLAN' | 'WAIT' | 'DO NOT TRADE';
    challenge: string;
    summary: string;
    accountContext: {
        accountType: 'Demo' | 'Real' | 'Unknown';
        balance: number | null;
        currency: string;
        baseStake: number;
        nextStake: number;
        autoStake: boolean;
        riskPercent: number;
        maxStake: number;
        takeProfit: number;
        stopLoss: number;
        sessionPnl: number;
        strategyMode: string;
        scheduledSessions: boolean;
    } | null;
    route: {
        market: string;
        contract: string;
        entryRule: string;
        targetDigits: number[];
        marketSymbol: string;
        contractType: AutoLabContractType;
        strategy: AutoLabMode;
        barrier?: number;
        entryDigit?: number;
        matchKey?: string;
    } | null;
    strategies: string[];
    evidence: string[];
    riskNotes: string[];
    sidePerformance: MoneyPrintTradeSide[];
    losingSide: string | null;
    settledCount: number;
};

const MIN_MATCH_HISTORY = 300;
const MIN_ENTRY_OBSERVATIONS = 12;
const MIN_FULL_HISTORY_OBSERVATIONS = 20;
const MIN_LIFT = 0.03;

const wilsonLowerBound = (successes: number, total: number, z = 1.96) => {
    if (total <= 0) return 0;
    const rate = successes / total;
    const zSquared = z * z;
    const denominator = 1 + zSquared / total;
    const center = rate + zSquared / (2 * total);
    const margin = z * Math.sqrt((rate * (1 - rate) + zSquared / (4 * total)) / total);
    return Math.max(0, (center - margin) / denominator);
};

export const isMoneyPrintMatchMarket = (market: Pick<AutoLabMarket, 'symbol' | 'label'>) => {
    const symbol = String(market.symbol || '').trim().toUpperCase();
    const label = String(market.label || '');
    if (!symbol || isAutoLabMarketExcluded(symbol, label)) return false;
    return /^(R_|1HZ|JD\d+|RDBEAR|RDBULL)/.test(symbol)
        || /\b(volatility|jump|bear|bull)\b/i.test(label);
};

export const rankMoneyPrintMatchRoutes = (markets: AutoLabMarket[]): MoneyPrintMatchRoute[] => {
    const routes: MoneyPrintMatchRoute[] = [];
    for (const market of markets) {
        if (!isMoneyPrintMatchMarket(market)) continue;
        const digits = (market.digitHistory ?? [])
            .filter((digit): digit is number => Number.isInteger(digit) && digit >= 0 && digit <= 9)
            .slice(-500);
        if (digits.length < MIN_MATCH_HISTORY) continue;

        const splitAt = Math.floor(digits.length * 0.6);
        const training = digits.slice(0, splitAt);
        const validation = digits.slice(splitAt);
        const validationTargets = validation.slice(1);
        const trainingTargets = training.slice(1);
        if (trainingTargets.length < 100 || validationTargets.length < 40) continue;
        const trainingBaseline = Array.from({ length: 10 }, (_, target) =>
            trainingTargets.filter(digit => digit === target).length / trainingTargets.length,
        );
        const baselineRates = Array.from({ length: 10 }, (_, target) =>
            validationTargets.filter(digit => digit === target).length / validationTargets.length,
        );
        const trainCandidates: Array<{ entryDigit: number; targetDigit: number; trainingLift: number; trainingObservations: number }> = [];
        for (let entryDigit = 0; entryDigit <= 9; entryDigit += 1) {
            const trainingCounts = Array.from({ length: 10 }, () => 0);
            let trainingObservations = 0;
            for (let index = 0; index < training.length - 1; index += 1) {
                if (training[index] !== entryDigit) continue;
                trainingObservations += 1;
                trainingCounts[training[index + 1]] += 1;
            }
            for (let targetDigit = 0; targetDigit <= 9; targetDigit += 1) {
                const trainingRate = trainingObservations
                    ? trainingCounts[targetDigit] / trainingObservations
                    : 0;
                const trainingLift = trainingRate - trainingBaseline[targetDigit];
                if (trainingObservations >= MIN_ENTRY_OBSERVATIONS && trainingLift >= MIN_LIFT) {
                    trainCandidates.push({
                        entryDigit,
                        targetDigit,
                        trainingLift,
                        trainingObservations,
                    });
                }
            }
        }

        const selectedTrainingRoutes = trainCandidates
            .sort((left, right) =>
                right.trainingLift - left.trainingLift
                || right.trainingObservations - left.trainingObservations,
            )
            .slice(0, 4);
        for (const trained of selectedTrainingRoutes) {
            let validationObservations = 0;
            let validationHits = 0;
            let fullHistoryObservations = 0;
            for (let index = 0; index < validation.length - 1; index += 1) {
                if (validation[index] !== trained.entryDigit) continue;
                validationObservations += 1;
                if (validation[index + 1] === trained.targetDigit) validationHits += 1;
            }
            for (let index = 0; index < digits.length - 1; index += 1) {
                if (digits[index] === trained.entryDigit) fullHistoryObservations += 1;
            }
            const conditionalRate = validationObservations
                ? validationHits / validationObservations
                : 0;
            const baselineRate = baselineRates[trained.targetDigit];
            const lift = conditionalRate - baselineRate;
            const confidenceLowerBound = wilsonLowerBound(validationHits, validationObservations, 2.576);
            const eligible = validationObservations >= MIN_ENTRY_OBSERVATIONS
                && fullHistoryObservations >= MIN_FULL_HISTORY_OBSERVATIONS
                && lift >= MIN_LIFT
                && confidenceLowerBound > baselineRate;
            const reason = `Walk-forward holdout: after entry ${trained.entryDigit}, target ${trained.targetDigit} followed ${validationHits}/${validationObservations} times (${(conditionalRate * 100).toFixed(1)}%); holdout baseline ${(baselineRate * 100).toFixed(1)}%, 99% lower bound ${(confidenceLowerBound * 100).toFixed(1)}%.`;
            routes.push({
                key: `${market.symbol}:${trained.entryDigit}:${trained.targetDigit}`,
                symbol: market.symbol,
                label: market.label,
                entryDigit: trained.entryDigit,
                targetDigit: trained.targetDigit,
                conditionalRate: conditionalRate * 100,
                baselineRate: baselineRate * 100,
                lift: lift * 100,
                observations: validationObservations,
                confidenceLowerBound: confidenceLowerBound * 100,
                score: (confidenceLowerBound - baselineRate) * 100,
                eligible,
                latestDigit: market.digit,
                tickCount: digits.length,
                reason,
            });
        }
    }
    return routes
        .sort((left, right) =>
            Number(right.eligible) - Number(left.eligible)
            || right.score - left.score
            || right.observations - left.observations
            || left.entryDigit - right.entryDigit
            || left.targetDigit - right.targetDigit,
        )
        .slice(0, 4);
};

const tradeSide = (contract: string) => {
    switch (String(contract || '').toUpperCase()) {
        case 'CALL': return 'Rise';
        case 'PUT': return 'Fall';
        case 'DIGITEVEN': return 'Even';
        case 'DIGITODD': return 'Odd';
        case 'DIGITOVER': return 'Over';
        case 'DIGITUNDER': return 'Under';
        case 'DIGITMATCH': return 'Matches';
        case 'DIGITDIFF': return 'Differs';
        default: return String(contract || 'Unknown');
    }
};

export const summarizeMoneyPrintTrades = (trades: AutoLabTrade[]): MoneyPrintTradeSide[] => {
    const groups = new Map<string, MoneyPrintTradeSide>();
    const recentBySide = new Map<string, AutoLabTrade[]>();
    trades.filter(trade => trade.status === 'WIN' || trade.status === 'LOSS')
        .forEach(trade => {
            const side = tradeSide(trade.contract);
            const row = groups.get(side) ?? {
                side,
                trades: 0,
                wins: 0,
                losses: 0,
                netProfit: 0,
                winRate: null,
                consecutiveLosses: 0,
            };
            row.trades += 1;
            if (trade.status === 'WIN') row.wins += 1;
            else row.losses += 1;
            row.netProfit += Number.isFinite(trade.profit) ? trade.profit : 0;
            groups.set(side, row);
            recentBySide.set(side, [...(recentBySide.get(side) ?? []), trade]);
        });

    return [...groups.values()]
        .map(row => {
            const sideTrades = recentBySide.get(row.side) ?? [];
            let consecutiveLosses = 0;
            for (const trade of sideTrades.slice(0, 20)) {
                if (trade.status !== 'LOSS') break;
                consecutiveLosses += 1;
            }
            return {
                ...row,
                winRate: row.trades ? row.wins / row.trades : null,
                consecutiveLosses,
            };
        })
        .sort((left, right) => right.netProfit - left.netProfit);
};

export const findMoneyPrintLosingSide = (performance: MoneyPrintTradeSide[]) => performance.find(side =>
    side.trades >= 5
    && side.netProfit < 0
    && ((side.winRate != null && side.winRate <= 0.4) || side.consecutiveLosses >= 3),
)?.side ?? null;

export const createMoneyPrintNeuralReport = (input: {
    challenge: string;
    trades: AutoLabTrade[];
    matches: MoneyPrintMatchRoute[];
    tradeTypes?: AutoLabContractType[];
    currentSignal?: AutoLabSignal;
    markets?: Pick<AutoLabMarket, 'symbol' | 'label'>[];
    contractBarrier?: number;
    matchEntryDigit?: number | null;
    accountContext?: MoneyPrintNeuralReport['accountContext'];
    now?: number;
}): MoneyPrintNeuralReport => {
    const generatedAt = input.now ?? Date.now();
    const sidePerformance = summarizeMoneyPrintTrades(input.trades);
    const losingSide = findMoneyPrintLosingSide(sidePerformance);
    const settledCount = input.trades.filter(trade =>
        trade.status === 'WIN' || trade.status === 'LOSS',
    ).length;
    const selectedTypes = input.tradeTypes?.length ? new Set(input.tradeTypes) : null;
    const qualifiedRoute = selectedTypes?.has('DIGITMATCH')
        ? input.matches.find(route => route.eligible)
        : undefined;
    const signalContract = (() => {
        const aliases: Record<string, AutoLabContractType> = {
            '1 Rise': 'CALL',
            '2 Fall': 'PUT',
            'Digit EVEN': 'DIGITEVEN',
            'Digit ODD': 'DIGITODD',
            'Digit OVER': 'DIGITOVER',
            'Digit UNDER': 'DIGITUNDER',
            'Digit MATCH': 'DIGITMATCH',
            'Digit DIFF': 'DIGITDIFF',
        };
        return input.currentSignal ? aliases[input.currentSignal.label] : undefined;
    })();
    const signalStrategy = input.currentSignal?.detail.split(' · ')[0] as AutoLabMode | undefined;
    const signalMarket = input.markets?.find(market => market.label === input.currentSignal?.market);
    const signalRoute = signalContract
        && signalStrategy
        && signalMarket
        && (!selectedTypes || selectedTypes.has(signalContract))
        && input.currentSignal?.confidence != null
        ? {
            market: input.currentSignal.market,
            marketSymbol: signalMarket.symbol,
            contract: signalContract,
            contractType: signalContract,
            strategy: signalStrategy,
            entryRule: input.currentSignal.detail,
            targetDigits: input.contractBarrier == null ? [] : [input.contractBarrier],
            ...(input.contractBarrier == null ? {} : { barrier: input.contractBarrier }),
            ...(input.matchEntryDigit == null ? {} : { entryDigit: input.matchEntryDigit }),
        }
        : undefined;
    const challenge = input.challenge.trim();
    const context = input.accountContext ?? null;

    const evidence = [
        `Challenge brief: ${challenge || 'not provided'}`,
        `${settledCount} settled journal trade${settledCount === 1 ? '' : 's'} reviewed; open trades excluded.`,
        ...(context ? [
            `${context.accountType} account · verified balance ${context.balance == null ? 'unavailable' : `${context.balance.toFixed(2)} ${context.currency}`} · next stake ${context.nextStake.toFixed(2)} ${context.currency}.`,
            `Risk controls: TP ${context.takeProfit.toFixed(2)} ${context.currency}, SL ${context.stopLoss.toFixed(2)} ${context.currency}, session P/L ${context.sessionPnl.toFixed(2)} ${context.currency}, strategy ${context.strategyMode}${context.scheduledSessions ? ' · EAT schedule enabled' : ''}.`,
        ] : []),
        ...sidePerformance.slice(0, 4).map(side =>
            `${side.side}: ${side.wins} wins / ${side.losses} losses, ${side.winRate == null ? '—' : `${(side.winRate * 100).toFixed(1)}%`} win rate, net ${side.netProfit.toFixed(2)}.`,
        ),
        qualifiedRoute
            ? `${qualifiedRoute.label}: ${qualifiedRoute.reason}`
            : signalRoute
                ? `Live candidate supplied by ${signalRoute.strategy}: ${signalRoute.market} · ${signalRoute.contractType}. ${signalRoute.entryRule}`
                : 'No route matched the selected trade types and current evidence gates.',
    ];
    const riskNotes = [
        'Historical tick patterns do not guarantee the next outcome. Do not increase stake to recover losses.',
        'Auto-match checks the live proposal against the historical lower confidence bound and rejects the order unless it clears break-even by at least two percentage points.',
        'Only settled journal outcomes are used; open contracts are not counted as wins or losses.',
    ];

    if (losingSide) {
        return {
            generatedAt,
            verdict: 'DO NOT TRADE',
            challenge,
            summary: `${losingSide} is under the Money Print loss guard. Trading is locked for five hours; open contracts will settle normally.`,
            accountContext: context,
            route: null,
            strategies: ['Stop new entries', 'Review the settled report before resuming', 'Keep the configured stake and loss limits unchanged'],
            evidence,
            riskNotes,
            sidePerformance,
            losingSide,
            settledCount,
        };
    }

    if (!challenge) {
        return {
            generatedAt,
            verdict: 'WAIT',
            challenge,
            summary: 'Add a challenge brief before asking Neural Link to assemble a route.',
            accountContext: context,
            route: null,
            strategies: ['Keep automation stopped until a challenge and account risk limits are reviewed'],
            evidence,
            riskNotes,
            sidePerformance,
            losingSide: null,
            settledCount,
        };
    }

    if (!qualifiedRoute && !signalRoute) {
        return {
            generatedAt,
            verdict: 'WAIT',
            challenge,
            summary: 'The observed market history did not qualify a match entry. Wait for more data instead of forcing a trade.',
            accountContext: context,
            route: null,
            strategies: ['Continue collecting authenticated ticks', 'Re-analyze after the history window grows', 'Use demo mode to validate any new rule'],
            evidence,
            riskNotes,
            sidePerformance,
            losingSide: null,
            settledCount,
        };
    }

    const route = qualifiedRoute
        ? {
            market: qualifiedRoute.label,
            marketSymbol: qualifiedRoute.symbol,
            contract: 'DIGITMATCH' as const,
            contractType: 'DIGITMATCH' as const,
            strategy: 'Matches/Differs' as const,
            entryRule: `Wait for last digit ${qualifiedRoute.entryDigit}; the proposed one-tick target is ${qualifiedRoute.targetDigit}.`,
            targetDigits: [qualifiedRoute.targetDigit],
            barrier: qualifiedRoute.targetDigit,
            entryDigit: qualifiedRoute.entryDigit,
            matchKey: qualifiedRoute.key,
        }
        : signalRoute!;
    return {
        generatedAt,
        verdict: 'PLAN',
        challenge,
        summary: qualifiedRoute
            ? 'A historical match transition passed the screening checks. Treat it as a research route, not proof of a profitable trade.'
            : 'A live candidate matches the selected trade types. Treat the setup score as a scan score, not a win probability or profit forecast.',
        accountContext: context,
        route,
        strategies: qualifiedRoute
            ? [
                `Watch ${qualifiedRoute.label} and wait for entry digit ${qualifiedRoute.entryDigit}.`,
                `At that entry, test only DIGITMATCH ${qualifiedRoute.targetDigit}; the contract supports one target digit per order.`,
                'Re-check the market history and live proposal before every entry; stop if the route no longer meets the evidence checks.',
            ]
            : [
                `Use the selected ${signalRoute.strategy} engine on ${signalRoute.market} for ${signalRoute.contractType}.`,
                'The Start Trade button applies this route to the existing risk-controlled engine; no order is sent until you press it.',
                'The live signal may change before the next tick. Review the current market and stop limits before starting.',
            ],
        evidence,
        riskNotes,
        sidePerformance,
        losingSide: null,
        settledCount,
    };
};
