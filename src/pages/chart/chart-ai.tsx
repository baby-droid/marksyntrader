// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import './chart-ai.scss';

const MIN_STAKE = 0.35;
const MAX_CONFIRM_TICKS = 5;
const SCAN_SIZE = 50;
const RESCAN_MS = 120_000;
const COOLDOWN_TICKS = 10;

const ENTRY_POINTS = {
    // Entry groups from the supplied trading reference. These are entry
    // digits, not barriers: the selected barrier still decides the contract.
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
    const s = String(symbol).toUpperCase();
    if (/^1HZ|^JD|BEAR|BULL/.test(s)) return 10.6;
    if (/^R_/.test(s)) return 10.2;
    return 10.2;
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

function evaluateSide(
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
    // The chart's circle is a longer, independently maintained distribution.
    // Blend it in without changing the circle DOM or its moving pointer.
    const pcts = windowPcts.map((p, i) => p * 0.75 + (circlePcts?.[i] ?? p) * 0.25);
    const threshold = marketThreshold(symbol);
    if (!group?.needsBarrier) {
        const type = side === 'over' ? group?.typeA : group?.typeB;
        const duration = autoRotate ? [1, 2, 3, 4, 5][0] : clamp(selectedTicks, 1, MAX_CONFIRM_TICKS);
        let score = 0;
        let note = '50-tick market sample ready';
        let expectedDigit = null;
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
        if (score < 0.56) return null;
        return {
            side,
            barrier,
            duration,
            confidence: clamp(55 + score * 40, 55, 95),
            expectedDigit,
            entryDigit: null,
            requiresReferenceEntry: group?.id === 'over_under',
            conditionPct: score * 100,
            threshold,
            note,
        };
    }
    const losing = side === 'over'
        ? Array.from({ length: barrier + 1 }, (_, i) => i)
        : Array.from({ length: 10 - barrier }, (_, i) => barrier + i);
    const shield = side === 'over' ? barrier + 1 : barrier - 1;
    if (shield < 0 || shield > 9 || losing.length === 0) return null;
    const conditionMet = losing.every(d => pcts[d] <= threshold);
    const shieldPct = pcts[shield] ?? 0;
    if (!conditionMet || shieldPct < threshold) return null;

    const candidates = autoRotate
        ? [1, 2, 3, 4, 5]
        : [clamp(selectedTicks, 1, MAX_CONFIRM_TICKS)];
    const tests = candidates.map(duration => ({
        duration,
        ...backtestDigits(digits, side, barrier, duration),
    }));
    const best = [...tests].sort((a, b) =>
        (b.safeRate * 0.7 + b.winRate * 0.3) - (a.safeRate * 0.7 + a.winRate * 0.3)
    )[0];
    if (!best || best.winRate < 0.52) return null;

    const entry = ENTRY_POINTS[side];
    const confidence = clamp(
        54 + shieldPct + best.safeRate * 18 + best.winRate * 12
            + (entry.strong.includes(digits[digits.length - 1]) ? 7 : 0),
        55,
        98,
    );
    if (confidence < 60) return null;
    return {
        side,
        barrier,
        duration: best.duration,
        confidence,
        expectedDigit: best.expectedDigit,
        entryDigit: null,
        requiresReferenceEntry: group?.id === 'over_under',
        conditionPct: Math.max(...losing.map(d => pcts[d] ?? 0)),
        threshold,
        note: `${groupSideLabel(group, side)} ${barrier} · max condition ${Math.max(...losing.map(d => pcts[d] ?? 0)).toFixed(1)}% · ${Math.round(best.winRate * 100)}% historical wins`,
    };
}

function entryMatches(
    signal: any,
    digits: number[],
    currentDigit: number | null,
    strategies: string[],
) {
    if (currentDigit == null || !digits.length) return false;
    const side = signal.side;
    const entry = ENTRY_POINTS[side];
    const previous = digits[digits.length - 2];
    const strong = entry.strong.includes(currentDigit);
    const weak = entry.weak.includes(currentDigit);
    const momentum = previous == null
        ? true
        : side === 'over' ? currentDigit >= previous : currentDigit <= previous;
    // Never enter on a weak digit. A weak digit can be useful context during
    // analysis, but it is not an entry trigger. This is especially important
    // when the user enables only one side (for example Over with barrier 2).
    const checks: Record<string, boolean> = {
        reversal: strong,
        'tick-concept': previous == null || currentDigit !== previous,
        'entry-loop': strong || weak,
        conservative: strong && Math.abs(currentDigit - signal.barrier) >= 2,
        'number-losses': true,
        'digit-distribution': signal.conditionPct <= signal.threshold,
        momentum,
    };
    // The supplied entry map is specifically for Over/Under. Never enter an
    // Over/Under trade on a weak digit; it must wait for a strong digit from
    // the selected side. Other contract groups retain their own checks.
    if (signal.requiresReferenceEntry && !strong) return false;
    const selected = strategies.length ? strategies : ['reversal', 'tick-concept', 'entry-loop'];
    const passed = selected.filter(id => checks[id]).length;
    return passed >= Math.max(1, Math.ceil(selected.length * 0.66));
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
    const [confirmTicks, setConfirmTicks] = useState(2);
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
    const signalRef = useRef<any>(null);
    const entryPhaseRef = useRef('idle');
    const entryDigitRef = useRef<number | null>(null);
    const confirmCountRef = useRef(0);
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
    const confirmTicksRef = useRef(confirmTicks);

    const setPhase = (next: string) => {
        entryPhaseRef.current = next;
        setEntryPhase(next);
    };

    useEffect(() => { signalRef.current = signal; }, [signal]);
    useEffect(() => { strategiesRef.current = strategies; }, [strategies]);
    useEffect(() => { confirmTicksRef.current = confirmTicks; }, [confirmTicks]);
    useEffect(() => {
        if (enabled) setAiStake(Math.max(MIN_STAKE, stake));
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
                        const matches = entryMatches(active, digitsRef.current, digit, strategiesRef.current);
                        if (!matches) {
                            setPhase('analysing');
                            setEntryDigit(digit);
                            setConfirmCount(0);
                            confirmCountRef.current = 0;
                            entryDigitRef.current = null;
                            setStatus(`Analysing entry point · ${digit}`);
                            return;
                        }
                        setEntryDigit(digit);
                        if (entryDigitRef.current !== digit) {
                            entryDigitRef.current = digit;
                            confirmCountRef.current = 1;
                        } else {
                            confirmCountRef.current = Math.min(confirmTicksRef.current, confirmCountRef.current + 1);
                        }
                        setConfirmCount(confirmCountRef.current);
                        if (confirmCountRef.current >= confirmTicksRef.current) {
                            setPhase('waiting');
                            setStatus(`Waiting to execute · ${digit} · ${active.duration} tick${active.duration === 1 ? '' : 's'}`);
                        } else {
                            setPhase('confirming');
                            setStatus(`Confirming ${digit} · ${confirmCountRef.current}/${confirmTicksRef.current} ticks`);
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
        const duration = autoRotate ? signal.duration : clamp(ticks, 1, MAX_CONFIRM_TICKS);
        const nextStake = Math.max(MIN_STAKE, aiStake);
        const recoveryBarrier = signal.recoveryBarrier;
        activeStakeRef.current = nextStake;
        setPopup({ ...signal, duration, recovery: !!recoveryBarrier });
        const timer = setTimeout(() => setPopup(null), 4500);
        onAutoTrade(signal.side, duration, nextStake, recoveryBarrier).then(id => {
            if (id != null) {
                activeContractRef.current = Number(id);
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

            let next = activeStakeRef.current;
            if (fullMargin) {
                if (won) {
                    next = next + Math.max(0, Number(profit) || 0);
                    ladderPeakRef.current = Math.max(ladderPeakRef.current, next);
                    if (next >= 2 && !ladderHadLossRef.current) {
                        ladderBaseRef.current = Number((ladderBaseRef.current + 0.1).toFixed(2));
                        next = ladderBaseRef.current;
                        ladderPeakRef.current = next;
                    }
                } else {
                    ladderHadLossRef.current = true;
                    ladderBaseRef.current = MIN_STAKE;
                    next = MIN_STAKE;
                    ladderPeakRef.current = MIN_STAKE;
                }
                if (won && next < 2) ladderHadLossRef.current = false;
            } else if (!won && fixedStake && martingaleEnabled) {
                next = next * Math.max(1, martingale);
            } else if (won || fixedStake) {
                next = Math.max(MIN_STAKE, stake);
            }
            next = Number(clamp(next, MIN_STAKE, 100000).toFixed(2));
            setAiStake(next);
            onStakeChange(next);

            const nextBatch = batchCountRef.current + 1;
            batchCountRef.current = nextBatch;
            setBatchCount(nextBatch);
            if (!won && recovery !== 'off' && !recoveryPendingRef.current) {
                recoveryPendingRef.current = true;
                const recoverySide = recovery === 'over4' ? 'over' : 'under';
                const recoveryBarrier = recovery === 'over4' ? 4 : 5;
                const baseSignal = defaultSignalRef.current;
                if (baseSignal) {
                    setSignal({
                        ...baseSignal,
                        side: recoverySide,
                        barrier: recoveryBarrier,
                        recoveryBarrier,
                        note: `Opposite recovery ${recoverySide === 'over' ? 'Over 4' : 'Under 5'} · fresh entry`,
                    });
                }
            } else if (won && recoveryPendingRef.current) {
                recoveryPendingRef.current = false;
                setSignal(defaultSignalRef.current);
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
                setEntryDigit(null);
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
                            Strong Over: 3 · 4 · 1 · 8 &nbsp;|&nbsp; Strong Under: 9 · 6 · 2 · 5
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
                            <select value={confirmTicks} onChange={e => setConfirmTicks(Number(e.target.value))}>
                                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} tick{n === 1 ? '' : 's'}</option>)}
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