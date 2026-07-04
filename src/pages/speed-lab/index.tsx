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
 * Speed Lab — three true execution tiers:
 *
 * NORMAL  — sequential, awaits each contract + 300 ms cooldown
 * CRAZY   — no cooldown, fire-and-forget via api send, yield every 10 via queueMicrotask
 * TURBO   — persistent raw WebSocket, pre-built payload, pure ws.send(), yield every 20
 *
 * The goal: CRAZY ≈ 1-5 ms inter-trade latency, TURBO ≈ sub-millisecond WS latency.
 */

const EXECUTION_MODES = {
    normal: { label: '🐢 Normal', description: 'Sequential — wait for confirmation, 300 ms cooldown' },
    crazy:  { label: '🔥 Crazy',  description: 'Zero cooldown — fire immediately, yield every 10 sends via queueMicrotask' },
    turbo:  { label: '⚡ Turbo',  description: 'Persistent WebSocket + pre-built payload — raw ws.send(), sub-ms latency' },
} as const;

type ExecMode = keyof typeof EXECUTION_MODES;

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
    { label: 'Even',  value: 'DIGITEVEN'  },
    { label: 'Odd',   value: 'DIGITODD'   },
    { label: 'Over',  value: 'DIGITOVER',  needsBarrier: true },
    { label: 'Under', value: 'DIGITUNDER', needsBarrier: true },
    { label: 'Rise',  value: 'CALL' },
    { label: 'Fall',  value: 'PUT'  },
    { label: 'Match', value: 'DIGITMATCH', needsBarrier: true },
    { label: 'Differ',value: 'DIGITDIFF',  needsBarrier: true },
];

/** Microtask yield — faster than setTimeout(0) */
const yieldMicrotask = () => new Promise<void>(r => queueMicrotask(r));

/** Persistent raw WebSocket for Turbo mode */
class TurboSocket {
    ws: WebSocket | null = null;
    authorized = false;
    reqId = 1;

    connect(token: string): Promise<boolean> {
        return new Promise(resolve => {
            if (this.ws?.readyState === WebSocket.OPEN && this.authorized) {
                resolve(true); return;
            }
            this.ws?.close();
            this.authorized = false;
            const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
            this.ws = ws;
            ws.onopen = () => ws.send(JSON.stringify({ authorize: token, req_id: this.reqId++ }));
            ws.onmessage = e => {
                const d = JSON.parse(e.data);
                if (d.msg_type === 'authorize' && !d.error) {
                    this.authorized = true;
                    resolve(true);
                }
            };
            ws.onerror = () => resolve(false);
            setTimeout(() => resolve(false), 5000);
        });
    }

    /** Synchronous raw send — zero software overhead */
    fire(payload: object): void {
        if (this.ws?.readyState === WebSocket.OPEN && this.authorized) {
            this.ws.send(JSON.stringify({ ...payload, req_id: this.reqId++ }));
        }
    }

    close() { this.ws?.close(); this.ws = null; this.authorized = false; }
}

