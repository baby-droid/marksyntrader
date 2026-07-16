// @ts-nocheck
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import { useDigitStats } from '@/hooks/useDigitStats';
import DigitCircles from '@/components/digit-circles';
import NumberField from '@/components/number-field';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import './bulk-trade.scss';

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
        <span className={`bulk-trade__acct-badge ${isDemo ? 'demo' : 'real'}`}>
            {isDemo ? '🔵 DEMO' : '🟢 REAL'}
        </span>
    );
};

const MARKETS = [
  { label: 'V10',         value: 'R_10'      },
  { label: 'V25',         value: 'R_25'      },
  { label: 'V50',         value: 'R_50'      },
  { label: 'V75',         value: 'R_75'      },
  { label: 'V100',        value: 'R_100'     },
  { label: 'V10 1s',      value: '1HZ10V'    },
  { label: 'V25 1s',      value: '1HZ25V'    },
  { label: 'V50 1s',      value: '1HZ50V'    },
  { label: 'V75 1s',      value: '1HZ75V'    },
  { label: 'V100 1s',     value: '1HZ100V'   },
  { label: 'Jump 10',     value: 'JD10'      },
  { label: 'Jump 25',     value: 'JD25'      },
  { label: 'Jump 50',     value: 'JD50'      },
  { label: 'Jump 75',     value: 'JD75'      },
  { label: 'Jump 100',    value: 'JD100'     },
  { label: 'Crash 300N',  value: 'CRASH300N' },
  { label: 'Crash 500',   value: 'CRASH500'  },
  { label: 'Crash 1000',  value: 'CRASH1000' },
  { label: 'Boom 300N',   value: 'BOOM300N'  },
  { label: 'Boom 500',    value: 'BOOM500'   },
  { label: 'Boom 1000',   value: 'BOOM1000'  },
];

