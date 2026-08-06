// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import DigitCircles from '@/components/digit-circles';
import { useDigitStats } from '@/hooks/useDigitStats';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { isFastExecutionEnabled, subscribeFastExecution } from '@/utils/execution-speed';
import './speed-lab.scss';

const AccountBadge: React.FC = () => {
    const [isDemo, setIsDemo] = React.useState(false);
    React.useEffect(() => {
        const check = () => {
            const id = localStorage.getItem('active_loginid') || '';
            setIsDemo(id.startsWith('VRTC') || id.startsWith('VR'));
        };
        check();
        window.addEventListener('storage', check);
        return () => window.removeEventListener('storage', check);
    }, []);
    return (
        <span className={`speed-lab__acct-badge ${isDemo ? 'demo' : 'real'}`}>
            {isDemo ? '🔵 DEMO' : '🟢 REAL'}
        </span>
    );
};

/**
 * Speed Lab — three execution tiers with full P/L tracking and martingale.
 * Uses useDerivTrade, which rides the SAME already-authenticated Deriv
 * connection (api_base) the rest of the app is logged in with — no separate
 * API token or second login. Trades execute on, and balance updates come
 * from, the user's real logged-in account.
 *
 *  NORMAL — buy → await settlement → next trade (sequential)
 *  CRAZY  — same but no delay; fires the instant previous contract settles
 *  TURBO  — fire-and-forget: settlement tracked in background, loops instantly
 */

const SPEED_MODES = {
    normal: { name: 'NORMAL', label: '🐢 Normal', desc: 'Sequential — buy, wait for settlement, then next trade' },
    crazy:  { name: 'CRAZY',  label: '🔥 Crazy',  desc: 'Fast — no delay, fires immediately after each settlement' },
    turbo:  { name: 'TURBO',  label: '⚡ Turbo',  desc: 'Super-human — fire-and-forget, multiple contracts in flight' },
} as const;