const SpeedLab = observer(() => {
    const { digits, lastDigit, currentPrice, symbol, setSymbol, isConnected } = useDigitStats('1HZ100V');
    const {
        balance, currency, buyContract, tradeResults,
        totalProfit, winCount, lossCount, clearResults, subscribeBalance,
    } = useDerivTrading();

    const [execMode, setExecMode]       = useState<ExecMode>('normal');
    const [stake, setStake]             = useState(0.35);
    const [duration, setDuration]       = useState(1);
    const [barrier, setBarrier]         = useState(5);
    const [contractType, setContractType] = useState('DIGITEVEN');
    const [martingale, setMartingale]   = useState(1);
    const [targetProfit, setTargetProfit] = useState(10);
    const [stopLoss, setStopLoss]       = useState(5);
    const [isRunning, setIsRunning]     = useState(false);
    const [executionLog, setExecutionLog] = useState<string[]>([]);
    const [displayCur, setDisplayCur]   = useState(getDisplayCurrency());
    const [fireCount, setFireCount]     = useState(0);

    const runRef            = useRef(false);
    const currentStakeRef   = useRef(stake);
    const sessionProfitRef  = useRef(0);
    const turboSocketRef    = useRef<TurboSocket>(new TurboSocket());
    const prebuiltPayloadRef = useRef<any>(null);
    const fireCountRef      = useRef(0);

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    const fmtAmount = (usd: number) => `${fromUsd(usd).toFixed(2)} ${displayCur}`;
    const fmtProfit = (usd: number) => `${usd >= 0 ? '+' : ''}${fromUsd(usd).toFixed(2)} ${displayCur}`;

    const logEntry = useCallback((msg: string) => {
        setExecutionLog(prev => [`[${new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 as any })}] ${msg}`, ...prev].slice(0, 300));
    }, []);

    const needsBarrier = ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(contractType);

    const buildBuyPayload = useCallback(() => ({
        buy: '1',
        price: currentStakeRef.current,
        parameters: {
            amount: currentStakeRef.current,
            basis: 'stake',
            contract_type: contractType,
            currency,
            duration,
            duration_unit: 't',
            symbol,
            ...(needsBarrier ? { barrier: String(barrier) } : {}),
        },
    }), [contractType, currency, duration, symbol, barrier, needsBarrier]);

    useEffect(() => { prebuiltPayloadRef.current = buildBuyPayload(); }, [buildBuyPayload]);

    useEffect(() => {
        if (execMode === 'turbo') {
            const token = (() => {
                try {
                    const accts = JSON.parse(localStorage.getItem('client.accounts') || '{}');
                    const active = localStorage.getItem('active_loginid') || '';
                    return accts[active]?.token || '';
                } catch { return ''; }
            })();
            if (token) turboSocketRef.current.connect(token);
        }
        return () => { if (execMode === 'turbo') turboSocketRef.current.close(); };
    }, [execMode]);

    const checkLimits = useCallback((): boolean => {
        if (sessionProfitRef.current >= targetProfit) {
            logEntry(`✅ Target profit reached: ${fmtProfit(sessionProfitRef.current)}`);
            runRef.current = false; setIsRunning(false); return false;
        }
        if (sessionProfitRef.current <= -stopLoss) {
            logEntry(`🛑 Stop loss hit: ${fmtProfit(sessionProfitRef.current)}`);
            runRef.current = false; setIsRunning(false); return false;
        }
        return true;
    }, [targetProfit, stopLoss]);

    /** NORMAL: sequential + 300 ms cooldown */
    const normalLoop = useCallback(async () => {
        while (runRef.current) {
            if (!checkLimits()) break;
            await new Promise(r => setTimeout(r, 300));
            if (!runRef.current) break;
            const t0 = performance.now();
            await buyContract(buildBuyPayload());
            const ms = Math.round(performance.now() - t0);
            logEntry(`🐢 NORMAL ${contractType} @ ${fmtAmount(currentStakeRef.current)} (${ms}ms)`);
        }
    }, [buyContract, buildBuyPayload, contractType, checkLimits, logEntry]);

    /**
     * CRAZY: fire-and-forget via api_base.api.send (no await on result),
     * yield every 10 iterations via queueMicrotask for event-loop health.
     * Target latency: < 2ms per fire.
     */
    const crazyLoop = useCallback(async () => {
        let iter = 0;
        while (runRef.current) {
            if (!checkLimits()) break;
            const payload = buildBuyPayload();
            const t0 = performance.now();

            // Fire without awaiting — immediate next iteration
            api_base.api.send(payload)
                .then((res: any) => {
                    if (res?.buy?.contract_id) {
                        const ms = Math.round(performance.now() - t0);
                        const n = ++fireCountRef.current;
                        setFireCount(n);
                        logEntry(`🔥 CRAZY #${n} ${contractType} (${ms}ms)`);
                        subscribeBalance();
                    }
                })
                .catch(() => {});

            iter++;
            // Yield every 10 fires to keep browser responsive
            if (iter % 10 === 0) await yieldMicrotask();
        }
    }, [buildBuyPayload, contractType, checkLimits, logEntry, subscribeBalance]);

    /**
     * TURBO: persistent raw WebSocket + pre-built payload.
     * ws.send() is synchronous — zero round-trip wait.
     * Yield every 20 fires via queueMicrotask.
     */
    const turboLoop = useCallback(async () => {
        const ts = turboSocketRef.current;
        let iter = 0;
        let apiMode = !ts.authorized;
        if (apiMode) logEntry('⚡ TURBO (API mode — WS authorizing in background)');

        while (runRef.current) {
            if (!checkLimits()) break;
            const payload = prebuiltPayloadRef.current || buildBuyPayload();
            const t0 = performance.now();

            if (!apiMode && ts.authorized) {
                // TRUE TURBO: synchronous raw WS send — no round-trip
                ts.fire(payload);
                const ms = Math.round(performance.now() - t0);
                const n = ++fireCountRef.current;
                setFireCount(n);
                if (n % 20 === 1) logEntry(`⚡ TURBO #${n} raw-WS ${contractType} (${ms}ms)`);
                subscribeBalance();
            } else {
                // API fallback — still fire without awaiting
                api_base.api.send(payload)
                    .then((res: any) => {
                        if (res?.buy?.contract_id) {
                            const ms = Math.round(performance.now() - t0);
                            const n = ++fireCountRef.current;
                            setFireCount(n);
                            if (n % 10 === 1) logEntry(`⚡ TURBO #${n} API ${contractType} (${ms}ms)`);
                        }
                        if (ts.authorized) apiMode = false;
                    })
                    .catch(() => {});
            }

            // Pre-build NEXT payload immediately (zero prep time on next iteration)
            prebuiltPayloadRef.current = buildBuyPayload();

            iter++;
            // Yield every 20 fires via microtask (much faster than setTimeout(0))
            if (iter % 20 === 0) await yieldMicrotask();
        }
    }, [buildBuyPayload, contractType, checkLimits, logEntry, subscribeBalance]);

    useEffect(() => { sessionProfitRef.current = totalProfit; }, [totalProfit]);
    useEffect(() => { currentStakeRef.current = stake; }, [stake]);

    const handleStart = useCallback(async () => {
        if (isRunning) {
            runRef.current = false;
            setIsRunning(false);
            logEntry('⏸ Stopped');
            return;
        }
        clearResults();
        sessionProfitRef.current = 0;
        currentStakeRef.current = stake;
        fireCountRef.current = 0;
        setFireCount(0);
        runRef.current = true;
        setIsRunning(true);
        logEntry(`🚀 [${execMode.toUpperCase()}] ${contractType} @ ${fmtAmount(stake)} | TP:${fmtAmount(targetProfit)} SL:${fmtAmount(stopLoss)}`);

        if (execMode === 'turbo') turboLoop();
        else if (execMode === 'crazy') crazyLoop();
        else normalLoop();
    }, [isRunning, stake, contractType, targetProfit, stopLoss, clearResults, execMode, normalLoop, crazyLoop, turboLoop, logEntry]);

    useEffect(() => () => { runRef.current = false; }, []);

    const selectedType = CONTRACT_TYPES.find(t => t.value === contractType);
    const winRate = winCount + lossCount > 0 ? ((winCount / (winCount + lossCount)) * 100).toFixed(0) : 0;

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

            {/* Execution Mode */}
            <div className='speed-lab__mode-row'>
                {(Object.keys(EXECUTION_MODES) as ExecMode[]).map(m => (
                    <button
                        key={m}
                        className={`speed-lab__mode-btn speed-lab__mode-btn--${m} ${execMode === m ? 'active' : ''}`}
                        onClick={() => !isRunning && setExecMode(m)}
                        disabled={isRunning}
                        title={EXECUTION_MODES[m].description}
                    >
                        {EXECUTION_MODES[m].label}
                    </button>
                ))}
            </div>
            <div className='speed-lab__mode-desc'>{EXECUTION_MODES[execMode].description}</div>

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
                            <label>Target Profit<input type='number' value={targetProfit} min={0} step={0.5} onChange={e => setTargetProfit(Number(e.target.value))} /></label>
                            <label>Stop Loss<input type='number' value={stopLoss} min={0} step={0.5} onChange={e => setStopLoss(Number(e.target.value))} /></label>
                        </div>
                    </div>

                    <div className='speed-lab__run-row'>
                        <button className={`speed-lab__run-btn ${isRunning ? 'speed-lab__run-btn--stop' : ''}`} onClick={handleStart}>
                            {isRunning ? `⏹ Stop [${fireCount} fired]` : `▶ Start [${execMode.toUpperCase()}]`}
                        </button>
                        <button
                            className='speed-lab__buy-btn'
                            disabled={isRunning || !isConnected}
                            onClick={() => {
                                buyContract({ symbol, contract_type: contractType, stake, duration, barrier: needsBarrier ? barrier : undefined });
                                logEntry(`Manual: ${contractType} @ ${fmtAmount(stake)}`);
                            }}
                        >
                            ⚡ Buy 1
                        </button>
                    </div>

                    <div className='speed-lab__stats'>
                        <div className='speed-lab__stat'><span>Total P/L</span><strong className={totalProfit >= 0 ? 'pos' : 'neg'}>{fmtProfit(totalProfit)}</strong></div>
                        <div className='speed-lab__stat'><span>Wins</span><strong className='pos'>{winCount}</strong></div>
                        <div className='speed-lab__stat'><span>Losses</span><strong className='neg'>{lossCount}</strong></div>
                        <div className='speed-lab__stat'><span>Win Rate</span><strong>{winRate}%</strong></div>
                        {(execMode === 'crazy' || execMode === 'turbo') && (
                            <div className='speed-lab__stat'><span>Fires Sent</span><strong style={{ color: '#f97316' }}>{fireCount}</strong></div>
                        )}
                    </div>
                </div>

                <div className='speed-lab__right'>
                    <div className='speed-lab__card speed-lab__log-card'>
                        <h3>
                            Execution Log
                            <span className={`speed-lab__mode-badge speed-lab__mode-badge--${execMode}`}>{execMode.toUpperCase()}</span>
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
