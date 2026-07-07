// @ts-nocheck
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import DigitCircles from '@/components/digit-circles';
import { useDigitStats } from '@/hooks/useDigitStats';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import './dcircles.scss';

const APP_ID = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DERIV_APP_ID) || '36300';

const ALL_SYMBOLS = [
  { label: 'V10',       value: 'R_10',      group: 'Volatility' },
  { label: 'V25',       value: 'R_25',      group: 'Volatility' },
  { label: 'V50',       value: 'R_50',      group: 'Volatility' },
  { label: 'V75',       value: 'R_75',      group: 'Volatility' },
  { label: 'V100',      value: 'R_100',     group: 'Volatility' },
  { label: 'V10 1s',    value: '1HZ10V',    group: 'Volatility 1s' },
  { label: 'V25 1s',    value: '1HZ25V',    group: 'Volatility 1s' },
  { label: 'V50 1s',    value: '1HZ50V',    group: 'Volatility 1s' },
  { label: 'V75 1s',    value: '1HZ75V',    group: 'Volatility 1s' },
  { label: 'V100 1s',   value: '1HZ100V',   group: 'Volatility 1s' },
  { label: 'Jump 10',   value: 'JD10',      group: 'Jump' },
  { label: 'Jump 25',   value: 'JD25',      group: 'Jump' },
  { label: 'Jump 50',   value: 'JD50',      group: 'Jump' },
  { label: 'Jump 75',   value: 'JD75',      group: 'Jump' },
  { label: 'Jump 100',  value: 'JD100',     group: 'Jump' },
  { label: 'Crash 300', value: 'CRASH300N', group: 'Crash/Boom' },
  { label: 'Crash 500', value: 'CRASH500',  group: 'Crash/Boom' },
  { label: 'Crash 1000',value: 'CRASH1000', group: 'Crash/Boom' },
  { label: 'Boom 300',  value: 'BOOM300N',  group: 'Crash/Boom' },
  { label: 'Boom 500',  value: 'BOOM500',   group: 'Crash/Boom' },
  { label: 'Boom 1000', value: 'BOOM1000',  group: 'Crash/Boom' },
];

function getLastDigit(priceStr: string): number {
  const s = String(priceStr);
  return parseInt(s[s.length - 1], 10) || 0;
}

/** Compact single-market digit-circle mini panel — own WS, no shared state */
const MiniMarketCircles: React.FC<{ sym: string; label: string }> = ({ sym, label }) => {
  const [counts, setCounts] = useState<number[]>(Array(10).fill(0));
  const [total, setTotal] = useState(0);
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    wsRef.current?.close();
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);
    wsRef.current = ws;
    const localCounts = Array(10).fill(0);
    let localTotal = 0;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ ticks_history: sym, count: 500, end: 'latest', style: 'ticks', subscribe: 1 }));
    };
    ws.onmessage = e => {
      try {
        const data = JSON.parse(e.data);
        if (data.history?.prices) {
          data.history.prices.forEach((p: any) => {
            const d = getLastDigit(String(p));
            if (!isNaN(d)) { localCounts[d]++; localTotal++; }
          });
          setCounts([...localCounts]);
          setTotal(localTotal);
          const last = data.history.prices[data.history.prices.length - 1];
          if (last) { setLastDigit(getLastDigit(String(last))); setPrice(String(last)); }
        } else if (data.tick) {
          const qs = String(data.tick.quote);
          const d = getLastDigit(qs);
          if (!isNaN(d)) { localCounts[d]++; localTotal++; }
          setCounts([...localCounts]);
          setTotal(localTotal);
          setLastDigit(d);
          setPrice(qs);
        }
      } catch {}
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => { ws.close(); };
  }, [sym]);

  // Rank colours: green=highest, red=lowest
  const maxPct = counts.length > 0 ? Math.max(...counts.map(c => total > 0 ? c / total * 100 : 0)) : 0;
  const minPct = counts.length > 0 ? Math.min(...counts.map(c => total > 0 ? c / total * 100 : 0)) : 0;

  return (
    <div className='dcircles__mini-card'>
      <div className='dcircles__mini-header'>
        <span className='dcircles__mini-label'>{label}</span>
        <span className={`dcircles__mini-status ${connected ? 'live' : ''}`}>{connected ? '●' : '○'}</span>
      </div>
      {price && <div className='dcircles__mini-price'>{price}</div>}
      <div className='dcircles__mini-circles'>
        {Array.from({ length: 10 }, (_, d) => {
          const pct = total > 0 ? (counts[d] / total * 100) : 0;
          const isCurrent = lastDigit === d;
          let bg = '#e5e7eb';
          if (total > 0) {
            if (pct === maxPct) bg = '#22c55e';
            else if (pct === minPct) bg = '#ef4444';
            else if (pct > maxPct - 2) bg = '#3b82f6';
            else if (pct < minPct + 2) bg = '#eab308';
          }
          return (
            <div
              key={d}
              className={`dcircles__mini-circle ${isCurrent ? 'current' : ''}`}
              style={{ background: bg, boxShadow: isCurrent ? '0 0 0 2px #7b3fe4, 0 0 6px rgba(123,63,228,0.3)' : undefined }}
              title={`${d}: ${pct.toFixed(1)}%`}
            >
              <span style={{ color: bg === '#e5e7eb' ? '#374151' : '#fff', fontWeight: 700, fontSize: '1rem' }}>{d}</span>
              <span style={{ color: bg === '#e5e7eb' ? '#6b7280' : 'rgba(255,255,255,0.85)', fontSize: '0.7rem', lineHeight: 1 }}>
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

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
  const [activeView, setActiveView] = useState<'single' | 'multi'>('single');
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const evenPct = digits.filter(d => d.digit % 2 === 0).reduce((s, d) => s + d.percentage, 0);
  const oddPct = 100 - evenPct;

  const last50 = lastTicks.slice(-50);
  const patternBadges = last50.map(p => {
    const s = String(p);
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
            {ALL_SYMBOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
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

        {/* View toggle: Single / Multi */}
        <div className='dcircles__view-toggle'>
          <button className={`dcircles__view-btn ${activeView === 'single' ? 'active' : ''}`} onClick={() => setActiveView('single')}>
            Single Market
          </button>
          <button className={`dcircles__view-btn ${activeView === 'multi' ? 'active' : ''}`} onClick={() => setActiveView('multi')}>
            All Markets
          </button>
        </div>
      </div>

      {/* ── MULTI-MARKET DIGIT GRID ─────────────────── */}
      {activeView === 'multi' && (
        <div className='dcircles__multi-grid'>
          {ALL_SYMBOLS.map(s => (
            <MiniMarketCircles key={s.value} sym={s.value} label={s.label} />
          ))}
        </div>
      )}

      {/* ── SINGLE MARKET VIEW ──────────────────────── */}
      {activeView === 'single' && (
        <>
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
              <p className='dcircles__streak'>
                Current streak: <strong>{streak.count} {streak.type === 'E' ? 'Even' : streak.type === 'O' && patternView === 'EVEN/ODD' ? 'Odd' : streak.type === 'O' ? 'Over' : 'Under'}</strong>
              </p>
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
        </>
      )}
    </div>
  );
});

export default DCircles;
