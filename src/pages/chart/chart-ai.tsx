// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import './chart-ai.scss';

const MIN_STAKE = 0.35;
const MAX_CONFIRM_TICKS = 5;
const SCAN_SIZE = 50;
const RESCAN_MS = 120_000;
const COOLDOWN_TICKS = 10;
const ENTRY_CONFIRM_HITS = 3;
const ENTRY_USE_LIMIT = 3;
const ENTRY_FAILURE_LIMIT = 3;
const ENTRY_WINDOW_TICKS = 5;
const ENTRY_STALE_TICKS = 8;

const ENTRY_POINTS = {
    // These are the preferred reference digits for the default barrier. For a
    // user-selected barrier, validBarrierEntries() below always expands this
    // to every digit on the winning side.
    over: { strong: [3, 4, 1, 8], weak: [7, 0] },
    under: { strong: [9, 6, 2], weak: [5] },
};

const STRATEGIES = [
    { id: 'reversal', label: 'Reversal' },
    { id: 'tick-concept', label: 'Tick concept' },
    { id: 'entry-loop', label: 'Entry loop' },
    { id: 'conservative', label: 'Conservative' },
    { id: 'number-losses', label: 'Number of losses' },
    { id: 'digit-distribution', label: 'Digit distribution' },
    { id: 'momentum', label: 'Momentum' },
];

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function digitFromPrice(price: number, pipSize: number) {
    const text = Number(price).toFixed(Math.max(0, pipSize));
    return Number(text[text.length - 1]);
}

function groupSideLabel(group: any, side: 'over' | 'under') {
    const labels: Record<string, [string, string]> = {
        over_under: ['Over', 'Under'], even_odd: ['Even', 'Odd'],
        match_differ: ['Matches', 'Differs'], rise_fall: ['Rise', 'Fall'],
        higher_lower: ['Higher', 'Lower'], asian: ['Asian Up', 'Asian Down'],
        touch: ['Touch', 'No Touch'], run_high_low: ['Run High', 'Run Low'],
        reset: ['Reset Call', 'Reset Put'], highlow: ['High Tick', 'Low Tick'],
        ends_between: ['Ends In', 'Ends Out'], stays_between: ['Stays In', 'Goes Out'],
    };
    return labels[group?.id]?.[side === 'over' ? 0 : 1] ?? (side === 'over' ? 'Over' : 'Under');
}

function marketThreshold(symbol: string) {
    // The AI rule is intentionally consistent across markets: a digit must
    // stay below 10.5% to be part of the low-frequency condition. The live
    // distribution is still market-specific; only the decision threshold is
    // shared so a single digit above 10.5% can be used as the shield.
    void symbol;
    return 10.5;
}

function pctsFor(digits: number[]) {
    const counts = Array.from({ length: 10 }, () => 0);
    digits.forEach(d => { if (d >= 0 && d <= 9) counts[d]++; });
    return counts.map(c => digits.length ? c / digits.length * 100 : 0);
}

function backtestDigits(digits: number[], side: 'over' | 'under', barrier: number, duration: number) {
    if (digits.length <= duration + 4) return { winRate: 0, safeRate: 0, expectedDigit: null };
    let wins = 0;
    let safeWins = 0;
    const exits: number[] = [];
    for (let i = 0; i < digits.length - duration; i++) {
        const exit = digits[i + duration];
        const won = side === 'over' ? exit > barrier : exit < barrier;
        if (won) {
            wins++;
            exits.push(exit);
            if (Math.abs(exit - barrier) >= 3) safeWins++;
        }
    }
    const attempts = digits.length - duration;
    const counts = new Map<number, number>();
    exits.forEach(d => counts.set(d, (counts.get(d) ?? 0) + 1));
    const expectedDigit = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
        winRate: wins / attempts,
        safeRate: safeWins / attempts,
        expectedDigit,
    };
}

function backtestContract(
    digits: number[],
    prices: number[],
    type: string,
    side: 'over' | 'under',
    barrier: number,
    duration: number,
    expectedDigit: number | null,
) {
    if (digits.length <= duration + 4) return { winRate: 0, safeRate: 0, expectedDigit };
    let wins = 0;
    let safeWins = 0;
    for (let i = 0; i < digits.length - duration; i++) {
        const exitDigit = digits[i + duration];
        const entryPrice = prices[i];
        const exitPrice = prices[i + duration];
        let won = false;
        if (type === 'DIGITEVEN') won = exitDigit % 2 === 0;
        else if (type === 'DIGITODD') won = exitDigit % 2 !== 0;
        else if (type === 'DIGITMATCH') won = expectedDigit == null ? exitDigit === digits[i] : exitDigit === expectedDigit;
        else if (type === 'DIGITDIFF') won = expectedDigit == null ? exitDigit !== digits[i] : exitDigit !== expectedDigit;
        else if (type === 'CALL') won = exitPrice > entryPrice;
        else if (type === 'PUT') won = exitPrice < entryPrice;
        else won = side === 'over' ? exitDigit > barrier : exitDigit < barrier;
        if (won) {
            wins++;
            if (type === 'DIGITOVER' || type === 'DIGITUNDER') {
                if (Math.abs(exitDigit - barrier) >= 3) safeWins++;
            } else {
                safeWins++;
            }
        }
    }
    const attempts = digits.length - duration;
    return {
        winRate: wins / attempts,
        safeRate: safeWins / attempts,
        expectedDigit,
    };
}

export function durationCandidates(selectedTicks: number, autoRotate: boolean): number[] {
    const maxTicks = clamp(Math.round(Number(selectedTicks) || 1), 1, MAX_CONFIRM_TICKS);
    // Auto ticks means “compare every duration up to the selected limit”, not
    // “always use one tick”. With 3 selected, evaluate 1, 2, and 3; with 5,
    // evaluate all five.
    return autoRotate
        ? Array.from({ length: maxTicks }, (_, index) => index + 1)
        : [maxTicks];
}

export function validBarrierEntries(side: 'over' | 'under', barrier: number): number[] {
    const b = clamp(Math.round(Number(barrier) || 0), 0, 9);
    return side === 'over'
        ? Array.from({ length: 9 - b }, (_, index) => b + 1 + index)
        : Array.from({ length: b }, (_, index) => index);
}

function entrySequence(side: 'over' | 'under', barrier: number): number[] {
    // Start with the farthest valid digits (safer distance from the barrier),
    // then walk toward the barrier. This is dynamic for every selected
    // prediction digit: Over 3 scans 9,8,7,6,5,4 rather than a fixed list.
    return validBarrierEntries(side, barrier).sort((a, b) => {
        const distanceA = Math.abs(a - barrier);
        const distanceB = Math.abs(b - barrier);
        return distanceB - distanceA || a - b;
    });
}

