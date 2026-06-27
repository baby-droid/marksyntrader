// @ts-nocheck
import React, { useState, useCallback, lazy, Suspense } from 'react';
import { observer } from 'mobx-react-lite';
import DigitCircles from '@/components/digit-circles';
import AIAssistant from '@/components/ai-assistant';
import { useDigitStats } from '@/hooks/useDigitStats';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import ChunkLoader from '@/components/loader/chunk-loader';
import './manual-trader.scss';

const ChartWrapper = lazy(() => import('../chart/chart-wrapper'));

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

const TRADE_TYPES = [
  { label: 'Rise/Fall', contracts: ['CALL', 'PUT'] },
  { label: 'Even/Odd', contracts: ['DIGITEVEN', 'DIGITODD'] },
  { label: 'Over/Under', contracts: ['DIGITOVER', 'DIGITUNDER'], needsBarrier: true },
  { label: 'Matches/Differs', contracts: ['DIGITMATCH', 'DIGITDIFF'], needsBarrier: true },
];

const DURATIONS = [
  { label: '1 tick', value: 1, unit: 't' },
  { label: '2 ticks', value: 2, unit: 't' },
  { label: '3 ticks', value: 3, unit: 't' },
  { label: '5 ticks', value: 5, unit: 't' },
  { label: '10 ticks', value: 10, unit: 't' },
  { label: '15 secs', value: 15, unit: 's' },
  { label: '1 min', value: 60, unit: 's' },
];

