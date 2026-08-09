// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import './chart-ai.scss';

const MIN_STAKE = 0.35;
const MAX_CONFIRM_TICKS = 5;

const ENTRY_POINTS = {
    over: { strong: [3, 4, 1], weak: [8, 7, 0] },
    under: { strong: [9, 6, 2], weak: [5] },
};

function digitFromPrice(price: number, pipSize: number) {
    const text = Number(price).toFixed(Math.max(0, pipSize));
    return Number(text[text.length - 1]);
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function groupSideLabel(group: any, side: 'over' | 'under') {
    const labels: Record<string, [string, string]> = {
        over_under: ['Over', 'Under'], even_odd: ['Even', 'Odd'],
        match_differ: ['Matches', 'Differs'], rise_fall: ['Rise', 'Fall'],
        higher_lower: ['Higher', 'Lower'], asian: ['Asian Up', 'Asian Down'],
        touch: ['Touch', 'No Touch'], run_high_low: ['Run High', 'Run Low'],
        reset: ['Reset Call', 'Reset Put'], ends_between: ['Ends In', 'Ends Out'],
        stays_between: ['Stays Between', 'Goes Outside'],
    };
    return labels[group?.id]?.[side === 'over' ? 0 : 1] ?? (side === 'over' ? 'A' : 'B');
}

type Signal = {
    side: 'over' | 'under';
    duration: number;
    confidence: number;
    expectedDigit: number | null;
    entryDigit: number | null;
    note: string;
};

function backtestDigits(
    digits: number[],
    side: 'over' | 'under',
    barrier: number,
    duration: number,
) {
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

function evaluateDigitSide(
    digits: number[],
    pcts: number[],
    side: 'over' | 'under',
    barrier: number,
    currentDigit: number | null,
    autoRotate: boolean,
    selectedTicks: number,
): Signal | null {
    if (digits.length < 50 || currentDigit == null) return null;
    const losing = side === 'over'
        ? Array.from({ length: barrier + 1 }, (_, i) => i)
        : Array.from({ length: 10 - barrier }, (_, i) => barrier + i);
    const shield = side === 'over' ? barrier + 1 : barrier - 1;
    if (shield < 0 || shield > 9) return null;
    const balanced = losing.some(d => (pcts[d] ?? 0) >= 10.2);
    const shieldPct = pcts[shield] ?? 0;
    if (balanced || shieldPct < 10.2) return null;

    const entry = ENTRY_POINTS[side];
    const isStrongEntry = entry.strong.includes(currentDigit);
    const isWeakEntry = entry.weak.includes(currentDigit);
    if (!isStrongEntry && !isWeakEntry) return null;

    const candidates = autoRotate
        ? [1, 2, 3, 4, 5]
        : [clamp(selectedTicks, 1, MAX_CONFIRM_TICKS)];
    const tests = candidates.map(duration => ({
        duration,
        ...backtestDigits(digits, side, barrier, duration),
    }));
    const best = [...tests].sort((a, b) => {
        const aScore = a.safeRate * 0.7 + a.winRate * 0.3;
        const bScore = b.safeRate * 0.7 + b.winRate * 0.3;
        return bScore - aScore;
    })[0];
    if (!best || best.winRate < 0.52) return null;

    const marketStrength = clamp(58 + (shieldPct - 10.2) * 15, 58, 84);
    const entryBonus = isStrongEntry ? 8 : 2;
    const confidence = clamp(
        marketStrength + best.safeRate * 18 + best.winRate * 12 + entryBonus - 18,
        55,
        98,
    );
    if (confidence < 60) return null;
    return {
        side,
        duration: best.duration,
        confidence,
        expectedDigit: best.expectedDigit,
        entryDigit: currentDigit,
        note: `${isStrongEntry ? 'Strong' : 'Weak'} entry ${currentDigit} · shield ${shield} at ${shieldPct.toFixed(1)}% · ${(best.safeRate * 100).toFixed(0)}% safe wins`,
    };
}

function evaluateGeneralSide(
    digits: number[],
    prices: number[],
    side: 'over' | 'under',
    group: any,
    selectedTicks: number,
) {
    if (digits.length < 50) return null;
    const type = side === 'over' ? group.typeA : group.typeB;
    const duration = clamp(selectedTicks, 1, MAX_CONFIRM_TICKS);
    let score = 0;
    let note = '';
    let expectedDigit: number | null = null;
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
        note = `${type === 'DIGITMATCH' ? 'digit' : 'digit'} ${selected} ${type === 'DIGITMATCH' ? 'dominates' : 'is rare'} in the window`;
    } else if (type === 'CALL' || type === 'PUT') {
        let up = 0;
        for (let i = 1; i < prices.length; i++) if (prices[i] > prices[i - 1]) up++;
        score = type === 'CALL' ? up / Math.max(1, prices.length - 1) : 1 - up / Math.max(1, prices.length - 1);
        note = `${(score * 100).toFixed(0)}% directional price confirmation`;
    } else {
        score = 0.5;
        note = '50-tick market sample ready';
    }
    if (score < 0.56) return null;
    return {
        side,
        duration,
        confidence: clamp(55 + score * 40, 55, 95),
        expectedDigit,
        entryDigit: digits[digits.length - 1] ?? null,
        note,
    } as Signal;
}

export interface ChartAiControlProps {
    symbol: string;
    group: any;
    barrier: number;
    currentDigit: number | null;
    ticks: number;
    durationUnit: string;
    stake: number;
    onStakeChange: (stake: number) => void;
    onAutoTrade: (side: 'over' | 'under', ticks: number, stake: number) => Promise<number | null>;
    tradeBusy?: boolean;
}

export const ChartAiControl: React.FC<ChartAiControlProps> = ({
    symbol, group, barrier, currentDigit, ticks, durationUnit, stake, onStakeChange, onAutoTrade, tradeBusy,
}) => {
    const [enabled, setEnabled] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [sample, setSample] = useState(0);
    const [signal, setSignal] = useState<Signal | null>(null);
    const [status, setStatus] = useState('AI is off');
    const [autoRotate, setAutoRotate] = useState(true);
    const [fullMargin, setFullMargin] = useState(false);
    const [fixedStake, setFixedStake] = useState(true);
    const [runsEnabled, setRunsEnabled] = useState(false);
    const [runs, setRuns] = useState(3);
    const [stopLossEnabled, setStopLossEnabled] = useState(false);
    const [stopLoss, setStopLoss] = useState(3);
    const [martingaleEnabled, setMartingaleEnabled] = useState(false);
    const [martingale, setMartingale] = useState(2);
    const [allowA, setAllowA] = useState(true);
    const [allowB, setAllowB] = useState(true);
    const [runCount, setRunCount] = useState(0);
    const [lossCount, setLossCount] = useState(0);
    const [popup, setPopup] = useState<Signal | null>(null);
    const [aiStake, setAiStake] = useState(Math.max(MIN_STAKE, stake));
    const digitsRef = useRef<number[]>([]);
    const pricesRef = useRef<number[]>([]);
    const pipRef = useRef<number | null>(null);
    const subscriptionRef = useRef<any>(null);
    const subscriptionIdRef = useRef<string | null>(null);
    const activeContractRef = useRef<number | null>(null);
    const activeStakeRef = useRef(aiStake);
    const autoAttemptRef = useRef(false);
    const scanEpochRef = useRef(0);

    useEffect(() => {
        if (!enabled) return;
        setAiStake(Math.max(MIN_STAKE, stake));
    }, [stake, enabled]);

    const stopStream = () => {
        subscriptionRef.current?.unsubscribe?.();
        subscriptionRef.current = null;
        if (subscriptionIdRef.current && api_base.api) {
            try { api_base.api.send({ forget: subscriptionIdRef.current }).catch(() => {}); } catch {}
        }
        subscriptionIdRef.current = null;
    };

    useEffect(() => {
        if (!enabled) {
            stopStream();
            return;
        }
        let alive = true;
        const epoch = ++scanEpochRef.current;
        digitsRef.current = [];
        pricesRef.current = [];
        pipRef.current = null;
        setSample(0);
        setSignal(null);
        setScanning(true);
        setStatus('Connecting to the live market…');
        const start = () => {
            if (!alive || epoch !== scanEpochRef.current) return;
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
                        if (!Number.isFinite(price)) return;
                        const digit = digitFromPrice(price, pipRef.current ?? 2);
                        pricesRef.current = [...pricesRef.current, price].slice(-50);
                        digitsRef.current = [...digitsRef.current, digit].slice(-50);
                        setSample(digitsRef.current.length);
                        if (digitsRef.current.length < 50) {
                            setStatus(`Scanning active ticks… ${digitsRef.current.length}/50`);
                            return;
                        }
                        setScanning(false);
                        setStatus('50 ticks ready · waiting for confirmation');
                    },
                    error: () => { if (alive) setStatus('Market stream paused · retrying…'); },
                });
                // History is requested after subscribing so the live pip_size is authoritative.
                const ps = pipRef.current ?? Number(api_base.pip_sizes?.[symbol] ?? 2);
                api.send({ ticks_history: symbol, count: 50, end: 'latest', style: 'ticks' }).then((res: any) => {
                    if (!alive || epoch !== scanEpochRef.current || digitsRef.current.length >= 50) return;
                    const prices = (res?.history?.prices ?? []).map(Number);
                    if (!prices.length) return;
                    pricesRef.current = prices.slice(-50);
                    digitsRef.current = pricesRef.current.map(p => digitFromPrice(p, pipRef.current ?? ps));
                    setSample(digitsRef.current.length);
                    if (digitsRef.current.length >= 50) {
                        setScanning(false);
                        setStatus('50 ticks ready · waiting for confirmation');
                    }
                }).catch(() => {});
            } catch {
                if (alive) setTimeout(start, 500);
            }
        };
        start();
        return () => { alive = false; stopStream(); };
    }, [enabled, symbol]);

    const pcts = useMemo(() => {
        const counts = Array.from({ length: 10 }, () => 0);
        digitsRef.current.forEach(d => counts[d]++);
        return counts.map(c => digitsRef.current.length ? c / digitsRef.current.length * 100 : 0);
    }, [sample]);

    useEffect(() => {
        if (!enabled || scanning || digitsRef.current.length < 50 || group?.isAccumulator) return;
        const digitGroup = group?.needsBarrier;
        const candidates = [
            allowA && (digitGroup
                ? evaluateDigitSide(digitsRef.current, pcts, 'over', barrier, currentDigit, autoRotate, ticks)
                : evaluateGeneralSide(digitsRef.current, pricesRef.current, 'over', group, ticks)),
            allowB && (digitGroup
                ? evaluateDigitSide(digitsRef.current, pcts, 'under', barrier, currentDigit, autoRotate, ticks)
                : evaluateGeneralSide(digitsRef.current, pricesRef.current, 'under', group, ticks)),
        ].filter(Boolean) as Signal[];
        const next = candidates.sort((a, b) => b.confidence - a.confidence)[0] ?? null;
        setSignal(next);
        if (next) setStatus(`${groupSideLabel(group, next.side)} confirmed · ${next.confidence.toFixed(0)}%`);
        else setStatus('No safe confirmation yet · collecting the next tick');
    }, [enabled, scanning, sample, group, barrier, currentDigit, autoRotate, ticks, allowA, allowB, pcts]);

    useEffect(() => {
        if (!enabled || !signal || tradeBusy || activeContractRef.current || autoAttemptRef.current) return;
        if (runsEnabled && runCount >= runs) return;
        if (stopLossEnabled && lossCount >= stopLoss) return;
        autoAttemptRef.current = true;
        const duration = autoRotate ? signal.duration : clamp(ticks, 1, MAX_CONFIRM_TICKS);
        const nextStake = Math.max(MIN_STAKE, aiStake);
        activeStakeRef.current = nextStake;
        setPopup({ ...signal, duration });
        const timer = setTimeout(() => setPopup(null), 4500);
        onAutoTrade(signal.side, duration, nextStake).then(id => {
            if (id != null) {
                activeContractRef.current = Number(id);
                setStatus(`${groupSideLabel(group, signal.side)} fired · ${duration} tick${duration === 1 ? '' : 's'}`);
            } else {
                autoAttemptRef.current = false;
                setPopup(null);
            }
        }).catch(() => { autoAttemptRef.current = false; setPopup(null); });
        return () => clearTimeout(timer);
    }, [signal, enabled, tradeBusy, aiStake, autoRotate, ticks, runsEnabled, runCount, runs, stopLossEnabled, lossCount, stopLoss]);

    useEffect(() => {
        const onSettlement = (event: any) => {
            if (!enabled || !activeContractRef.current) return;
            if (event.detail?.contractId != null && Number(event.detail.contractId) !== activeContractRef.current) return;
            const { won, profit } = event.detail ?? {};
            activeContractRef.current = null;
            autoAttemptRef.current = false;
            setSignal(null);
            setRunCount(v => v + 1);
            if (!won) setLossCount(v => v + 1);
            const current = activeStakeRef.current;
            let next = current;
            if (won) {
                if (fullMargin && !fixedStake) next = current + Math.max(0, Number(profit) || 0);
                else next = Math.max(MIN_STAKE, stake);
            } else if (fixedStake && martingaleEnabled) {
                next = current * Math.max(1, martingale);
            } else if (fixedStake) {
                next = Math.max(MIN_STAKE, stake);
            }
            next = Number(clamp(next, MIN_STAKE, 100000).toFixed(2));
            setAiStake(next);
            onStakeChange(next);
            if ((runsEnabled && runCount + 1 >= runs) || (stopLossEnabled && lossCount + (won ? 0 : 1) >= stopLoss)) {
                setEnabled(false);
                setStatus(won ? 'Run limit reached · AI stopped' : 'Stop-loss reached · AI stopped');
            } else {
                setStatus(won ? 'Won · rescanning 50 ticks' : 'Lost · rescanning before next trade');
            }
        };
        window.addEventListener('chart:trade-settled', onSettlement as any);
        return () => window.removeEventListener('chart:trade-settled', onSettlement as any);
    }, [enabled, fullMargin, fixedStake, martingaleEnabled, martingale, stake, runsEnabled, runs, stopLossEnabled, stopLoss, runCount, lossCount, onStakeChange]);

    const toggle = (setter: any, value: boolean) => setter(!value);
    const disabledForMarket = /^RDBEAR$|^RDBULL$|^BOOM|^CRASH|^RB/.test(symbol) && group?.needsBarrier;
    const sideA = groupSideLabel(group, 'over');
    const sideB = groupSideLabel(group, 'under');

    return (
        <div className={`chart-ai${enabled ? ' chart-ai--active' : ''}`}>
            {popup && (
                <div className='chart-ai__popup'>
                    <strong>🤖 AI {groupSideLabel(group, popup.side)} fired</strong>
                    <span>{popup.duration} tick{popup.duration === 1 ? '' : 's'} · expected win digit {popup.expectedDigit ?? '—'}</span>
                    <span>{popup.confidence.toFixed(0)}% confidence · {popup.note}</span>
                </div>
            )}
            <div className='chart-ai__head'>
                <button className={`chart-ai__power${enabled ? ' on' : ''}`} onClick={() => setEnabled(v => !v)} disabled={disabledForMarket}>
                    {enabled ? 'AI ON' : 'AI'}
                </button>
                <span className='chart-ai__title'>AI confirmation</span>
                <span className='chart-ai__status'>{disabledForMarket ? 'Digit AI unavailable on this market' : status}</span>
            </div>
            {enabled && (
                <>
                    <div className='chart-ai__scan'>
                        <span className={scanning ? 'pulse' : 'ready'} />
                        {scanning ? `Scanning 50 active ticks · ${sample}/50` : signal ? `${signal.confidence.toFixed(0)}% confirmed · ${signal.duration} ticks` : status}
                    </div>
                    <div className='chart-ai__toggles'>
                        <button className={autoRotate ? 'active' : ''} onClick={() => toggle(setAutoRotate, autoRotate)}>Auto tick rotate {autoRotate ? 'ON' : 'OFF'}</button>
                        <button className={fullMargin ? 'active' : ''} onClick={() => toggle(setFullMargin, fullMargin)}>Full margin {fullMargin ? 'ON' : 'OFF'}</button>
                        <button className={fixedStake ? 'active' : ''} onClick={() => toggle(setFixedStake, fixedStake)}>Fixed stake {fixedStake ? 'ON' : 'OFF'}</button>
                        <button className={runsEnabled ? 'active' : ''} onClick={() => toggle(setRunsEnabled, runsEnabled)}>Runs {runsEnabled ? 'ON' : 'OFF'}</button>
                        <button className={stopLossEnabled ? 'active' : ''} onClick={() => toggle(setStopLossEnabled, stopLossEnabled)}>Stop loss {stopLossEnabled ? 'ON' : 'OFF'}</button>
                        <button className={martingaleEnabled ? 'active' : ''} onClick={() => toggle(setMartingaleEnabled, martingaleEnabled)}>Martingale {martingaleEnabled ? 'ON' : 'OFF'}</button>
                    </div>
                    <div className='chart-ai__settings'>
                        {[
                            ['runs', runs, setRuns, 1, 100],
                            ['losses', stopLoss, setStopLoss, 1, 100],
                            ['× loss', martingale, setMartingale, 1, 10],
                        ].map(([label, value, setter, min, max]) => (
                            <label key={label}>{label}<input type='number' min={min} max={max} value={value} onChange={e => setter(clamp(Number(e.target.value) || min, min, max))} /></label>
                        ))}
                        <span className='chart-ai__stake-readout'>AI stake {aiStake.toFixed(2)}</span>
                    </div>
                    <div className='chart-ai__sides'>
                        <button className={allowA ? 'active' : ''} onClick={() => setAllowA(v => !v)}>{sideA} {allowA ? 'ON' : 'OFF'}</button>
                        <button className={allowB ? 'active' : ''} onClick={() => setAllowB(v => !v)}>{sideB} {allowB ? 'ON' : 'OFF'}</button>
                        <span>{runCount} run{runCount === 1 ? '' : 's'} · {lossCount} loss{lossCount === 1 ? '' : 'es'}</span>
                    </div>
                </>
            )}
        </div>
    );
};

export default ChartAiControl;