export function chooseEntryDigit(
    side: 'over' | 'under',
    barrier: number,
    pcts: number[],
    index = 0,
) {
    const ordered = entrySequence(side, barrier);
    // Prefer a visible point within the safe ordering, then rotate
    // deterministically through every valid winning digit. This prevents the
    // AI from locking to one hardcoded entry point.
    const visible = ordered.filter(d => (pcts[d] ?? 0) > 0);
    const pool = visible.length ? visible : ordered;
    return pool[index % pool.length] ?? null;
}

function chooseSignalEntry(signal: any, pcts: number[], index = 0) {
    if (!signal) return null;
    if (signal.requiresReferenceEntry) {
        return chooseEntryDigit(signal.side, Number(signal.barrier), pcts, index);
    }
    return entryDigitForType(signal.entryType, signal.expectedDigit ?? null, pcts, index);
}

function entryDigitForType(type: string, expectedDigit: number | null, pcts: number[], index = 0) {
    const candidates = type === 'DIGITEVEN'
        ? [0, 2, 4, 6, 8]
        : type === 'DIGITODD'
            ? [1, 3, 5, 7, 9]
            : type === 'DIGITDIFF' && expectedDigit != null
                ? Array.from({ length: 10 }, (_, digit) => digit).filter(digit => digit !== expectedDigit)
                : expectedDigit != null
                    ? [expectedDigit]
                    : [];
    const visible = candidates.filter(digit => (pcts[digit] ?? 0) > 0);
    const pool = visible.length ? visible : candidates;
    return pool[index % pool.length] ?? null;
}

function isDigitEntryType(type: string) {
    return ['DIGITEVEN', 'DIGITODD', 'DIGITMATCH', 'DIGITDIFF'].includes(type);
}

function isUpEntryType(type: string) {
    return ['CALL', 'CALLE', 'ASIANU', 'TICKHIGH', 'RUNHIGH', 'RESETCALL'].includes(type);
}

function isDownEntryType(type: string) {
    return ['PUT', 'PUTE', 'ASIAND', 'TICKLOW', 'RUNLOW', 'RESETPUT'].includes(type);
}

function patternSignal(
    group: any,
    side: 'over' | 'under',
    digits: number[],
    prices: number[],
) {
    const recentDigits = digits.slice(-4);
    const recentPrices = prices.slice(-4);
    if (recentDigits.length < 4) return { matched: false, note: '' };

    const type = side === 'over' ? group?.typeA : group?.typeB;
    const evenCount = recentDigits.filter(d => d % 2 === 0).length;
    const oddCount = recentDigits.length - evenCount;
    const changes = recentPrices.slice(1).map((p, i) => p - recentPrices[i]);
    const rises = changes.filter(delta => delta > 0).length;
    const falls = changes.filter(delta => delta < 0).length;

    if (type === 'DIGITEVEN') {
        const matched = oddCount >= 3 && evenCount <= 1;
        return { matched, note: matched ? '3 odd / 1 even reversal' : '' };
    }
    if (type === 'DIGITODD') {
        const matched = evenCount >= 3 && oddCount <= 1;
        return { matched, note: matched ? '3 even / 1 odd reversal' : '' };
    }
    if (type === 'DIGITMATCH') {
        const matched = recentDigits[3] === recentDigits[2] || recentDigits[2] === recentDigits[1];
        return { matched, note: matched ? 'repeating digit pattern' : '' };
    }
    if (type === 'DIGITDIFF') {
        const distinct = new Set(recentDigits).size;
        const matched = distinct >= 3 && recentDigits[3] !== recentDigits[2];
        return { matched, note: matched ? '3+ differing digits pattern' : '' };
    }
    if (type === 'CALL') {
        const matched = falls >= 2 && rises >= 1 && falls >= rises;
        return { matched, note: matched ? '3-fall / 1-rise reversal' : '' };
    }
    if (type === 'PUT') {
        const matched = rises >= 2 && falls >= 1 && rises >= falls;
        return { matched, note: matched ? '3-rise / 1-fall reversal' : '' };
    }
    return { matched: false, note: '' };
}