type SpeedMode = keyof typeof SPEED_MODES;

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
    // useDerivTrade opens its own authenticated WebSocket → trades execute on the live account
    const derivTrade = useDerivTrade();
    const derivTradeRef = useRef(derivTrade);
    useEffect(() => { derivTradeRef.current = derivTrade; }, [derivTrade]);

    const [speedMode, setSpeedMode]       = useState<SpeedMode>('normal');
    const [stake, setStake]               = useState(0.35);
    const [duration, setDuration]         = useState(1);
    const [barrier, setBarrier]           = useState(5);
    const [contractType, setContractType] = useState('DIGITEVEN');
    const [targetProfit, setTargetProfit] = useState(10);
    const [stopLoss, setStopLoss]         = useState(5);
    const [martingale, setMartingale]     = useState(1.0);
    const [isRunning, setIsRunning]       = useState(false);
    const [executionLog, setExecutionLog] = useState<string[]>([]);
    const [fireCount, setFireCount]       = useState(0);
    const [sessionProfit, setSessionProfit] = useState(0);
    const [winCount, setWinCount]         = useState(0);
    const [lossCount, setLossCount]       = useState(0);
    const [lastTrade, setLastTrade]       = useState<{
        entry?: number; exit?: number; buy_price?: number;
        profit?: number; balance?: number; contract_id?: number;
    } | null>(null);

    const runRef            = useRef(false);
    const sessionProfitRef  = useRef(0);
    const currentStakeRef   = useRef(stake);
    const baseStakeRef      = useRef(stake);
    const fireCountRef      = useRef(0);

    useEffect(() => { currentStakeRef.current = stake; baseStakeRef.current = stake; }, [stake]);

    const fmtProfit = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} USD`;
    const fmtVal    = (v: number) => `${v.toFixed(2)} USD`;

    const logEntry = useCallback((msg: string) => {
        setExecutionLog(prev => [
            `[${new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${msg}`,
            ...prev,
        ].slice(0, 200));
    }, []);

    const needsBarrier = ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(contractType);

    const stopSession = useCallback((reason: string) => {
        runRef.current = false;
        setIsRunning(false);
        logEntry(`⏹ ${reason} | Total: ${fmtProfit(sessionProfitRef.current)}`);
    }, [logEntry]);

    const applyResult = useCallback((
        profit: number, boughtStake: number, speed: SpeedMode,
        extra?: { entry_spot?: number; exit_spot?: number; buy_price?: number; contract_id?: number; }
    ) => {
        const won = profit >= 0;
        sessionProfitRef.current += profit;
        fireCountRef.current++;
        setSessionProfit(sessionProfitRef.current);
        setFireCount(fireCountRef.current);
        if (won) setWinCount(p => p + 1);
        else     setLossCount(p => p + 1);

        // Update last-trade panel
        const bal = derivTradeRef.current.balance;
        setLastTrade({
            entry: extra?.entry_spot,
            exit: extra?.exit_spot,
            buy_price: extra?.buy_price ?? boughtStake,
            profit,
            balance: bal ?? undefined,
            contract_id: extra?.contract_id,
        });

        const spotPart = extra?.entry_spot != null
            ? ` | Entry:${extra.entry_spot} Exit:${extra.exit_spot ?? '?'}`
            : '';
        logEntry(`${won ? '✅' : '❌'} [${SPEED_MODES[speed].name}] #${fireCountRef.current} ${contractType} ${fmtProfit(profit)} @ ${fmtVal(boughtStake)}${spotPart} | Session: ${fmtProfit(sessionProfitRef.current)}`);

        // Martingale
        if (won) {
            currentStakeRef.current = baseStakeRef.current;
        } else if (martingale > 1) {
            currentStakeRef.current = Math.max(0.35, +(currentStakeRef.current * martingale).toFixed(2));
        }

        // TP / SL — check after updating stake
        if (sessionProfitRef.current >= targetProfit)         stopSession(`✅ Target profit hit (${fmtProfit(sessionProfitRef.current)})`);
        if (sessionProfitRef.current <= -Math.abs(stopLoss))  stopSession(`🛑 Stop loss hit (${fmtProfit(sessionProfitRef.current)})`);
    }, [contractType, martingale, targetProfit, stopLoss, stopSession, logEntry]);

    /**
     * Run the trading loop.
     * We close over the current speed/contract settings at start time,
     * but use refs for stake (so martingale updates are immediate).
     *
     * ⚡ FAST BOOST: when the global Fast toggle is active, fires up to 20
     * contracts simultaneously (Promise.allSettled) so that ~20 contracts
     * settle per contract-duration window — achieving ~20 runs/second on
     * 1-tick markets. The batch size is locked at loop-start so toggling
     * Fast mid-session takes effect on the next Start.
     */
    const runLoop = useCallback(async (speed: SpeedMode, sym: string, cType: string, dur: number, bar: number, withBarrier: boolean) => {
        const buildParams = (s: number) => ({
            symbol: sym,
            contract_type: cType as any,
            duration: dur,
            duration_unit: 't' as any,
            stake: s,
            ...(withBarrier ? { barrier: bar } : {}),
        });

        // Zero inter-trade delay in Fast mode; otherwise tier-specific.
        // ⚡ Fast = individual contracts at maximum speed (0ms between each).
        const POST_DELAY = isFastExecutionEnabled() ? 0 : speed === 'turbo' ? 0 : speed === 'crazy' ? 50 : 200;

        while (runRef.current) {
            const curStake = currentStakeRef.current;

            // Sequential path: buy → await settlement → inter-trade delay → repeat.
            // Fast mode keeps this sequential but with 0ms POST_DELAY for super speed.
            try {
                const { profit, extra } = await new Promise<{ profit: number; extra?: any }>(resolve => {
                    const bail = setTimeout(() => { logEntry('⏱ Settlement timeout'); resolve({ profit: 0 }); }, 15_000);
                    derivTradeRef.current.buyContract(
                        buildParams(curStake),
                        settled => { clearTimeout(bail); resolve({ profit: settled.profit ?? 0, extra: settled }); }
                    ).then(result => {
                        if (!result?.contract_id) { clearTimeout(bail); resolve({ profit: 0 }); }
                    }).catch(err => {
                        clearTimeout(bail);
                        const msg = err?.message || err?.error?.message || 'Buy failed';
                        logEntry(`❌ ${msg}`);
                        resolve({ profit: 0 });
                    });
                });
                if (!runRef.current) break;
                applyResult(profit, curStake, speed, extra);
                if (POST_DELAY > 0) await new Promise(r => setTimeout(r, POST_DELAY));
            } catch (e: any) {
                logEntry(`❌ ${e?.message || 'Unknown error'}`);
                await new Promise(r => setTimeout(r, isFastExecutionEnabled() ? 0 : 300));
            }
        }
        setIsRunning(false);
    }, [applyResult, logEntry]);

    const handleStart = useCallback(async () => {
        if (isRunning) {
            runRef.current = false;
            setIsRunning(false);
            logEntry('⏸ Stopped by user');
            return;
        }

        // Reset session
        sessionProfitRef.current = 0;
        fireCountRef.current = 0;
        currentStakeRef.current = stake;
        baseStakeRef.current = stake;
        setSessionProfit(0);
        setFireCount(0);
        setWinCount(0);
        setLossCount(0);

        runRef.current = true;
        setIsRunning(true);
        const cfg = SPEED_MODES[speedMode];
        logEntry(`🚀 [${cfg.name}] ${contractType} on ${symbol} @ ${fmtVal(stake)} | TP:${fmtVal(targetProfit)} SL:${fmtVal(stopLoss)} | Martingale:${martingale}x | ${cfg.desc}`);
        runLoop(speedMode, symbol, contractType, duration, barrier, needsBarrier);
    }, [isRunning, stake, contractType, symbol, duration, barrier, needsBarrier, targetProfit, stopLoss, martingale, speedMode, runLoop, logEntry]);

    useEffect(() => () => { runRef.current = false; }, []);

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <AccountBadge />
                    {derivTrade.balance !== null && (
                        <div className='speed-lab__balance'>{derivTrade.balance?.toFixed(2)} {derivTrade.currency || 'USD'}</div>
                    )}
                </div>
            </div>

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
                            <span className={derivTrade.connected ? 'live' : 'dead'}>{derivTrade.connected ? 'LIVE' : 'CONNECTING...'}</span>
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
                            <label>Stake (USD)<input type='number' value={stake} min={0.35} step={0.05} onChange={e => setStake(Number(e.target.value))} /></label>
                            <label>Ticks<input type='number' value={duration} min={1} max={10} onChange={e => setDuration(Number(e.target.value))} /></label>
                            {selectedType?.needsBarrier && <label>Barrier<input type='number' value={barrier} min={0} max={9} onChange={e => setBarrier(Number(e.target.value))} /></label>}
                            <label>Martingale ×<input type='number' value={martingale} min={1} max={4} step={0.1} onChange={e => setMartingale(Number(e.target.value))} /></label>
                            <label>Take Profit (USD)<input type='number' value={targetProfit} min={0} step={0.5} onChange={e => setTargetProfit(Number(e.target.value))} /></label>
                            <label>Stop Loss (USD)<input type='number' value={stopLoss} min={0} step={0.5} onChange={e => setStopLoss(Number(e.target.value))} /></label>
                        </div>
                    </div>

                    <div className='speed-lab__run-row'>
                        <button
                            className={`speed-lab__run-btn ${isRunning ? 'speed-lab__run-btn--stop' : ''}`}
                            onClick={handleStart}
                            disabled={!derivTrade.connected}
                        >
                            {!derivTrade.connected
                                ? '⌛ Connecting...'
                                : isRunning
                                    ? `⏹ Stop [${cfg.name} · ${fireCount} fired]`
                                    : `▶ Start [${cfg.name}]`}
                        </button>
                    </div>

                    <div className='speed-lab__stats'>
                        <div className='speed-lab__stat'><span>Session P/L</span><strong className={sessionProfit >= 0 ? 'pos' : 'neg'}>{fmtProfit(sessionProfit)}</strong></div>
                        <div className='speed-lab__stat'><span>Wins</span><strong className='pos'>{winCount}</strong></div>
                        <div className='speed-lab__stat'><span>Losses</span><strong className='neg'>{lossCount}</strong></div>
                        <div className='speed-lab__stat'><span>Win Rate</span><strong>{winRate}%</strong></div>
                        {isRunning && (
                            <div className='speed-lab__stat'><span>Fires</span><strong style={{ color: '#f97316' }}>{fireCount}</strong></div>
                        )}
                    </div>
                </div>

                <div className='speed-lab__right'>
                    {/* ── Last trade / API response panel ── */}
                    {lastTrade && (
                        <div className='speed-lab__card speed-lab__last-trade'>
                            <h3>
                                Last Trade
                                <span className={`speed-lab__mode-badge ${lastTrade.profit != null && lastTrade.profit >= 0 ? 'speed-lab__mode-badge--won' : 'speed-lab__mode-badge--lost'}`}>
                                    {lastTrade.profit != null ? (lastTrade.profit >= 0 ? '✅ WIN' : '❌ LOSS') : ''}
                                </span>
                            </h3>
                            <div className='speed-lab__last-trade-grid'>
                                {lastTrade.contract_id && (
                                    <div className='speed-lab__lti'>
                                        <span>Contract ID</span>
                                        <strong>{lastTrade.contract_id}</strong>
                                    </div>
                                )}
                                {lastTrade.buy_price != null && (
                                    <div className='speed-lab__lti'>
                                        <span>Buy price</span>
                                        <strong>{Number(lastTrade.buy_price).toFixed(2)} {derivTrade.currency}</strong>
                                    </div>
                                )}
                                {lastTrade.profit != null && (
                                    <div className='speed-lab__lti'>
                                        <span>P / L</span>
                                        <strong className={lastTrade.profit >= 0 ? 'pos' : 'neg'}>
                                            {lastTrade.profit >= 0 ? '+' : ''}{lastTrade.profit.toFixed(2)} {derivTrade.currency}
                                        </strong>
                                    </div>
                                )}
                                {lastTrade.entry != null && (
                                    <div className='speed-lab__lti'>
                                        <span>Entry spot</span>
                                        <strong>{lastTrade.entry}</strong>
                                    </div>
                                )}
                                {lastTrade.exit != null && (
                                    <div className='speed-lab__lti'>
                                        <span>Exit spot</span>
                                        <strong>{lastTrade.exit}</strong>
                                    </div>
                                )}
                                {lastTrade.balance != null && (
                                    <div className='speed-lab__lti'>
                                        <span>Balance after</span>
                                        <strong style={{ color: '#4C7DFF' }}>
                                            {lastTrade.balance.toFixed(2)} {derivTrade.currency}
                                        </strong>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

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
                </div>
            </div>
        </div>
    );
});

export default SpeedLab;
