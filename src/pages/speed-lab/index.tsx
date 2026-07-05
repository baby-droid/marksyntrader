// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import DigitCircles from '@/components/digit-circles';
import { useDigitStats } from '@/hooks/useDigitStats';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import { api_base } from '@/external/bot-skeleton';
import './speed-lab.scss';

/**
 * Speed Lab — three execution tiers with full P/L tracking and martingale.
 *
 *  NORMAL — sequential: fire, await settlement, then next trade.
 *  CRAZY  — skip proposal, inline buy, await settlement, immediately loop.
 *  TURBO  — fire-and-forget: buy instantly, settlement tracked in background.
 *           Multiple contracts in flight simultaneously — super-human speed.
 */

const SPEED_MODES = {
    normal: { name: 'NORMAL', label: '🐢 Normal', desc: 'Sequential — one trade at a time, full settlement wait' },
    crazy:  { name: 'CRAZY',  label: '🔥 Crazy',  desc: 'Faster — no proposal, inline buy, await settlement' },
    turbo:  { name: 'TURBO',  label: '⚡ Turbo',  desc: 'Super-human — fire-and-forget, settlement in background' },
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

/** Wait for a contract to settle and return its profit. */
function waitForSettlement(contractId: string): Promise<number> {
    return new Promise(resolve => {
        let sub: any;
        const bail = setTimeout(() => { try { sub?.unsubscribe(); } catch {} resolve(0); }, 15000);
        try {
            const obs = api_base.api.subscribe({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });
            sub = obs.subscribe({
                next: (res: any) => {
                    const poc = res?.proposal_open_contract;
                    if (poc?.is_sold || poc?.is_expired) {
                        clearTimeout(bail);
                        try { sub?.unsubscribe(); } catch {}
                        resolve(parseFloat(poc.profit ?? '0'));
                    }
                },
                error: () => { clearTimeout(bail); resolve(0); },
            });
        } catch { clearTimeout(bail); resolve(0); }
    });
}

const SpeedLab = observer(() => {
    const { digits, lastDigit, currentPrice, symbol, setSymbol, isConnected } = useDigitStats('1HZ100V');
    const { balance, currency, subscribeBalance } = useDerivTrading();

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

    const inlineBuy = useCallback(async () => {
        const res = await api_base.api.send({
            buy: '1',
            price: currentStakeRef.current,
            parameters: {
                amount: currentStakeRef.current,
                basis: 'stake',
                contract_type: contractType,
                currency: currency || 'USD',
                duration,
                duration_unit: 't',
                symbol,
                ...(needsBarrier ? { barrier: String(barrier) } : {}),
            },
        });
        return res?.buy?.contract_id ?? null;
    }, [contractType, currency, duration, symbol, barrier, needsBarrier]);

    const stopSession = useCallback((reason: string) => {
        runRef.current = false;
        setIsRunning(false);
        logEntry(`⏹ ${reason} | Total: ${fmtProfit(sessionProfitRef.current)}`);
    }, [logEntry]);

    const applyResult = useCallback((profit: number, ms?: number) => {
        const won = profit >= 0;
        sessionProfitRef.current += profit;
        fireCountRef.current++;
        setSessionProfit(sessionProfitRef.current);
        setFireCount(fireCountRef.current);
        if (won) setWinCount(p => p + 1);
        else     setLossCount(p => p + 1);

        const modeIcon = speedMode === 'normal' ? '🐢' : speedMode === 'crazy' ? '🔥' : '⚡';
        logEntry(`${won ? '✅' : '❌'} [${SPEED_MODES[speedMode].name}] #${fireCountRef.current} ${contractType} ${fmtProfit(profit)} @ ${fmtVal(currentStakeRef.current)}${ms ? ` (${ms}ms)` : ''} | Session: ${fmtProfit(sessionProfitRef.current)}`);

        // Martingale
        if (won) {
            currentStakeRef.current = baseStakeRef.current;
        } else if (martingale > 1) {
            currentStakeRef.current = Math.max(0.35, +(currentStakeRef.current * martingale).toFixed(2));
        }

        subscribeBalance?.();

        // TP / SL
        if (sessionProfitRef.current >= targetProfit)  stopSession(`✅ Target profit hit (${fmtProfit(sessionProfitRef.current)})`);
        if (sessionProfitRef.current <= -Math.abs(stopLoss)) stopSession(`🛑 Stop loss hit (${fmtProfit(sessionProfitRef.current)})`);
    }, [speedMode, contractType, martingale, targetProfit, stopLoss, subscribeBalance, stopSession]);

    const runLoop = useCallback(async () => {
        while (runRef.current) {
            const t0 = performance.now();
            try {
                if (speedMode === 'turbo') {
                    // Turbo: fire immediately, track settlement in background
                    const contractId = await inlineBuy();
                    if (contractId) {
                        const ms = Math.round(performance.now() - t0);
                        waitForSettlement(contractId).then(profit => {
                            if (runRef.current || profit !== 0) applyResult(profit, ms);
                        });
                    }
                    // No await — loop immediately for next buy
                } else {
                    // Normal / Crazy: wait for full settlement before next trade
                    const contractId = await inlineBuy();
                    if (!contractId) { await new Promise(r => setTimeout(r, 200)); continue; }
                    const ms = Math.round(performance.now() - t0);
                    const profit = await waitForSettlement(contractId);
                    if (!runRef.current) break;
                    applyResult(profit, ms);
                    // Crazy: no extra delay; Normal: tiny yield to keep UI responsive
                    if (speedMode === 'normal') await new Promise(r => setTimeout(r, 0));
                }
            } catch (e: any) {
                const msg = e?.error?.message || e?.message || 'Unknown error';
                logEntry(`❌ ${msg}`);
                await new Promise(r => setTimeout(r, 300));
            }
        }
        setIsRunning(false);
    }, [inlineBuy, applyResult, speedMode, logEntry]);

    const handleStart = useCallback(async () => {
        if (isRunning) { runRef.current = false; setIsRunning(false); logEntry('⏸ Stopped by user'); return; }

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
        logEntry(`🚀 [${cfg.name}] ${contractType} @ ${fmtVal(stake)} | TP:${fmtVal(targetProfit)} SL:${fmtVal(stopLoss)} | Mart:${martingale}x | ${cfg.desc}`);
        runLoop();
    }, [isRunning, stake, contractType, targetProfit, stopLoss, martingale, speedMode, runLoop, logEntry]);

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
                {balance !== null && (
                    <div className='speed-lab__balance'>{balance?.toFixed(2)} {currency || 'USD'}</div>
                )}
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
                        >
                            {isRunning
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
