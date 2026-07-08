// @ts-nocheck
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import './dcircles.scss';

const APP_ID = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DERIV_APP_ID) || '36300';

const ALL_SYMBOLS = [
  { label: 'V10',        value: 'R_10'      },
  { label: 'V25',        value: 'R_25'      },
  { label: 'V50',        value: 'R_50'      },
  { label: 'V75',        value: 'R_75'      },
  { label: 'V100',       value: 'R_100'     },
  { label: 'V10 1s',     value: '1HZ10V'   },
  { label: 'V25 1s',     value: '1HZ25V'   },
  { label: 'V50 1s',     value: '1HZ50V'   },
  { label: 'V75 1s',     value: '1HZ75V'   },
  { label: 'V100 1s',    value: '1HZ100V'  },
  { label: 'Jump 10',    value: 'JD10'     },
  { label: 'Jump 25',    value: 'JD25'     },
  { label: 'Jump 50',    value: 'JD50'     },
  { label: 'Jump 75',    value: 'JD75'     },
  { label: 'Jump 100',   value: 'JD100'    },
  { label: 'Crash 300',  value: 'CRASH300N'},
  { label: 'Crash 500',  value: 'CRASH500' },
  { label: 'Crash 1000', value: 'CRASH1000'},
  { label: 'Boom 300',   value: 'BOOM300N' },
  { label: 'Boom 500',   value: 'BOOM500'  },
  { label: 'Boom 1000',  value: 'BOOM1000' },
];

interface TradeRecord {
  id: string;
  type: string;
  stake: number;
  profit: number;
  won: boolean;
  time: Date;
  barrier?: string;
}

// Colour ranks for digit circles
function rankColors(pcts: number[]): string[] {
  const sorted = [...pcts].sort((a, b) => a - b);
  return pcts.map(p => {
    if (p === sorted[sorted.length - 1]) return '#22c55e';
    if (p === sorted[sorted.length - 2]) return '#3b82f6';
    if (p === sorted[0]) return '#ef4444';
    if (p === sorted[1]) return '#eab308';
    return '#6b7280';
  });
}