const ManualTrader = observer(() => {
  const { digits, lastDigit, currentPrice, symbol, setSymbol, isConnected } = useDigitStats('R_10');
  const { balance, currency, buyContract, isTrading, tradeResults, totalProfit, winCount, lossCount } = useDerivTrading();
  const [tradeTypeIdx, setTradeTypeIdx] = useState(0);
  const [stake, setStake] = useState(50);
  const [durationIdx, setDurationIdx] = useState(0);
  const [barrier, setBarrier] = useState(5);
  const [showChart, setShowChart] = useState(true);
  const [allowEquals, setAllowEquals] = useState(false);

  const tradeType = TRADE_TYPES[tradeTypeIdx];
  const duration = DURATIONS[durationIdx];

  const handleBuy = useCallback(async (contractType: string) => {
    await buyContract({
      symbol,
      contract_type: contractType,
      stake,
      duration: duration.value,
      duration_unit: duration.unit,
      barrier: tradeType.needsBarrier ? barrier : undefined,
    });
  }, [symbol, stake, duration, barrier, tradeType, buyContract]);

  const getButtonLabels = () => {
    const [a, b] = tradeType.contracts;
    if (tradeTypeIdx === 0) return [{ label: 'Rise', type: a, color: 'rise' }, { label: 'Fall', type: b, color: 'fall' }];
    if (tradeTypeIdx === 1) return [{ label: 'Even', type: a, color: 'even' }, { label: 'Odd', type: b, color: 'odd' }];
    if (tradeTypeIdx === 2) return [{ label: `Over ${barrier}`, type: a, color: 'over' }, { label: `Under ${barrier}`, type: b, color: 'under' }];
    return [{ label: `Matches ${barrier}`, type: a, color: 'rise' }, { label: `Differs ${barrier}`, type: b, color: 'fall' }];
  };

  const buttons = getButtonLabels();
  const payout = (stake * 0.9132).toFixed(2);

  return (
    <div className='manual-trader'>
      {/* Header bar like dtrader */}
      <div className='manual-trader__topbar'>
        <div className='manual-trader__trade-tabs'>
          {TRADE_TYPES.map((t, i) => (
            <button key={t.label} className={`manual-trader__tab ${tradeTypeIdx === i ? 'active' : ''}`} onClick={() => setTradeTypeIdx(i)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className='manual-trader__header-right'>
          {balance !== null && (
            <div className='manual-trader__balance'>
              {currency} {balance.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      <div className='manual-trader__body'>
        {/* Chart area */}
        <div className='manual-trader__chart-area'>
          <div className='manual-trader__chart-header'>
            <select className='manual-trader__symbol-select' value={symbol} onChange={e => setSymbol(e.target.value)}>
              {SYMBOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <span className='manual-trader__price'>{currentPrice?.toFixed(3) ?? '---'}</span>
            <span className={`manual-trader__live ${isConnected ? 'live' : ''}`}>
              {isConnected ? '● LIVE' : '● OFF'}
            </span>
          </div>

          {showChart && (
            <div className='manual-trader__chart'>
              <Suspense fallback={<ChunkLoader message='Loading chart...' />}>
                <ChartWrapper show_digits_stats={true} />
              </Suspense>
            </div>
          )}

          <div className='manual-trader__digits-section'>
            <div className='manual-trader__digits-header'>
              <h3>Digit Distribution</h3>
              <button className='manual-trader__toggle-chart' onClick={() => setShowChart(!showChart)}>
                {showChart ? '▲ Hide Chart' : '▼ Show Chart'}
              </button>
            </div>
            <DigitCircles digits={digits} lastDigit={lastDigit} size='sm' />
          </div>
        </div>

        {/* Right panel */}
        <div className='manual-trader__panel'>
          <div className='manual-trader__panel-body'>
            {/* Duration */}
            <div className='manual-trader__field'>
              <label>Duration</label>
              <div className='manual-trader__duration-grid'>
                {DURATIONS.map((d, i) => (
                  <button key={i} className={`manual-trader__duration-btn ${durationIdx === i ? 'active' : ''}`} onClick={() => setDurationIdx(i)}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stake */}
            <div className='manual-trader__field'>
              <label>Stake</label>
              <div className='manual-trader__stake-row'>
                <button className='manual-trader__stake-adj' onClick={() => setStake(s => Math.max(0.35, parseFloat((s - 1).toFixed(2))))}>−</button>
                <input
                  type='number'
                  value={stake}
                  min={0.35}
                  step={0.5}
                  onChange={e => setStake(Number(e.target.value))}
                  className='manual-trader__stake-input'
                />
                <span className='manual-trader__currency'>{currency}</span>
                <button className='manual-trader__stake-adj' onClick={() => setStake(s => parseFloat((s + 1).toFixed(2)))}>+</button>
              </div>
            </div>

            {/* Barrier for over/under/matches */}
            {tradeType.needsBarrier && (
              <div className='manual-trader__field'>
                <label>Barrier</label>
                <div className='manual-trader__barrier-row'>
                  {Array.from({ length: 10 }, (_, i) => (
                    <button key={i} className={`manual-trader__barrier-btn ${barrier === i ? 'active' : ''}`} onClick={() => setBarrier(i)}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tradeTypeIdx === 0 && (
              <div className='manual-trader__field manual-trader__field--toggle'>
                <label>Allow equals</label>
                <label className='manual-trader__toggle'>
                  <input type='checkbox' checked={allowEquals} onChange={e => setAllowEquals(e.target.checked)} />
                  <span className='manual-trader__toggle-slider' />
                </label>
              </div>
            )}

            {/* Payout info */}
            <div className='manual-trader__payout'>
              <span>Payout</span>
              <strong>{payout} {currency}</strong>
            </div>
          </div>

          {/* Buy buttons */}
          <div className='manual-trader__buy-btns'>
            {buttons.map(btn => (
              <button
                key={btn.type}
                className={`manual-trader__buy-btn manual-trader__buy-btn--${btn.color}`}
                onClick={() => handleBuy(btn.type)}
                disabled={isTrading}
              >
                {btn.label}
                <span className='manual-trader__buy-payout'>Payout {payout} {currency}</span>
              </button>
            ))}
          </div>

          {/* Results */}
          {tradeResults.length > 0 && (
            <div className='manual-trader__results'>
              <div className='manual-trader__results-row'>
                <span className={totalProfit >= 0 ? 'pos' : 'neg'}>
                  P/L: {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)}
                </span>
                <span>W:{winCount} L:{lossCount}</span>
              </div>
              <div className='manual-trader__trade-list'>
                {tradeResults.slice(0, 8).map(r => (
                  <div key={r.id} className={`manual-trader__trade-item ${r.won ? 'won' : 'lost'}`}>
                    <span>{r.type}</span>
                    <span>{r.profit >= 0 ? '+' : ''}{r.profit.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <AIAssistant digits={digits} lastDigit={lastDigit} symbol={symbol} onTrade={(type) => handleBuy(type)} />
    </div>
  );
});

export default ManualTrader;
