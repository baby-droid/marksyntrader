// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import DigitCircles from '@/components/digit-circles';
import AIAssistant from '@/components/ai-assistant';
import { useDigitStats } from '@/hooks/useDigitStats';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import './pro-hedge.scss';

const SYMBOLS = [
  { label: 'Volatility 10 Index', value: 'R_10' },
  { label: 'Volatility 25 Index', value: 'R_25' },
  { label: 'Volatility 50 Index', value: 'R_50' },
  { label: 'Volatility 75 Index', value: 'R_75' },
  { label: 'Volatility 100 Index', value: 'R_100' },
  { label: 'Volatility 10 (1s)', value: '1HZ10V' },
  { label: 'Volatility 25 (1s)', value: '1HZ25V' },
  { label: 'Volatility 50 (1s)', value: '1HZ50V' },
  { label: 'Volatility 75 (1s)', value: '1HZ75V' },
  { label: 'Volatility 100 (1s)', value: '1HZ100V' },
];

const ProHedge = observer(() => {
  const { digits, lastDigit, currentPrice, symbol, setSymbol, isConnected } = useDigitStats('R_100');
  const { balance, currency, buyContract, buyBothDirections, isTrading, tradeResults, totalProfit, winCount, lossCount, clearResults } = useDerivTrading();
  const [callStake, setCallStake] = useState(1);
  const [putStake, setPutStake] = useState(1);
  const [duration, setDuration] = useState(1);
  const [hedgeMode, setHedgeMode] = useState<'simultaneous' | 'sequential'>('simultaneous');
  const [autoHedge, setAutoHedge] = useState(false);
  const [hedgeInterval, setHedgeInterval] = useState(2000);
  const [martingale, setMartingale] = useState(1);
  const [lossStreak, setLossStreak] = useState(0);
  const [hedgeLog, setHedgeLog] = useState<{ time: string; callEntry: number; putEntry: number; callExit?: number; putExit?: number; profit: number }[]>([]);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentCallStake = useRef(callStake);
  const currentPutStake = useRef(putStake);

  useEffect(() => { currentCallStake.current = callStake; }, [callStake]);
  useEffect(() => { currentPutStake.current = putStake; }, [putStake]);

  const executeHedge = useCallback(async () => {
    const cStake = currentCallStake.current;
    const pStake = currentPutStake.current;

    const logEntry = {
      time: new Date().toLocaleTimeString(),
      callEntry: currentPrice ?? 0,
      putEntry: currentPrice ?? 0,
      profit: 0,
    };

    if (hedgeMode === 'simultaneous') {
      // Buy both at EXACT SAME time - same entry spot
      const [callResult, putResult] = await Promise.all([
        buyContract({ symbol, contract_type: 'CALL', stake: cStake, duration }),
        buyContract({ symbol, contract_type: 'PUT', stake: pStake, duration }),
      ]);
      if (callResult || putResult) {
        setHedgeLog(prev => [logEntry, ...prev].slice(0, 100));
      }
    } else {
      // Sequential: Call first, then PUT on next tick
      await buyContract({ symbol, contract_type: 'CALL', stake: cStake, duration });
      await buyContract({ symbol, contract_type: 'PUT', stake: pStake, duration });
      setHedgeLog(prev => [logEntry, ...prev].slice(0, 100));
    }
  }, [symbol, duration, hedgeMode, buyContract, currentPrice]);

  const toggleAutoHedge = useCallback(() => {
    if (autoHedge) {
      if (autoRef.current) clearInterval(autoRef.current);
      setAutoHedge(false);
    } else {
      setAutoHedge(true);
      executeHedge();
      autoRef.current = setInterval(executeHedge, hedgeInterval);
    }
  }, [autoHedge, hedgeInterval, executeHedge]);

  useEffect(() => {
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, []);

  // Apply martingale on loss
  useEffect(() => {
    if (tradeResults.length > 0) {
      const last = tradeResults[0];
      if (!last.won && martingale > 1) {
        currentCallStake.current = parseFloat((currentCallStake.current * martingale).toFixed(2));
        currentPutStake.current = parseFloat((currentPutStake.current * martingale).toFixed(2));
        setLossStreak(prev => prev + 1);
      } else if (last.won) {
        currentCallStake.current = callStake;
        currentPutStake.current = putStake;
        setLossStreak(0);
      }
    }
  }, [tradeResults.length]);

  const netProfit = tradeResults.reduce((s, r) => s + r.profit, 0);

  return (
    <div className='pro-hedge'>
      <div className='pro-hedge__header'>
        <div>
          <h1>⚖ Pro Hedge</h1>
          <p>Same entry &amp; exit spot — CALL + PUT simultaneously</p>
        </div>
        {balance !== null && (
          <div className='pro-hedge__balance'>{currency} {balance.toFixed(2)}</div>
        )}
      </div>

      <div className='pro-hedge__body'>
        <div className='pro-hedge__left'>
          <div className='pro-hedge__card'>
            <div className='pro-hedge__row'>
              <div>
                <label>Symbol</label>
                <select value={symbol} onChange={e => setSymbol(e.target.value)}>
                  {SYMBOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className='pro-hedge__price-box'>
                <strong>{currentPrice?.toFixed(3) ?? '---'}</strong>
                <span className={isConnected ? 'live' : 'dead'}>{isConnected ? '● LIVE' : '● OFF'}</span>
              </div>
            </div>
          </div>

          <div className='pro-hedge__hedge-cards'>
            <div className='pro-hedge__direction-card pro-hedge__direction-card--call'>
              <h3>📈 CALL (Rise)</h3>
              <label>Stake ({currency})</label>
              <input type='number' value={callStake} min={0.35} step={0.1} onChange={e => setCallStake(Number(e.target.value))} />
            </div>
            <div className='pro-hedge__direction-card pro-hedge__direction-card--put'>
              <h3>📉 PUT (Fall)</h3>
              <label>Stake ({currency})</label>
              <input type='number' value={putStake} min={0.35} step={0.1} onChange={e => setPutStake(Number(e.target.value))} />
            </div>
          </div>

          <div className='pro-hedge__card'>
            <div className='pro-hedge__params'>
              <label>Duration (ticks)<input type='number' value={duration} min={1} max={10} onChange={e => setDuration(Number(e.target.value))} /></label>
              <label>Martingale<input type='number' value={martingale} min={1} step={0.1} onChange={e => setMartingale(Number(e.target.value))} /></label>
              <label>Auto Interval (ms)<input type='number' value={hedgeInterval} min={500} step={100} onChange={e => setHedgeInterval(Number(e.target.value))} /></label>
            </div>
          </div>

          <div className='pro-hedge__mode'>
            <h3>Hedge Mode</h3>
            <div className='pro-hedge__mode-btns'>
              <button className={hedgeMode === 'simultaneous' ? 'active' : ''} onClick={() => setHedgeMode('simultaneous')}>
                ⚡ Simultaneous<br /><small>Same tick entry/exit</small>
              </button>
              <button className={hedgeMode === 'sequential' ? 'active' : ''} onClick={() => setHedgeMode('sequential')}>
                🔁 Sequential<br /><small>Call then Put</small>
              </button>
            </div>
          </div>

          <div className='pro-hedge__actions'>
            <button className='pro-hedge__btn pro-hedge__btn--hedge' onClick={executeHedge} disabled={isTrading}>
              ⚡ Execute Hedge Now
            </button>
            <button className={`pro-hedge__btn ${autoHedge ? 'pro-hedge__btn--stop' : 'pro-hedge__btn--auto'}`} onClick={toggleAutoHedge}>
              {autoHedge ? '⏹ Stop Auto' : '▶ Auto Trade'}
            </button>
          </div>

          <div className='pro-hedge__summary'>
            <div className='pro-hedge__summary-item'>
              <span>Net P/L</span>
              <strong className={netProfit >= 0 ? 'pos' : 'neg'}>{netProfit >= 0 ? '+' : ''}{netProfit.toFixed(2)}</strong>
            </div>
            <div className='pro-hedge__summary-item'>
              <span>Hedges</span>
              <strong>{hedgeLog.length}</strong>
            </div>
            <div className='pro-hedge__summary-item'>
              <span>Wins</span>
              <strong className='pos'>{winCount}</strong>
            </div>
            <div className='pro-hedge__summary-item'>
              <span>Losses</span>
              <strong className='neg'>{lossCount}</strong>
            </div>
            {lossStreak > 0 && (
              <div className='pro-hedge__summary-item'>
                <span>Loss Streak</span>
                <strong className='neg'>{lossStreak}x</strong>
              </div>
            )}
          </div>
        </div>

        <div className='pro-hedge__right'>
          <div className='pro-hedge__card'>
            <h3>Digit Distribution</h3>
            <DigitCircles digits={digits} lastDigit={lastDigit} size='sm' />
          </div>

          <div className='pro-hedge__card'>
            <h3>Hedge Log</h3>
            <div className='pro-hedge__log'>
              {hedgeLog.length === 0 && <p className='pro-hedge__empty'>No hedges executed yet.</p>}
              {hedgeLog.map((entry, i) => (
                <div key={i} className='pro-hedge__log-entry'>
                  <span>{entry.time}</span>
                  <span>Entry: {entry.callEntry.toFixed(3)}</span>
                  <span className='pro-hedge__mode-tag'>{hedgeMode === 'simultaneous' ? '⚡ SYNC' : '🔁 SEQ'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className='pro-hedge__card'>
            <h3>Trade Results</h3>
            <div className='pro-hedge__trades'>
              {tradeResults.slice(0, 20).map(r => (
                <div key={r.id} className={`pro-hedge__trade ${r.won ? 'won' : 'lost'}`}>
                  <span>{r.type}</span>
                  <span>{r.stake.toFixed(2)}</span>
                  <span>{r.won ? '+' : ''}{r.profit.toFixed(2)}</span>
                </div>
              ))}
              {tradeResults.length === 0 && <p className='pro-hedge__empty'>No trades yet</p>}
            </div>
          </div>
        </div>
      </div>

      <AIAssistant digits={digits} lastDigit={lastDigit} symbol={symbol} />
    </div>
  );
});

export default ProHedge;