const TRADE_TYPES = [
  { label: '⬆ Rise',   value: 'CALL'       },
  { label: '⬇ Fall',   value: 'PUT'        },
  { label: 'Even',     value: 'DIGITEVEN'  },
  { label: 'Odd',      value: 'DIGITODD'   },
  { label: 'Over',     value: 'DIGITOVER'  },
  { label: 'Under',    value: 'DIGITUNDER' },
  { label: 'Match',    value: 'DIGITMATCH' },
  { label: 'Differ',   value: 'DIGITDIFF'  },
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
  const [displayCur, setDisplayCur] = useState(getDisplayCurrency());

  useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

  const fmt = (usd: number) => `${fromUsd(usd).toFixed(2)} ${displayCur}`;
  const fmtProfit = (usd: number) => `${usd >= 0 ? '+' : ''}${fromUsd(usd).toFixed(2)} ${displayCur}`;

  const { balance, currency, buyContract, tradeResults, winCount, lossCount, totalProfit, clearResults } = useDerivTrading();
  const { digits, lastDigit, currentPrice, isConnected, setSymbol } = useDigitStats(market);

  // Sync market changes into useDigitStats (it only reads initialSymbol on mount)
  useEffect(() => { setSymbol(market); }, [market, setSymbol]);

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

  const [activeStake, setActiveStake] = useState(stake);
  const prevResultLenRef = useRef(0);

  useEffect(() => { setActiveStake(stake); }, [stake]);

  const runBulk = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    const batchStake = activeStake;
    prevResultLenRef.current = tradeResults.length;
    try {
      const promises = Array.from({ length: count }, () =>
        buyContract({
          symbol: market,
          contract_type: tradeType,
          stake: batchStake,
          duration: ticks,
          duration_unit: 't',
          barrier: needsPrediction ? String(prediction) : undefined,
        })
      );
      await Promise.all(promises);
    } catch (e) {
      console.error('Bulk trade error', e);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, count, activeStake, market, tradeType, ticks, prediction, buyContract, needsPrediction, tradeResults.length]);

  useEffect(() => {
    if (!martingale || tradeResults.length === 0) return;
    const newCount = tradeResults.length - prevResultLenRef.current;
    // Wait until all contracts in the current batch have settled
    if (newCount < count) return;
    // tradeResults is ordered newest-first; the fresh batch is the first `newCount` items
    const newResults = tradeResults.slice(0, newCount);
    const batchWins   = newResults.filter(r => r.won).length;
    const batchLosses = newResults.filter(r => !r.won).length;
    if (batchLosses > batchWins) {
      setActiveStake(prev => Math.max(0.35, +(prev * martMult).toFixed(2)));
    } else {
      setActiveStake(stake);
    }
    // Advance the baseline so the next batch starts fresh
    prevResultLenRef.current = tradeResults.length;
  }, [tradeResults.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const wins = winCount;
  const losses = lossCount;
  const settled = winCount + lossCount;
  const tradeTypeLabel = TRADE_TYPES.find(t => t.value === tradeType)?.label ?? tradeType;

  return (
    <div className='bulk-trade'>
      {/* Disclaimer */}
      {disclaimer && (
        <div className='bulk-trade__disclaimer'>
          <span>⚠</span>
          <span>RISK DISCLAIMER — Bulk trading involves high risk. Only trade what you can afford to lose.</span>
          <button onClick={() => setDisclaimer(false)}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className='bulk-trade__header'>
        <div>
          <h2 className='bulk-trade__title'>⚡ Bulk Trade</h2>
          <p className='bulk-trade__sub'>Execute {count} contracts simultaneously at the same entry spot</p>
        </div>
        <div className='bulk-trade__header-right'>
          <AccountBadge />
          <div className='bulk-trade__balance'>
            <span>Balance</span>
            <strong>{fmt(Number(balance))}</strong>
          </div>
          <div className={`bulk-trade__conn ${isConnected ? 'on' : 'off'}`}>
            {isConnected ? '● Live' : '○ Offline'}
          </div>
        </div>
      </div>

      {/* Main body: left=controls, right=circles+execute */}
      <div className='bulk-trade__body'>

        {/* LEFT: compact controls */}
        <div className='bulk-trade__controls'>

          {/* Market + Trade Type dropdowns */}
          <div className='bulk-trade__droprow'>
            <div className='bulk-trade__field'>
              <label>Market</label>
              <select value={market} onChange={e => setMarket(e.target.value)} className='bulk-trade__select'>
                {MARKETS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className='bulk-trade__field'>
              <label>Trade Type</label>
              <select value={tradeType} onChange={e => setTradeType(e.target.value)} className='bulk-trade__select'>
                {TRADE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Prediction digits */}
          {needsPrediction && (
            <div className='bulk-trade__field'>
              <label>Prediction (digit 0–9)</label>
              <div className='bulk-trade__pills bulk-trade__pills--digits'>
                {[0,1,2,3,4,5,6,7,8,9].map(d => (
                  <button
                    key={d}
                    className={`bulk-trade__pill ${prediction === d ? 'active' : ''}`}
                    onClick={() => setPrediction(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ticks, Count, Stake in one row */}
          <div className='bulk-trade__row3'>
            <div className='bulk-trade__field'>
              <label>Ticks</label>
              <div className='bulk-trade__pills'>
                {TICK_OPTIONS.map(t => (
                  <button key={t} className={`bulk-trade__pill ${ticks === t ? 'active' : ''}`} onClick={() => setTicks(t)}>
                    {t}T
                  </button>
                ))}
              </div>
            </div>

            <div className='bulk-trade__field'>
              <label>Contracts</label>
              <div className='bulk-trade__pills'>
                {COUNT_OPTIONS.map(c => (
                  <button key={c} className={`bulk-trade__pill ${count === c ? 'active' : ''}`} onClick={() => setCount(c)}>
                    {c}
                  </button>
                ))}
                <NumberField
                  min={1} max={100}
                  value={count}
                  onCommit={n => setCount(n)}
                  className='bulk-trade__num-input'
                />
              </div>
            </div>

            <div className='bulk-trade__field'>
              <label>Stake ({currency})</label>
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
          <div className='bulk-trade__field bulk-trade__field--row'>
            <label>Martingale on Loss</label>
            <button className={`bulk-trade__toggle ${martingale ? 'on' : ''}`} onClick={() => setMartingale(p => !p)}>
              {martingale ? 'ON' : 'OFF'}
            </button>
            {martingale && (
              <>
                <label style={{ marginLeft: '1rem' }}>×</label>
                <input type='number' min={1.1} max={5} step={0.1} value={martMult}
                  onChange={e => setMartMult(Number(e.target.value))}
                  className='bulk-trade__num-input'
                  style={{ width: '5rem' }}
                />
              </>
            )}
          </div>

          {/* Summary mini-bar */}
          <div className='bulk-trade__summary'>
            <div className='bulk-trade__summary-item'>
              <span>Contracts</span><strong>{count}</strong>
            </div>
            <div className='bulk-trade__summary-item'>
              <span>Total Stake</span>
              <strong>{fmt(activeStake * count)}</strong>
            </div>
            <div className='bulk-trade__summary-item'>
              <span>Type</span><strong>{tradeTypeLabel}{needsPrediction ? ` [${prediction}]` : ''}</strong>
            </div>
            <div className='bulk-trade__summary-item bulk-trade__summary-item--green'>
              <span>Wins</span><strong>{wins}</strong>
            </div>
            <div className='bulk-trade__summary-item bulk-trade__summary-item--red'>
              <span>Losses</span><strong>{losses}</strong>
            </div>
            <div className={`bulk-trade__summary-item ${totalProfit >= 0 ? 'bulk-trade__summary-item--green' : 'bulk-trade__summary-item--red'}`}>
              <span>Net P/L</span><strong>{fmtProfit(totalProfit)}</strong>
            </div>
          </div>
        </div>

        {/* RIGHT: digit display + circles + execute */}
        <div className='bulk-trade__right'>
          {/* Current Digit Display */}
          <div className={`bulk-trade__digit-display ${digitFlash ? 'flash' : ''}`}>
            <div className='bulk-trade__digit-triangle'>▲</div>
            <div className='bulk-trade__digit-value'>{lastDigit !== null ? lastDigit : '—'}</div>
            <div className='bulk-trade__digit-meta'>
              <div className='bulk-trade__digit-tag'>CURRENT DIGIT</div>
              <div className='bulk-trade__digit-price'>{currentPrice ?? '—'}</div>
            </div>
          </div>

          {/* Digit Circles */}
          <div className='bulk-trade__circles-section'>
            <DigitCircles digits={digits} lastDigit={lastDigit} />
          </div>

          {/* Execute button — sits right below the circles */}
          <button
            className={`bulk-trade__execute ${isRunning ? 'running' : ''}`}
            onClick={runBulk}
            disabled={isRunning || !isConnected}
          >
            {isRunning
              ? `⏳ Sending ${count} contracts...`
              : `⚡ Execute ${count} × ${tradeTypeLabel}${needsPrediction ? ` [${prediction}]` : ''} — ${fmt(activeStake * count)}`
            }
          </button>
        </div>
      </div>

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
                  <span>{fmt(r.stake)}</span>
                  <span className={`bulk-trade__result-status bulk-trade__result-status--${st}`}>
                    {r.won ? '✓ Won' : '✗ Lost'} {fmtProfit(r.profit)}
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