export function evaluateSide(
    digits: number[],
    prices: number[],
    circlePcts: number[],
    side: 'over' | 'under',
    barrier: number,
    selectedTicks: number,
    autoRotate: boolean,
    symbol: string,
    group: any,
) {
    if (digits.length < SCAN_SIZE) return null;
    const windowPcts = pctsFor(digits);
    // The chart's circles are the distribution the user is looking at. Use a
    // blended view first, but do not throw away a qualifying chart distribution
    // just because this component's private 50-tick window is slightly
    // different. The live sample remains the fallback when the chart has not
    // populated its percentages yet.
    const blendedPcts = windowPcts.map(
        (p, i) => p * 0.75 + (circlePcts?.[i] ?? p) * 0.25,
    );
    const threshold = marketThreshold(symbol);
    if (!group?.needsBarrier || group?.id === 'match_differ') {
        const type = side === 'over' ? group?.typeA : group?.typeB;
        let score = 0;
        let note = '50-tick market sample ready';
        let expectedDigit = null;
        const pattern = patternSignal(group, side, digits, prices);
        if (type === 'DIGITEVEN' || type === 'DIGITODD') {
            const even = digits.filter(d => d % 2 === 0).length / digits.length;
            score = type === 'DIGITEVEN' ? even : 1 - even;
            note = `${(score * 100).toFixed(0)}% ${type === 'DIGITEVEN' ? 'even' : 'odd'} in 50 ticks`;
        } else if (type === 'DIGITMATCH' || type === 'DIGITDIFF') {
            const counts = Array.from({ length: 10 }, (_, d) => digits.filter(x => x === d).length);
            const selected = type === 'DIGITMATCH'
                ? counts.indexOf(Math.max(...counts))
                : counts.indexOf(Math.min(...counts));
            expectedDigit = selected;
            score = type === 'DIGITMATCH' ? counts[selected] / digits.length : 1 - counts[selected] / digits.length;
            note = `digit ${selected} ${type === 'DIGITMATCH' ? 'dominates' : 'is rare'} in the window`;
        } else if (type === 'CALL' || type === 'PUT') {
            let up = 0;
            for (let i = 1; i < prices.length; i++) if (prices[i] > prices[i - 1]) up++;
            score = type === 'CALL' ? up / Math.max(1, prices.length - 1) : 1 - up / Math.max(1, prices.length - 1);
            note = `${(score * 100).toFixed(0)}% directional price confirmation`;
        } else {
            score = 0.56;
        }
        if (pattern.matched) {
            score = Math.max(score, 0.62);
            note = `${note} · ${pattern.note}`;
        }
        if (score < 0.56) return null;
        const candidates = durationCandidates(selectedTicks, autoRotate);
        const tests = candidates.map(duration => ({
            duration,
            ...backtestContract(digits, prices, type, side, barrier, duration, expectedDigit),
        }));
        const best = [...tests].sort(
            (a, b) => (b.safeRate * 0.7 + b.winRate * 0.3) - (a.safeRate * 0.7 + a.winRate * 0.3),
        )[0];
        if (!best) return null;
        const entryType = type || '';
        const entryDigit = isDigitEntryType(entryType)
            ? entryDigitForType(entryType, expectedDigit, blendedPcts)
            : null;
        return {
            side,
            barrier,
            duration: best.duration,
            confidence: clamp(55 + score * 30 + best.winRate * 15, 55, 95),
            expectedDigit,
            entryDigit,
            entryType,
            requiresReferenceEntry: group?.id === 'over_under',
            patternRequired: false,
            patternNote: pattern.note,
            marketQualified: true,
            conditionPct: score * 100,
            threshold,
            note: `${note} · ${best.duration} tick${best.duration === 1 ? '' : 's'} selected from ${candidates.join(', ')}`,
        };
    }
    const losing = side === 'over'
        ? Array.from({ length: barrier + 1 }, (_, i) => i)
        : Array.from({ length: 10 - barrier }, (_, i) => barrier + i);
    const winning = side === 'over'
        ? Array.from({ length: 9 - barrier }, (_, i) => barrier + 1 + i)
        : Array.from({ length: barrier }, (_, i) => i);
    const shield = side === 'over' ? barrier + 1 : barrier - 1;
    if (shield < 0 || shield > 9 || losing.length === 0 || winning.length === 0) return null;

    const distributionQualifies = (values: number[]) =>
        losing.every(d => (values[d] ?? 0) < threshold) &&
        winning.some(d => (values[d] ?? 0) > threshold);
    const distribution = [
        { values: blendedPcts, source: 'combined live/chart distribution' },
        { values: circlePcts, source: 'chart distribution' },
        { values: windowPcts, source: '50-tick distribution' },
    ].find(candidate => distributionQualifies(candidate.values));
    if (!distribution) return null;
    const pcts = distribution.values;

    const conditionMet = losing.every(d => pcts[d] < threshold);
    const shieldPct = pcts[shield] ?? 0;
    const bestWinningDigit = [...winning].sort(
        (a, b) => (pcts[b] ?? 0) - (pcts[a] ?? 0),
    )[0];
    const bestWinningPct = pcts[bestWinningDigit] ?? 0;
    const highDigits = winning.filter(d => (pcts[d] ?? 0) > threshold).length;
    // Over/Under entry: the losing range stays below 10.5%, and at least one
    // winning digit is strong enough to carry the signal.
    // The adjacent shield is preferred when it is the strongest digit, but
    // it is optional: a different winning digit can carry the condition.
    if (!conditionMet || highDigits < 1 || bestWinningPct <= threshold) return null;
    const shieldIsBest = bestWinningDigit === shield && shieldPct > threshold;

    // Compare every duration up to the user's selected limit when Auto Ticks
    // is enabled. Never silently collapse a selection of 3 or 5 to one tick.
    const candidates = durationCandidates(selectedTicks, autoRotate);
    const tests = candidates.map(duration => ({
        duration,
        ...backtestDigits(digits, side, barrier, duration),
    }));
    const best = [...tests].sort((a, b) =>
        (b.safeRate * 0.7 + b.winRate * 0.3) - (a.safeRate * 0.7 + a.winRate * 0.3)
    )[0];
    // Historical backtesting helps choose between one- and two-tick duration,
    // but it must not veto a live distribution that meets the market rule.
    // For example, a valid Under 7 distribution can have a noisy 50-tick
    // backtest while the current market still has a clear entry opportunity.
    if (!best) return null;

    const validEntries = entrySequence(side, barrier);
    const confidence = clamp(
        60 + bestWinningPct + best.safeRate * 18 + best.winRate * 12
            + (shieldIsBest ? 7 : 0)
            + (validEntries.includes(digits[digits.length - 1]) ? 7 : 0),
        60,
        98,
    );
    return {
        side,
        barrier,
        duration: best.duration,
        confidence,
        expectedDigit: best.expectedDigit,
        entryDigit: chooseEntryDigit(side, barrier, pcts),
        entryType: side === 'over' ? 'DIGITOVER' : 'DIGITUNDER',
        requiresReferenceEntry: group?.id === 'over_under',
        patternRequired: false,
        marketQualified: true,
        conditionPct: Math.max(...losing.map(d => pcts[d] ?? 0)),
        threshold,
        note: `${groupSideLabel(group, side)} ${barrier} · entries ${validEntries.join(', ')} · best winning digit ${bestWinningDigit} at ${bestWinningPct.toFixed(1)}% · ${distribution.source}${shieldIsBest ? ' · shield preferred' : ' · shield optional'} · ${Math.round(best.winRate * 100)}% historical wins`,
    };
}

export function entryMatches(
    signal: any,
    digits: number[],
    currentDigit: number | null,
    strategies: string[],
    activeEntryDigit: number | null = signal?.entryDigit ?? null,
    group: any = null,
    prices: number[] = [],
) {
    if (currentDigit == null || !digits.length) return false;
    const side = signal.side;
    const previous = digits[digits.length - 2];
    const entryPoint = activeEntryDigit == null || currentDigit === activeEntryDigit;
    const distance = side === 'over'
        ? currentDigit - Number(signal.barrier)
        : Number(signal.barrier) - currentDigit;
    const pattern = patternSignal(group, side, digits, prices);
    const type = signal.entryType || (side === 'over' ? group?.typeA : group?.typeB) || '';
    const pricePrevious = prices[prices.length - 2];
    const priceDelta = Number.isFinite(pricePrevious)
        ? prices[prices.length - 1] - pricePrevious
        : 0;
    const directionHit = isUpEntryType(type)
        ? priceDelta > 0
        : isDownEntryType(type)
            ? priceDelta < 0
            : false;
    const digitEntryHit = isDigitEntryType(type) && entryPoint;
    const momentum = previous == null
        ? true
        : side === 'over' ? currentDigit >= previous : currentDigit <= previous;
    const nonReferenceEntry = isDigitEntryType(type)
        ? digitEntryHit
        : isUpEntryType(type) || isDownEntryType(type)
            ? directionHit || pattern.matched
            : pattern.matched || currentDigit !== previous;
    const checks: Record<string, boolean> = {
        // Every selected strategy observes the same type-specific entry
        // condition. The surrounding three-touch window is the confirmation
        // safety check; no fixed “strong digit” list can block a valid barrier.
        reversal: signal.requiresReferenceEntry ? entryPoint : nonReferenceEntry,
        'tick-concept': signal.requiresReferenceEntry
            ? entryPoint && distance >= 1
            : nonReferenceEntry,
        'entry-loop': signal.requiresReferenceEntry ? entryPoint : nonReferenceEntry,
        conservative: signal.requiresReferenceEntry
            ? entryPoint && distance >= 1
            : nonReferenceEntry,
        'number-losses': true,
        'digit-distribution': signal.marketQualified !== false,
        momentum,
    };
    if (signal.requiresReferenceEntry && !entryPoint) return false;
    if (signal.patternRequired && !pattern.matched) return false;
    const selected = strategies.length ? strategies : ['reversal', 'tick-concept', 'entry-loop'];
    const passed = selected.filter(id => checks[id]).length;
    return passed >= Math.max(1, Math.ceil(selected.length * 0.5));
}

