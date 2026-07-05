// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import DigitCircles from '@/components/digit-circles';
import { useDigitStats } from '@/hooks/useDigitStats';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import { api_base } from '@/external/bot-skeleton';
import './speed-lab.scss';

/**
 * Speed Lab — three execution tiers modelled on the TradeEngine pattern:
 *
 *  NORMAL — sequential, await each contract, 500 ms cooldown.
 *  CRAZY  — queue-based, no cooldown, preloads proposal before each buy.
 *  TURBO  — queue-based, no cooldown, preloads + pipelines next proposal
 *            while the current contract settles (fastest possible re-entry).
 */

const SPEED_MODES = {
    normal: {
        name: 'NORMAL',
        delay: 500,
        preload: false,
        queue: true,
        pipeline: false,
        label: '🐢 Normal',
        desc: 'Sequential — wait for result, 500 ms cooldown',
    },
    crazy: {
        name: 'CRAZY',
        delay: 0,
        preload: true,
        queue: true,
        pipeline: false,
        label: '🔥 Crazy',
        desc: 'Queue + preload proposal — zero cooldown, fastest re-entry',
    },
    turbo: {
        name: 'TURBO',
        delay: 0,
        preload: true,
        queue: true,
        pipeline: true,
        label: '⚡ Turbo',
        desc: 'Queue + preload + pipeline next proposal while settling',
    },
} as const;

type SpeedMode = keyof typeof SPEED_MODES;

interface TradeSignal {
    symbol: string;
    contract_type: string;
    stake: number;
    duration: number;
    barrier?: string;
    currency: string;
}

/**
 * TradeEngine — manages the buy queue with proposal pre-caching.
 */
class TradeEngine {
    private mode = SPEED_MODES.normal;
    private busy = false;
    private queue: TradeSignal[] = [];
    private cachedProposal: { id: string; price: number } | null = null;
    private active = false;
    fireCount = 0;
    onFire?: (n: number, ms: number) => void;
    onError?: (msg: string) => void;

    setMode(m: typeof SPEED_MODES[SpeedMode]) { this.mode = m; }
    start() { this.active = true; this.fireCount = 0; }
    stop() { this.active = false; this.queue = []; this.cachedProposal = null; this.busy = false; }

    /** Preload a Deriv proposal so the buy step is instant. */
    private async preloadProposal(sig: TradeSignal): Promise<{ id: string; price: number } | null> {
        try {
            const res = await api_base.api.send({
                proposal: 1,
                amount: sig.stake,
                basis: 'stake',
                contract_type: sig.contract_type,
                currency: sig.currency,
                duration: sig.duration,
                duration_unit: 't',
                symbol: sig.symbol,
                ...(sig.barrier !== undefined ? { barrier: sig.barrier } : {}),
            });
            if (res?.proposal?.id) return { id: res.proposal.id, price: sig.stake };
        } catch { /* fall through */ }
        return null;
    }

    /** Execute one trade: use cached proposal or fall back to inline params. */
    private async executeSingle(sig: TradeSignal): Promise<boolean> {
        const t0 = performance.now();

        // Preload if mode requires it and we don't have a cached one
        if (this.mode.preload && !this.cachedProposal) {
            this.cachedProposal = await this.preloadProposal(sig);
        }

        let result: any;
        try {
            if (this.cachedProposal) {
                result = await api_base.api.send({ buy: this.cachedProposal.id, price: this.cachedProposal.price });
                this.cachedProposal = null; // consumed
            } else {
                result = await api_base.api.send({
                    buy: '1',
                    price: sig.stake,
                    parameters: {
                        amount: sig.stake,
                        basis: 'stake',
                        contract_type: sig.contract_type,
                        currency: sig.currency,
                        duration: sig.duration,
                        duration_unit: 't',
                        symbol: sig.symbol,
                        ...(sig.barrier !== undefined ? { barrier: sig.barrier } : {}),
                    },
                });
            }
        } catch (e: any) {
            this.onError?.(`Buy error: ${e?.message || e}`);
            return false;
        }

        if (result?.buy?.contract_id) {
            const ms = Math.round(performance.now() - t0);
            this.fireCount++;
            this.onFire?.(this.fireCount, ms);
            return true;
        }
        if (result?.error) {
            this.onError?.(`API: ${result.error.message}`);
        }
        return false;
    }

    /** Process the queue until empty or stopped. */
    async processQueue(): Promise<void> {
        while (this.queue.length > 0 && this.active) {
            const sig = this.queue.shift()!;
            this.busy = true;

            await this.executeSingle(sig);

            // Pipeline: preload next while we (potentially) wait
            if (this.mode.pipeline && this.queue.length > 0 && !this.cachedProposal) {
                this.preloadProposal(this.queue[0]).then(p => {
                    if (!this.cachedProposal && p) this.cachedProposal = p;
                });
            }

            if (this.mode.delay > 0) {
                await new Promise(r => setTimeout(r, this.mode.delay));
            }

            this.busy = false;
        }
    }

