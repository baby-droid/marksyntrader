// @ts-nocheck
import React, { useState, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import { useDigitStats } from '@/hooks/useDigitStats';
import DigitCircles from '@/components/digit-circles';
import './bulk-trade.scss';

const MARKETS = [
  { label: 'V10',     value: 'R_10'      },
  { label: 'V25',     value: 'R_25'      },
  { label: 'V50',     value: 'R_50'      },
  { label: 'V75',     value: 'R_75'      },
  { label: 'V100',    value: 'R_100'     },
  { label: 'V10 1s',  value: '1HZ10V'   },
  { label: 'V25 1s',  value: '1HZ25V'   },
  { label: 'V50 1s',  value: '1HZ50V'   },
  { label: 'V75 1s',  value: '1HZ75V'   },
  { label: 'V100 1s', value: '1HZ100V'  },
  { label: 'Jump 10', value: 'JD10'     },
  { label: 'Jump 25', value: 'JD25'     },
  { label: 'Jump 50', value: 'JD50'     },
  { label: 'Jump 75', value: 'JD75'     },
  { label: 'Jump 100',value: 'JD100'    },
];

const TRADE_TYPES = [
  { label: '⬆ Rise',  value: 'CALL'       },
  { label: '⬇ Fall',  value: 'PUT'        },
  { label: 'Even',    value: 'DIGITEVEN'  },
  { label: 'Odd',     value: 'DIGITODD'   },
  { label: 'Over',    value: 'DIGITOVER'  },
  { label: 'Under',   value: 'DIGITUNDER' },
  { label: 'Match',   value: 'DIGITMATCH' },
  { label: 'Differ',  value: 'DIGITDIFF'  },
];

const TICK_OPTIONS = [1, 2, 3, 5, 10];
const STAKE_PRESETS = [0.35, 0.5, 1, 2, 5];
const COUNT_OPTIONS = [2, 3, 5, 10, 20, 50];

const BulkTrade = observer(() => {
  const [market, setMarket] = useState('1HZ100V');
  const [tradeType, setTradeType] = useState('DIGITOVER');
  const [prediction, setPrediction] = useState(7);
  const [stake, setStake] = useState(0.35);
  const [ticks, setTicks] = useState(1);
  const [count, setCount] = useState(5);
  const [martingale, setMartingale] = useState(false);
  const [martMult, setMartMult] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [disclaimer, setDisclaimer] = useState(true);

  const { balance, currency, buyContract, tradeResults, winCount, lossCount, totalProfit, clearResults } = useDerivTrading();
  const { digits, lastDigit, currentPrice, isConnected } = useDigitStats(market);

  const prevDigitRef = React.useRef<number | null>(null);
  const [digitFlash, setDigitFlash] = React.useState(false);
  React.useEffect(() => {
    if (lastDigit !== null && lastDigit !== prevDigitRef.current) {
      prevDigitRef.current = lastDigit;
      setDigitFlash(true);
      const t = setTimeout(() => setDigitFlash(false), 300);
      return () => clearTimeout(t);
    }
  }, [lastDigit]);

  const needsPrediction = ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(tradeType);

  const runBulk = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      // Single click → open `count` identical contracts at the same entry.
      const promises = Array.from({ length: count }, () =>
        buyContract({
          symbol: market,
          contract_type: tradeType,
          stake,
          duration: ticks,
          barrier: needsPrediction ? String(prediction) : undefined,
        })
      );
      await Promise.all(promises);
    } catch (e) {
      console.error('Bulk trade error', e);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, count, stake, market, tradeType, ticks, prediction, buyContract, needsPrediction]);

  const wins = winCount;
  const losses = lossCount;
  const settled = winCount + lossCount;

  return (
    <div className='bulk-trade'>
      {/* Disclaimer */}
      {disclaimer && (
        <div className='bulk-trade__disclaimer'>
          <span>⚠</span>
          <span>RISK DISCLAIMER — Bulk trading involves high risk. Only trade what you can afford to lose. AHMED SYN TRADER provides tools, not financial advice.</span>
          <button onClick={() => setDisclaimer(false)}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className='bulk-trade__header'>
        <div>
          <h2 className='bulk-trade__title'>⚡ Bulk Trade</h2>
          <p className='bulk-trade__sub'>AHMED SYN TRADER — Execute {count} contracts simultaneously at the same entry spot</p>
        </div>
        <div className='bulk-trade__header-right'>
          <div className='bulk-trade__balance'>
            <span>Balance</span>
            <strong>{currency} {Number(balance).toFixed(2)}</strong>
          </div>
          <div className={`bulk-trade__conn ${isConnected ? 'on' : 'off'}`}>
            {isConnected ? '● Live' : '○ Offline'}
          </div>
        </div>
      </div>

      {/* Current Digit Triangle Display */}
      <div className='bulk-trade__digit-display'>
        <div className={`bulk-trade__digit-triangle-wrap ${digitFlash ? 'flash' : ''}`}>
          <div className='bulk-trade__digit-triangle'>▲</div>
          <div className='bulk-trade__digit-value'>{lastDigit !== null ? lastDigit : '—'}</div>
          <div className='bulk-trade__digit-tag'>CURRENT DIGIT</div>
        </div>
        <div className='bulk-trade__price-live'>
          <span>Live Price</span>
          <strong>{currentPrice ?? '—'}</strong>
        </div>
      </div>

      {/* Digit Circles */}
      <div className='bulk-trade__circles-section'>
        <DigitCircles digits={digits} lastDigit={lastDigit} />
      </div>

      {/* Controls Card */}
      <div className='bulk-trade__controls'>
        {/* Market */}
        <div className='bulk-trade__group'>
          <label>Market</label>
          <div className='bulk-trade__pills'>
            {MARKETS.map(m => (
              <button key={m.value} className={`bulk-trade__pill ${market === m.value ? 'active' : ''}`} onClick={() => setMarket(m.value)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Trade Type */}
        <div className='bulk-trade__group'>
          <label>Trade Type</label>
          <div className='bulk-trade__pills'>
            {TRADE_TYPES.map(t => (
              <button key={t.value} className={`bulk-trade__pill ${tradeType === t.value ? 'active' : ''}`} onClick={() => setTradeType(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prediction (digits) */}
        {needsPrediction && (
          <div className='bulk-trade__group'>
            <label>Prediction (digit 0–9)</label>
            <div className='bulk-trade__pills'>
              {[0,1,2,3,4,5,6,7,8,9].map(d => (
                <button
                  key={d}
                  className={`bulk-trade__pill bulk-trade__pill--digit ${prediction === d ? 'active' : ''}`}
                  onClick={() => setPrediction(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Row: Ticks + Count + Stake */}
        <div className='bulk-trade__row3'>
          <div className='bulk-trade__group'>
            <label>Ticks Duration</label>
            <div className='bulk-trade__pills'>
              {TICK_OPTIONS.map(t => (
                <button key={t} className={`bulk-trade__pill ${ticks === t ? 'active' : ''}`} onClick={() => setTicks(t)}>
                  {t}T
                </button>
              ))}
            </div>
          </div>

          <div className='bulk-trade__group'>
            <label>Contracts Count</label>
            <div className='bulk-trade__pills'>
              {COUNT_OPTIONS.map(c => (
                <button key={c} className={`bulk-trade__pill ${count === c ? 'active' : ''}`} onClick={() => setCount(c)}>
                  {c}
                </button>
              ))}
              <input
                type='number' min={1} max={100}
                value={count}
                onChange={e => setCount(Math.max(1, Number(e.target.value)))}
                className='bulk-trade__num-input'
                title='Custom count'
              />
            </div>
          </div>

          <div className='bulk-trade__group'>
            <label>Stake per Contract ({currency})</label>
            <div className='bulk-trade__pills'>
              {STAKE_PRESETS.map(s => (
                <button key={s} className={`bulk-trade__pill ${stake === s ? 'active' : ''}`} onClick={() => setStake(s)}>
                  ${s}
                </button>
              ))}
              <input
                type='number' min={0.35} step={0.01}
                value={stake}
                onChange={e => setStake(Number(e.target.value))}
                className='bulk-trade__num-input'
              />
            </div>
          </div>
        </div>

        {/* Martingale */}
        <div className='bulk-trade__group bulk-trade__group--row'>
          <label>Martingale on Loss</label>
          <button className={`bulk-trade__toggle ${martingale ? 'on' : ''}`} onClick={() => setMartingale(p => !p)}>
            {martingale ? 'ON' : 'OFF'}
          </button>
          {martingale && (
            <>
              <label style={{ marginLeft: '1.6rem' }}>Multiplier</label>
              <input type='number' min={1.1} max={5} step={0.1} value={martMult}
                onChange={e => setMartMult(Number(e.target.value))}
                className='bulk-trade__num-input'
              />
            </>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className='bulk-trade__summary'>
        <div className='bulk-trade__summary-item'>
          <span>Contracts</span><strong>{count}</strong>
        </div>
        <div className='bulk-trade__summary-item'>
          <span>Total Stake</span><strong>{currency} {(stake * count).toFixed(2)}</strong>
        </div>
        <div className='bulk-trade__summary-item'>
          <span>Market</span><strong>{market}</strong>
        </div>
        <div className='bulk-trade__summary-item'>
          <span>Type</span><strong>{tradeType}{needsPrediction ? ` [${prediction}]` : ''}</strong>
        </div>
        <div className='bulk-trade__summary-item bulk-trade__summary-item--green'>
          <span>Wins</span><strong>{wins}</strong>
        </div>
        <div className='bulk-trade__summary-item bulk-trade__summary-item--red'>
          <span>Losses</span><strong>{losses}</strong>
        </div>
        <div className={`bulk-trade__summary-item ${totalProfit >= 0 ? 'bulk-trade__summary-item--green' : 'bulk-trade__summary-item--red'}`}>
          <span>Net P/L</span><strong>{currency} {totalProfit.toFixed(2)}</strong>
        </div>
      </div>

      {/* Execute */}
      <button
        className={`bulk-trade__execute ${isRunning ? 'running' : ''}`}
        onClick={runBulk}
        disabled={isRunning || !isConnected}
      >
        {isRunning
          ? `⏳ Sending ${count} contracts...`
          : `⚡ Execute ${count} ${tradeType} Contracts — ${currency} ${(stake * count).toFixed(2)} total`
        }
      </button>

      {/* Results log */}
      {(tradeResults.length > 0 || isRunning) && (
        <div className='bulk-trade__results'>
          <div className='bulk-trade__results-hdr'>
            <h3>Trade Log ({tradeResults.length}{isRunning ? ` · ${count - settled} pending` : ''})</h3>
            <button onClick={clearResults}>Clear</button>
          </div>
          <div className='bulk-trade__results-list'>
            {tradeResults.map(r => {
              const st = r.won ? 'won' : 'lost';
              return (
                <div key={r.id} className={`bulk-trade__result-row bulk-trade__result-row--${st}`}>
                  <span className='bulk-trade__result-time'>{new Date(r.time).toLocaleTimeString()}</span>
                  <span>{r.type}</span>
                  <span>{market}</span>
                  <span>{currency} {r.stake.toFixed(2)}</span>
                  <span className={`bulk-trade__result-status bulk-trade__result-status--${st}`}>
                    {r.won ? '✓ Won' : '✗ Lost'} {r.profit >= 0 ? '+' : ''}{r.profit.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export default BulkTrade;