export interface ChartAiControlProps {
    symbol: string;
    group: any;
    barrier: number;
    currentDigit: number | null;
    pcts?: number[];
    ticks: number;
    durationUnit: string;
    stake: number;
    onStakeChange: (stake: number) => void;
    onAutoTrade: (side: 'over' | 'under', ticks: number, stake: number, barrier?: number) => Promise<number | null>;
    tradeBusy?: boolean;
}

export const ChartAiControl: React.FC<ChartAiControlProps> = ({
    symbol, group, barrier, currentDigit, pcts = [], ticks, durationUnit,
    stake, onStakeChange, onAutoTrade, tradeBusy,
}) => {
    const [enabled, setEnabled] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [sample, setSample] = useState(0);
    const [signal, setSignal] = useState<any>(null);
    const [status, setStatus] = useState('AI is off');
    const [entryPhase, setEntryPhase] = useState('idle');
    const [entryDigit, setEntryDigit] = useState<number | null>(null);
    const [confirmCount, setConfirmCount] = useState(0);
    const confirmTicks = ENTRY_CONFIRM_HITS;
    const [autoRotate, setAutoRotate] = useState(true);
    const [fullMargin, setFullMargin] = useState(false);
    const [fixedStake, setFixedStake] = useState(true);
    const [runsEnabled, setRunsEnabled] = useState(false);
    const [runs, setRuns] = useState(3);
    const [stopLossEnabled, setStopLossEnabled] = useState(false);
    const [stopLoss, setStopLoss] = useState(3);
    const [martingaleEnabled, setMartingaleEnabled] = useState(false);
    const [martingale, setMartingale] = useState(2);
    const [batchLimit, setBatchLimit] = useState(3);
    const [recovery, setRecovery] = useState('off');
    const [strategies, setStrategies] = useState(['reversal', 'tick-concept', 'entry-loop']);
    const [allowA, setAllowA] = useState(true);
    const [allowB, setAllowB] = useState(true);
    const [runCount, setRunCount] = useState(0);
    const [lossCount, setLossCount] = useState(0);
    const [batchCount, setBatchCount] = useState(0);
    const [cooldown, setCooldown] = useState(0);
    const [refreshIn, setRefreshIn] = useState(0);
    const [popup, setPopup] = useState<any>(null);
    const [aiStake, setAiStake] = useState(Math.max(MIN_STAKE, stake));
    const [strategiesOpen, setStrategiesOpen] = useState(false);

    const digitsRef = useRef<number[]>([]);
    const pricesRef = useRef<number[]>([]);
    const pipRef = useRef<number | null>(null);
    const subscriptionRef = useRef<any>(null);
    const subscriptionIdRef = useRef<string | null>(null);
    const activeContractRef = useRef<number | null>(null);
    const activeStakeRef = useRef(aiStake);
    const initialStakeRef = useRef(Math.max(MIN_STAKE, stake));
    const userStakeRef = useRef(Math.max(MIN_STAKE, stake));
    const hasPlacedTradeRef = useRef(false);
    const signalRef = useRef<any>(null);
    const entryPhaseRef = useRef('idle');
    const entryDigitRef = useRef<number | null>(null);
    const confirmCountRef = useRef(0);
    const entryIndexRef = useRef(0);
    const entryUseCountRef = useRef(0);
    const entryFailureCountRef = useRef(0);
    const entryWindowTicksRef = useRef(0);
    const entryWindowHitsRef = useRef(0);
    const reversePendingRef = useRef(false);
    const autoAttemptRef = useRef(false);
    const scanEpochRef = useRef(0);
    const scanActiveRef = useRef(false);
    const refreshTimerRef = useRef<any>(null);
    const refreshClockRef = useRef<any>(null);
    const cooldownRef = useRef(0);
    const batchCountRef = useRef(0);
    const recoveryPendingRef = useRef(false);
    const defaultSignalRef = useRef<any>(null);
    const ladderBaseRef = useRef(MIN_STAKE);
    const ladderPeakRef = useRef(MIN_STAKE);
    const ladderHadLossRef = useRef(false);
    const strategiesRef = useRef(strategies);

    const setPhase = (next: string) => {
        entryPhaseRef.current = next;
        setEntryPhase(next);
    };

    useEffect(() => { signalRef.current = signal; }, [signal]);
    useEffect(() => { strategiesRef.current = strategies; }, [strategies]);
    useEffect(() => {
        // `stake` is the user's base stake. AI progression must not call
        // onStakeChange and feed its temporary amount back into this effect.
        // Only accept a user/base-stake change while no contract is active.
        if (!activeContractRef.current) {
            const nextBase = Math.max(MIN_STAKE, Number(stake) || MIN_STAKE);
            userStakeRef.current = nextBase;
            initialStakeRef.current = nextBase;
            if (enabled) setAiStake(nextBase);
        }
    }, [stake, enabled]);

    const stopStream = () => {
        subscriptionRef.current?.unsubscribe?.();
        subscriptionRef.current = null;
        if (subscriptionIdRef.current && api_base.api) {
            try { api_base.api.send({ forget: subscriptionIdRef.current }).catch(() => {}); } catch {}
        }
        subscriptionIdRef.current = null;
    };

    const beginScan = (reason = 'Market selected') => {
        scanEpochRef.current++;
        digitsRef.current = [];
        pricesRef.current = [];
        pipRef.current = null;
        setSample(0);
        signalRef.current = null;
        setSignal(null);
        defaultSignalRef.current = null;
        recoveryPendingRef.current = false;
        // A fresh market scan starts a new AI cycle. The first order in that
        // cycle must use the user's current stake exactly, before progression.
        hasPlacedTradeRef.current = false;
        const baseStake = userStakeRef.current;
        initialStakeRef.current = baseStake;
        setAiStake(baseStake);
        entryIndexRef.current = 0;
        entryUseCountRef.current = 0;
        entryFailureCountRef.current = 0;
        entryWindowTicksRef.current = 0;
        entryWindowHitsRef.current = 0;
        reversePendingRef.current = false;
        setPhase('idle');
        setEntryDigit(null);
        setConfirmCount(0);
        setScanning(true);
        scanActiveRef.current = true;
        setStatus(`${reason} · collecting live ticks 0/50`);
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        if (refreshClockRef.current) clearInterval(refreshClockRef.current);
        setRefreshIn(120);
    };

    const scheduleRefresh = () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        if (refreshClockRef.current) clearInterval(refreshClockRef.current);
        setRefreshIn(120);
        refreshClockRef.current = setInterval(() => setRefreshIn(v => Math.max(0, v - 1)), 1000);
        refreshTimerRef.current = setTimeout(() => {
            if (activeContractRef.current) {
                setStatus('Fresh 50-tick analysis waiting for the active trade');
                refreshTimerRef.current = setTimeout(() => beginScan('2-minute refresh'), 2500);
            } else {
                beginScan('2-minute refresh');
            }
        }, RESCAN_MS);
    };

    useEffect(() => {
        if (!enabled) {
            stopStream();
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
            if (refreshClockRef.current) clearInterval(refreshClockRef.current);
            setScanning(false);
            scanActiveRef.current = false;
            setStatus('AI is off');
            return;
        }
        let alive = true;
        beginScan('Market changed');
        const start = () => {
            if (!alive) return;
            const api = api_base.api as any;
            if (!api) { setTimeout(start, 300); return; }
            try {
                const stream = api.subscribe({ ticks: symbol, subscribe: 1 });
                subscriptionRef.current = stream;
                subscriptionRef.current = stream?.subscribe?.({
                    next: (res: any) => {
                        const tick = res?.tick;
                        if (!alive || !tick) return;
                        if (res?.subscription?.id) subscriptionIdRef.current = String(res.subscription.id);
                        if (tick.pip_size != null) pipRef.current = Number(tick.pip_size);
                        const price = Number(tick.quote);
                        if (!Number.isFinite(price) || !pipRef.current) return;
                        const digit = digitFromPrice(price, pipRef.current);

                        if (cooldownRef.current > 0) {
                            cooldownRef.current -= 1;
                            setCooldown(cooldownRef.current);
                            setStatus(`Cooling off · ${cooldownRef.current} tick${cooldownRef.current === 1 ? '' : 's'} remaining`);
                            if (cooldownRef.current === 0) beginScan('Cooldown complete');
                        }

                        if (scanActiveRef.current || digitsRef.current.length < SCAN_SIZE) {
                            digitsRef.current = [...digitsRef.current, digit].slice(-SCAN_SIZE);
                            pricesRef.current = [...pricesRef.current, price].slice(-SCAN_SIZE);
                            setSample(digitsRef.current.length);
                            if (digitsRef.current.length < SCAN_SIZE) {
                                setStatus(`Scanning live ticks… ${digitsRef.current.length}/50`);
                            } else {
                                setScanning(false);
                                scanActiveRef.current = false;
                                setPhase('analysing');
                                setStatus('50 ticks ready · analysing digit distribution');
                                scheduleRefresh();
                            }
                            return;
                        }

                        // Keep a rolling window for entry-point logic only. The
                        // selected signal remains based on the completed 50-tick scan.
                        digitsRef.current = [...digitsRef.current, digit].slice(-SCAN_SIZE);
                        pricesRef.current = [...pricesRef.current, price].slice(-SCAN_SIZE);
                        setSample(v => v + 1);
                        const active = signalRef.current;
                        if (!active || activeContractRef.current || cooldownRef.current > 0 || autoAttemptRef.current) return;
                        if (entryDigitRef.current == null) {
                            entryDigitRef.current = active.entryDigit
                                ?? chooseEntryDigit(active.side, active.barrier, pctsFor(digitsRef.current), entryIndexRef.current);
                        }
                        entryWindowTicksRef.current = Math.min(
                            ENTRY_STALE_TICKS,
                            entryWindowTicksRef.current + 1,
                        );
                        const matches = entryMatches(
                            active,
                            digitsRef.current,
                            digit,
                            strategiesRef.current,
                            entryDigitRef.current,
                            group,
                            pricesRef.current,
                        );
                        if (matches) {
                            entryWindowHitsRef.current += 1;
                        }
                        setEntryDigit(entryDigitRef.current);
                        confirmCountRef.current = Math.min(
                            ENTRY_CONFIRM_HITS,
                            entryWindowHitsRef.current,
                        );
                        setConfirmCount(confirmCountRef.current);

                        // A 1–5 tick confirmation window is used for every
                        // entry point. Three qualifying touches in that
                        // window are enough; repeated consecutive ticks are
                        // not required.
                        if (confirmCountRef.current >= ENTRY_CONFIRM_HITS) {
                            entryWindowTicksRef.current = 0;
                            entryWindowHitsRef.current = 0;
                            setPhase('waiting');
                            setStatus(`Entry ${entryDigitRef.current} confirmed · ${ENTRY_CONFIRM_HITS}/${ENTRY_WINDOW_TICKS} touches · ready`);
                            return;
                        }

                        if (entryWindowTicksRef.current >= ENTRY_STALE_TICKS &&
                            entryWindowHitsRef.current === 0 &&
                            !reversePendingRef.current) {
                            const reverseSide = active.side === 'over' ? 'under' : 'over';
                            const reverseBarrier = reverseSide === 'over'
                                ? Math.max(2, Math.min(3, Number(active.barrier)))
                                : Math.min(7, Math.max(6, Number(active.barrier)));
                            const reverseSignal = {
                                ...active,
                                side: reverseSide,
                                barrier: reverseBarrier,
                                entryDigit: chooseEntryDigit(
                                    reverseSide,
                                    reverseBarrier,
                                    pctsFor(digitsRef.current),
                                    0,
                                ),
                                note: `Reverse after ${ENTRY_STALE_TICKS} ticks without entry`,
                            };
                            reversePendingRef.current = true;
                            signalRef.current = reverseSignal;
                            setSignal(reverseSignal);
                            entryIndexRef.current = 0;
                            entryDigitRef.current = reverseSignal.entryDigit;
                            entryWindowTicksRef.current = 0;
                            entryWindowHitsRef.current = 0;
                            confirmCountRef.current = 0;
                            setEntryDigit(reverseSignal.entryDigit);
                            setConfirmCount(0);
                            setPhase('analysing');
                            setStatus(`Reverse ${groupSideLabel(group, reverseSide)} selected · waiting for ${reverseSignal.entryDigit}`);
                            return;
                        }

                        if (entryWindowTicksRef.current >= ENTRY_WINDOW_TICKS && entryWindowHitsRef.current === 0) {
                            // Keep a no-touch entry alive through the stale
                            // band so the reverse rule can take over.
                            if (
                                entryWindowTicksRef.current < ENTRY_STALE_TICKS &&
                                !reversePendingRef.current
                            ) {
                                setPhase('analysing');
                                setConfirmCount(0);
                                setStatus(
                                    `Entry ${entryDigitRef.current ?? '—'} not touched · ` +
                                    `watching reverse band ${entryWindowTicksRef.current}/${ENTRY_STALE_TICKS}`,
                                );
                                return;
                            }
                            entryWindowTicksRef.current = 0;
                            entryWindowHitsRef.current = 0;
                            confirmCountRef.current = 0;
                            entryFailureCountRef.current += 1;
                            if (entryFailureCountRef.current >= ENTRY_FAILURE_LIMIT) {
                                entryFailureCountRef.current = 0;
                                entryIndexRef.current += 1;
                                entryDigitRef.current = chooseEntryDigit(
                                    active.side,
                                    active.barrier,
                                    pctsFor(digitsRef.current),
                                    entryIndexRef.current,
                                );
                                setStatus(`Entry point rotated · watching ${entryDigitRef.current}`);
                            } else {
                                setStatus(`No 3 touches in ${ENTRY_WINDOW_TICKS} ticks · restarting entry check`);
                            }
                            setPhase('analysing');
                            setConfirmCount(0);
                            return;
                        }

                        if (
                            entryWindowTicksRef.current >= ENTRY_WINDOW_TICKS &&
                            entryWindowHitsRef.current < ENTRY_CONFIRM_HITS
                        ) {
                            entryWindowTicksRef.current = 0;
                            entryWindowHitsRef.current = 0;
                            confirmCountRef.current = 0;
                            entryFailureCountRef.current += 1;
                            if (entryFailureCountRef.current >= ENTRY_FAILURE_LIMIT) {
                                entryFailureCountRef.current = 0;
                                entryIndexRef.current += 1;
                                entryDigitRef.current = chooseEntryDigit(
                                    active.side,
                                    active.barrier,
                                    pctsFor(digitsRef.current),
                                    entryIndexRef.current,
                                );
                            }
                            setEntryDigit(entryDigitRef.current);
                            setConfirmCount(0);
                            setPhase('analysing');
                            setStatus(`Confirmation window ended · watching ${entryDigitRef.current}`);
                            return;
                        }

                        setPhase('confirming');
                        setStatus(
                            `Watching ${entryDigitRef.current ?? '—'} · ` +
                            `${confirmCountRef.current}/${ENTRY_CONFIRM_HITS} touches in ` +
                            `${entryWindowTicksRef.current}/${ENTRY_WINDOW_TICKS} ticks`,
                        );
                    },
                    error: () => { if (alive) setStatus('Market stream paused · retrying…'); },
                });
            } catch { if (alive) setTimeout(start, 500); }
        };
        start();
        return () => {
            alive = false;
            stopStream();
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
            if (refreshClockRef.current) clearInterval(refreshClockRef.current);
        };
    }, [enabled, symbol]);

    const windowPcts = useMemo(() => pctsFor(digitsRef.current), [sample]);
    const circlePcts = pcts.length ? pcts : windowPcts;

    useEffect(() => {
        if (!enabled || scanning || digitsRef.current.length < SCAN_SIZE || group?.isAccumulator) return;
        if (signalRef.current) return;
        const candidates = [
            allowA && evaluateSide(digitsRef.current, pricesRef.current, pcts, 'over', barrier, ticks, autoRotate, symbol, group),
            allowB && evaluateSide(digitsRef.current, pricesRef.current, pcts, 'under', barrier, ticks, autoRotate, symbol, group),
        ].filter(Boolean);
        const next = candidates.sort((a, b) => b.confidence - a.confidence)[0] ?? null;
        signalRef.current = next;
        setSignal(next);
        defaultSignalRef.current = next;
        setPhase(next ? 'analysing' : 'idle');
        if (next) {
            setStatus(`${groupSideLabel(group, next.side)} ${barrier} selected · best entry digit pending`);
        } else {
            setStatus(`No ${marketThreshold(symbol).toFixed(1)}% condition yet · waiting for next tick`);
        }
    }, [enabled, scanning, sample, group, barrier, ticks, autoRotate, allowA, allowB, pcts, symbol]);

    useEffect(() => {
        if (!enabled || !signal || entryPhase !== 'waiting' || tradeBusy || activeContractRef.current || autoAttemptRef.current) return;
        if (runsEnabled && runCount >= runs) return;
        if (stopLossEnabled && lossCount >= stopLoss) return;
        autoAttemptRef.current = true;
        const duration = clamp(
            Number(signal.duration ?? ticks) || 1,
            1,
            MAX_CONFIRM_TICKS,
        );
        const nextStake = hasPlacedTradeRef.current
            ? Math.max(MIN_STAKE, aiStake)
            : Math.max(MIN_STAKE, initialStakeRef.current);
        const recoveryBarrier = signal.recoveryBarrier;
        activeStakeRef.current = nextStake;
        setPopup({ ...signal, duration, recovery: !!recoveryBarrier });
        const timer = setTimeout(() => setPopup(null), 4500);
        onAutoTrade(signal.side, duration, nextStake, recoveryBarrier).then(id => {
            if (id != null) {
                activeContractRef.current = Number(id);
                hasPlacedTradeRef.current = true;
                setStatus(`${groupSideLabel(group, signal.side)} fired · ${duration} tick${duration === 1 ? '' : 's'}`);
            } else {
                autoAttemptRef.current = false;
                setPhase('idle');
                setSignal(null);
                setStatus('Trade not placed · rescanning 50 ticks');
                beginScan('Trade failed');
            }
        }).catch(() => {
            autoAttemptRef.current = false;
            setPopup(null);
            setPhase('idle');
            beginScan('Trade failed');
        });
        return () => clearTimeout(timer);
    }, [signal, entryPhase, enabled, tradeBusy, aiStake, autoRotate, ticks, runsEnabled, runCount, runs, stopLossEnabled, lossCount, stopLoss]);

    useEffect(() => {
        const onSettlement = (event: any) => {
            if (!enabled || !activeContractRef.current) return;
            if (event.detail?.contractId != null && Number(event.detail.contractId) !== activeContractRef.current) return;
            const { won, profit } = event.detail ?? {};
            activeContractRef.current = null;
            autoAttemptRef.current = false;
            setPopup(null);
            setRunCount(v => v + 1);
            if (!won) setLossCount(v => v + 1);

            const stakeStep = (amount: number) =>
                amount > 10 ? 2 : amount > 5 ? 1 : amount > 2 ? 0.5 : 0;
            const baseNext = activeStakeRef.current + stakeStep(activeStakeRef.current);
            // Keep the user-selected stake as the floor. Never fall back to
            // MIN_STAKE after a loss or settlement. Optional martingale still
            // works when explicitly enabled, but its result also receives the
            // requested additive tier step.
            let next = !won && fixedStake && martingaleEnabled
                ? activeStakeRef.current * Math.max(1, martingale)
                : baseNext;
            if (!won && fixedStake && martingaleEnabled) {
                next += stakeStep(next);
            }
            next = Number(clamp(next, MIN_STAKE, 100000).toFixed(2));
            setAiStake(next);
            // Do not call onStakeChange here. That callback edits the user's
            // base stake input; AI's progression belongs to aiStake only.
            initialStakeRef.current = Math.max(MIN_STAKE, Number(stake) || MIN_STAKE);

            // An entry point may be used three times, then the AI rotates to
            // the next point. Two failed windows rotate sooner so one stale
            // digit cannot lock the engine.
            if (won) {
                entryUseCountRef.current += 1;
                entryFailureCountRef.current = 0;
            }
            reversePendingRef.current = false;
            if (
                entryUseCountRef.current >= ENTRY_USE_LIMIT ||
                (!won && entryFailureCountRef.current >= 2)
            ) {
                entryUseCountRef.current = 0;
                entryFailureCountRef.current = 0;
                entryIndexRef.current += 1;
            }
            const settledSignal = signalRef.current ?? defaultSignalRef.current;
            if (settledSignal) {
                const rotatedEntry = chooseEntryDigit(
                    settledSignal.side,
                    Number(settledSignal.barrier),
                    pctsFor(digitsRef.current),
                    entryIndexRef.current,
                );
                entryDigitRef.current = rotatedEntry;
                entryWindowTicksRef.current = 0;
                entryWindowHitsRef.current = 0;
                confirmCountRef.current = 0;
                signalRef.current = { ...settledSignal, entryDigit: rotatedEntry };
                setSignal(signalRef.current);
                setEntryDigit(rotatedEntry);
            }

            const nextBatch = batchCountRef.current + 1;
            batchCountRef.current = nextBatch;
            setBatchCount(nextBatch);
            if (!won && recovery !== 'off' && !recoveryPendingRef.current) {
                recoveryPendingRef.current = true;
                const recoverySide = recovery === 'over4' ? 'over' : 'under';
                const recoveryBarrier = recovery === 'over4' ? 4 : 5;
                const baseSignal = defaultSignalRef.current;
                if (baseSignal) {
                    const recoverySignal = {
                        ...baseSignal,
                        side: recoverySide,
                        barrier: recoveryBarrier,
                        recoveryBarrier,
                        entryDigit: chooseEntryDigit(
                            recoverySide,
                            recoveryBarrier,
                            pctsFor(digitsRef.current),
                            0,
                        ),
                        note: `Opposite recovery ${recoverySide === 'over' ? 'Over 4' : 'Under 5'} · fresh entry`,
                    };
                    signalRef.current = recoverySignal;
                    setSignal(recoverySignal);
                    entryIndexRef.current = 0;
                    entryDigitRef.current = recoverySignal.entryDigit;
                    entryWindowTicksRef.current = 0;
                    entryWindowHitsRef.current = 0;
                    confirmCountRef.current = 0;
                    setEntryDigit(recoverySignal.entryDigit);
                    setConfirmCount(0);
                }
            } else if (won && recoveryPendingRef.current) {
                recoveryPendingRef.current = false;
                const restoredSignal = defaultSignalRef.current;
                signalRef.current = restoredSignal;
                setSignal(restoredSignal);
                entryDigitRef.current = restoredSignal?.entryDigit ?? null;
                entryWindowTicksRef.current = 0;
                entryWindowHitsRef.current = 0;
                confirmCountRef.current = 0;
                setEntryDigit(entryDigitRef.current);
                setConfirmCount(0);
            }

            if (nextBatch >= batchLimit) {
                batchCountRef.current = 0;
                setBatchCount(0);
                cooldownRef.current = COOLDOWN_TICKS;
                setCooldown(COOLDOWN_TICKS);
                signalRef.current = null;
                setSignal(null);
                setPhase('idle');
                setStatus(`Batch complete · cooling off ${COOLDOWN_TICKS} ticks`);
            } else if ((runsEnabled && runCount + 1 >= runs) || (stopLossEnabled && lossCount + (won ? 0 : 1) >= stopLoss)) {
                setEnabled(false);
                setStatus(won ? 'Run limit reached · AI stopped' : 'Stop-loss reached · AI stopped');
            } else {
                setPhase('analysing');
                setEntryDigit(entryDigitRef.current);
                setConfirmCount(0);
                setStatus(won ? 'Profit · searching for a fresh entry' : 'Loss · searching for a fresh entry');
            }
        };
        window.addEventListener('chart:trade-settled', onSettlement as any);
        return () => window.removeEventListener('chart:trade-settled', onSettlement as any);
    }, [enabled, fullMargin, fixedStake, martingaleEnabled, martingale, stake, runsEnabled, runs, stopLossEnabled, stopLoss, runCount, lossCount, onStakeChange, recovery, batchLimit]);

    const threshold = marketThreshold(symbol);
    const sideA = groupSideLabel(group, 'over');
    const sideB = groupSideLabel(group, 'under');
    const phaseLabel = {
        idle: 'Waiting for a qualifying market',
        analysing: `Analysing entry point${entryDigit == null ? '' : ` · ${entryDigit}`}`,
        confirming: `Confirming ${entryDigit ?? '—'} · ${confirmCount}/${confirmTicks} ticks`,
        waiting: `Waiting to execute · ${entryDigit ?? '—'}`,
    }[entryPhase] ?? status;

    const updateStrategies = (strategyId: string) => {
        if (strategyId === 'all') {
            setStrategies(STRATEGIES.map(strategy => strategy.id));
        } else {
            setStrategies(current => {
                const next = current.includes(strategyId)
                    ? current.filter(id => id !== strategyId)
                    : [...current, strategyId];
                return next.length ? next : ['entry-loop'];
            });
        }
        // Keep the menu open while selecting multiple strategies. The trigger
        // remains the explicit retract/expand control.
    };

    const allStrategiesSelected = strategies.length === STRATEGIES.length;
    const selectedStrategyLabel = allStrategiesSelected
        ? 'All strategies'
        : STRATEGIES.filter(strategy => strategies.includes(strategy.id))
            .map(strategy => strategy.label)
            .join(', ') || 'Entry loop';

    return (
        <div className={`chart-ai${enabled ? ' chart-ai--active' : ''}`}>
            {popup && (
                <div className='chart-ai__popup'>
                    <strong>🤖 AI {groupSideLabel(group, popup.side)} {popup.barrier} fired</strong>
                    <span>{popup.duration} tick{popup.duration === 1 ? '' : 's'} · prediction digit {popup.expectedDigit ?? '—'}</span>
                    <span>{popup.confidence.toFixed(0)}% confidence · {popup.recovery ? 'opposite recovery · ' : ''}{popup.note}</span>
                </div>
            )}
            <div className='chart-ai__head'>
                <button className={`chart-ai__power${enabled ? ' on' : ''}`} onClick={() => setEnabled(v => !v)} disabled={group?.isAccumulator}>
                    {enabled ? 'AI ON' : 'AI'}
                </button>
                <span className='chart-ai__title'>AI market scanner</span>
                <span className='chart-ai__status'>{group?.isAccumulator ? 'Unavailable for accumulator' : status}</span>
            </div>
            {enabled && (
                <div className='chart-ai__body'>
                    <div className='chart-ai__scan'>
                        <span className={scanning ? 'pulse' : 'ready'} />
                        {scanning
                            ? `Scanning live ticks · ${Math.min(sample, 50)}/50`
                            : signal
                                ? `${signal.confidence.toFixed(0)}% · ${sideA === groupSideLabel(group, signal.side) ? sideA : sideB} ${signal.barrier} · refresh ${refreshIn}s`
                                : status}
                    </div>
                    <div className='chart-ai__entry'>
                        <b>{phaseLabel}</b>
                        {signal && <span>Best entry: {signal.entryDigit ?? 'watching'} · {signal.duration} tick{signal.duration === 1 ? '' : 's'} · condition ≤ {threshold.toFixed(1)}%</span>}
                        <span className='chart-ai__entry-map'>
                            {signal?.requiresReferenceEntry
                                ? `${groupSideLabel(group, signal.side)} ${signal.barrier} entries: ${validBarrierEntries(signal.side, signal.barrier).join(' · ')}`
                                : `${groupSideLabel(group, signal?.side ?? 'over')} entry confirmation follows the selected contract pattern`
                            }
                        </span>
                        <span className='chart-ai__circle-readout'>
                            Circle distribution: {circlePcts.map((v, i) => `${i} ${v.toFixed(1)}%`).join(' · ')}
                        </span>
                    </div>
                    <div className='chart-ai__toggles'>
                        <button className={autoRotate ? 'active' : ''} onClick={() => setAutoRotate(v => !v)}>Auto ticks {autoRotate ? 'ON' : 'OFF'}</button>
                        <button className={fullMargin ? 'active' : ''} onClick={() => setFullMargin(v => !v)}>Full margin {fullMargin ? 'ON' : 'OFF'}</button>
                        <button className={fixedStake ? 'active' : ''} onClick={() => setFixedStake(v => !v)}>Fixed stake {fixedStake ? 'ON' : 'OFF'}</button>
                        <button className={runsEnabled ? 'active' : ''} onClick={() => setRunsEnabled(v => !v)}>Runs {runsEnabled ? 'ON' : 'OFF'}</button>
                        <button className={stopLossEnabled ? 'active' : ''} onClick={() => setStopLossEnabled(v => !v)}>Stop loss {stopLossEnabled ? 'ON' : 'OFF'}</button>
                        <button className={martingaleEnabled ? 'active' : ''} onClick={() => setMartingaleEnabled(v => !v)}>Martingale {martingaleEnabled ? 'ON' : 'OFF'}</button>
                    </div>
                    <div className='chart-ai__settings'>
                        <label>confirm
                            <select value={confirmTicks} disabled>
                                <option value={ENTRY_CONFIRM_HITS}>{ENTRY_CONFIRM_HITS} touches</option>
                            </select>
                        </label>
                        <label>batch
                            <select value={batchLimit} onChange={e => setBatchLimit(Number(e.target.value))}>
                                {[3, 4].map(n => <option key={n} value={n}>{n} trades</option>)}
                            </select>
                        </label>
                        <label>recovery
                            <select value={recovery} onChange={e => setRecovery(e.target.value)}>
                                <option value='off'>Off</option>
                                <option value='over4'>Over 4</option>
                                <option value='under5'>Under 5</option>
                            </select>
                        </label>
                        <span className='chart-ai__stake-readout'>AI stake {aiStake.toFixed(2)}</span>
                    </div>
                    <div className='chart-ai__strategy-picker'>
                        <span className='chart-ai__strategy-label'>Strategies used</span>
                        <button
                            type='button'
                            className={`chart-ai__strategy-trigger${strategiesOpen ? ' open' : ''}`}
                            aria-expanded={strategiesOpen}
                            onClick={() => setStrategiesOpen(value => !value)}
                        >
                            <span>{selectedStrategyLabel}</span>
                            <span aria-hidden='true'>{strategiesOpen ? '⌃' : '⌄'}</span>
                        </button>
                        {strategiesOpen && (
                            <div className='chart-ai__strategy-menu'>
                                <button
                                    type='button'
                                    className={`chart-ai__strategy-option${allStrategiesSelected ? ' selected' : ''}`}
                                    onClick={() => updateStrategies('all')}
                                >
                                    <span className='chart-ai__strategy-check'>{allStrategiesSelected ? '✓' : ''}</span>
                                    <span>All strategies</span>
                                </button>
                                {STRATEGIES.map(strategy => {
                                    const selected = strategies.includes(strategy.id);
                                    return (
                                        <button
                                            type='button'
                                            key={strategy.id}
                                            className={`chart-ai__strategy-option${selected ? ' selected' : ''}`}
                                            onClick={() => updateStrategies(strategy.id)}
                                        >
                                            <span className='chart-ai__strategy-check'>{selected ? '✓' : ''}</span>
                                            <span>{strategy.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className='chart-ai__settings'>
                        {[
                            ['runs', runs, setRuns, 1, 100],
                            ['losses', stopLoss, setStopLoss, 1, 100],
                            ['× loss', martingale, setMartingale, 1, 10],
                        ].map(([label, value, setter, min, max]) => (
                            <label key={label}>{label}<input type='number' min={min} max={max} value={value} onChange={e => setter(clamp(Number(e.target.value) || min, min, max))} /></label>
                        ))}
                    </div>
                    <div className='chart-ai__sides'>
                        <button className={allowA ? 'active' : ''} onClick={() => setAllowA(v => !v)}>{sideA} {allowA ? 'ON' : 'OFF'}</button>
                        <button className={allowB ? 'active' : ''} onClick={() => setAllowB(v => !v)}>{sideB} {allowB ? 'ON' : 'OFF'}</button>
                        <span>{runCount} trades · {lossCount} losses · batch {batchCount}/{batchLimit}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChartAiControl;