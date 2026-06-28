// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import DigitCircles from '@/components/digit-circles';
import { useDigitStats } from '@/hooks/useDigitStats';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import './pro-hedge.scss';

const MARKETS = [
  { label: 'V10',     value: 'R_10'    },
  { label: 'V25',     value: 'R_25'    },
  { label: 'V50',     value: 'R_50'    },
  { label: 'V75',     value: 'R_75'    },
  { label: 'V100',    value: 'R_100'   },
  { label: 'V10 1s',  value: '1HZ10V'  },
  { label: 'V25 1s',  value: '1HZ25V'  },
  { label: 'V50 1s',  value: '1HZ50V'  },
  { label: 'V75 1s',  value: '1HZ75V'  },
  { label: 'V100 1s', value: '1HZ100V' },
  { label: 'Jump 10', value: 'JD10'    },
  { label: 'Jump 25', value: 'JD25'    },
  { label: 'Jump 50', value: 'JD50'    },
  { label: 'Jump 75', value: 'JD75'    },
  { label: 'Jump 100',value: 'JD100'   },
];

const TRADE_TYPE_GROUPS = [
  { label: 'Even/Odd',    typeA: 'DIGITEVEN', typeB: 'DIGITODD'  },
  { label: 'Rise/Fall',   typeA: 'CALL',      typeB: 'PUT'       },
  { label: 'Only Up/Dn',  typeA: 'CALLE',     typeB: 'PUTE'      },
  { label: 'High/Low',    typeA: 'CALL',      typeB: 'PUT'       },
  { label: 'Over/Under',  typeA: 'DIGITOVER', typeB: 'DIGITUNDER'},
  { label: 'Match/Differ',typeA: 'DIGITMATCH',typeB: 'DIGITDIFF' },
];

const TICK_OPTIONS  = [1, 2, 3, 5, 10];
const STAKE_PRESETS = [0.5, 1, 2, 5];

function LegCard({
  label, color, contractType, stake, ticks, martingale,
  onStakeChange, onTicksChange, onMartingaleChange,
  prediction, onPredictionChange, currency,
}: any) {
  const needsPred = ['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF'].includes(contractType);

  return (
    <div className={`pro-hedge__leg-card pro-hedge__leg-card--${color}`}>
      <div className='pro-hedge__leg-header'>
        <span className='pro-hedge__leg-label'>{label}</span>
        <span className='pro-hedge__leg-type'>{contractType}</span>
      </div>

      {/* Duration ticks */}
      <div className='pro-hedge__leg-section'>
        <label>Duration</label>
        <div className='pro-hedge__tick-btns'>
          {TICK_OPTIONS.map(t => (
            <button
              key={t}
              className={`pro-hedge__tick-btn ${ticks === t ? 'active' : ''}`}
              onClick={() => onTicksChange(t)}
            >{t}T</button>
          ))}
        </div>
      </div>

      {/* Stake */}
      <div className='pro-hedge__leg-section'>
        <label>Stake ({currency})</label>
        <div className='pro-hedge__stake-row'>
          {STAKE_PRESETS.map(s => (
            <button
              key={s}
              className={`pro-hedge__stake-btn ${stake === s ? 'active' : ''}`}
              onClick={() => onStakeChange(s)}
            >${s}</button>
          ))}
          <input
            type='number' min={0.35} step={0.01}
            value={stake}
            onChange={e => onStakeChange(Number(e.target.value))}
            className='pro-hedge__stake-input'
          />
        </div>
      </div>

      {/* Prediction (if needed) */}
      {needsPred && (
        <div className='pro-hedge__leg-section'>
          <label>Digit (0–9)</label>
          <div className='pro-hedge__digit-row'>
            {[0,1,2,3,4,5,6,7,8,9].map(d => (
              <button
                key={d}
                className={`pro-hedge__digit-btn ${prediction === d ? 'active' : ''}`}
                onClick={() => onPredictionChange(d)}
              >{d}</button>
            ))}
          </div>
        </div>
      )}

      {/* Martingale */}
      <div className='pro-hedge__leg-section pro-hedge__leg-section--row'>
        <label>Martingale</label>
        <button
          className={`pro-hedge__toggle ${martingale > 1 ? 'on' : ''}`}
          onClick={() => onMartingaleChange(martingale > 1 ? 1 : 2)}
        >
          {martingale > 1 ? `×${martingale}` : 'OFF'}
        </button>
        {martingale > 1 && (
          <input
            type='number' min={1.1} max={5} step={0.1}
            value={martingale}
            onChange={e => onMartingaleChange(Number(e.target.value))}
            className='pro-hedge__stake-input'
          />
        )}
      </div>

      {/* Stake preview */}
      <div className='pro-hedge__leg-preview'>
        Stake: <strong>{currency} {stake.toFixed(2)}</strong>
        {martingale > 1 && <span> → loss×{martingale}</span>}
      </div>
    </div>
  );
}

const ProHedge = observer(() => {
  const [market, setMarket]       = useState('1HZ100V');
  const [tradeGroup, setTradeGroup] = useState(TRADE_TYPE_GROUPS[1]); // Rise/Fall default
  const [ticksA, setTicksA]       = useState(1);
  const [ticksB, setTicksB]       = useState(1);
  const [stakeA, setStakeA]       = useState(1);
  const [stakeB, setStakeB]       = useState(1);
  const [martA,  setMartA]        = useState(1);
  const [martB,  setMartB]        = useState(1);
  const [predA,  setPredA]        = useState(5);
  const [predB,  setPredB]        = useState(4);
  const [takeProfit, setTakeProfit] = useState(3);
  const [stopLoss,   setStopLoss]   = useState(5);
  const [maxTrades,  setMaxTrades]  = useState(10);
  const [showSettings, setShowSettings] = useState(false);
  const [autoHedge, setAutoHedge]   = useState(false);
  const [hedgeInterval, setHedgeInterval] = useState(2000);
  const [tradeLog, setTradeLog] = useState<any[]>([]);
  const autoRef = useRef<any>(null);

  const { digits, lastDigit, currentPrice, isConnected } = useDigitStats(market);
  const { balance, currency, buyContract, isTrading, tradeResults, totalProfit, winCount, lossCount } = useDerivTrading();

  const executeHedge = useCallback(async () => {
    const logEntry = {
      time: new Date().toLocaleTimeString(),
      price: currentPrice ?? 0,
      typeA: tradeGroup.typeA,
      typeB: tradeGroup.typeB,
      stakeA, stakeB,
    };
    const [resA, resB] = await Promise.all([
      buyContract({
        symbol: market,
        contract_type: tradeGroup.typeA,
        stake: stakeA,
        duration: ticksA,
        barrier: ['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF'].includes(tradeGroup.typeA) ? String(predA) : undefined,
      }),
      buyContract({
        symbol: market,
        contract_type: tradeGroup.typeB,
        stake: stakeB,
        duration: ticksB,
        barrier: ['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF'].includes(tradeGroup.typeB) ? String(predB) : undefined,
      }),
    ]);
    setTradeLog(prev => [logEntry, ...prev].slice(0, 100));
  }, [market, tradeGroup, stakeA, stakeB, ticksA, ticksB, predA, predB, buyContract, currentPrice]);

  const toggleAuto = useCallback(() => {
    if (autoHedge) {
      if (autoRef.current) clearInterval(autoRef.current);
      setAutoHedge(false);
    } else {
      setAutoHedge(true);
      executeHedge();
      autoRef.current = setInterval(executeHedge, hedgeInterval);
    }
  }, [autoHedge, hedgeInterval, executeHedge]);

  useEffect(() => () => { if (autoRef.current) clearInterval(autoRef.current); }, []);

  // TP/SL check
  useEffect(() => {
    if (autoHedge) {
      if (totalProfit >= takeProfit || totalProfit <= -stopLoss || tradeResults.length >= maxTrades) {
        if (autoRef.current) clearInterval(autoRef.current);
        setAutoHedge(false);
      }
    }
  }, [totalProfit, tradeResults.length, autoHedge, takeProfit, stopLoss, maxTrades]);

  return (
    <div className='pro-hedge'>
      {/* Header */}
      <div className='pro-hedge__header'>
        <div>
          <h1>⚖ Pro Hedge</h1>
          <p>AHMED SYN TRADER — Leg A + Leg B simultaneous hedge strategy</p>
        </div>
        <div className='pro-hedge__header-right'>
          {balance !== null && (
            <div className='pro-hedge__balance'>
              <span>Balance</span>
              <strong>{currency} {Number(balance).toFixed(2)}</strong>
            </div>
          )}
          <div className={`pro-hedge__conn ${isConnected ? 'on' : 'off'}`}>
            {isConnected ? '● Live' : '○ Offline'}
          </div>
        </div>
      </div>

      {/* Market row */}
      <div className='pro-hedge__market-row'>
        {MARKETS.map(m => (
          <button
            key={m.value}
            className={`pro-hedge__market-pill ${market === m.value ? 'active' : ''}`}
            onClick={() => setMarket(m.value)}
          >{m.label}</button>
        ))}
        <div className='pro-hedge__live-price'>
          {currentPrice?.toFixed(4) ?? '—'}
        </div>
      </div>

      {/* Trade type filter */}
      <div className='pro-hedge__type-row'>
        <span className='pro-hedge__type-label'>Strategy</span>
        {TRADE_TYPE_GROUPS.map(g => (
          <button
            key={g.label}
            className={`pro-hedge__type-pill ${tradeGroup.label === g.label ? 'active' : ''}`}
            onClick={() => setTradeGroup(g)}
          >{g.label}</button>
        ))}
      </div>

      {/* Digit circles */}
      <div className='pro-hedge__circles'>
        <DigitCircles digits={digits} lastDigit={lastDigit} size='sm' />
      </div>

      {/* Leg A + Leg B */}
      <div className='pro-hedge__legs'>
        <LegCard
          label='LEG A'
          color='a'
          contractType={tradeGroup.typeA}
          stake={stakeA}
          ticks={ticksA}
          martingale={martA}
          prediction={predA}
          currency={currency}
          onStakeChange={setStakeA}
          onTicksChange={setTicksA}
          onMartingaleChange={setMartA}
          onPredictionChange={setPredA}
        />
        <div className='pro-hedge__vs'>⚔ VS</div>
        <LegCard
          label='LEG B'
          color='b'
          contractType={tradeGroup.typeB}
          stake={stakeB}
          ticks={ticksB}
          martingale={martB}
          prediction={predB}
          currency={currency}
          onStakeChange={setStakeB}
          onTicksChange={setTicksB}
          onMartingaleChange={setMartB}
          onPredictionChange={setPredB}
        />
      </div>

      {/* Summary stats */}
      <div className='pro-hedge__stats-bar'>
        <div className='pro-hedge__stat'>
          <span>Total P/L</span>
          <strong className={totalProfit >= 0 ? 'pos' : 'neg'}>
            {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)}
          </strong>
        </div>
        <div className='pro-hedge__stat'>
          <span>Wins</span><strong className='pos'>{winCount}</strong>
        </div>
        <div className='pro-hedge__stat'>
          <span>Losses</span><strong className='neg'>{lossCount}</strong>
        </div>
        <div className='pro-hedge__stat'>
          <span>Hedges</span><strong>{tradeLog.length}</strong>
        </div>
        <div className='pro-hedge__stat'>
          <span>Total Stake</span><strong>{currency} {(stakeA + stakeB).toFixed(2)}</strong>
        </div>
      </div>

      {/* Execute buttons */}
      <div className='pro-hedge__action-row'>
        <button
          className='pro-hedge__execute-btn'
          onClick={executeHedge}
          disabled={isTrading || !isConnected}
        >
          ⚡ Execute Hedge
        </button>
        <button
          className={`pro-hedge__auto-btn ${autoHedge ? 'on' : ''}`}
          onClick={toggleAuto}
        >
          {autoHedge ? '⏹ Stop Auto Hedge' : '▶ Auto Hedge'}
        </button>
        {autoHedge && (
          <div className='pro-hedge__interval'>
            <label>Interval (ms)</label>
            <input type='number' min={500} step={100} value={hedgeInterval}
              onChange={e => setHedgeInterval(Number(e.target.value))}
              className='pro-hedge__interval-input'
            />
          </div>
        )}
        <button
          className={`pro-hedge__settings-btn ${showSettings ? 'active' : ''}`}
          onClick={() => setShowSettings(p => !p)}
        >⚙ Settings</button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className='pro-hedge__settings'>
          <h3>TP / SL / Limits</h3>
          <div className='pro-hedge__settings-row'>
            <div className='pro-hedge__settings-field'>
              <label>Take Profit ({currency})</label>
              <input type='number' min={0} step={0.1} value={takeProfit} onChange={e => setTakeProfit(Number(e.target.value))} />
            </div>
            <div className='pro-hedge__settings-field'>
              <label>Stop Loss ({currency})</label>
              <input type='number' min={0} step={0.1} value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))} />
            </div>
            <div className='pro-hedge__settings-field'>
              <label>Max Trades</label>
              <input type='number' min={1} step={1} value={maxTrades} onChange={e => setMaxTrades(Number(e.target.value))} />
            </div>
          </div>
          <p className='pro-hedge__settings-note'>
            Auto hedge stops when P/L reaches TP/SL or max trade count is hit.
          </p>
        </div>
      )}

      {/* Trade log */}
      {tradeLog.length > 0 && (
        <div className='pro-hedge__log'>
          <div className='pro-hedge__log-hdr'>
            <h3>Hedge Log ({tradeLog.length})</h3>
            <button onClick={() => setTradeLog([])}>Clear</button>
          </div>
          <div className='pro-hedge__log-list'>
            {tradeLog.map((e, i) => (
              <div key={i} className='pro-hedge__log-row'>
                <span className='pro-hedge__log-time'>{e.time}</span>
                <span>{e.typeA}</span>
                <span>${e.stakeA}</span>
                <span className='pro-hedge__log-sep'>⚔</span>
                <span>{e.typeB}</span>
                <span>${e.stakeB}</span>
                <span style={{ opacity: 0.5 }}>@ {typeof e.price === 'number' ? e.price.toFixed(4) : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent trade results */}
      {tradeResults.length > 0 && (
        <div className='pro-hedge__results'>
          <h3>Trade Results</h3>
          <div className='pro-hedge__results-list'>
            {tradeResults.slice(0, 30).map(r => (
              <div key={r.id} className={`pro-hedge__result-row ${r.won ? 'won' : 'lost'}`}>
                <span>{r.type}</span>
                <span>{currency} {r.stake.toFixed(2)}</span>
                <span className='pro-hedge__result-pnl'>{r.profit >= 0 ? '+' : ''}{r.profit.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default ProHedge;
