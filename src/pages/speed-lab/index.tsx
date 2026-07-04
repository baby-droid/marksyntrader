// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import DigitCircles from '@/components/digit-circles';
import { useDigitStats } from '@/hooks/useDigitStats';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import './speed-lab.scss';

/**
 * Speed Lab — execution modes per the provided spec:
 *   Normal: 200-500ms inter-contract delay, safe and stable
 *   Crazy: 0ms delay, parallel processing, high priority
 *   Turbo: 0ms delay, pre-loaded payloads, persistent WS, maximum priority
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
    description: 'No cooldown — buy immediately when signal confirmed, skip animations',
  },
  turbo: {
    label: '⚡ Turbo',
    interContractDelay: 0,
    preloadContracts: true,
    parallelProcessing: true,
    persistentWebSocket: true,
    instantExecution: true,
    priority: 'maximum',
    description: 'Zero delay — pre-built payloads, instant API on trigger, non-blocking queue',
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
  { label: 'Odd', value: 'DIGITODD' },
  { label: 'Over', value: 'DIGITOVER', needsBarrier: true },
  { label: 'Under', value: 'DIGITUNDER', needsBarrier: true },
  { label: 'Rise', value: 'CALL' },
  { label: 'Fall', value: 'PUT' },
  { label: 'Matches', value: 'DIGITMATCH', needsBarrier: true },
  { label: 'Differs', value: 'DIGITDIFF', needsBarrier: true },
];

const SpeedLab = observer(() => {
  const { digits, lastDigit, currentPrice, symbol, setSymbol, isConnected } = useDigitStats('1HZ100V');
  const { balance, currency, buyContract, isTrading, tradeResults, totalProfit, winCount, lossCount, clearResults } = useDerivTrading();

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

  const runRef = useRef(false);
  const currentStakeRef = useRef(stake);
  const sessionProfitRef = useRef(0);
  const pendingQueueRef = useRef<Promise<any>[]>([]);

  const mode = EXECUTION_MODES[execMode];

  const logEntry = useCallback((msg: string) => {
    setExecutionLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  const buildParams = useCallback(() => {
    const needsBarrier = ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(contractType);
    return {
      symbol,
      contract_type: contractType,
      stake: currentStakeRef.current,
      duration,
      barrier: needsBarrier ? barrier : undefined,
    };
  }, [contractType, symbol, duration, barrier]);

  const runLoop = useCallback(async () => {
    if (!runRef.current) return;

    const params = buildParams();
    const start = performance.now();

    try {
      if (execMode === 'turbo') {
        // Turbo: fire and forget, non-blocking, immediate re-entry
        const promise = buyContract(params);
        pendingQueueRef.current.push(promise);
        // Don't await — start next iteration immediately
        promise.then(() => {
          const ms = Math.round(performance.now() - start);
          logEntry(`⚡ TURBO bought ${contractType} @ ${currentStakeRef.current.toFixed(2)} ${currency} (${ms}ms)`);
          // Clean up resolved promises
          pendingQueueRef.current = pendingQueueRef.current.filter(p => p !== promise);
        }).catch(() => {});
      } else if (execMode === 'crazy') {
        // Crazy: no delay, buy immediately when ready
        const result = await buyContract(params);
        if (result) {
          const ms = Math.round(performance.now() - start);
          logEntry(`🔥 CRAZY bought ${contractType} @ ${currentStakeRef.current.toFixed(2)} ${currency} (${ms}ms)`);
        }
        // No inter-contract delay
      } else {
        // Normal: wait for confirmation + delay
        const result = await buyContract(params);
        if (result) {
          const ms = Math.round(performance.now() - start);
          logEntry(`Bought ${contractType} @ ${currentStakeRef.current.toFixed(2)} ${currency} (${ms}ms)`);
        }
        // Apply inter-contract delay for normal mode
        if (mode.interContractDelay > 0) {
          await new Promise(r => setTimeout(r, mode.interContractDelay));
        }
      }
    } catch (e) {
      logEntry(`Error: ${e?.message ?? 'trade failed'}`);
    }

    if (!runRef.current) return;

    // Check TP/SL
    if (sessionProfitRef.current >= targetProfit) {
      logEntry(`✅ Target profit reached: +${sessionProfitRef.current.toFixed(2)}`);
      runRef.current = false;
      setIsRunning(false);
      return;
    }
    if (sessionProfitRef.current <= -stopLoss) {
      logEntry(`🛑 Stop loss hit: ${sessionProfitRef.current.toFixed(2)}`);
      runRef.current = false;
      setIsRunning(false);
      return;
    }

    // Schedule next iteration
    if (execMode === 'turbo' || execMode === 'crazy') {
      // Zero-delay: use requestAnimationFrame for maximum throughput
      requestAnimationFrame(runLoop);
    } else {
      // Normal: schedule after delay already applied above
      requestAnimationFrame(runLoop);
    }
  }, [execMode, buildParams, buyContract, contractType, currency, targetProfit, stopLoss, logEntry, mode]);

  useEffect(() => { sessionProfitRef.current = totalProfit; }, [totalProfit]);
  useEffect(() => { currentStakeRef.current = stake; }, [stake]);

  const handleStart = useCallback(() => {
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
    logEntry(`🚀 Speed Lab [${execMode.toUpperCase()}] — ${contractType} @ ${stake} ${currency}`);
    runLoop();
  }, [isRunning, stake, contractType, currency, clearResults, runLoop, logEntry, execMode]);

  useEffect(() => {
    return () => { runRef.current = false; };
  }, []);

  const selectedType = CONTRACT_TYPES.find(t => t.value === contractType);

  return (
    <div className='speed-lab'>
      <div className='speed-lab__header'>
        <div>
          <h1>⚡ Speed Lab</h1>
          <p>Ultra-fast execution trading</p>
        </div>
        {balance !== null && (
          <div className='speed-lab__balance'>{currency} {balance.toFixed(2)}</div>
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
              <label>Stake ({currency})<input type='number' value={stake} min={0.35} step={0.05} onChange={e => setStake(Number(e.target.value))} /></label>
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
                const needsBarrier = ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(contractType);
                buyContract({ symbol, contract_type: contractType, stake, duration, barrier: needsBarrier ? barrier : undefined });
                logEntry(`Manual buy: ${contractType} @ ${stake.toFixed(2)} ${currency}`);
              }}
            >
              ⚡ Buy 1
            </button>
          </div>

          <div className='speed-lab__stats'>
            <div className='speed-lab__stat'><span>Total P/L</span><strong className={totalProfit >= 0 ? 'pos' : 'neg'}>{totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)}</strong></div>
            <div className='speed-lab__stat'><span>Wins</span><strong className='pos'>{winCount}</strong></div>
            <div className='speed-lab__stat'><span>Losses</span><strong className='neg'>{lossCount}</strong></div>
            <div className='speed-lab__stat'><span>Win Rate</span><strong>{winCount + lossCount > 0 ? ((winCount / (winCount + lossCount)) * 100).toFixed(0) : 0}%</strong></div>
          </div>
        </div>

        <div className='speed-lab__right'>
          <div className='speed-lab__card speed-lab__log-card'>
            <h3>Execution Log <span className={`speed-lab__mode-badge speed-lab__mode-badge--${execMode}`}>{execMode.toUpperCase()}</span></h3>
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
              {tradeResults.slice(0, 15).map(r => (
                <div key={r.id} className={`speed-lab__trade ${r.won ? 'won' : 'lost'}`}>
                  <span>{r.type}</span>
                  <span>{r.stake.toFixed(2)}</span>
                  <span className={r.won ? 'pos' : 'neg'}>{r.profit >= 0 ? '+' : ''}{r.profit.toFixed(2)}</span>
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
