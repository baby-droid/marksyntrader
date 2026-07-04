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
 * Speed Lab — three true execution modes:
 *
 * NORMAL:  wait(300ms) → analyze() → buyContract() → await settlement → repeat
 * CRAZY:   interContractDelay=0 → fire immediately, prepare next while current processes
 * TURBO:   persistent raw WebSocket → pre-build payload → sendPurchaseRequestImmediately()
 *          non-blocking, instant re-entry after signal
 */

const EXECUTION_MODES = {
    normal: {
        label: '🐢 Normal',
        interContractDelay: 300,
        preloadContracts: false,
        parallelProcessing: false,
        priority: 'normal',
        description: 'Human-like execution — wait for confirmation, safe & stable',
    },
    crazy: {
        label: '🔥 Crazy',
        interContractDelay: 0,
        preloadContracts: true,
        parallelProcessing: true,
        priority: 'high',
        description: 'No cooldown — fire immediately when signal confirmed, skip UI waits',
    },
    turbo: {
        label: '⚡ Turbo',
        interContractDelay: 0,
        preloadContracts: true,
        parallelProcessing: true,
        persistentWebSocket: true,
        instantExecution: true,
        priority: 'maximum',
        description: 'Persistent WebSocket + pre-built payload — zero software delay, instant fire',
    },
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
    { label: 'Even', value: 'DIGITEVEN' },
    { label: 'Odd',  value: 'DIGITODD'  },
    { label: 'Over', value: 'DIGITOVER', needsBarrier: true },
    { label: 'Under',value: 'DIGITUNDER', needsBarrier: true },
    { label: 'Rise', value: 'CALL' },
    { label: 'Fall', value: 'PUT'  },
    { label: 'Match',value: 'DIGITMATCH', needsBarrier: true },
    { label: 'Differ',value: 'DIGITDIFF', needsBarrier: true },
];

/** Turbo: dedicated persistent WebSocket for raw instant sends */
class TurboSocket {
    ws: WebSocket | null = null;
    authorized = false;
    reqId = 1;
    pendingAuth: ((ok: boolean) => void)[] = [];

    connect(token: string): Promise<boolean> {
        return new Promise(resolve => {
            if (this.ws?.readyState === WebSocket.OPEN && this.authorized) {
                resolve(true); return;
            }
            this.ws?.close();
            this.authorized = false;
            const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
            this.ws = ws;
            ws.onopen = () => {
                ws.send(JSON.stringify({ authorize: token, req_id: this.reqId++ }));
            };
            ws.onmessage = e => {
                const d = JSON.parse(e.data);
                if (d.msg_type === 'authorize' && !d.error) {
                    this.authorized = true;
                    this.pendingAuth.forEach(cb => cb(true));
                    this.pendingAuth = [];
                    resolve(true);
                }
            };
            ws.onerror = () => resolve(false);
            ws.onclose = () => { this.authorized = false; };
            setTimeout(() => resolve(false), 5000);
        });
    }

    /** Send buy immediately without awaiting response */
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