    /** Add a trade to the queue and start processing if idle. */
    addTrade(sig: TradeSignal): void {
        if (!this.active) return;
        this.queue.push(sig);
        if (!this.busy) {
            this.processQueue();
        }
    }
}

const SYMBOLS = [
    { label: 'V10',      value: 'R_10'      },
    { label: 'V25',      value: 'R_25'      },
    { label: 'V50',      value: 'R_50'      },
    { label: 'V75',      value: 'R_75'      },
    { label: 'V100',     value: 'R_100'     },
    { label: 'V10 1s',   value: '1HZ10V'   },
    { label: 'V25 1s',   value: '1HZ25V'   },
    { label: 'V50 1s',   value: '1HZ50V'   },
    { label: 'V75 1s',   value: '1HZ75V'   },
    { label: 'V100 1s',  value: '1HZ100V'  },
    { label: 'Jump 10',  value: 'JD10'     },
    { label: 'Jump 25',  value: 'JD25'     },
    { label: 'Jump 50',  value: 'JD50'     },
    { label: 'Jump 75',  value: 'JD75'     },
    { label: 'Jump 100', value: 'JD100'    },
    { label: 'Crash 300',  value: 'CRASH300N' },
    { label: 'Crash 500',  value: 'CRASH500'  },
    { label: 'Crash 1000', value: 'CRASH1000' },
    { label: 'Boom 300',   value: 'BOOM300N'  },
    { label: 'Boom 500',   value: 'BOOM500'   },
    { label: 'Boom 1000',  value: 'BOOM1000'  },
];

const CONTRACT_TYPES = [
    { label: 'Even',   value: 'DIGITEVEN'  },
    { label: 'Odd',    value: 'DIGITODD'   },
    { label: 'Over',   value: 'DIGITOVER',  needsBarrier: true },
    { label: 'Under',  value: 'DIGITUNDER', needsBarrier: true },
    { label: 'Rise',   value: 'CALL' },
    { label: 'Fall',   value: 'PUT'  },
    { label: 'Match',  value: 'DIGITMATCH', needsBarrier: true },
    { label: 'Differ', value: 'DIGITDIFF',  needsBarrier: true },
];