const CircleAnalyzer = observer(() => {
  const [symbol, setSymbol] = useState('1HZ100V');
  const [counts, setCounts] = useState<number[]>(Array(10).fill(0));
  const [total, setTotal] = useState(0);
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  const [currentPrice, setCurrentPrice] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [rawPrices, setRawPrices] = useState<number[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const localCountsRef = useRef<number[]>(Array(10).fill(0));
  const localTotalRef = useRef(0);

  // Right-panel tabs
  const [rightTab, setRightTab] = useState<'summary' | 'transactions' | 'journal'>('summary');
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [winCount, setWinCount] = useState(0);
  const [lossCount, setLossCount] = useState(0);
  const [totalStake, setTotalStake] = useState(0);
  const [totalPayout, setTotalPayout] = useState(0);

  // Trade controls
  const [stake, setStake] = useState(1);
  const [duration, setDuration] = useState(1);
  const [barrier, setBarrier] = useState(5);
  const [isTrading, setIsTrading] = useState(false);
  const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
  useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

  // Connect WS
  useEffect(() => {
    wsRef.current?.close();
    const lc = Array(10).fill(0);
    localCountsRef.current = [...lc];
    localTotalRef.current = 0;
    setCounts([...lc]);
    setTotal(0);
    setLastDigit(null);
    setCurrentPrice(null);
    setRawPrices([]);

    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);
    wsRef.current = ws;
    let pipSize = 2;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ ticks_history: symbol, count: 1000, end: 'latest', style: 'ticks', subscribe: 1 }));
    };

    ws.onmessage = e => {
      try {
        const data = JSON.parse(e.data);
        if (data.tick?.pip_size) pipSize = data.tick.pip_size;

        const getDigit = (p: number) => parseInt(Number(p).toFixed(pipSize).slice(-1), 10);

        if (data.history?.prices) {
          data.history.prices.forEach((p: any) => {
            const d = getDigit(Number(p));
            if (!isNaN(d) && d >= 0 && d <= 9) { localCountsRef.current[d]++; localTotalRef.current++; }
          });
          const rp = data.history.prices.map(Number);
          setCounts([...localCountsRef.current]);
          setTotal(localTotalRef.current);
          setRawPrices(rp);
          const last = rp[rp.length - 1];
          if (last) {
            setLastDigit(getDigit(last));
            setCurrentPrice(Number(last).toFixed(pipSize));
          }
        } else if (data.tick) {
          const ps = data.tick.pip_size ?? pipSize;
          const q = Number(data.tick.quote);
          const d = parseInt(q.toFixed(ps).slice(-1), 10);
          if (!isNaN(d) && d >= 0 && d <= 9) {
            localCountsRef.current[d]++;
            localTotalRef.current++;
          }
          setCounts([...localCountsRef.current]);
          setTotal(localTotalRef.current);
          setLastDigit(d);
          setCurrentPrice(q.toFixed(ps));
          setRawPrices(prev => [...prev.slice(-999), q]);
        }
      } catch {}
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    return () => { ws.close(); };
  }, [symbol]);

  const pcts = counts.map(c => total > 0 ? (c / total) * 100 : 0);
  const colors = rankColors(pcts);

  const evenPct = pcts.filter((_, i) => i % 2 === 0).reduce((s, p) => s + p, 0);
  const oddPct = pcts.filter((_, i) => i % 2 !== 0).reduce((s, p) => s + p, 0);
  const overPct = pcts.filter((_, i) => i > barrier).reduce((s, p) => s + p, 0);
  const underPct = pcts.filter((_, i) => i < barrier).reduce((s, p) => s + p, 0);
  const eqPct = pcts[barrier] || 0;

  const last50 = rawPrices.slice(-50).map(p => {
    const ps = 2;
    return parseInt(Number(p).toFixed(ps).slice(-1), 10);
  });

  const evenOddBadges = last50.map(d => d % 2 === 0 ? { lbl: 'E', cls: 'ca-badge--even' } : { lbl: 'O', cls: 'ca-badge--odd' });
  const overUnderBadges = last50.map(d => d > barrier ? { lbl: 'Ov', cls: 'ca-badge--over' } : d < barrier ? { lbl: 'Un', cls: 'ca-badge--under' } : { lbl: '=', cls: 'ca-badge--eq' });

  // Buy a contract via api_base
  const buyContract = useCallback(async (contractType: string, barrierVal?: number) => {
    if (isTrading) return;
    setIsTrading(true);
    const id = `t${Date.now()}`;
    const sym = ALL_SYMBOLS.find(s => s.value === symbol)?.label ?? symbol;
    try {
      const { api_base } = await import('@/external/bot-skeleton');
      if (!api_base.api) throw new Error('Not connected');
      const send = (msg: object): Promise<any> =>
        (api_base.api.send as unknown as (d: unknown) => Promise<any>)(msg);

      // Get proposal
      const propReq: any = {
        proposal: 1, amount: stake, basis: 'stake',
        contract_type: contractType, currency: 'USD',
        duration, duration_unit: 't', symbol,
      };
      if (['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF'].includes(contractType) && barrierVal !== undefined) {
        propReq.barrier = String(barrierVal);
      }
      const propRes = await send(propReq);
      if (propRes?.error) throw new Error(propRes.error.message);
      const proposalId = propRes?.proposal?.id;
      if (!proposalId) throw new Error('No proposal ID');
      const askPrice = propRes?.proposal?.ask_price ?? stake;

      // Buy
      const buyRes = await send({ buy: proposalId, price: Number(askPrice) });
      if (buyRes?.error) throw new Error(buyRes.error.message);
      const contract_id = buyRes?.buy?.contract_id;
      if (!contract_id) throw new Error('No contract ID');

      // Track settlement
      const profit = await new Promise<number>(resolve => {
        let sub: any;
        const bail = setTimeout(() => { try { sub?.unsubscribe?.(); } catch {} resolve(0); }, 20000);
        try {
          sub = api_base.api?.onMessage?.()?.subscribe(({ data: d }: any) => {
            if (!d?.proposal_open_contract) return;
            const poc = d.proposal_open_contract;
            if (Number(poc.contract_id) !== Number(contract_id)) return;
            if (poc.is_sold === 1 || poc.status === 'won' || poc.status === 'lost') {
              clearTimeout(bail); try { sub?.unsubscribe?.(); } catch {}
              resolve(parseFloat(poc.profit ?? '0'));
            }
          });
        } catch { clearTimeout(bail); resolve(0); return; }
        send({ proposal_open_contract: 1, contract_id, subscribe: 1 }).catch(() => { clearTimeout(bail); try { sub?.unsubscribe?.(); } catch {} resolve(0); });
      });

      const won = profit > 0;
      const rec: TradeRecord = {
        id, type: contractType, stake, profit, won, time: new Date(),
        barrier: barrierVal !== undefined ? String(barrierVal) : undefined,
      };
      setTrades(p => [rec, ...p].slice(0, 100));
      setTotalProfit(p => +(p + profit).toFixed(2));
      setTotalStake(p => +(p + stake).toFixed(2));
      setTotalPayout(p => +(p + Math.max(0, stake + profit)).toFixed(2));
      if (won) setWinCount(p => p + 1); else setLossCount(p => p + 1);
    } catch (err: any) {
      const rec: TradeRecord = { id, type: contractType, stake, profit: 0, won: false, time: new Date() };
      setTrades(p => [rec, ...p].slice(0, 100));
      setLossCount(p => p + 1);
    } finally {
      setIsTrading(false);
    }
  }, [isTrading, stake, duration, barrier, symbol]);

  const fmt = (v: number) => `${fromUsd(v).toFixed(2)} ${displayCur}`;
  const fmtP = (v: number) => `${v >= 0 ? '+' : ''}${fromUsd(v).toFixed(2)} ${displayCur}`;

  const resetStats = () => {
    setTrades([]); setTotalProfit(0); setWinCount(0); setLossCount(0);
    setTotalStake(0); setTotalPayout(0);
  };

  return (
    <div className='ca'>
      {/* Left panel: circle analysis */}
      <div className='ca__left'>
        {/* Header */}
        <div className='ca__top-bar'>
          <div className='ca__symbol-row'>
            <select className='ca__select' value={symbol} onChange={e => setSymbol(e.target.value)}>
              {ALL_SYMBOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <span className={`ca__live-dot ${connected ? 'live' : ''}`}>{connected ? '● LIVE' : '○ OFF'}</span>
          </div>
          <div className='ca__price-row'>
            <span className='ca__price'>{currentPrice ?? '---'}</span>
            {lastDigit !== null && (
              <span className='ca__last-digit' style={{ background: colors[lastDigit] }}>{lastDigit}</span>
            )}
            <span className='ca__tick-count'>{total} ticks</span>
          </div>
        </div>

        {/* Digit circles */}
        <div className='ca__circles'>
          {Array.from({ length: 10 }, (_, d) => {
            const pct = pcts[d];
            const isCurrent = lastDigit === d;
            return (
              <div key={d} className={`ca__circle-wrap ${isCurrent ? 'current' : ''}`}>
                {isCurrent && <div className='ca__circle-arrow'>▼</div>}
                <div
                  className='ca__circle'
                  style={{ background: colors[d], opacity: pct === 0 ? 0.3 : 1 }}
                >
                  <span className='ca__circle-digit'>{d}</span>
                </div>
                <span className='ca__circle-pct'>{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>

        {/* Stat bars */}
        <div className='ca__bars'>
          <div className='ca__bar-row'>
            <span>Even</span>
            <div className='ca__bar-track'><div className='ca__bar ca__bar--even' style={{ width: `${evenPct}%` }} /></div>
            <span className='ca__bar-val'>{evenPct.toFixed(1)}%</span>
          </div>
          <div className='ca__bar-row'>
            <span>Odd</span>
            <div className='ca__bar-track'><div className='ca__bar ca__bar--odd' style={{ width: `${oddPct}%` }} /></div>
            <span className='ca__bar-val'>{oddPct.toFixed(1)}%</span>
          </div>
          <div className='ca__bar-row'>
            <span>Over {barrier}</span>
            <div className='ca__bar-track'><div className='ca__bar ca__bar--over' style={{ width: `${overPct}%` }} /></div>
            <span className='ca__bar-val'>{overPct.toFixed(1)}%</span>
          </div>
          <div className='ca__bar-row'>
            <span>Under {barrier}</span>
            <div className='ca__bar-track'><div className='ca__bar ca__bar--under' style={{ width: `${underPct}%` }} /></div>
            <span className='ca__bar-val'>{underPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Pattern badges */}
        {last50.length > 0 && (
          <div className='ca__patterns'>
            <div className='ca__pattern-section'>
              <p className='ca__pattern-label'>EVEN / ODD STREAM</p>
              <div className='ca__badges'>
                {evenOddBadges.map((b, i) => (
                  <span key={i} className={`ca__badge ${b.cls} ${i === evenOddBadges.length - 1 ? 'ca__badge--current' : ''}`}>{b.lbl}</span>
                ))}
              </div>
            </div>
            <div className='ca__pattern-section'>
              <p className='ca__pattern-label'>OVER / UNDER (threshold={barrier})</p>
              <div className='ca__badges'>
                {overUnderBadges.map((b, i) => (
                  <span key={i} className={`ca__badge ${b.cls} ${i === overUnderBadges.length - 1 ? 'ca__badge--current' : ''}`}>{b.lbl}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Trade controls */}
        <div className='ca__trade-panel'>
          <h3>TRADE</h3>
          <div className='ca__trade-fields'>
            <div className='ca__trade-field'>
              <label>Stake</label>
              <input type='number' min={0.35} step={0.1} value={stake} onChange={e => setStake(+e.target.value)} />
            </div>
            <div className='ca__trade-field'>
              <label>Ticks</label>
              <input type='number' min={1} max={10} value={duration} onChange={e => setDuration(+e.target.value)} />
            </div>
            <div className='ca__trade-field'>
              <label>Barrier</label>
              <input type='number' min={0} max={9} value={barrier} onChange={e => setBarrier(+e.target.value)} />
            </div>
          </div>
          <div className='ca__trade-btns'>
            <button className='ca__btn ca__btn--even' onClick={() => buyContract('DIGITEVEN')} disabled={isTrading}>Even</button>
            <button className='ca__btn ca__btn--odd' onClick={() => buyContract('DIGITODD')} disabled={isTrading}>Odd</button>
            <button className='ca__btn ca__btn--over' onClick={() => buyContract('DIGITOVER', barrier)} disabled={isTrading}>Over {barrier}</button>
            <button className='ca__btn ca__btn--under' onClick={() => buyContract('DIGITUNDER', barrier)} disabled={isTrading}>Under {barrier}</button>
            <button className='ca__btn ca__btn--rise' onClick={() => buyContract('CALL')} disabled={isTrading}>Rise</button>
            <button className='ca__btn ca__btn--fall' onClick={() => buyContract('PUT')} disabled={isTrading}>Fall</button>
          </div>
        </div>
      </div>

      {/* Right panel: Summary / Transactions / Journal */}
      <div className='ca__right'>
        <div className='ca__right-tabs'>
          <button className={`ca__right-tab ${rightTab === 'summary' ? 'active' : ''}`} onClick={() => setRightTab('summary')}>Summary</button>
          <button className={`ca__right-tab ${rightTab === 'transactions' ? 'active' : ''}`} onClick={() => setRightTab('transactions')}>Transactions</button>
          <button className={`ca__right-tab ${rightTab === 'journal' ? 'active' : ''}`} onClick={() => setRightTab('journal')}>Journal</button>
        </div>

        {rightTab === 'summary' && (
          <div className='ca__summary'>
            {trades.length === 0 ? (
              <div className='ca__empty'>
                <div className='ca__empty-icon'>📊</div>
                <p>When you're ready to trade, hit Run.</p>
                <p>You'll be able to track your bot's performance here.</p>
              </div>
            ) : (
              <>
                <div className='ca__summary-grid'>
                  <div className='ca__summary-card'>
                    <span className='ca__summary-label'>Total stake</span>
                    <span className='ca__summary-val'>{fmt(totalStake)}</span>
                  </div>
                  <div className='ca__summary-card'>
                    <span className='ca__summary-label'>Total payout</span>
                    <span className='ca__summary-val'>{fmt(totalPayout)}</span>
                  </div>
                  <div className='ca__summary-card'>
                    <span className='ca__summary-label'>No. of runs</span>
                    <span className='ca__summary-val'>{trades.length}</span>
                  </div>
                  <div className='ca__summary-card'>
                    <span className='ca__summary-label'>Contracts lost</span>
                    <span className='ca__summary-val ca__summary-val--neg'>{lossCount}</span>
                  </div>
                  <div className='ca__summary-card'>
                    <span className='ca__summary-label'>Contracts won</span>
                    <span className='ca__summary-val ca__summary-val--pos'>{winCount}</span>
                  </div>
                  <div className='ca__summary-card ca__summary-card--profit'>
                    <span className='ca__summary-label'>Total Profit/Loss</span>
                    <span className={`ca__summary-val ca__summary-val--big ${totalProfit >= 0 ? 'ca__summary-val--pos' : 'ca__summary-val--neg'}`}>
                      {fmtP(totalProfit)}
                    </span>
                  </div>
                </div>
                <button className='ca__reset-btn' onClick={resetStats}>Reset</button>
              </>
            )}
          </div>
        )}

        {rightTab === 'transactions' && (
          <div className='ca__transactions'>
            {trades.length === 0 ? (
              <div className='ca__empty'><div className='ca__empty-icon'>💳</div><p>No transactions yet.</p></div>
            ) : (
              <div className='ca__tx-list'>
                {trades.map(t => (
                  <div key={t.id} className={`ca__tx-row ${t.won ? 'won' : 'lost'}`}>
                    <div className='ca__tx-left'>
                      <span className='ca__tx-icon'>{t.won ? '✅' : '❌'}</span>
                      <div>
                        <div className='ca__tx-type'>{t.type}{t.barrier ? ` @${t.barrier}` : ''}</div>
                        <div className='ca__tx-time'>{t.time.toLocaleTimeString()}</div>
                      </div>
                    </div>
                    <div className='ca__tx-right'>
                      <div className='ca__tx-stake'>{fmt(t.stake)}</div>
                      <div className={`ca__tx-profit ${t.profit >= 0 ? 'pos' : 'neg'}`}>{fmtP(t.profit)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {rightTab === 'journal' && (
          <div className='ca__journal'>
            {trades.length === 0 ? (
              <div className='ca__empty'><div className='ca__empty-icon'>📓</div><p>Journal will appear here.</p></div>
            ) : (
              <div className='ca__journal-list'>
                {trades.map((t, i) => (
                  <div key={t.id} className='ca__journal-entry'>
                    <span className='ca__journal-num'>#{trades.length - i}</span>
                    <span className='ca__journal-icon'>{t.won ? '✅' : '❌'}</span>
                    <span className='ca__journal-body'>
                      {t.type}{t.barrier ? ` @${t.barrier}` : ''} — Stake: {fmt(t.stake)} → P/L: <strong className={t.profit >= 0 ? 'pos' : 'neg'}>{fmtP(t.profit)}</strong>
                    </span>
                    <span className='ca__journal-time'>{t.time.toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default CircleAnalyzer;