    const [execMode, setExecMode] = useState<ExecMode>('normal');
    const [stake, setStake] = useState(0.35);
    const [duration, setDuration] = useState(1);
    const [barrier, setBarrier] = useState(5);
    const [contractType, setContractType] = useState('DIGITEVEN');
    const [martingale, setMartingale] = useState(1);
    const [targetProfit, setTargetProfit] = useState(10);
    const [stopLoss, setStopLoss] = useState(5);
    const [isRunning, setIsRunning] = useState(false);
    const [executionLog, setExecutionLog] = useState<string[]>([]);
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());

    const runRef = useRef(false);
    const currentStakeRef = useRef(stake);
    const sessionProfitRef = useRef(0);
    const turboSocketRef = useRef<TurboSocket>(new TurboSocket());
    const prebuiltPayloadRef = useRef<any>(null);
    const iterCountRef = useRef(0);

    // KSH tracking
    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    const fmtProfit = (usd: number) => {
        const v = fromUsd(usd);
        return `${v >= 0 ? '+' : ''}${v.toFixed(2)} ${displayCur}`;
    };
    const fmtAmount = (usd: number) => `${fromUsd(usd).toFixed(2)} ${displayCur}`;

    const logEntry = useCallback((msg: string) => {
        setExecutionLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 200));
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

    /** Rebuild pre-built payload whenever params change (Turbo pre-load) */
    useEffect(() => {
        prebuiltPayloadRef.current = buildBuyPayload();
    }, [buildBuyPayload]);

    /** Authorize TurboSocket when mode switches to turbo */
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
        return () => {
            if (execMode === 'turbo') turboSocketRef.current.close();
        };
    }, [execMode]);

    const checkLimits = useCallback((): boolean => {
        if (sessionProfitRef.current >= targetProfit) {
            logEntry(`✅ Target profit: ${fmtProfit(sessionProfitRef.current)}`);
            runRef.current = false;
            setIsRunning(false);
            return false;
        }
        if (sessionProfitRef.current <= -stopLoss) {
            logEntry(`🛑 Stop loss: ${fmtProfit(sessionProfitRef.current)}`);
            runRef.current = false;
            setIsRunning(false);
            return false;
        }
        return true;
    }, [targetProfit, stopLoss, logEntry]);

    // Normal mode loop — sequential, awaits confirmation, 300ms delay
    const normalLoop = useCallback(async () => {
        while (runRef.current) {
            if (!checkLimits()) break;
            await new Promise(r => setTimeout(r, 300)); // interContractDelay
            if (!runRef.current) break;
            const t0 = performance.now();
            const result = await buyContract(buildBuyPayload());
            const ms = Math.round(performance.now() - t0);
            if (result) logEntry(`Bought ${contractType} @ ${fmtAmount(currentStakeRef.current)} (${ms}ms)`);
        }
    }, [buyContract, buildBuyPayload, contractType, checkLimits, logEntry]);

    // Crazy mode loop — no delay, prepare next while current is processing
    const crazyLoop = useCallback(async () => {
        while (runRef.current) {
            if (!checkLimits()) break;
            const t0 = performance.now();
            // Fire WITHOUT awaiting — prepare next immediately
            buyContract(buildBuyPayload())
                .then(r => {
                    if (r) {
                        const ms = Math.round(performance.now() - t0);
                        logEntry(`🔥 CRAZY ${contractType} @ ${fmtAmount(currentStakeRef.current)} (${ms}ms)`);
                    }
                })
                .catch(() => {});
            // Minimal yield to prevent stack overflow, but no intentional delay
            await new Promise(r => setTimeout(r, 0));
        }
    }, [buyContract, buildBuyPayload, contractType, checkLimits, logEntry]);

    // Turbo mode loop — persistent WS, pre-built payload, instant send
    const turboLoop = useCallback(async () => {
        const ts = turboSocketRef.current;
        let directApiMode = false;

        // Try persistent WS first, fall back to direct API if not ready
        if (!ts.authorized) {
            directApiMode = true;
            logEntry('⚡ TURBO direct-API mode (WS not yet authorized)');
        }

        while (runRef.current) {
            if (!checkLimits()) break;
            const payload = prebuiltPayloadRef.current || buildBuyPayload();
            const t0 = performance.now();

            if (!directApiMode && ts.authorized) {
                // INSTANT: raw WebSocket send, no round-trip wait
                ts.fire(payload);
                const ms = Math.round(performance.now() - t0);
                logEntry(`⚡ TURBO instant-fire ${contractType} @ ${fmtAmount(payload.price)} (${ms}ms)`);
                subscribeBalance();
            } else {
                // API path (still no await on monitoring — fire and forget)
                api_base.api.send(payload).then((res: any) => {
                    if (res?.buy?.contract_id) {
                        const ms = Math.round(performance.now() - t0);
                        logEntry(`⚡ TURBO API-fire ${contractType} @ ${fmtAmount(payload.price)} (${ms}ms)`);
                    }
                }).catch(() => {});
            }

            // Pre-build next payload immediately (zero delay)
            prebuiltPayloadRef.current = buildBuyPayload();
            // Non-blocking: give the event loop ONE tick only
            await new Promise(r => setTimeout(r, 0));
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
        runRef.current = true;
        setIsRunning(true);
        iterCountRef.current = 0;
        logEntry(`🚀 [${execMode.toUpperCase()}] ${contractType} @ ${fmtAmount(stake)}`);

        if (execMode === 'turbo') {
            turboLoop();
        } else if (execMode === 'crazy') {
            crazyLoop();
        } else {
            normalLoop();
        }
    }, [isRunning, stake, contractType, clearResults, execMode, normalLoop, crazyLoop, turboLoop, logEntry]);

    useEffect(() => () => { runRef.current = false; }, []);

    const selectedType = CONTRACT_TYPES.find(t => t.value === contractType);
    const mode = EXECUTION_MODES[execMode];

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

            {/* Execution Mode Selector */}
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
            <div className='speed-lab__mode-desc'>{mode.description}</div>

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
                                <button
                                    key={t.value}
                                    className={`speed-lab__type-btn ${contractType === t.value ? 'active' : ''}`}
                                    onClick={() => setContractType(t.value)}
                                >
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
                            <label>Martingale<input type='number' value={martingale} min={1} step={0.1} onChange={e => setMartingale(Number(e.target.value))} /></label>
                            <label>Target Profit<input type='number' value={targetProfit} min={0} step={0.5} onChange={e => setTargetProfit(Number(e.target.value))} /></label>
                            <label>Stop Loss<input type='number' value={stopLoss} min={0} step={0.5} onChange={e => setStopLoss(Number(e.target.value))} /></label>
                        </div>
                    </div>

                    <div className='speed-lab__run-row'>
                        <button
                            className={`speed-lab__run-btn ${isRunning ? 'speed-lab__run-btn--stop' : ''}`}
                            onClick={handleStart}
                        >
                            {isRunning ? '⏹ Stop' : `▶ Start [${execMode.toUpperCase()}]`}
                        </button>
                        <button
                            className='speed-lab__buy-btn'
                            disabled={isRunning || !isConnected}
                            onClick={() => {
                                buyContract({
                                    symbol, contract_type: contractType, stake, duration,
                                    barrier: needsBarrier ? barrier : undefined,
                                });
                                logEntry(`Manual: ${contractType} @ ${fmtAmount(stake)}`);
                            }}
                        >
                            ⚡ Buy 1
                        </button>
                    </div>

                    <div className='speed-lab__stats'>
                        <div className='speed-lab__stat'>
                            <span>Total P/L</span>
                            <strong className={totalProfit >= 0 ? 'pos' : 'neg'}>{fmtProfit(totalProfit)}</strong>
                        </div>
                        <div className='speed-lab__stat'><span>Wins</span><strong className='pos'>{winCount}</strong></div>
                        <div className='speed-lab__stat'><span>Losses</span><strong className='neg'>{lossCount}</strong></div>
                        <div className='speed-lab__stat'>
                            <span>Win Rate</span>
                            <strong>{winCount + lossCount > 0 ? ((winCount / (winCount + lossCount)) * 100).toFixed(0) : 0}%</strong>
                        </div>
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
