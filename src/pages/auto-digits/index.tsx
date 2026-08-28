// @ts-nocheck
/**
 * Auto-Digits
 *
 * A scanner-first digit workspace. Market data rides on useDerivTrade's
 * authenticated api_base connection; real contracts use buyContract so the
 * native Bot Builder transaction store receives the same bot.contract event
 * as every other trading surface.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/hooks/useStore';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import './auto-digits.scss';

const MARKETS = [
    { label: 'Volatility 10 (1s)', value: '1HZ10V' },
    { label: 'Volatility 25 (1s)', value: '1HZ25V' },
    { label: 'Volatility 50 (1s)', value: '1HZ50V' },
    { label: 'Volatility 75 (1s)', value: '1HZ75V' },
    { label: 'Volatility 100 (1s)', value: '1HZ100V' },
    { label: 'Volatility 50', value: 'R_50' },
    { label: 'Volatility 100', value: 'R_100' },
    { label: 'Jump 50', value: 'JD50' },
    { label: 'Boom 500', value: 'BOOM500' },
    { label: 'Crash 500', value: 'CRASH500' },
];

const WINDOWS = [1000, 100, 50, 20] as const;
const MIN_STAKE = 0.35;

type Strategy = 'parity' | 'over-under' | 'differs' | 'rise-fall';
type Signal = {
    ready: boolean;
    type: string;
    label: string;
    barrier?: number;
    confidence: number;
    reason: string;
    side: 'even' | 'odd' | 'over' | 'under' | 'differs' | 'rise' | 'fall';
};
type TradeRow = {
    id: string;
    type: string;
    barrier?: number;
    stake: number;
    result: 'pending' | 'won' | 'lost';
    profit: number;
    time: string;
};
type VirtualRow = {
    id: string;
    label: string;
    result: 'WIN' | 'LOSS' | 'WAIT';
};

const getDigit = (price: number, pipSize: number) => {
    const value = Number(price).toFixed(pipSize).replace('.', '');
    return Number(value[value.length - 1]);
};

const formatMoney = (value: number, currency: string) =>
    `${value >= 0 ? '+' : ''}${fromUsd(value).toFixed(2)} ${currency}`;

function rankColors(pcts: number[]) {
    const sorted = pcts
        .map((pct, digit) => ({ pct, digit }))
        .sort((a, b) => b.pct - a.pct || a.digit - b.digit);
    const colors = new Array(10).fill('plain');
    if (sorted.some(item => item.pct > 0)) {
        colors[sorted[0].digit] = 'green';
        colors[sorted[1].digit] = 'blue';
        colors[sorted[8].digit] = 'yellow';
        colors[sorted[9].digit] = 'red';
    }
    return colors;
}

function isSignalWin(signal: Signal, digit: number, previousDigit: number | null, quote: number, previousQuote: number | null) {
    switch (signal.type) {
        case 'DIGITEVEN': return digit % 2 === 0;
        case 'DIGITODD': return digit % 2 !== 0;
        case 'DIGITOVER': return digit > signal.barrier;
        case 'DIGITUNDER': return digit < signal.barrier;
        case 'DIGITDIFF': return digit !== signal.barrier;
        case 'CALL': return previousQuote != null && quote > previousQuote;
        case 'PUT': return previousQuote != null && quote < previousQuote;
        default: return previousDigit !== digit;
    }
}

const AutoDigits: React.FC = () => {
    const store = useStore();
    const { connected, authorized, balance, currency, send, subscribeTicks, buyContract } = useDerivTrade();
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
    const [symbol, setSymbol] = useState('1HZ100V');
    const [analysisWindow, setAnalysisWindow] = useState<number>(1000);
    const [strategy, setStrategy] = useState<Strategy>('parity');
    const [barrier, setBarrier] = useState(3);
    const [stake, setStake] = useState(0.5);
    const [duration, setDuration] = useState(1);
    const [digits, setDigits] = useState<number[]>([]);
    const [prices, setPrices] = useState<number[]>([]);
    const [currentDigit, setCurrentDigit] = useState<number | null>(null);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [connectedAt, setConnectedAt] = useState<number | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [scannerOn, setScannerOn] = useState(false);
    const [autoTrading, setAutoTrading] = useState(false);
    const [virtualRows, setVirtualRows] = useState<VirtualRow[]>([]);
    const [trades, setTrades] = useState<TradeRow[]>([]);
    const [sessionPnl, setSessionPnl] = useState(0);
    const [wins, setWins] = useState(0);
    const [losses, setLosses] = useState(0);
    const [validationMessage, setValidationMessage] = useState('Scanner idle — enable Scan to validate entries');

    const rawPricesRef = useRef<number[]>([]);
    const pipSizeRef = useRef(2);
    const latestEpochRef = useRef(0);
    const previousQuoteRef = useRef<number | null>(null);
    const previousDigitRef = useRef<number | null>(null);
    const virtualPendingRef = useRef<any>(null);
    const virtualStreakRef = useRef(0);
    const lastValidatedEpochRef = useRef(0);
    const tradeBusyRef = useRef(false);
    const runningStakeRef = useRef(stake);
    const strategyRef = useRef(strategy);
    const barrierRef = useRef(barrier);
    const scannerRef = useRef(scannerOn);
    const autoTradingRef = useRef(autoTrading);

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);
    useEffect(() => { if (connected) setConnectedAt(Date.now()); }, [connected]);
    useEffect(() => { runningStakeRef.current = stake; }, [stake]);
    useEffect(() => { strategyRef.current = strategy; }, [strategy]);
    useEffect(() => { barrierRef.current = barrier; }, [barrier]);
    useEffect(() => { scannerRef.current = scannerOn; }, [scannerOn]);
    useEffect(() => { autoTradingRef.current = autoTrading; }, [autoTrading]);

    const applyHistory = useCallback((raw: number[], pip: number) => {
        const next = raw
            .map(price => getDigit(Number(price), pip))
            .filter(digit => Number.isFinite(digit) && digit >= 0 && digit <= 9);
        setDigits(next.slice(-1000));
        setPrices(raw.slice(-80));
        if (next.length) setCurrentDigit(next[next.length - 1]);
        if (raw.length) setCurrentPrice(raw[raw.length - 1]);
    }, []);

    // Load the broad distribution through the same authenticated connection.
    useEffect(() => {
        let cancelled = false;
        setHistoryLoading(true);
        setDigits([]);
        setPrices([]);
        rawPricesRef.current = [];
        if (!authorized || !send) {
            setHistoryLoading(false);
            return () => { cancelled = true; };
        }
        (async () => {
            try {
                const response = await send({ ticks_history: symbol, count: 1000, end: 'latest', style: 'ticks' });
                if (cancelled) return;
                const raw = (response?.history?.prices || []).map(Number).filter(Number.isFinite);
                rawPricesRef.current = raw;
                applyHistory(raw, pipSizeRef.current);
            } catch {
                if (!cancelled) setValidationMessage('History unavailable — waiting for live ticks');
            } finally {
                if (!cancelled) setHistoryLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [authorized, send, symbol, applyHistory]);

    // useDerivTrade subscribes to api_base, so this also recovers with the app
    // connection after an authorization or reconnect event.
    useEffect(() => {
        const unsubscribe = subscribeTicks(symbol, tick => {
            if (tick.pip_size && tick.pip_size !== pipSizeRef.current) {
                pipSizeRef.current = tick.pip_size;
                if (rawPricesRef.current.length) applyHistory(rawPricesRef.current, tick.pip_size);
            }
            const digit = getDigit(tick.quote, pipSizeRef.current);
            rawPricesRef.current = [...rawPricesRef.current, tick.quote].slice(-1000);
            previousQuoteRef.current = currentPrice;
            previousDigitRef.current = currentDigit;
            latestEpochRef.current = tick.epoch;
            setCurrentPrice(tick.quote);
            setCurrentDigit(digit);
            setPrices(prev => [...prev.slice(-79), tick.quote]);
            setDigits(prev => [...prev, digit].slice(-1000));
        });
        return unsubscribe;
    }, [symbol, subscribeTicks, applyHistory]); // live values are intentionally refs/state snapshots

    const windowDigits = useMemo(() => digits.slice(-analysisWindow), [digits, analysisWindow]);
    const counts = useMemo(() => {
        const result = new Array(10).fill(0);
        windowDigits.forEach(digit => { if (digit >= 0 && digit <= 9) result[digit] += 1; });
        return result;
    }, [windowDigits]);
    const pcts = useMemo(() => counts.map(count => windowDigits.length ? count / windowDigits.length * 100 : 0), [counts, windowDigits.length]);
    const colors = useMemo(() => rankColors(pcts), [pcts]);
    const evenPct = pcts.filter((_, digit) => digit % 2 === 0).reduce((a, b) => a + b, 0);
    const oddPct = 100 - evenPct;
    const shortDigits = digits.slice(-20);
    const shortCounts = useMemo(() => {
        const result = new Array(10).fill(0);
        shortDigits.forEach(digit => { result[digit] += 1; });
        return result;
    }, [shortDigits]);
    const signal = useMemo<Signal>(() => {
        const recent = digits.slice(-10);
        if (!recent.length) return { ready: false, type: 'WAIT', label: 'Waiting for distribution', confidence: 0, reason: 'Collecting authenticated tick data', side: 'even' };
        if (strategy === 'parity') {
            const odds = recent.filter(digit => digit % 2 !== 0).length;
            const evens = recent.length - odds;
            const streak = recent.slice(-3);
            if (streak.length === 3 && streak.every(digit => digit % 2 !== 0)) {
                return { ready: true, type: 'DIGITEVEN', label: 'Even', confidence: 91, reason: 'Three consecutive odd ticks — reversal entry', side: 'even' };
            }
            if (streak.length === 3 && streak.every(digit => digit % 2 === 0)) {
                return { ready: true, type: 'DIGITODD', label: 'Odd', confidence: 91, reason: 'Three consecutive even ticks — reversal entry', side: 'odd' };
            }
            const dominant = evenPct >= oddPct ? 'even' : 'odd';
            const dominantPct = Math.max(evenPct, oddPct);
            const shortEven = shortDigits.filter(digit => digit % 2 === 0).length / Math.max(shortDigits.length, 1) * 100;
            const increasing = dominant === 'even' ? shortEven >= evenPct : (100 - shortEven) >= oddPct;
            return {
                ready: dominantPct >= 55 && increasing,
                type: dominant === 'even' ? 'DIGITEVEN' : 'DIGITODD',
                label: dominant === 'even' ? 'Even' : 'Odd',
                confidence: Math.min(99, Math.round(dominantPct + (increasing ? 12 : 0))),
                reason: `${dominantPct.toFixed(1)}% ${dominant} distribution${increasing ? ' and increasing' : ''}`,
                side: dominant,
            };
        }
        if (strategy === 'over-under') {
            const lowTouches = recent.filter(digit => digit <= barrier).length;
            const highTouches = recent.filter(digit => digit > barrier).length;
            const last = recent[recent.length - 1];
            if (lowTouches >= 2 && lowTouches <= 5 && last <= barrier) {
                return { ready: true, type: 'DIGITOVER', label: `Over ${barrier}`, barrier, confidence: 82, reason: `${lowTouches} touches in the losing region (0–${barrier}) — retention reversal`, side: 'over' };
            }
            if (highTouches >= 2 && highTouches <= 5 && last > barrier) {
                return { ready: true, type: 'DIGITUNDER', label: `Under ${barrier}`, barrier, confidence: 82, reason: `${highTouches} touches above ${barrier} — retention reversal`, side: 'under' };
            }
            return { ready: false, type: 'WAIT', label: `Over / Under ${barrier}`, barrier, confidence: Math.round(Math.max(lowTouches, highTouches) * 10), reason: 'Waiting for 2–5 confirmed region touches', side: 'over' };
        }
        if (strategy === 'differs') {
            const last = recent[recent.length - 1];
            const repeats = recent.slice(-4).filter(digit => digit === last).length;
            return {
                ready: repeats >= 2,
                type: 'DIGITDIFF',
                label: `Differs ${last}`,
                barrier: last,
                confidence: repeats >= 2 ? 84 : 42,
                reason: repeats >= 2 ? `${repeats} recent touches on ${last} — differs entry` : 'Waiting for a repeated digit touch',
                side: 'differs',
            };
        }
        const rising = prices.length >= 4 && prices.slice(-4).every((price, index, array) => index === 0 || price >= array[index - 1]);
        const falling = prices.length >= 4 && prices.slice(-4).every((price, index, array) => index === 0 || price <= array[index - 1]);
        return rising || falling
            ? { ready: true, type: rising ? 'CALL' : 'PUT', label: rising ? 'Rise' : 'Fall', confidence: 78, reason: `Four-tick ${rising ? 'up' : 'down'} momentum confirmed`, side: rising ? 'rise' : 'fall' }
            : { ready: false, type: 'WAIT', label: 'Rise / Fall', confidence: 36, reason: 'Waiting for four-tick momentum', side: 'rise' };
    }, [strategy, digits, prices, evenPct, oddPct, shortDigits, barrier]);

    const signalRef = useRef(signal);
    useEffect(() => { signalRef.current = signal; }, [signal]);

    const addVirtual = useCallback((row: VirtualRow) => {
        setVirtualRows(prev => [row, ...prev].slice(0, 5));
    }, []);

    const executeTrade = useCallback(async (entrySignal: Signal) => {
        if (!authorized || tradeBusyRef.current || entrySignal.type === 'WAIT') return;
        tradeBusyRef.current = true;
        const tradeId = `auto-digits-${Date.now()}`;
        const tradeStake = runningStakeRef.current;
        setValidationMessage(`Validated — sending ${entrySignal.label} through the account connection`);
        const row: TradeRow = {
            id: tradeId,
            type: entrySignal.type,
            barrier: entrySignal.barrier,
            stake: tradeStake,
            result: 'pending',
            profit: 0,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
        setTrades(prev => [row, ...prev].slice(0, 12));
        try {
            await buyContract({
                symbol,
                contract_type: entrySignal.type,
                duration,
                duration_unit: 't',
                stake: tradeStake,
                barrier: entrySignal.barrier,
                currency: currency || 'USD',
                metadata: {
                    source: 'Auto-Digits',
                    auto_digits: true,
                    batch_id: 'auto-digits-session',
                    signal_reason: entrySignal.reason,
                },
            }, settled => {
                const profit = Number(settled?.profit || 0);
                const result = settled?.status === 'won' ? 'won' : 'lost';
                setTrades(prev => prev.map(item => item.id === tradeId ? { ...item, result, profit } : item));
                setSessionPnl(prev => prev + profit);
                if (result === 'won') {
                    setWins(prev => prev + 1);
                    runningStakeRef.current = stake;
                    setStake(stake);
                    virtualStreakRef.current = 0;
                    setValidationMessage('Contract won — stake reset and scanner is validating the next clean entry');
                } else {
                    setLosses(prev => prev + 1);
                    const nextStake = Math.min(1000, Math.max(MIN_STAKE, tradeStake * 2));
                    runningStakeRef.current = nextStake;
                    setStake(nextStake);
                    virtualStreakRef.current = 0;
                    setValidationMessage(`Loss recorded — recovery stake ${fromUsd(nextStake).toFixed(2)} ${displayCur}; checking the opposite clean entry`);
                }
                tradeBusyRef.current = false;
            });
        } catch (error) {
            setTrades(prev => prev.map(item => item.id === tradeId ? { ...item, result: 'lost' } : item));
            setLosses(prev => prev + 1);
            tradeBusyRef.current = false;
            setValidationMessage(`Purchase failed — ${error?.message || 'the account connection rejected the request'}`);
        }
    }, [authorized, buyContract, currency, displayCur, duration, symbol]);

    // Two virtual confirmations are required before a real contract. A
    // virtual position is resolved by the next confirmed tick, not by a
    // fabricated random result.
    useEffect(() => {
        if (!scannerOn || currentDigit == null || !latestEpochRef.current) return;
        const epoch = latestEpochRef.current;
        const pending = virtualPendingRef.current;
        if (pending && pending.epoch !== epoch) {
            const won = isSignalWin(
                pending.signal,
                currentDigit,
                previousDigitRef.current,
                currentPrice,
                previousQuoteRef.current
            );
            addVirtual({ id: `v-${epoch}`, label: pending.signal.label, result: won ? 'WIN' : 'LOSS' });
            virtualPendingRef.current = null;
            virtualStreakRef.current = won ? virtualStreakRef.current + 1 : 0;
            setValidationMessage(won
                ? `Virtual validation ${virtualStreakRef.current}/2 passed — waiting for the next confirmed tick`
                : 'Virtual validation failed — restarting the two-step confirmation');
        }
        if (signal.ready && lastValidatedEpochRef.current !== epoch && !virtualPendingRef.current && !tradeBusyRef.current) {
            lastValidatedEpochRef.current = epoch;
            if (autoTrading && virtualStreakRef.current >= 2) {
                virtualStreakRef.current = 0;
                executeTrade(signal);
            } else {
                virtualPendingRef.current = { epoch, signal };
                addVirtual({ id: `v-wait-${epoch}`, label: signal.label, result: 'WAIT' });
                if (!autoTrading) setValidationMessage('Signal found — enable Auto Trade after validation to purchase');
            }
        }
    }, [currentDigit, currentPrice, scannerOn, autoTrading, signal, addVirtual, executeTrade]);

    const resetSession = () => {
        setTrades([]);
        setVirtualRows([]);
        setSessionPnl(0);
        setWins(0);
        setLosses(0);
        virtualPendingRef.current = null;
        virtualStreakRef.current = 0;
        setValidationMessage(scannerOn ? 'Scanner reset — collecting a fresh two-step validation' : 'Scanner idle — enable Scan to validate entries');
    };

    const topDigits = [...pcts.keys()].sort((a, b) => pcts[b] - pcts[a]).slice(0, 3);
    const lowDigits = [...pcts.keys()].sort((a, b) => pcts[a] - pcts[b]).slice(0, 3);
    const pressure = Math.max(evenPct, oddPct);
    const balanceLabel = Math.abs(evenPct - oddPct) < 3 ? 'BALANCED' : evenPct > oddPct ? 'EVEN PRESSURE' : 'ODD PRESSURE';
    const fmt = (value: number) => `${fromUsd(value).toFixed(2)} ${displayCur}`;
    const marketLabel = MARKETS.find(item => item.value === symbol)?.label || symbol;

    return (
        <div className='auto-digits'>
            <header className='auto-digits__header'>
                <div className='auto-digits__brand'>
                    <span className='auto-digits__brand-mark'>AD</span>
                    <div>
                        <h1>AUTO-DIGITS</h1>
                        <p>Intelligent digit distribution engine</p>
                    </div>
                </div>
                <div className='auto-digits__connection'>
                    <span className={`auto-digits__status-dot ${connected ? 'is-live' : ''}`} />
                    <div><strong>{connected ? 'Connected' : 'Offline'}</strong><small>{authorized ? 'Authenticated account' : 'Log in to trade'}</small></div>
                </div>
                <div className='auto-digits__header-actions'>
                    <span className='auto-digits__clock'>{connectedAt ? 'LIVE STREAM' : 'READY'}</span>
                    <button className='auto-digits__reset' onClick={resetSession}>Reset session</button>
                </div>
            </header>

            <div className='auto-digits__toolbar'>
                <label>
                    <span>MARKET</span>
                    <select value={symbol} onChange={event => setSymbol(event.target.value)}>
                        {MARKETS.map(market => <option key={market.value} value={market.value}>{market.label}</option>)}
                    </select>
                </label>
                <div className='auto-digits__window-picker'>
                    <span>ANALYSIS WINDOW</span>
                    <div>{WINDOWS.map(windowSize => (
                        <button key={windowSize} className={analysisWindow === windowSize ? 'is-active' : ''} onClick={() => setAnalysisWindow(windowSize)}>
                            {windowSize >= 1000 ? '1K' : windowSize}
                        </button>
                    ))}</div>
                </div>
                <label>
                    <span>STRATEGY</span>
                    <select value={strategy} onChange={event => setStrategy(event.target.value as Strategy)}>
                        <option value='parity'>Parity pattern scanner</option>
                        <option value='over-under'>Touch reversal / Over-Under</option>
                        <option value='differs'>Differs edge</option>
                        <option value='rise-fall'>Rise / Fall momentum</option>
                    </select>
                </label>
                {(strategy === 'over-under') && (
                    <label className='auto-digits__barrier'>
                        <span>BARRIER</span>
                        <input type='number' min='0' max='8' value={barrier} onChange={event => setBarrier(Math.max(0, Math.min(8, Number(event.target.value))))} />
                    </label>
                )}
                <div className='auto-digits__mode-buttons'>
                    <button className={`auto-digits__scan-toggle ${scannerOn ? 'is-on' : ''}`} onClick={() => setScannerOn(value => !value)}>
                        <span>{scannerOn ? '●' : '○'}</span> {scannerOn ? 'SCANNING' : 'START SCAN'}
                    </button>
                    <button className={`auto-digits__trade-toggle ${autoTrading ? 'is-on' : ''}`} onClick={() => setAutoTrading(value => !value)} disabled={!authorized}>
                        {autoTrading ? 'AUTO TRADE ON' : 'AUTO TRADE OFF'}
                    </button>
                </div>
            </div>

            <main className='auto-digits__grid'>
                <aside className='auto-digits__column auto-digits__column--left'>
                    <section className='ad-panel ad-account'>
                        <div className='ad-panel__title'>ACCOUNT OVERVIEW <span className='ad-panel__live'>● LIVE</span></div>
                        <div className='ad-account__balance'><small>Balance</small><strong>{balance == null ? '—' : fmt(balance)}</strong></div>
                        <div className='ad-stat-grid'>
                            <div><span>Session P/L</span><strong className={sessionPnl >= 0 ? 'positive' : 'negative'}>{formatMoney(sessionPnl, displayCur)}</strong></div>
                            <div><span>Win rate</span><strong>{wins + losses ? `${Math.round(wins / (wins + losses) * 100)}%` : '—'}</strong></div>
                            <div><span>Wins</span><strong className='positive'>{wins}</strong></div>
                            <div><span>Losses</span><strong className='negative'>{losses}</strong></div>
                        </div>
                    </section>
                    <section className='ad-panel ad-recovery'>
                        <div className='ad-panel__title'>LOSS RECOVERY ENGINE <span className='ad-panel__gear'>●</span></div>
                        <div className='ad-recovery__row'><span>Current stake</span><strong>{fmt(runningStakeRef.current)}</strong></div>
                        <div className='ad-recovery__row'><span>Martingale</span><strong>2.00×</strong></div>
                        <div className='ad-recovery__row'><span>Validation</span><strong>{virtualStreakRef.current}/2 passed</strong></div>
                        <div className='ad-recovery__bar'><span style={{ width: `${Math.min(100, virtualStreakRef.current * 50)}%` }} /></div>
                        <div className='ad-recovery__row'><span>Recovery state</span><b className={losses ? 'warning' : 'positive'}>{losses ? 'CHECK OPPOSITE' : 'READY'}</b></div>
                        <button className='ad-button ad-button--secondary' onClick={() => { virtualStreakRef.current = 0; setValidationMessage('Recovery reset — waiting for clean entry'); }}>RESET RECOVERY</button>
                    </section>
                    <section className='ad-panel ad-status'>
                        <div className='ad-panel__title'>ENGINE STATUS</div>
                        <div className='ad-status__line'><span>Scanner</span><b className={scannerOn ? 'positive' : ''}>{scannerOn ? 'RUNNING' : 'IDLE'}</b></div>
                        <div className='ad-status__line'><span>Stream</span><b>{historyLoading ? 'LOADING' : `${digits.length.toLocaleString()} TICKS`}</b></div>
                        <div className='ad-status__line'><span>Contract</span><b>{signal.label}</b></div>
                        <div className='ad-status__line'><span>Speed</span><b className='cyan'>EVENT-DRIVEN</b></div>
                    </section>
                </aside>

                <section className='auto-digits__column auto-digits__column--center'>
                    <section className='ad-panel ad-distribution'>
                        <div className='ad-panel__heading'>
                            <div><div className='ad-panel__title'>DIGIT DISTRIBUTION ({analysisWindow >= 1000 ? '1,000' : analysisWindow} TICKS)</div><p>{marketLabel} <span className='dot-separator'>·</span> pip-size aware</p></div>
                            <div className='ad-current-price'><small>LAST PRICE</small><strong>{currentPrice == null ? '—' : currentPrice.toFixed(pipSizeRef.current)}</strong><span>digit <b>{currentDigit ?? '—'}</b></span></div>
                        </div>
                        <div className='ad-circles'>
                            {Array.from({ length: 10 }, (_, digit) => (
                                <div className={`ad-circle-wrap ${digit === currentDigit ? 'is-current' : ''}`} key={digit}>
                                    {digit === currentDigit && <span className='ad-circle-arrow'>▼</span>}
                                    <div className={`ad-circle ad-circle--${colors[digit]}`}><strong>{digit}</strong></div>
                                    <span className='ad-circle-pct'>{pcts[digit].toFixed(1)}%</span>
                                    <span className='ad-circle-count'>{counts[digit]}</span>
                                </div>
                            ))}
                        </div>
                        <div className='ad-distribution__footer'><span>Moving marker = current digit</span><span>Total ticks: {windowDigits.length.toLocaleString()} ({digits.length ? Math.round(windowDigits.length / Math.min(digits.length, 1000) * 100) : 0}%)</span></div>
                    </section>

                    <section className='ad-panel ad-barrier'>
                        <div className='ad-panel__title'>BARRIER VIEW <span>OVER / UNDER {barrier}</span></div>
                        <div className='ad-barrier__digits'>
                            {Array.from({ length: 10 }, (_, digit) => <span key={digit} className={`${digit > barrier ? 'winning' : 'losing'} ${digit === currentDigit ? 'current' : ''}`}>{digit}</span>)}
                        </div>
                        <div className='ad-barrier__labels'><span>LOSING REGION (0–{barrier})</span><span>WINNING REGION ({barrier + 1}–9)</span></div>
                    </section>

                    <div className='ad-two-up'>
                        <section className='ad-panel ad-ticks'>
                            <div className='ad-panel__title'>RECENT TICKS <span>(LAST 20)</span></div>
                            <div className='ad-ticks__row'>{shortDigits.length ? shortDigits.map((digit, index) => <span key={`${digit}-${index}`} className={digit === currentDigit ? 'current' : ''}>{digit}</span>) : <em>Waiting for ticks…</em>}</div>
                            <div className='ad-ticks__legend'><span>Even <b>{evenPct.toFixed(1)}%</b></span><span>Odd <b>{oddPct.toFixed(1)}%</b></span></div>
                        </section>
                        <section className='ad-panel ad-entry'>
                            <div className='ad-panel__title'>ENTRY PATTERN</div>
                            <div className={`ad-entry__signal ${signal.ready ? 'is-ready' : ''}`}><span className='ad-entry__pulse' /><strong>{signal.ready ? 'PATTERN DETECTED' : 'SCANNING PATTERN'}</strong></div>
                            <p>{signal.reason}</p>
                            <div className='ad-entry__confidence'><span>Confidence</span><strong>{signal.confidence ? `${signal.confidence}/100` : '—'}</strong></div>
                        </section>
                    </div>

                    <section className='ad-panel ad-validation'>
                        <div className='ad-panel__title'>VIRTUAL VALIDATION <span>REAL TICKS ONLY</span></div>
                        <div className='ad-validation__rows'>
                            {[0, 1].map(index => {
                                const row = virtualRows[index];
                                return <div className='ad-validation__row' key={index}><span>Virtual trade {index + 1}</span><strong className={row?.result === 'WIN' ? 'positive' : row?.result === 'LOSS' ? 'negative' : ''}>{row?.result || 'WAIT'} {row?.label ? `· ${row.label}` : ''}</strong><span>{row?.result === 'WIN' ? '✓' : row?.result === 'LOSS' ? '×' : '·'}</span></div>;
                            })}
                        </div>
                        <div className='ad-validation__message'>{validationMessage}</div>
                    </section>
                </section>

                <aside className='auto-digits__column auto-digits__column--right'>
                    <section className='ad-panel ad-strategy'>
                        <div className='ad-panel__title'>CURRENT STRATEGY</div>
                        <div className='ad-strategy__name'>{signal.label}</div>
                        <div className='ad-score'><strong>{signal.confidence || 0}</strong><span>/100<br />SCORE</span></div>
                        <div className='ad-strategy__ready'>{signal.ready ? 'READY TO VALIDATE' : 'WAITING FOR ENTRY'}</div>
                        <div className='ad-strategy__reason'>{signal.reason}</div>
                        <ul>
                            <li className={windowDigits.length >= 20 ? 'done' : ''}>Distribution window</li>
                            <li className={pressure >= 55 || strategy !== 'parity' ? 'done' : ''}>Pressure / pattern check</li>
                            <li className={signal.ready ? 'done' : ''}>Entry confirmation</li>
                            <li className={virtualStreakRef.current >= 2 ? 'done' : ''}>Two virtual wins</li>
                        </ul>
                    </section>
                    <section className='ad-panel ad-pressure'>
                        <div className='ad-panel__title'>MARKET PRESSURE</div>
                        <div className='ad-pressure__headline'><span>{balanceLabel}</span><strong>{Math.round(pressure)}%</strong></div>
                        <div className='ad-pressure__bar'><span className='even' style={{ width: `${evenPct}%` }} /><span className='odd' style={{ width: `${oddPct}%` }} /></div>
                        <div className='ad-pressure__legend'><span>Even {evenPct.toFixed(1)}%</span><span>Odd {oddPct.toFixed(1)}%</span></div>
                        <div className='ad-pressure__headline ad-pressure__headline--small'><span>Top digits</span><strong>{topDigits.join(' · ') || '—'}</strong></div>
                        <div className='ad-pressure__headline ad-pressure__headline--small'><span>Weak digits</span><strong>{lowDigits.join(' · ') || '—'}</strong></div>
                    </section>
                    <section className='ad-panel ad-next'>
                        <div className='ad-panel__title'>NEXT CONTRACT</div>
                        <div className='ad-next__line'><span>Contract</span><strong>{signal.label}</strong></div>
                        <div className='ad-next__line'><span>Stake</span><strong>{fmt(runningStakeRef.current)}</strong></div>
                        <div className='ad-next__line'><span>Duration</span><strong>{duration} tick</strong></div>
                        <div className='ad-next__controls'>
                            <label>Stake<input type='number' min={MIN_STAKE} step='0.01' value={stake} onChange={event => { const next = Math.max(MIN_STAKE, Number(event.target.value)); setStake(next); runningStakeRef.current = next; }} /></label>
                            <label>Ticks<input type='number' min='1' max='5' value={duration} onChange={event => setDuration(Math.max(1, Math.min(5, Number(event.target.value))))} /></label>
                        </div>
                    </section>
                    <section className='ad-panel ad-results'>
                        <div className='ad-panel__title'>RECENT RESULTS</div>
                        {trades.length === 0 ? <p className='ad-empty'>No real contracts yet.</p> : trades.slice(0, 5).map(trade => <div className='ad-results__row' key={trade.id}><span>{trade.time}</span><b>{trade.type}</b><strong className={trade.result === 'won' ? 'positive' : trade.result === 'lost' ? 'negative' : ''}>{trade.result === 'pending' ? 'OPEN' : trade.result.toUpperCase()} {trade.result !== 'pending' && formatMoney(trade.profit, displayCur)}</strong></div>)}
                    </section>
                </aside>
            </main>
            <footer className='auto-digits__footer'>
                <span>Auto-Digits v1.0</span><span>Market: {marketLabel}</span><span>Window: {analysisWindow >= 1000 ? '1K' : analysisWindow}</span><span>Account: {authorized ? (currency || displayCur) : 'Not connected'}</span><span className='auto-digits__footer-status'>{scannerOn ? '● SCANNER ACTIVE' : '○ SCANNER PAUSED'}</span>
            </footer>
        </div>
    );
};

export default AutoDigits;