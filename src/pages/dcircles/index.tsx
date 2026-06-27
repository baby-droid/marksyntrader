// @ts-nocheck
import React, { useState, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import DigitCircles from '@/components/digit-circles';
import AIAssistant from '@/components/ai-assistant';
import { useDigitStats } from '@/hooks/useDigitStats';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import './dcircles.scss';

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

const PATTERN_VIEWS = ['EVEN/ODD', 'OVER/UNDER'];

const DCircles = observer(() => {
  const { digits, lastDigit, currentPrice, lastTicks, symbol, setSymbol, isConnected } = useDigitStats('R_10');
  const { balance, currency, buyContract, isTrading, tradeResults, totalProfit, winCount, lossCount } = useDerivTrading();
  const [patternView, setPatternView] = useState('EVEN/ODD');
  const [stake, setStake] = useState(1);
  const [duration, setDuration] = useState(1);
  const [autoTrade, setAutoTrade] = useState(false);
  const [autoType, setAutoType] = useState<'even' | 'odd' | 'over' | 'under'>('even');
  const [autoBarrier, setAutoBarrier] = useState(5);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const evenPct = digits.filter(d => d.digit % 2 === 0).reduce((s, d) => s + d.percentage, 0);
  const oddPct = 100 - evenPct;
  const lowestDigit = [...digits].sort((a, b) => a.percentage - b.percentage)[0];
  const highestDigit = [...digits].sort((a, b) => b.percentage - a.percentage)[0];

  const last50 = lastTicks.slice(-50);
  const patternBadges = last50.map(p => {
    const s = p.toFixed(2);
    const d = parseInt(s[s.length - 1], 10);
    if (patternView === 'EVEN/ODD') return d % 2 === 0 ? { label: 'E', type: 'even' } : { label: 'O', type: 'odd' };
    return d > autoBarrier ? { label: 'O', type: 'over' } : { label: 'U', type: 'under' };
  });

  const handleBuy = useCallback(async (type: string, barrier?: number) => {
    const contractType = type === 'CALL' || type === 'over' ? 'CALL' :
      type === 'PUT' || type === 'under' ? 'PUT' :
        type === 'even' || type === 'DIGITEVEN' ? 'DIGITEVEN' :
          type === 'odd' || type === 'DIGITODD' ? 'DIGITODD' :
            type.startsWith('Over') ? 'DIGITOVER' :
              type.startsWith('Under') ? 'DIGITUNDER' : type;

    await buyContract({
      symbol,
      contract_type: contractType,
      stake,
      duration,
      barrier: barrier !== undefined ? barrier : autoBarrier,
    });
  }, [symbol, stake, duration, autoBarrier, buyContract]);

  const toggleAutoTrade = useCallback(() => {
    if (autoTrade) {
      if (autoRef.current) clearInterval(autoRef.current);
      setAutoTrade(false);
    } else {
      setAutoTrade(true);
      const contractType = autoType === 'even' ? 'DIGITEVEN' : autoType === 'odd' ? 'DIGITODD' :
        autoType === 'over' ? 'DIGITOVER' : 'DIGITUNDER';
      autoRef.current = setInterval(() => {
        buyContract({ symbol, contract_type: contractType, stake, duration, barrier: autoBarrier });
      }, 1000);
    }
  }, [autoTrade, autoType, symbol, stake, duration, autoBarrier, buyContract]);

  React.useEffect(() => {
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, []);

  const streak = (() => {
    if (patternBadges.length === 0) return { type: '', count: 0 };
    const last = patternBadges[patternBadges.length - 1];
    let count = 0;
    for (let i = patternBadges.length - 1; i >= 0; i--) {
      if (patternBadges[i].type === last.type) count++;
      else break;
    }
    return { type: last.label, count };
  })();

  return (
    <div className='dcircles'>
      <div className='dcircles__header'>
        <div className='dcircles__price'>
          <h1>{currentPrice?.toFixed(3) ?? '---'}</h1>
          <span>CURRENT PRICE</span>
        </div>
        <div className='dcircles__controls'>
          <select value={symbol} onChange={e => setSymbol(e.target.value)}>
            {SYMBOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <span className={`dcircles__status ${isConnected ? 'dcircles__status--live' : ''}`}>
            {isConnected ? '🟢 LIVE' : '🔴'}
          </span>
        </div>
        {balance !== null && (
          <div className='dcircles__balance'>
            {currency} {balance.toFixed(2)}
          </div>
        )}
      </div>

      <div className='dcircles__section'>
        <div className='dcircles__section-header' onClick={() => setIsCollapsed(!isCollapsed)}>
          <h2>DIGIT DISTRIBUTION</h2>
          <button className='dcircles__collapse'>{isCollapsed ? '▼' : '▲'}</button>
        </div>
        {!isCollapsed && <DigitCircles digits={digits} lastDigit={lastDigit} />}
      </div>

      <div className='dcircles__section'>
        <div className='dcircles__section-header'>
          <h2>PATTERN ANALYSIS</h2>
          <div className='dcircles__view-toggle'>
            {PATTERN_VIEWS.map(v => (
              <button key={v} className={`dcircles__view-btn ${patternView === v ? 'active' : ''}`} onClick={() => setPatternView(v)}>{v}</button>
            ))}
          </div>
        </div>

        {patternView === 'EVEN/ODD' && (
          <div className='dcircles__bars'>
            <div className='dcircles__bar-row'>
              <span>Even</span>
              <div className='dcircles__bar-track'>
                <div className='dcircles__bar dcircles__bar--even' style={{ width: `${evenPct}%` }}>{evenPct.toFixed(1)}%</div>
              </div>
            </div>
            <div className='dcircles__bar-row'>
              <span>Odd</span>
              <div className='dcircles__bar-track'>
                <div className='dcircles__bar dcircles__bar--odd' style={{ width: `${oddPct}%` }}>{oddPct.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        )}

        {patternView === 'OVER/UNDER' && (
          <div className='dcircles__bars'>
            <div className='dcircles__bar-row'>
              <span>Over {autoBarrier}</span>
              <div className='dcircles__bar-track'>
                <div className='dcircles__bar dcircles__bar--even' style={{ width: `${(digits.filter(d => d.digit > autoBarrier).reduce((s, d) => s + d.percentage, 0)).toFixed(0)}%` }}>
                  {digits.filter(d => d.digit > autoBarrier).reduce((s, d) => s + d.percentage, 0).toFixed(1)}%
                </div>
              </div>
            </div>
            <div className='dcircles__bar-row'>
              <span>Under {autoBarrier}</span>
              <div className='dcircles__bar-track'>
                <div className='dcircles__bar dcircles__bar--odd' style={{ width: `${(digits.filter(d => d.digit <= autoBarrier).reduce((s, d) => s + d.percentage, 0)).toFixed(0)}%` }}>
                  {digits.filter(d => d.digit <= autoBarrier).reduce((s, d) => s + d.percentage, 0).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        <div className='dcircles__last-digits'>
          <p>LAST {last50.length} DIGITS PATTERN</p>
          <div className='dcircles__badges'>
            {patternBadges.map((b, i) => (
              <span key={i} className={`dcircles__badge dcircles__badge--${b.type}`}>{b.label}</span>
            ))}
          </div>
          <p className='dcircles__streak'>Current streak: <strong>{streak.count} {streak.type === 'E' ? 'Even' : streak.type === 'O' && patternView === 'EVEN/ODD' ? 'Odd' : streak.type === 'O' ? 'Over' : 'Under'}</strong></p>
        </div>
      </div>

      <div className='dcircles__section dcircles__trade-panel'>
        <h2>TRADE</h2>
        <div className='dcircles__trade-row'>
          <div className='dcircles__trade-field'>
            <label>Stake ({currency})</label>
            <input type='number' value={stake} min={0.35} step={0.1} onChange={e => setStake(Number(e.target.value))} />
          </div>
          <div className='dcircles__trade-field'>
            <label>Ticks</label>
            <input type='number' value={duration} min={1} max={10} onChange={e => setDuration(Number(e.target.value))} />
          </div>
          <div className='dcircles__trade-field'>
            <label>Barrier</label>
            <input type='number' value={autoBarrier} min={0} max={9} onChange={e => setAutoBarrier(Number(e.target.value))} />
          </div>
        </div>
        <div className='dcircles__trade-btns'>
          <button className='dcircles__btn dcircles__btn--even' onClick={() => handleBuy('DIGITEVEN')} disabled={isTrading}>Buy Even</button>
          <button className='dcircles__btn dcircles__btn--odd' onClick={() => handleBuy('DIGITODD')} disabled={isTrading}>Buy Odd</button>
          <button className='dcircles__btn dcircles__btn--over' onClick={() => handleBuy('DIGITOVER', autoBarrier)} disabled={isTrading}>Over {autoBarrier}</button>
          <button className='dcircles__btn dcircles__btn--under' onClick={() => handleBuy('DIGITUNDER', autoBarrier)} disabled={isTrading}>Under {autoBarrier}</button>
        </div>

        <div className='dcircles__auto'>
          <select value={autoType} onChange={e => setAutoType(e.target.value as any)}>
            <option value='even'>Auto Even</option>
            <option value='odd'>Auto Odd</option>
            <option value='over'>Auto Over</option>
            <option value='under'>Auto Under</option>
          </select>
          <button className={`dcircles__btn dcircles__btn--auto ${autoTrade ? 'dcircles__btn--stop' : ''}`} onClick={toggleAutoTrade}>
            {autoTrade ? '⏹ Stop Auto' : '▶ Start Auto Trade'}
          </button>
        </div>

        {tradeResults.length > 0 && (
          <div className='dcircles__results'>
            <div className='dcircles__results-summary'>
              <span>Total P/L: <strong className={totalProfit >= 0 ? 'pos' : 'neg'}>{totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)}</strong></span>
              <span>W: <strong className='pos'>{winCount}</strong> L: <strong className='neg'>{lossCount}</strong></span>
            </div>
            <div className='dcircles__trade-history'>
              {tradeResults.slice(0, 10).map(r => (
                <div key={r.id} className={`dcircles__trade-result ${r.won ? 'won' : 'lost'}`}>
                  <span>{r.type}</span>
                  <span>{r.won ? '+' : ''}{r.profit.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AIAssistant digits={digits} lastDigit={lastDigit} symbol={symbol} onTrade={handleBuy} />
    </div>
  );
});

export default DCircles;