const SpeedLab = observer(() => {
    const { digits, lastDigit, currentPrice, symbol, setSymbol, isConnected } = useDigitStats('1HZ100V');
    const {
        balance, currency, buyContract, tradeResults,
        totalProfit, winCount, lossCount, clearResults, subscribeBalance,
    } = useDerivTrading();

    const [speedMode, setSpeedMode]     = useState<SpeedMode>('normal');
    const [stake, setStake]             = useState(0.35);
    const [duration, setDuration]       = useState(1);
    const [barrier, setBarrier]         = useState(5);
    const [contractType, setContractType] = useState('DIGITEVEN');
    const [targetProfit, setTargetProfit] = useState(10);
    const [stopLoss, setStopLoss]       = useState(5);
    const [isRunning, setIsRunning]     = useState(false);
    const [executionLog, setExecutionLog] = useState<string[]>([]);
    const [displayCur, setDisplayCur]   = useState(getDisplayCurrency());
    const [fireCount, setFireCount]     = useState(0);

    const engineRef         = useRef<TradeEngine>(new TradeEngine());
    const runRef            = useRef(false);
    const sessionProfitRef  = useRef(0);
    const currentStakeRef   = useRef(stake);

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    const fmtAmount = (usd: number) => `${fromUsd(usd).toFixed(2)} ${displayCur}`;
    const fmtProfit = (usd: number) => `${usd >= 0 ? '+' : ''}${fromUsd(usd).toFixed(2)} ${displayCur}`;

    const logEntry = useCallback((msg: string) => {
        setExecutionLog(prev => [
            `[${new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${msg}`,
            ...prev,
        ].slice(0, 200));
    }, []);

    const needsBarrier = ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(contractType);

    const buildSignal = useCallback((): TradeSignal => ({
        symbol,
        contract_type: contractType,
        stake: currentStakeRef.current,
        duration,
        currency: currency || 'USD',
        ...(needsBarrier ? { barrier: String(barrier) } : {}),
    }), [symbol, contractType, duration, currency, barrier, needsBarrier]);

    useEffect(() => { sessionProfitRef.current = totalProfit; }, [totalProfit]);
    useEffect(() => { currentStakeRef.current = stake; }, [stake]);

    const checkLimits = useCallback((): boolean => {
        if (sessionProfitRef.current >= targetProfit) {
            logEntry(`✅ Target profit reached: ${fmtProfit(sessionProfitRef.current)}`);
            return false;
        }
        if (sessionProfitRef.current <= -stopLoss) {
            logEntry(`🛑 Stop loss hit: ${fmtProfit(sessionProfitRef.current)}`);
            return false;
        }
        return true;
    }, [targetProfit, stopLoss, logEntry]);

    // Wire engine callbacks
    useEffect(() => {
        const engine = engineRef.current;
        engine.onFire = (n, ms) => {
            setFireCount(n);
            const mode = SPEED_MODES[speedMode];
            logEntry(`${mode.name === 'NORMAL' ? '🐢' : mode.name === 'CRAZY' ? '🔥' : '⚡'} [${mode.name}] #${n} ${contractType} @ ${fmtAmount(currentStakeRef.current)} (${ms}ms)`);
            subscribeBalance();
        };
        engine.onError = (msg) => {
            logEntry(`❌ ${msg}`);
        };
    }, [speedMode, contractType, subscribeBalance, logEntry]);

    /**
     * Main run loop — feeds the TradeEngine queue while running.
     * Engine handles proposal preloading (CRAZY) + pipeline (TURBO).
     */
    const runLoop = useCallback(async () => {
        const engine = engineRef.current;

        // For CRAZY/TURBO, keep feeding the queue (engine processes sequentially)
        // For NORMAL, the queue also handles one-at-a-time with a delay
        while (runRef.current && checkLimits()) {
            engine.addTrade(buildSignal());

            // Pace the loop: for NORMAL wait for queue to drain before adding more
            // For CRAZY/TURBO we can stay slightly ahead (max 3 queued)
            const maxQueue = speedMode === 'normal' ? 1 : 3;
            if ((engine as any).queue.length >= maxQueue) {
                await new Promise(r => setTimeout(r, speedMode === 'normal' ? 200 : 50));
            }
        }

        runRef.current = false;
        setIsRunning(false);
        engine.stop();
        logEntry(`⏹ Stopped — ${fmtProfit(sessionProfitRef.current)}`);
    }, [buildSignal, checkLimits, speedMode, logEntry]);

    const handleStart = useCallback(async () => {
        if (isRunning) {
            runRef.current = false;
            engineRef.current.stop();
            setIsRunning(false);
            logEntry('⏸ Stopped by user');
            return;
        }

        clearResults();
        sessionProfitRef.current = 0;
        currentStakeRef.current = stake;
        setFireCount(0);

        const cfg = SPEED_MODES[speedMode];
        engineRef.current = new TradeEngine();
        engineRef.current.setMode(cfg);
        engineRef.current.onFire = (n, ms) => {
            setFireCount(n);
            logEntry(`${speedMode === 'normal' ? '🐢' : speedMode === 'crazy' ? '🔥' : '⚡'} [${cfg.name}] #${n} ${contractType} @ ${fmtAmount(currentStakeRef.current)} (${ms}ms)`);
            subscribeBalance();
        };
        engineRef.current.onError = (msg) => logEntry(`❌ ${msg}`);
        engineRef.current.start();

        runRef.current = true;
        setIsRunning(true);
        logEntry(`🚀 [${cfg.name}] ${contractType} @ ${fmtAmount(stake)} | TP:${fmtAmount(targetProfit)} SL:${fmtAmount(stopLoss)} | ${cfg.desc}`);

        runLoop();
    }, [isRunning, stake, contractType, targetProfit, stopLoss, speedMode, clearResults, runLoop, subscribeBalance, logEntry]);

    useEffect(() => () => { runRef.current = false; engineRef.current.stop(); }, []);

    const selectedType = CONTRACT_TYPES.find(t => t.value === contractType);
    const winRate = winCount + lossCount > 0 ? ((winCount / (winCount + lossCount)) * 100).toFixed(0) : 0;
    const cfg = SPEED_MODES[speedMode];

    return (
        <div className='speed-lab'>
            <div className='speed-lab__header'>
                <div>
                    <h1>⚡ Speed Lab</h1>
                    <p>Ultra-fast execution trading</p>
                </div>
                {balance !== null && (
                    <div className='speed-lab__balance'>{fmtAmount(balance)}</div>
                )}
            </div>

            {/* Speed Mode selector */}
            <div className='speed-lab__mode-row'>
                {(Object.keys(SPEED_MODES) as SpeedMode[]).map(m => (
                    <button
                        key={m}
                        className={`speed-lab__mode-btn speed-lab__mode-btn--${m} ${speedMode === m ? 'active' : ''}`}
                        onClick={() => !isRunning && setSpeedMode(m)}
                        disabled={isRunning}
                        title={SPEED_MODES[m].desc}
                    >
                        {SPEED_MODES[m].label}
                    </button>
                ))}
            </div>
            <div className='speed-lab__mode-desc'>{cfg.desc}</div>

            <div className='speed-lab__body'>
                <div className='speed-lab__left'>
                    <div className='speed-lab__card'>
                        <h3>Market</h3>
                        <select value={symbol} onChange={e => setSymbol(e.target.value)}>
                            {SYMBOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <div className='speed-lab__price'>
                            <strong>{currentPrice?.toFixed(3) ?? '---'}</strong>
                            <span className={isConnected ? 'live' : 'dead'}>{isConnected ? 'LIVE' : 'DISCONNECTED'}</span>
                        </div>
                    </div>

                    <div className='speed-lab__card speed-lab__digits-card'>
                        <h3>Digit Distribution</h3>
                        <DigitCircles digits={digits} lastDigit={lastDigit} size='sm' nowrap />
                    </div>

                    <div className='speed-lab__card'>
                        <h3>Contract Type</h3>
                        <div className='speed-lab__types'>
                            {CONTRACT_TYPES.map(t => (
                                <button key={t.value} className={`speed-lab__type-btn ${contractType === t.value ? 'active' : ''}`} onClick={() => setContractType(t.value)}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className='speed-lab__card'>
                        <h3>Parameters</h3>
                        <div className='speed-lab__params'>
                            <label>Stake ({displayCur})<input type='number' value={stake} min={0.35} step={0.05} onChange={e => setStake(Number(e.target.value))} /></label>
                            <label>Ticks<input type='number' value={duration} min={1} max={10} onChange={e => setDuration(Number(e.target.value))} /></label>
                            {selectedType?.needsBarrier && <label>Barrier<input type='number' value={barrier} min={0} max={9} onChange={e => setBarrier(Number(e.target.value))} /></label>}
                            <label>Take Profit ({displayCur})<input type='number' value={targetProfit} min={0} step={0.5} onChange={e => setTargetProfit(Number(e.target.value))} /></label>
                            <label>Stop Loss ({displayCur})<input type='number' value={stopLoss} min={0} step={0.5} onChange={e => setStopLoss(Number(e.target.value))} /></label>
                        </div>
                    </div>

                    <div className='speed-lab__run-row'>
                        <button
                            className={`speed-lab__run-btn ${isRunning ? 'speed-lab__run-btn--stop' : ''}`}
                            onClick={handleStart}
                        >
                            {isRunning
                                ? `⏹ Stop [${cfg.name} · ${fireCount} fired]`
                                : `▶ Start [${cfg.name}]`}
                        </button>
                    </div>

                    <div className='speed-lab__stats'>
                        <div className='speed-lab__stat'><span>Total P/L</span><strong className={totalProfit >= 0 ? 'pos' : 'neg'}>{fmtProfit(totalProfit)}</strong></div>
                        <div className='speed-lab__stat'><span>Wins</span><strong className='pos'>{winCount}</strong></div>
                        <div className='speed-lab__stat'><span>Losses</span><strong className='neg'>{lossCount}</strong></div>
                        <div className='speed-lab__stat'><span>Win Rate</span><strong>{winRate}%</strong></div>
                        {isRunning && (
                            <div className='speed-lab__stat'><span>Fires</span><strong style={{ color: '#f97316' }}>{fireCount}</strong></div>
                        )}
                    </div>
                </div>

                <div className='speed-lab__right'>
                    <div className='speed-lab__card speed-lab__log-card'>
                        <h3>
                            Execution Log
                            <span className={`speed-lab__mode-badge speed-lab__mode-badge--${speedMode}`}>{cfg.name}</span>
                        </h3>
                        <div className='speed-lab__log'>
                            {executionLog.length === 0 && <p className='speed-lab__log-empty'>Waiting to start...</p>}
                            {executionLog.map((entry, i) => (
                                <div key={i} className='speed-lab__log-entry'>{entry}</div>
                            ))}
                        </div>
                    </div>

                    <div className='speed-lab__card'>
                        <h3>Recent Trades</h3>
                        <div className='speed-lab__trades'>
                            {tradeResults.slice(0, 20).map(r => (
                                <div key={r.id} className={`speed-lab__trade ${r.won ? 'won' : 'lost'}`}>
                                    <span>{r.type}</span>
                                    <span>{fmtAmount(r.stake)}</span>
                                    <span className={r.won ? 'pos' : 'neg'}>{fmtProfit(r.profit)}</span>
                                </div>
                            ))}
                            {tradeResults.length === 0 && <p className='speed-lab__empty'>No trades yet</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default SpeedLab;
