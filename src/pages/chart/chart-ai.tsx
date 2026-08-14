// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import NumberField from '@/components/number-field';
import './chart-ai.scss';

const MIN_STAKE = 0.35;
const MAX_CONFIRM_TICKS = 5;
const SCAN_SIZE = 50;
const RESCAN_MS = 300_000;
const RESCAN_SECONDS = 300;
const COOLDOWN_TICKS = 10;
const ENTRY_USE_LIMIT = 3;
const ENTRY_FAILURE_LIMIT = 3;
const TOUCH_CONFIRM_DEFAULT = 3;
const LOSS_RESCAN_LIMIT = 3;
const ENTRY_ANALYSIS_MIN_TICKS = 10;
const ENTRY_ANALYSIS_MAX_TICKS = 15;
const ENTRY_WAIT_MIN_TICKS = 6;
const ENTRY_WAIT_MAX_TICKS = 10;
const AUTO_TICK_LIMIT = 5;

const STRATEGIES = [
    { id: 'reversal', label: 'Reversal' },
    { id: 'tick-concept', label: 'Tick concept' },
    { id: 'entry-loop', label: 'Entry loop' },
    { id: 'conservative', label: 'Conservative' },
    { id: 'number-losses', label: 'Number of losses' },
    { id: 'digit-distribution', label: 'Digit distribution' },
    { id: 'momentum', label: 'Momentum' },
];

const TICK_DEFAULT_STRATEGIES = ['reversal', 'tick-concept', 'entry-loop', 'momentum'];

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
    // Fast 1-second and Jump feeds need the slightly wider 10.6% band used
    // by the visual analyser; plain Volatility/Bear/Bull/Step feeds retain
    // the stricter 10.5% threshold.
    return /^(1HZ|JD)/i.test(String(symbol)) ? 10.6 : 10.5;
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

function marketFlowOffset(symbol: string) {
    // The one-second and Jump feeds are faster/noisier at the first tick after
    // an entry. Treat that first post-entry tick as the setup tick, just like
    // the chart AI's manual analysis does, then score the following ticks.
    return /^(1HZ|JD)/i.test(String(symbol)) ? 1 : 0;
}

export function analyzeEntryFlow(
    digits: number[],
    entryDigit: number,
    side: 'over' | 'under',
    barrier: number,
    symbol: string,
    durations: number[] = [1, 2, 3, 4, 5],
) {
    const offset = marketFlowOffset(symbol);
    const scores = durations.map(duration => {
        let wins = 0;
        let attempts = 0;
        for (let index = 0; index < digits.length; index++) {
            if (digits[index] !== entryDigit) continue;
            const exit = digits[index + offset + duration];
            if (exit == null) continue;
            attempts++;
            if (side === 'over' ? exit > barrier : exit < barrier) wins++;
        }
        return {
            duration,
            attempts,
            winRate: attempts ? wins / attempts : 0,
        };
    });
    const best = [...scores].sort((a, b) =>
        (b.winRate * 0.8 + Math.min(b.attempts, 5) * 0.04)
        - (a.winRate * 0.8 + Math.min(a.attempts, 5) * 0.04)
    )[0];
    const latestEntry = digits.lastIndexOf(entryDigit);
    const flowStart = latestEntry >= 0 ? latestEntry + 1 + offset : digits.length;
    return {
        offset,
        skippedDigit: offset ? digits[latestEntry + 1] ?? null : null,
        flow: digits.slice(flowStart, flowStart + Math.max(...durations)),
        duration: best?.duration ?? durations[0] ?? 1,
        scores,
    };
}

export function validBarrierEntries(side: 'over' | 'under', barrier: number): number[] {
    const b = clamp(Math.round(Number(barrier) || 0), 0, 9);
    return side === 'over'
        ? Array.from({ length: 9 - b }, (_, index) => b + 1 + index)
        : Array.from({ length: b }, (_, index) => index);
}

