// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import DigitCircles from '@/components/digit-circles';
import AIAssistant from '@/components/ai-assistant';
import { useDigitStats } from '@/hooks/useDigitStats';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import './speed-lab.scss';

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
  const [stake, setStake] = useState(0.35);
  const [duration, setDuration] = useState(1);
  const [barrier, setBarrier] = useState(5);
  const [contractType, setContractType] = useState('DIGITEVEN');
  const [martingale, setMartingale] = useState(1);
  const [targetProfit, setTargetProfit] = useState(10);
  const [stopLoss, setStopLoss] = useState(5);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(100); // ms between trades
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const runRef = useRef(false);
  const currentStakeRef = useRef(stake);
  const sessionProfitRef = useRef(0);

  const logEntry = useCallback((msg: string) => {
    setExecutionLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  const runLoop = useCallback(async () => {
    if (!runRef.current) return;
    const ct = contractType;
    const sym = symbol;
    const needsBarrier = ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(ct);

    const result = await buyContract({
      symbol: sym,
      contract_type: ct,
      stake: currentStakeRef.current,
      duration,
      barrier: needsBarrier ? barrier : undefined,
    });

    if (result) {
      logEntry(`Bought ${ct} @ ${currentStakeRef.current.toFixed(2)} ${currency}`);
    }

    // Wait for result then continue
    await new Promise(r => setTimeout(r, speed));

    if (!runRef.current) return;

    // Check stop conditions
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

    if (runRef.current) requestAnimationFrame(runLoop);
  }, [contractType, symbol, duration, barrier, speed, buyContract, currency, targetProfit, stopLoss, logEntry]);

  useEffect(() => {
    sessionProfitRef.current = totalProfit;
  }, [totalProfit]);

  useEffect(() => {
    currentStakeRef.current = stake;
  }, [stake]);

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
    logEntry(`🚀 Speed Lab started — ${contractType} @ ${stake} ${currency}`);
    runLoop();
  }, [isRunning, stake, contractType, currency, clearResults, runLoop, logEntry]);

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
              <label>Speed (ms)<input type='number' value={speed} min={50} max={5000} step={50} onChange={e => setSpeed(Number(e.target.value))} /></label>
              <label>Target Profit<input type='number' value={targetProfit} min={0} step={0.5} onChange={e => setTargetProfit(Number(e.target.value))} /></label>
              <label>Stop Loss<input type='number' value={stopLoss} min={0} step={0.5} onChange={e => setStopLoss(Number(e.target.value))} /></label>
            </div>
          </div>

          <button
            className={`speed-lab__run-btn ${isRunning ? 'speed-lab__run-btn--stop' : ''}`}
            onClick={handleStart}
          >
            {isRunning ? '⏹ Stop' : '▶ Start Auto Trade'}
          </button>

          <div className='speed-lab__stats'>
            <div className='speed-lab__stat'>
              <span>Total P/L</span>
              <strong className={totalProfit >= 0 ? 'pos' : 'neg'}>{totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)}</strong>
            </div>
            <div className='speed-lab__stat'>
              <span>Wins</span>
              <strong className='pos'>{winCount}</strong>
            </div>
            <div className='speed-lab__stat'>
              <span>Losses</span>
              <strong className='neg'>{lossCount}</strong>
            </div>
            <div className='speed-lab__stat'>
              <span>Win Rate</span>
              <strong>{winCount + lossCount > 0 ? ((winCount / (winCount + lossCount)) * 100).toFixed(0) : 0}%</strong>
            </div>
          </div>
        </div>

        <div className='speed-lab__right'>
          <div className='speed-lab__card'>
            <h3>Digit Distribution</h3>
            <DigitCircles digits={digits} lastDigit={lastDigit} size='sm' nowrap />
          </div>

          <div className='speed-lab__card speed-lab__log-card'>
            <h3>Execution Log</h3>
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

      <AIAssistant digits={digits} lastDigit={lastDigit} symbol={symbol} />
    </div>
  );
});

export default SpeedLab;