function entrySequence(side: 'over' | 'under', barrier: number): number[] {
    // Start Over with the lower winning digits nearest its barrier and Under
    // with the upper winning digits nearest its barrier. This keeps the first
    // scan aligned with the user's requested entry direction while still
    // rotating through every valid digit.
    return validBarrierEntries(side, barrier).sort((a, b) =>
        side === 'over' ? a - b : b - a
    );
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

export function calculateNextAiStake({
    won,
    profit,
    activeStake,
    initialStake,
    fullMargin,
    fixedStake,
    martingaleEnabled,
    martingale,
}: {
    won: boolean;
    profit: number;
    activeStake: number;
    initialStake: number;
    fullMargin: boolean;
    fixedStake: boolean;
    martingaleEnabled: boolean;
    martingale: number;
}) {
    const base = clamp(Number(initialStake) || MIN_STAKE, MIN_STAKE, 100000);
    const current = clamp(Number(activeStake) || base, MIN_STAKE, 100000);
    let next = base;

    // Full Margin is intentionally its own progression mode: after a win the
    // next contract reinvests the stake plus the realised profit. A loss starts
    // the next batch from the user's initial stake rather than compounding a
    // negative amount.
    if (fullMargin) {
        next = won && Number(profit) > 0 ? current + Number(profit) : base;
    } else if (fixedStake) {
        // Fixed Stake always returns to the user's initial AI stake.
        next = base;
    } else if (!won && martingaleEnabled) {
        next = current * Math.max(1, Number(martingale) || 1);
    }

    return Number(clamp(next, MIN_STAKE, 100000).toFixed(2));
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
        const flow = entryDigit == null
            ? null
            : analyzeEntryFlow(digits, entryDigit, side, barrier, symbol, candidates);
        const selectedDuration = flow?.scores?.length
            ? [...tests].sort((a, b) => {
                const flowA = flow.scores.find(item => item.duration === a.duration)?.winRate ?? 0;
                const flowB = flow.scores.find(item => item.duration === b.duration)?.winRate ?? 0;
                return (flowB * 0.55 + b.safeRate * 0.3 + b.winRate * 0.15)
                    - (flowA * 0.55 + a.safeRate * 0.3 + a.winRate * 0.15);
            })[0]
            : best;
        return {
            side,
            barrier,
            duration: selectedDuration?.duration ?? best.duration,
            confidence: clamp(55 + score * 30 + best.winRate * 15, 55, 95),
            expectedDigit,
            entryDigit,
            flow,
            entryType,
            requiresReferenceEntry: group?.id === 'over_under',
            patternRequired: false,
            patternNote: pattern.note,
            marketQualified: true,
            conditionPct: score * 100,
            threshold,
            note: `${note} · ${selectedDuration?.duration ?? best.duration} tick${(selectedDuration?.duration ?? best.duration) === 1 ? '' : 's'} selected from ${candidates.join(', ')}`,
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

    const lowRunLength = (values: number[]) => {
        let length = 0;
        if (side === 'over') {
            for (let digit = 0; digit < barrier; digit++) {
                if ((values[digit] ?? 0) >= threshold) break;
                length++;
            }
        } else {
            for (let digit = 9; digit >= barrier; digit--) {
                if ((values[digit] ?? 0) >= threshold) break;
                length++;
            }
        }
        return length;
    };
    // A barrier remains the user's command. The AI only needs the contiguous
    // low-frequency run that supports it: Over 1 needs 0 low, Over 2 needs
    // 0+1 low, while Under 7 can be supported by 9+8+7. This mirrors the
    // digit-circle reading in the reference image without requiring every
    // digit on the losing side to be below 10.5%.
    const requiredLowRun = side === 'over'
        ? Math.max(1, Math.min(barrier, 3))
        : Math.max(1, Math.min(10 - barrier, 3));
    const distributionQualifies = (values: number[]) =>
        lowRunLength(values) >= requiredLowRun &&
        winning.some(d => (values[d] ?? 0) > threshold);
    // The visible digit circles are the user's source of truth. Previously a
    // neutral private 50-tick sample could blend with the circles and either
    // hide a real qualifying market or manufacture a false qualification.
    // Prefer the displayed distribution whenever it is available; only use
    // the private window while the chart has not populated its circles yet.
    const distributionCandidates = circlePcts?.length === 10
        ? [{ values: circlePcts, source: 'chart distribution' }]
        : [
            { values: blendedPcts, source: 'combined live/chart distribution' },
            { values: windowPcts, source: '50-tick distribution' },
        ];
    const distribution = distributionCandidates.find(candidate => distributionQualifies(candidate.values));
    if (!distribution) return null;
    const pcts = distribution.values;

    const conditionMet = lowRunLength(pcts) >= requiredLowRun;
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
    const entryDigit = chooseEntryDigit(side, barrier, pcts);
    const flow = analyzeEntryFlow(digits, entryDigit, side, barrier, symbol, candidates);
    const selectedDuration = [...tests].sort((a, b) => {
        const flowA = flow.scores.find(item => item.duration === a.duration)?.winRate ?? 0;
        const flowB = flow.scores.find(item => item.duration === b.duration)?.winRate ?? 0;
        return (flowB * 0.55 + b.safeRate * 0.3 + b.winRate * 0.15)
            - (flowA * 0.55 + a.safeRate * 0.3 + a.winRate * 0.15);
    })[0] ?? best;
    return {
        side,
        barrier,
        duration: selectedDuration.duration,
        confidence,
        expectedDigit: best.expectedDigit,
        entryDigit,
        flow,
        entryType: side === 'over' ? 'DIGITOVER' : 'DIGITUNDER',
        requiresReferenceEntry: group?.id === 'over_under',
        patternRequired: false,
        marketQualified: true,
            conditionPct: Math.max(...losing.map(d => pcts[d] ?? 0)),
        threshold,
        note: `${groupSideLabel(group, side)} ${barrier} · entries ${validEntries.join(', ')} · best winning digit ${bestWinningDigit} at ${bestWinningPct.toFixed(1)}% · ${distribution.source}${shieldIsBest ? ' · shield preferred' : ' · shield optional'} · ${selectedDuration.duration} ticks from entry-flow confirmation · ${Math.round(best.winRate * 100)}% historical wins`,
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
    // condition. The live flow analysis is the confirmation safety check;
    // no fixed “strong digit” list can block a valid barrier.
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

export function touchMatches(
    signal: any,
    digit: number | null,
    previousDigit: number | null,
    prices: number[] = [],
) {
    if (!signal || digit == null) return false;
    const type = signal.entryType || '';
    const barrier = Number(signal.barrier);
    const previousPrice = prices[prices.length - 2];
    const currentPrice = prices[prices.length - 1];
    const priceDelta = Number.isFinite(previousPrice) && Number.isFinite(currentPrice)
        ? currentPrice - previousPrice
        : 0;

    if (type === 'DIGITOVER' || (signal.side === 'over' && signal.requiresReferenceEntry)) {
        return digit >= 0 && digit <= barrier;
    }
    if (type === 'DIGITUNDER' || (signal.side === 'under' && signal.requiresReferenceEntry)) {
        return digit >= barrier && digit <= 9;
    }
    if (type === 'DIGITEVEN') return digit % 2 === 0;
    if (type === 'DIGITODD') return digit % 2 !== 0;
    if (type === 'DIGITMATCH') return signal.expectedDigit == null
        ? digit === previousDigit
        : digit === Number(signal.expectedDigit);
    if (type === 'DIGITDIFF') return signal.expectedDigit == null
        ? digit !== previousDigit
        : digit !== Number(signal.expectedDigit);
    if (isUpEntryType(type)) return priceDelta > 0;
    if (isDownEntryType(type)) return priceDelta < 0;
    return signal.side === 'over' ? digit > barrier : digit < barrier;
}

export function touchStrategyMatches(
    signal: any,
    digits: number[],
    currentDigit: number | null,
    strategies: string[],
    group: any = null,
    prices: number[] = [],
) {
    if (!signal || currentDigit == null) return false;
    const previousDigit = digits[digits.length - 2] ?? null;
    const pattern = patternSignal(group, signal.side, digits, prices);
    const previousPrice = prices[prices.length - 2];
    const currentPrice = prices[prices.length - 1];
    const delta = Number.isFinite(previousPrice) && Number.isFinite(currentPrice)
        ? currentPrice - previousPrice
        : 0;
    const type = signal.entryType || '';
    const momentum = previousDigit == null
        ? true
        : signal.side === 'over' ? currentDigit >= previousDigit : currentDigit <= previousDigit;
    const directional = isUpEntryType(type)
        ? delta > 0
        : isDownEntryType(type)
            ? delta < 0
            : true;
    const checks: Record<string, boolean> = {
        reversal: pattern.matched || directional,
        'tick-concept': momentum,
        'entry-loop': true,
        conservative: directional || pattern.matched,
        'number-losses': true,
        'digit-distribution': signal.marketQualified !== false,
        momentum,
    };
    const selected = strategies.length ? strategies : TICK_DEFAULT_STRATEGIES;
    const passed = selected.filter(id => checks[id]).length;
    return passed >= Math.max(1, Math.ceil(selected.length * 0.5));
}

export function countQualifyingTouches(
    signal: any,
    digits: number[],
    prices: number[] = [],
    strategies: string[] = TICK_DEFAULT_STRATEGIES,
    group: any = null,
) {
    return digits.reduce((count, digit, index) => {
        const priceWindow = prices.slice(0, index + 1);
        const previousDigit = digits[index - 1] ?? null;
        return count
            + (touchMatches(signal, digit, previousDigit, priceWindow)
                && touchStrategyMatches(
                    signal,
                    digits.slice(0, index + 1),
                    digit,
                    strategies,
                    group,
                    priceWindow,
                )
                ? 1
                : 0);
    }, 0);
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
    const [strategies, setStrategies] = useState(TICK_DEFAULT_STRATEGIES);
    const [allowA, setAllowA] = useState(true);
    const [allowB, setAllowB] = useState(true);
    const [runCount, setRunCount] = useState(0);
    const [lossCount, setLossCount] = useState(0);
    const [batchCount, setBatchCount] = useState(0);
    const [cooldown, setCooldown] = useState(0);
    const [refreshIn, setRefreshIn] = useState(0);
    const [popup, setPopup] = useState<any>(null);
    const [aiStake, setAiStake] = useState(Math.max(MIN_STAKE, stake));
    const [aiTicks, setAiTicks] = useState(clamp(Number(ticks) || 1, 1, MAX_CONFIRM_TICKS));
    const [bestTicks, setBestTicks] = useState<number | null>(null);
    const [executionMode, setExecutionMode] = useState<'ticks' | 'touches'>('ticks');
    const [confirmTouches, setConfirmTouches] = useState(TOUCH_CONFIRM_DEFAULT);
    const [confirmCount, setConfirmCount] = useState(0);
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
    const entryIndexRef = useRef(0);
    const entryUseCountRef = useRef(0);
    const entryFailureCountRef = useRef(0);
    const entryAnalysisTicksRef = useRef(0);
    const entryConfirmedRef = useRef(false);
    const entryWaitTicksRef = useRef(0);
    const confirmCountRef = useRef(0);
    const executionModeRef = useRef(executionMode);
    const confirmTouchesRef = useRef(confirmTouches);
    const lossStreakRef = useRef(0);
    const tradingFinishedRef = useRef(false);
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
    const strategiesRef = useRef(strategies);
    const allowARef = useRef(allowA);
    const allowBRef = useRef(allowB);

    const setPhase = (next: string) => {
        entryPhaseRef.current = next;
        setEntryPhase(next);
    };

    useEffect(() => { signalRef.current = signal; }, [signal]);
    useEffect(() => { strategiesRef.current = strategies; }, [strategies]);
    useEffect(() => { allowARef.current = allowA; }, [allowA]);
    useEffect(() => { allowBRef.current = allowB; }, [allowB]);
    useEffect(() => { executionModeRef.current = executionMode; }, [executionMode]);
    useEffect(() => { confirmTouchesRef.current = confirmTouches; }, [confirmTouches]);
    useEffect(() => {
        // A side toggle is a user command, not merely a display filter. If a
        // signal was already selected for a side the user just disabled,
        // discard it immediately so the next live tick can select only from
        // the remaining enabled side.
        const active = signalRef.current;
        const sideDisabled = active
            && ((active.side === 'over' && !allowA) || (active.side === 'under' && !allowB));
        if (enabled && sideDisabled) {
            signalRef.current = null;
            setSignal(null);
            setPhase('idle');
            setStatus('Selected side disabled · waiting for the enabled side');
        }
    }, [allowA, allowB, enabled]);
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

    useEffect(() => {
        if (!activeContractRef.current) {
            setAiTicks(clamp(Number(ticks) || 1, 1, MAX_CONFIRM_TICKS));
        }
    }, [ticks]);

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
        tradingFinishedRef.current = false;
        entryIndexRef.current = 0;
        entryUseCountRef.current = 0;
        entryFailureCountRef.current = 0;
        entryAnalysisTicksRef.current = 0;
        entryConfirmedRef.current = false;
        entryWaitTicksRef.current = 0;
        confirmCountRef.current = 0;
        reversePendingRef.current = false;
        setBestTicks(null);
        setConfirmCount(0);
        setPhase('idle');
        setEntryDigit(null);
        setScanning(true);
        scanActiveRef.current = true;
        setStatus(`${reason} · collecting live ticks 0/50`);
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        if (refreshClockRef.current) clearInterval(refreshClockRef.current);
        setRefreshIn(RESCAN_SECONDS);
    };

    const scheduleRefresh = () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        if (refreshClockRef.current) clearInterval(refreshClockRef.current);
        setRefreshIn(RESCAN_SECONDS);
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
                         if (
                             tradingFinishedRef.current
                             || !active
                             || activeContractRef.current
                             || cooldownRef.current > 0
                             || autoAttemptRef.current
                         ) return;

                         if (executionModeRef.current === 'touches') {
                             const previousDigit = digitsRef.current[digitsRef.current.length - 2] ?? null;
                             const touchHit = touchMatches(
                                 active,
                                 digit,
                                 previousDigit,
                                 pricesRef.current,
                             );
                             const strategyHit = touchStrategyMatches(
                                 active,
                                 digitsRef.current,
                                 digit,
                                 strategiesRef.current,
                                 group,
                                 pricesRef.current,
                             );
                             if (touchHit && strategyHit) {
                                 const nextCount = Math.min(
                                     confirmTouchesRef.current,
                                     confirmCountRef.current + 1,
                                 );
                                 confirmCountRef.current = nextCount;
                                 setConfirmCount(nextCount);
                                 if (nextCount >= confirmTouchesRef.current) {
                                     setPhase('waiting');
                                     setStatus(
                                         `${groupSideLabel(group, active.side)} ${active.barrier} · ` +
                                         `${nextCount}/${confirmTouchesRef.current} touch hits ready`,
                                     );
                                 } else {
                                     setPhase('confirming');
                                     setStatus(
                                         `Touch mode · ${nextCount}/${confirmTouchesRef.current} ` +
                                         `strategy-confirmed hits`,
                                     );
                                 }
                             } else {
                                 setPhase('confirming');
                                 setStatus(
                                     `Touch mode · ${confirmCountRef.current}/${confirmTouchesRef.current} ` +
                                     `hits · watching ${active.entryDigit ?? 'barrier side'}`,
                                 );
                             }
                             return;
                         }

                        if (entryDigitRef.current == null) {
                            entryDigitRef.current = active.entryDigit
                                ?? chooseEntryDigit(active.side, active.barrier, pctsFor(digitsRef.current), entryIndexRef.current);
                        }
                        const matches = entryMatches(
                            active,
                            digitsRef.current,
                            digit,
                            strategiesRef.current,
                            entryDigitRef.current,
                            group,
                            pricesRef.current,
                        );
                        setEntryDigit(entryDigitRef.current);
                         if (!entryConfirmedRef.current) {
                              // First observe 10–15 live ticks after the 50-tick
                             // scan. This phase analyses the flow after the
                             // selected entry digit and automatically edits the
                              // recommended contract duration.
                            entryAnalysisTicksRef.current = Math.min(
                                ENTRY_ANALYSIS_MAX_TICKS,
                                entryAnalysisTicksRef.current + 1,
                            );
                             const flow = analyzeEntryFlow(
                                 digitsRef.current,
                                 entryDigitRef.current,
                                 active.side,
                                 Number(active.barrier),
                                 symbol,
                                 durationCandidates(AUTO_TICK_LIMIT, true),
                             );
                             const recommendedTicks = clamp(
                                 Number(flow.duration) || Number(active.duration) || 1,
                                 1,
                                 MAX_CONFIRM_TICKS,
                             );
                             const analysedSignal = {
                                 ...active,
                                 duration: recommendedTicks,
                                 flow,
                                 note: `${active.note ?? ''} · best ${recommendedTicks} ticks from live entry flow`,
                             };
                             signalRef.current = analysedSignal;
                             setSignal(analysedSignal);
                             setBestTicks(recommendedTicks);
                             setAiTicks(recommendedTicks);
                             const hasFlowEvidence = flow.scores.some(score => score.attempts > 0);

                            if (
                                entryAnalysisTicksRef.current >= ENTRY_ANALYSIS_MIN_TICKS &&
                                 hasFlowEvidence
                            ) {
                                entryConfirmedRef.current = true;
                                entryWaitTicksRef.current = 0;
                                setPhase('confirming');
                                setStatus(
                                     `Best ${recommendedTicks} ticks confirmed from entry ${entryDigitRef.current} · ` +
                                     `watching next ${ENTRY_WAIT_MIN_TICKS}-${ENTRY_WAIT_MAX_TICKS} ticks`,
                                );
                                 // A live entry-point appearance is still the
                                 // execution trigger, but it is not a hit
                                 // counter and never changes the tick analysis.
                                if (matches) {
                                    setPhase('waiting');
                                     setStatus(`Best ${recommendedTicks} ticks confirmed · entry ready`);
                                }
                                return;
                            }

                            if (entryAnalysisTicksRef.current >= ENTRY_ANALYSIS_MAX_TICKS) {
                                entryAnalysisTicksRef.current = 0;
                                entryFailureCountRef.current += 1;
                                if (entryFailureCountRef.current >= ENTRY_FAILURE_LIMIT) {
                                    entryFailureCountRef.current = 0;
                                    entryIndexRef.current += 1;
                                }
                                entryDigitRef.current = chooseEntryDigit(
                                    active.side,
                                    active.barrier,
                                    pctsFor(digitsRef.current),
                                    entryIndexRef.current,
                                );
                                setEntryDigit(entryDigitRef.current);
                                setPhase('analysing');
                                setStatus(
                                    `10-${ENTRY_ANALYSIS_MAX_TICKS} tick flow checked · ` +
                                     `best ${recommendedTicks} ticks · watching entry ${entryDigitRef.current}`,
                                );
                                return;
                            }

                            setPhase('confirming');
                            setStatus(
                                `Analysing entry ${entryDigitRef.current ?? '—'} · ` +
                                 `best ${recommendedTicks} tick${recommendedTicks === 1 ? '' : 's'} · ` +
                                `${entryAnalysisTicksRef.current}/${ENTRY_ANALYSIS_MIN_TICKS}-${ENTRY_ANALYSIS_MAX_TICKS} ticks`,
                            );
                            return;
                        }

                        // Once the point has been confirmed, allow 6–10 ticks
                        // for the actual entry to appear. If it does not,
                        // reverse only when the user left the opposite side
                        // enabled; otherwise rotate within the user's side.
                        entryWaitTicksRef.current = Math.min(
                            ENTRY_WAIT_MAX_TICKS,
                            entryWaitTicksRef.current + 1,
                        );
                        if (matches) {
                            setPhase('waiting');
                            setStatus(`Entry ${entryDigitRef.current} appeared · ready`);
                            return;
                        }
                        if (entryWaitTicksRef.current < ENTRY_WAIT_MAX_TICKS) {
                            setPhase('confirming');
                            setStatus(
                                `Entry ${entryDigitRef.current ?? '—'} confirmed · ` +
                                `waiting ${entryWaitTicksRef.current}/${ENTRY_WAIT_MAX_TICKS} ticks`,
                            );
                            return;
                        }

                        const reverseSide = active.side === 'over' ? 'under' : 'over';
                        const reverseAllowed = reverseSide === 'over' ? allowARef.current : allowBRef.current;
                        if (reverseAllowed && !reversePendingRef.current) {
                            const reverseBarrier = Number(active.barrier);
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
                                note: `Reverse after ${ENTRY_WAIT_MIN_TICKS}-${ENTRY_WAIT_MAX_TICKS} ticks without entry`,
                            };
                            reversePendingRef.current = true;
                            signalRef.current = reverseSignal;
                            setSignal(reverseSignal);
                            entryIndexRef.current = 0;
                            entryDigitRef.current = reverseSignal.entryDigit;
                            entryAnalysisTicksRef.current = 0;
                            entryConfirmedRef.current = false;
                            entryWaitTicksRef.current = 0;
                            setEntryDigit(reverseSignal.entryDigit);
                            setPhase('analysing');
                            setStatus(`Reverse ${groupSideLabel(group, reverseSide)} selected · analysing ${reverseSignal.entryDigit}`);
                        } else {
                            entryIndexRef.current += 1;
                            entryDigitRef.current = chooseEntryDigit(
                                active.side,
                                active.barrier,
                                pctsFor(digitsRef.current),
                                entryIndexRef.current,
                            );
                            entryAnalysisTicksRef.current = 0;
                            entryConfirmedRef.current = false;
                            entryWaitTicksRef.current = 0;
                            setEntryDigit(entryDigitRef.current);
                            setPhase('analysing');
                            setStatus(`Entry window expired · rotating to ${entryDigitRef.current}`);
                        }
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
        }, [enabled, symbol, executionMode]);

    const windowPcts = useMemo(() => pctsFor(digitsRef.current), [sample]);
    const circlePcts = pcts.length ? pcts : windowPcts;

    useEffect(() => {
        if (!enabled || scanning || digitsRef.current.length < SCAN_SIZE || group?.isAccumulator) return;
        if (tradingFinishedRef.current) return;
        if (signalRef.current) return;
        const durationLimit = autoRotate ? AUTO_TICK_LIMIT : aiTicks;
        const candidates = [
            allowA && evaluateSide(digitsRef.current, pricesRef.current, pcts, 'over', barrier, durationLimit, autoRotate, symbol, group),
            allowB && evaluateSide(digitsRef.current, pricesRef.current, pcts, 'under', barrier, durationLimit, autoRotate, symbol, group),
        ].filter(Boolean);
        const next = candidates.sort((a, b) => b.confidence - a.confidence)[0] ?? null;
        signalRef.current = next;
        setSignal(next);
        defaultSignalRef.current = next;
        setBestTicks(next?.duration ?? null);
        setPhase(next ? 'analysing' : 'idle');
        setEntryDigit(next?.entryDigit ?? null);
        entryDigitRef.current = next?.entryDigit ?? null;
        if (next) {
            setStatus(
                `${groupSideLabel(group, next.side)} ${barrier} selected · ` +
                `analysing entry flow for best ${next.duration} ticks`,
            );
        } else {
            setStatus(`No ${marketThreshold(symbol).toFixed(1)}% condition yet · waiting for next tick`);
        }
    }, [enabled, scanning, sample, group, barrier, aiTicks, autoRotate, allowA, allowB, pcts, symbol]);

    useEffect(() => {
        if (!enabled || !signal || entryPhase !== 'waiting' || tradeBusy || activeContractRef.current || autoAttemptRef.current) return;
        if (runsEnabled && runCount >= runs) return;
        if (stopLossEnabled && lossCount >= stopLoss) return;
        autoAttemptRef.current = true;
        const duration = clamp(
            Number(signal.duration ?? aiTicks) || 1,
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
    }, [signal, entryPhase, enabled, tradeBusy, aiStake, autoRotate, aiTicks, runsEnabled, runCount, runs, stopLossEnabled, lossCount, stopLoss]);

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
            lossStreakRef.current = won ? 0 : lossStreakRef.current + 1;

            const next = calculateNextAiStake({
                won,
                profit: Number(profit) || 0,
                activeStake: activeStakeRef.current,
                initialStake: initialStakeRef.current,
                fullMargin,
                fixedStake,
                martingaleEnabled,
                martingale,
            });

            // Rotate the reference entry after repeated completed trades or
            // failed windows. Touch mode keeps its own hit counter and never
            // shares confirmation state with tick-flow mode.
            if (won) {
                entryUseCountRef.current += 1;
                entryFailureCountRef.current = 0;
            }
            reversePendingRef.current = false;
            entryAnalysisTicksRef.current = 0;
            entryConfirmedRef.current = false;
            entryWaitTicksRef.current = 0;
            confirmCountRef.current = 0;
            setConfirmCount(0);
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
                signalRef.current = { ...settledSignal, entryDigit: rotatedEntry };
                setSignal(signalRef.current);
                setEntryDigit(rotatedEntry);
            }

            const nextBatch = batchCountRef.current + 1;
            batchCountRef.current = nextBatch;
            setBatchCount(nextBatch);
            const runLimitReached = runsEnabled && runCount + 1 >= runs;
            const stopLossReached = stopLossEnabled && lossCount + (won ? 0 : 1) >= stopLoss;
            const batchComplete = nextBatch >= batchLimit;
            const lossRescanReached = !won
                && lossStreakRef.current >= LOSS_RESCAN_LIMIT
                && !runLimitReached
                && !stopLossReached;

            if (lossRescanReached) {
                const lossStreak = lossStreakRef.current;
                lossStreakRef.current = 0;
                recoveryPendingRef.current = false;
                tradingFinishedRef.current = false;
                signalRef.current = null;
                defaultSignalRef.current = null;
                setSignal(null);
                setBestTicks(null);
                setPhase('idle');
                batchCountRef.current = 0;
                setBatchCount(0);
                cooldownRef.current = 0;
                setCooldown(0);
                beginScan(`${lossStreak} consecutive losses · rescanning market`);
            } else if (!won && recovery !== 'off' && !recoveryPendingRef.current && !runLimitReached && !stopLossReached) {
                recoveryPendingRef.current = true;
                const recoverySide = recovery.startsWith('over') ? 'over' : 'under';
                const recoveryBarrier = Number(recovery.replace(/\D/g, ''))
                    || (recoverySide === 'over' ? 3 : 6);
                const baseSignal = defaultSignalRef.current;
                const durationLimit = autoRotate ? AUTO_TICK_LIMIT : aiTicks;
                const scannedRecovery = evaluateSide(
                    digitsRef.current,
                    pricesRef.current,
                    pcts,
                    recoverySide,
                    recoveryBarrier,
                    durationLimit,
                    autoRotate,
                    symbol,
                    group,
                );
                const recoverySource = scannedRecovery ?? baseSignal ?? {};
                const recoverySignal = {
                    ...recoverySource,
                    side: recoverySide,
                    barrier: recoveryBarrier,
                    recoveryBarrier,
                    duration: scannedRecovery?.duration ?? baseSignal?.duration ?? aiTicks,
                    confidence: Number(recoverySource.confidence) || 60,
                    marketQualified: true,
                    entryType: scannedRecovery?.entryType
                        ?? (recoverySide === 'over' ? 'DIGITOVER' : 'DIGITUNDER'),
                    requiresReferenceEntry: group?.id === 'over_under',
                    entryDigit: scannedRecovery?.entryDigit
                        ?? chooseEntryDigit(
                            recoverySide,
                            recoveryBarrier,
                            pctsFor(digitsRef.current),
                            0,
                        ),
                    note: `Best ${recoverySide === 'over' ? 'Over' : 'Under'} ${recoveryBarrier} recovery · ` +
                        `entry and ${scannedRecovery?.duration ?? baseSignal?.duration ?? aiTicks} ticks rescanned`,
                };
                signalRef.current = recoverySignal;
                setSignal(recoverySignal);
                setBestTicks(recoverySignal.duration);
                entryIndexRef.current = 0;
                entryDigitRef.current = recoverySignal.entryDigit;
                entryAnalysisTicksRef.current = 0;
                entryConfirmedRef.current = false;
                entryWaitTicksRef.current = 0;
                setEntryDigit(recoverySignal.entryDigit);
                setPhase(executionModeRef.current === 'touches' ? 'confirming' : 'analysing');
                setStatus(
                    `Recovery ${recoverySide === 'over' ? 'Over' : 'Under'} ${recoveryBarrier} · ` +
                    `best entry ${recoverySignal.entryDigit ?? '—'} · best ${recoverySignal.duration} ticks`,
                );
            } else if (won && recoveryPendingRef.current) {
                recoveryPendingRef.current = false;
                const restoredSignal = defaultSignalRef.current;
                signalRef.current = restoredSignal;
                setSignal(restoredSignal);
                setBestTicks(restoredSignal?.duration ?? null);
                entryDigitRef.current = restoredSignal?.entryDigit ?? null;
                setEntryDigit(entryDigitRef.current);
            }

            if (runLimitReached || stopLossReached) {
                tradingFinishedRef.current = true;
                signalRef.current = null;
                setSignal(null);
                setPhase('idle');
                setAiStake(next);
                setStatus(won ? 'Run limit reached · AI stopped' : 'Stop-loss reached · AI stopped');
            } else if (lossRescanReached) {
                setAiStake(next);
                setStatus('Loss streak reached · fresh market scan running');
            } else if (batchComplete) {
                // A new Full Margin batch starts from the user's initial stake;
                // reinvestment is only carried through the current batch.
                const batchStartStake = Math.max(MIN_STAKE, initialStakeRef.current);
                setAiStake(batchStartStake);
                activeStakeRef.current = batchStartStake;
                batchCountRef.current = 0;
                setBatchCount(0);
                cooldownRef.current = COOLDOWN_TICKS;
                setCooldown(COOLDOWN_TICKS);
                signalRef.current = null;
                setSignal(null);
                setPhase('idle');
                setStatus(`Batch complete · cooling off ${COOLDOWN_TICKS} ticks`);
            } else {
                setAiStake(next);
                setPhase('analysing');
                setEntryDigit(entryDigitRef.current);
                setStatus(won ? 'Profit · searching for a fresh entry' : 'Loss · searching for a fresh entry');
            }
        };
        window.addEventListener('chart:trade-settled', onSettlement as any);
        return () => window.removeEventListener('chart:trade-settled', onSettlement as any);
    }, [enabled, fullMargin, fixedStake, martingaleEnabled, martingale, runsEnabled, runs, stopLossEnabled, stopLoss, runCount, lossCount, recovery, batchLimit]);

    const threshold = marketThreshold(symbol);
    const sideA = groupSideLabel(group, 'over');
    const sideB = groupSideLabel(group, 'under');
    const phaseLabel = {
        idle: 'Waiting for a qualifying market',
        confirming: executionMode === 'touches'
            ? `Touch hits ${confirmCount}/${confirmTouches} · ${entryDigit ?? 'barrier side'}`
            : `Best ${bestTicks ?? '—'} ticks confirmed · waiting for entry ${entryDigit ?? '—'}`,
        analysing: `Analysing 10-${ENTRY_ANALYSIS_MAX_TICKS} tick flow${entryDigit == null ? '' : ` · entry ${entryDigit}`}`,
        waiting: executionMode === 'touches'
            ? `Touch target ${confirmTouches} reached · ${bestTicks ?? signal?.duration ?? '—'} tick duration`
            : `Entry ${entryDigit ?? '—'} ready · ${bestTicks ?? '—'} tick duration`,
    }[entryPhase] ?? status;

    const commitAiStake = (value: number) => {
        const next = Number(clamp(Number(value) || MIN_STAKE, MIN_STAKE, 100000).toFixed(2));
        userStakeRef.current = next;
        initialStakeRef.current = next;
        setAiStake(next);
    };

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
                        {signal && (
                            <span>
                                {`Best entry: ${signal.entryDigit ?? 'watching'}`}
                                {' · '}{bestTicks ?? signal.duration} tick{(bestTicks ?? signal.duration) === 1 ? '' : 's'} · condition ≤ {threshold.toFixed(1)}%
                            </span>
                        )}
                        <span className='chart-ai__entry-map'>
                            {signal?.requiresReferenceEntry
                                ? `${groupSideLabel(group, signal.side)} ${signal.barrier} entries: ${validBarrierEntries(signal.side, signal.barrier).join(' · ')}`
                                : `${groupSideLabel(group, signal?.side ?? 'over')} entry confirmation follows the selected contract pattern`
                            }
                        </span>
                        {signal?.flow && (
                            <span className='chart-ai__flow'>
                                Flow: {signal.flow.offset ? `skip ${signal.flow.skippedDigit ?? 'setup'} · ` : ''}
                                {signal.flow.flow.length ? signal.flow.flow.join(' → ') : 'collecting next ticks'}
                                {' · '}best {signal.duration} ticks
                            </span>
                        )}
                        <span className='chart-ai__circle-readout'>
                            Circle distribution: {circlePcts.map((v, i) => `${i} ${v.toFixed(1)}%`).join(' · ')}
                        </span>
                    </div>
                    <div className='chart-ai__mode-picker' role='group' aria-label='AI execution mode'>
                        <span className='chart-ai__strategy-label'>Execution mode</span>
                        <button
                            type='button'
                            className={executionMode === 'ticks' ? 'active' : ''}
                            onClick={() => {
                                setExecutionMode('ticks');
                                confirmCountRef.current = 0;
                                setConfirmCount(0);
                            }}
                        >
                            Ticks · entry points
                        </button>
                        <button
                            type='button'
                            className={executionMode === 'touches' ? 'active' : ''}
                            onClick={() => {
                                setExecutionMode('touches');
                                confirmCountRef.current = 0;
                                setConfirmCount(0);
                            }}
                        >
                            Touches · count hits
                        </button>
                    </div>
                    <div className='chart-ai__toggles'>
                        <button className={autoRotate ? 'active' : ''} onClick={() => setAutoRotate(v => !v)}>Auto ticks {autoRotate ? 'ON' : 'OFF'}</button>
                        <button className={fullMargin ? 'active' : ''} onClick={() => setFullMargin(v => { if (!v) setFixedStake(false); return !v; })}>Full margin {fullMargin ? 'ON' : 'OFF'}</button>
                        <button className={fixedStake ? 'active' : ''} onClick={() => setFixedStake(v => { if (!v) setFullMargin(false); return !v; })}>Fixed stake {fixedStake ? 'ON' : 'OFF'}</button>
                        <button className={runsEnabled ? 'active' : ''} onClick={() => setRunsEnabled(v => !v)}>Runs {runsEnabled ? 'ON' : 'OFF'}</button>
                        <button className={stopLossEnabled ? 'active' : ''} onClick={() => setStopLossEnabled(v => !v)}>Stop loss {stopLossEnabled ? 'ON' : 'OFF'}</button>
                        <button className={martingaleEnabled ? 'active' : ''} onClick={() => setMartingaleEnabled(v => !v)}>Martingale {martingaleEnabled ? 'ON' : 'OFF'}</button>
                    </div>
                    <div className='chart-ai__settings'>
                        <label>{executionMode === 'touches' ? 'Best ticks' : 'Best ticks'}
                            <output className='chart-ai__auto-value' aria-label='Automatically selected best ticks'>
                                {bestTicks ?? '—'}
                            </output>
                        </label>
                        {executionMode === 'touches' && (
                            <label>hits
                                <input
                                    type='number'
                                    min={1}
                                    max={5}
                                    value={confirmTouches}
                                    onChange={e => {
                                        const next = clamp(Number(e.target.value) || TOUCH_CONFIRM_DEFAULT, 1, 5);
                                        confirmTouchesRef.current = next;
                                        setConfirmTouches(next);
                                        confirmCountRef.current = Math.min(confirmCountRef.current, next);
                                        setConfirmCount(confirmCountRef.current);
                                    }}
                                />
                            </label>
                        )}
                        <label>AI stake
                            <NumberField
                                value={aiStake}
                                onCommit={commitAiStake}
                                min={MIN_STAKE}
                                max={100000}
                                className='chart-ai__stake-field'
                                aria-label='AI stake'
                            />
                        </label>
                        <label>batch
                            <select value={batchLimit} onChange={e => setBatchLimit(Number(e.target.value))}>
                                {[3, 4].map(n => <option key={n} value={n}>{n} trades</option>)}
                            </select>
                        </label>
                        <label>recovery
                            <select value={recovery} onChange={e => setRecovery(e.target.value)}>
                                <option value='off'>Off</option>
                                <option value='over3'>Over 3</option>
                                <option value='under6'>Under 6</option>
                                <option value='over4'>Over 4</option>
                                <option value='under5'>Under 5</option>
                            </select>
                        </label>
                        <span className='chart-ai__stake-readout'>Next stake {aiStake.toFixed(2)}</span>
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