// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import './dcircles.scss';

const HISTORY_SIZE = 1000;
const WINDOW_SIZE = 100;

const ALL_MARKETS = [
  { label: 'Volatility 10', value: 'R_10' },
  { label: 'Volatility 25', value: 'R_25' },
  { label: 'Volatility 50', value: 'R_50' },
  { label: 'Volatility 75', value: 'R_75' },
  { label: 'Volatility 100', value: 'R_100' },
  { label: 'Volatility 10 (1s)', value: '1HZ10V' },
  { label: 'Volatility 25 (1s)', value: '1HZ25V' },
  { label: 'Volatility 50 (1s)', value: '1HZ50V' },
  { label: 'Volatility 75 (1s)', value: '1HZ75V' },
  { label: 'Volatility 100 (1s)', value: '1HZ100V' },
  { label: 'Jump 10', value: 'JD10' },
  { label: 'Jump 25', value: 'JD25' },
  { label: 'Jump 50', value: 'JD50' },
  { label: 'Jump 75', value: 'JD75' },
  { label: 'Jump 100', value: 'JD100' },
  { label: 'Crash 300', value: 'CRASH300N' },
  { label: 'Crash 500', value: 'CRASH500' },
  { label: 'Crash 1000', value: 'CRASH1000' },
  { label: 'Boom 300', value: 'BOOM300N' },
  { label: 'Boom 500', value: 'BOOM500' },
  { label: 'Boom 1000', value: 'BOOM1000' },
  { label: 'Bear Market', value: 'RDBEAR' },
  { label: 'Bull Market', value: 'RDBULL' },
];

const DEFAULT_MARKETS = ['1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V'];
const COLORS = {
  green: '#20a66a',
  blue: '#4678e8',
  yellow: '#e6b72f',
  red: '#df4c4c',
  normal: '#f8fafc',
};

type TickPoint = { epoch: number; price: number };
type TradeRecord = {
  id: string;
  symbol: string;
  type: string;
  barrier?: number;
  stake: number;
  profit: number;
  won: boolean;
  time: Date;
};

const emptyStats = () => Array.from({ length: 10 }, (_, digit) => ({
  digit, count: 0, percentage: 0,
}));

function digitFromPrice(price: number, pipSize: number) {
  const fixed = Number(price).toFixed(pipSize);
  return Number(fixed[fixed.length - 1]);
}

function getCircleColors(stats: { percentage: number }[]) {
  const unique = [...new Set(stats.map(s => s.percentage))].sort((a, b) => b - a);
  if (!unique.length || unique[0] === 0) return stats.map(() => COLORS.normal);
  return stats.map(s => {
    const high = unique.indexOf(s.percentage);
    const low = unique.length - 1 - high;
    if (high === 0) return COLORS.green;
    if (low === 0) return COLORS.red;
    if (high === 1) return COLORS.blue;
    if (low === 1) return COLORS.yellow;
    return COLORS.normal;
  });
}

function pct(count: number, total: number) {
  return total ? (count / total) * 100 : 0;
}

function useMarketStream(symbol: string) {
  const [points, setPoints] = useState<TickPoint[]>([]);
  const [pipSize, setPipSize] = useState(2);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const subIdRef = useRef<string | null>(null);
  const pointsRef = useRef<TickPoint[]>([]);
  const seenEpochsRef = useRef<Set<number>>(new Set());
  const liveBufferRef = useRef<TickPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let messageSub: any = null;
    let historyRequested = false;
    let activePipSize = 2;

    pointsRef.current = [];
    seenEpochsRef.current = new Set();
    liveBufferRef.current = [];
    setPoints([]);
    setConnected(false);
    setLoading(true);
    setError('');

    const forget = () => {
      if (subIdRef.current && api_base.api) {
        (api_base.api as any).send({ forget: subIdRef.current }).catch(() => {});
      }
      subIdRef.current = null;
    };

    const commit = (next: TickPoint[]) => {
      const unique: TickPoint[] = [];
      const epochs = new Set<number>();
      next.sort((a, b) => a.epoch - b.epoch).forEach(point => {
        if (!epochs.has(point.epoch)) {
          epochs.add(point.epoch);
          unique.push(point);
        }
      });
      pointsRef.current = unique.slice(-HISTORY_SIZE);
      setPoints([...pointsRef.current]);
    };

    const loadHistoryAfterPip = async (api: any) => {
      if (historyRequested || cancelled || !activePipSize) return;
      historyRequested = true;
      try {
        const response = await api.send({
          ticks_history: symbol,
          count: HISTORY_SIZE,
          end: 'latest',
          style: 'ticks',
        });
        if (cancelled) return;
        if (response?.error) throw new Error(response.error.message || 'History request failed');
        const prices = response?.history?.prices ?? [];
        const times = response?.history?. times ?? response?.history?.times ?? [];
        const history = prices.map((price: any, index: number) => ({
          price: Number(price),
          epoch: Number(times[index] ?? index),
        })).filter((point: TickPoint) => Number.isFinite(point.price));
        const merged = [...history, ...liveBufferRef.current];
        liveBufferRef.current = [];
        seenEpochsRef.current = new Set(merged.map(point => point.epoch));
        commit(merged);
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Unable to load market history');
          setLoading(false);
        }
      }
    };

    const start = async () => {
      if (cancelled) return;
      const api = api_base.api as any;
      if (!api) {
        retryTimer = setTimeout(start, 400);
        return;
      }

      try {
        messageSub = api.onMessage?.()?.subscribe?.(({ data: message }: any) => {
          if (cancelled) return;
          const data = message?.data ?? message;
          const tick = data?.tick;
          if (!tick || tick.quote == null) return;
          if (tick.symbol && tick.symbol !== symbol) return;
          if (subIdRef.current && data.subscription?.id &&
              String(data.subscription.id) !== String(subIdRef.current)) return;

          if (data.subscription?.id) subIdRef.current = String(data.subscription.id);
          if (tick.pip_size != null) {
            activePipSize = Number(tick.pip_size);
            pipSizeRef.current = activePipSize;
            setPipSize(activePipSize);
          }
          const point = { epoch: Number(tick.epoch ?? Math.floor(Date.now() / 1000)), price: Number(tick.quote) };
          if (!Number.isFinite(point.price)) return;

          setConnected(true);
          if (!historyRequested) {
            liveBufferRef.current.push(point);
            loadHistoryAfterPip(api);
            return;
          }
          if (seenEpochsRef.current.has(point.epoch)) return;
          seenEpochsRef.current.add(point.epoch);
          commit([...pointsRef.current, point]);
        });

        const subscription = await api.send({ ticks: symbol, subscribe: 1 });
        if (cancelled) return;
        if (subscription?.error) throw new Error(subscription.error.message || 'Tick subscription failed');
        if (subscription?.subscription?.id) {
          subIdRef.current = String(subscription.subscription.id);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Market stream unavailable');
          setLoading(false);
          retryTimer = setTimeout(start, 1200);
        }
      }
    };

    // Kept in a ref only to avoid changing the stream callback identity.
    const pipSizeRef = { current: 2 };
    start();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      messageSub?.unsubscribe?.();
      forget();
    };
  }, [symbol]);

  const digits = useMemo(() => points.map(point => digitFromPrice(point.price, pipSize)), [points, pipSize]);
  const stats = useMemo(() => {
    const counts = Array(10).fill(0);
    digits.forEach(digit => { if (digit >= 0 && digit <= 9) counts[digit]++; });
    return counts.map((count, digit) => ({
      digit, count, percentage: pct(count, digits.length),
    }));
  }, [digits]);

  return {
    points,
    digits,
    stats,
    lastDigit: digits.length ? digits[digits.length - 1] : null,
    currentPrice: points.length ? points[points.length - 1].price : null,
    pipSize,
    connected,
    loading,
    error,
  };
}

function Flow({ values, className = '' }: { values: string[]; className?: string }) {
  return (
    <div className={`dc-flow ${className}`}>
      {values.length ? values.slice(-32).map((value, index) => (
        <span key={`${value}-${index}`} className={`dc-flow__item dc-flow__item--${value === '=' ? 'eq' : value.toLowerCase()}`}>{value}</span>
      )) : <span className='dc-flow__empty'>Waiting for ticks…</span>}
    </div>
  );
}

function MetricBar({ label, value, color, detail }: { label: string; value: number; color: string; detail?: string }) {
  return (
    <div className='dc-metric'>
      <div className='dc-metric__top'>
        <span>{label}</span>
        <strong>{value.toFixed(1)}%</strong>
      </div>
      <div className='dc-metric__track'><span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} /></div>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function DigitStrip({ stats, lastDigit }: { stats: any[]; lastDigit: number | null }) {
  const colors = getCircleColors(stats);
  return (
    <div className='dc-digit-strip'>
      {stats.map((stat, digit) => {
        const current = digit === lastDigit;
        const bg = colors[digit];
        const darkText = bg === COLORS.normal || bg === COLORS.yellow;
        return (
          <div className={`dc-digit ${current ? 'dc-digit--current' : ''}`} key={digit}>
            <span className={`dc-digit__pointer ${current ? 'dc-digit__pointer--on' : ''}`}>▼</span>
            <div className='dc-digit__circle' style={{
              background: bg,
              color: darkText ? '#1a2433' : '#fff',
              borderColor: current ? (darkText ? '#172033' : '#fff') : bg === COLORS.normal ? '#d8dee8' : bg,
            }}>
              <b>{digit}</b>
              <small>{stat.percentage.toFixed(1)}%</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MarketCard({
  symbol,
  market,
  threshold,
  onThresholdChange,
  onRemove,
  onTrade,
}: {
  symbol: string;
  market: { label: string; value: string };
  threshold: number;
  onThresholdChange: (value: number) => void;
  onRemove: () => void;
  onTrade: () => void;
}) {
  const stream = useMarketStream(symbol);
  const lastDigits = stream.digits.slice(-WINDOW_SIZE);
  const lastPoints = stream.points.slice(-WINDOW_SIZE);
  const total = lastDigits.length;
  const windowStats = useMemo(() => {
    const counts = Array(10).fill(0);
    lastDigits.forEach(digit => { if (digit >= 0 && digit <= 9) counts[digit]++; });
    return counts.map((count, digit) => ({
      digit, count, percentage: pct(count, lastDigits.length),
    }));
  }, [lastDigits]);
  const topDigit = windowStats.reduce((best, item) => item.percentage > best.percentage ? item : best, windowStats[0]).digit;

  const even = pct(lastDigits.filter(d => d % 2 === 0).length, total);
  const odd = pct(lastDigits.filter(d => d % 2 !== 0).length, total);
  const over = pct(lastDigits.filter(d => d > threshold).length, total);
  const under = pct(lastDigits.filter(d => d < threshold).length, total);
  const equals = pct(lastDigits.filter(d => d === threshold).length, total);
  const matches = pct(lastDigits.filter(d => d === topDigit).length, total);
  const differs = pct(lastDigits.filter(d => d !== topDigit).length, total);
  const rises = lastPoints.reduce((count, point, index) => index > 0 && point.price > lastPoints[index - 1].price ? count + 1 : count, 0);
  const falls = lastPoints.reduce((count, point, index) => index > 0 && point.price < lastPoints[index - 1].price ? count + 1 : count, 0);
  const onlyUp = lastPoints.reduce((count, point, index) => index > 0 && point.price >= lastPoints[index - 1].price ? count + 1 : count, 0);
  const onlyDown = lastPoints.reduce((count, point, index) => index > 0 && point.price <= lastPoints[index - 1].price ? count + 1 : count, 0);
  const eoFlow = lastDigits.map(d => d % 2 === 0 ? 'E' : 'O');
  const ouFlow = lastDigits.map(d => d > threshold ? 'OV' : d < threshold ? 'UN' : '=');
  const directionFlow = lastPoints.slice(1).map((point, index) => point.price > lastPoints[index].price ? 'UP' : point.price < lastPoints[index].price ? 'DN' : '=');

  return (
    <article className='dc-card'>
      <header className='dc-card__header'>
        <div>
          <div className='dc-card__title-row'>
            <h3>{market.label}</h3>
            <span className={`dc-status ${stream.connected ? 'dc-status--live' : ''}`}>
              <i />{stream.connected ? 'LIVE' : stream.loading ? 'CONNECTING' : 'OFFLINE'}
            </span>
          </div>
          <span className='dc-card__symbol'>{symbol} · {stream.points.length.toLocaleString()} ticks loaded</span>
        </div>
        <div className='dc-card__actions'>
          <button className='dc-icon-btn' onClick={onTrade} title='Open trade panel'>Trade</button>
          <button className='dc-icon-btn dc-icon-btn--close' onClick={onRemove} title='Remove card'>×</button>
        </div>
      </header>

      <div className='dc-card__quote'>
        <div>
          <span className='dc-label'>LAST PRICE</span>
          <strong>{stream.currentPrice != null ? stream.currentPrice.toFixed(stream.pipSize) : '—'}</strong>
        </div>
        <div className='dc-card__latest'>
          <span className='dc-label'>LAST DIGIT</span>
           <b style={{ background: getCircleColors(windowStats)[stream.lastDigit ?? 0] }}>{stream.lastDigit ?? '—'}</b>
        </div>
        <label className='dc-threshold'>
          <span className='dc-label'>THRESHOLD</span>
          <input type='number' min={0} max={9} value={threshold} onChange={e => onThresholdChange(Math.max(0, Math.min(9, Number(e.target.value) || 0)))} />
        </label>
      </div>

       <DigitStrip stats={windowStats} lastDigit={stream.lastDigit} />

      <div className='dc-card__section-heading'>
        <span>LAST {WINDOW_SIZE} TICKS</span>
        <span>{stream.error ? stream.error : total ? `${total} real ticks analyzed` : 'Waiting for authenticated market data'}</span>
      </div>

      <div className='dc-metrics-grid'>
        <section className='dc-metric-group'>
          <h4>Even / Odd <em>100 ticks</em></h4>
          <MetricBar label='E · Even' value={even} color={COLORS.blue} />
          <MetricBar label='O · Odd' value={odd} color={COLORS.yellow} />
          <Flow values={eoFlow} />
        </section>
        <section className='dc-metric-group'>
          <h4>Over / Under <em>barrier {threshold}</em></h4>
          <MetricBar label={`Over ${threshold}`} value={over} color={COLORS.green} />
          <MetricBar label={`Under ${threshold}`} value={under} color={COLORS.red} />
          <MetricBar label={`= ${threshold}`} value={equals} color='#8b95a7' />
          <Flow values={ouFlow} className='dc-flow--wide' />
        </section>
        <section className='dc-metric-group'>
          <h4>Matches / Differs <em>target {topDigit}</em></h4>
          <MetricBar label={`Matches ${topDigit}`} value={matches} color={COLORS.green} />
          <MetricBar label={`Differs ${topDigit}`} value={differs} color={COLORS.red} />
        </section>
        <section className='dc-metric-group'>
          <h4>Rise / Fall</h4>
          <MetricBar label='Rise ↑' value={pct(rises, Math.max(1, total - 1))} color={COLORS.green} />
          <MetricBar label='Fall ↓' value={pct(falls, Math.max(1, total - 1))} color={COLORS.red} />
          <div className='dc-direction-pair'>
            <span>Only Up <b>{pct(onlyUp, Math.max(1, total - 1)).toFixed(1)}%</b></span>
            <span>Only Down <b>{pct(onlyDown, Math.max(1, total - 1)).toFixed(1)}%</b></span>
          </div>
          <Flow values={directionFlow} className='dc-flow--direction' />
        </section>
      </div>
    </article>
  );
}

function TradeRail({
  selectedSymbol,
  selectedMarket,
  currency,
  onTrade,
}: {
  selectedSymbol: string;
  selectedMarket: { label: string; value: string };
  currency: string;
  onTrade: (type: string, barrier?: number, stake?: number, duration?: number) => Promise<TradeRecord | null>;
}) {
  const [tab, setTab] = useState<'summary' | 'transactions' | 'journal'>('summary');
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [stake, setStake] = useState(0.35);
  const [duration, setDuration] = useState(1);
  const [barrier, setBarrier] = useState(5);
  const [busy, setBusy] = useState(false);

  const addTrade = useCallback(async (type: string, barrierValue?: number) => {
    setBusy(true);
    try {
      const trade = await onTrade(type, barrierValue, stake, duration);
      if (trade) setTrades(prev => [trade, ...prev].slice(0, 100));
    } finally {
      setBusy(false);
    }
  }, [duration, onTrade, stake]);

  const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
  const totalStake = trades.reduce((sum, t) => sum + t.stake, 0);
  const wins = trades.filter(t => t.won).length;
  const fmt = (value: number) => `${fromUsd(value).toFixed(2)} ${currency}`;
  const fmtPnl = (value: number) => `${value >= 0 ? '+' : ''}${fromUsd(value).toFixed(2)} ${currency}`;

  return (
    <aside className='dc-rail'>
      <div className='dc-rail__trade'>
        <div className='dc-rail__heading'>
          <div>
            <span className='dc-label'>TRADE PANEL</span>
            <h2>{selectedMarket.label}</h2>
          </div>
          <span className='dc-rail__live'>AUTHENTICATED API</span>
        </div>
        <div className='dc-form-row'>
          <label>Stake<input type='number' min={0.35} step={0.01} value={stake} onChange={e => setStake(Math.max(0.35, Number(e.target.value) || 0.35))} /></label>
          <label>Ticks<input type='number' min={1} max={10} value={duration} onChange={e => setDuration(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))} /></label>
          <label>Barrier<input type='number' min={0} max={9} value={barrier} onChange={e => setBarrier(Math.max(0, Math.min(9, parseInt(e.target.value) || 0)))} /></label>
        </div>
        <div className='dc-trade-buttons'>
          {[
            ['DIGITEVEN', 'Even'], ['DIGITODD', 'Odd'],
            ['DIGITOVER', `Over ${barrier}`], ['DIGITUNDER', `Under ${barrier}`],
            ['DIGITMATCH', `Match ${barrier}`], ['DIGITDIFF', `Differ ${barrier}`],
            ['CALL', 'Rise'], ['PUT', 'Fall'],
          ].map(([type, label]) => (
            <button key={type} disabled={busy} className={`dc-trade-btn dc-trade-btn--${type.toLowerCase()}`} onClick={() => addTrade(type, ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(type) ? barrier : undefined)}>
              {label}
            </button>
          ))}
        </div>
        <small className='dc-rail__hint'>Selected market: {selectedSymbol}. Contract results are added after authenticated settlement.</small>
      </div>

      <div className='dc-rail__records'>
        <nav className='dc-tabs'>
          {(['summary', 'transactions', 'journal'] as const).map(item => (
            <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>
          ))}
        </nav>
        {tab === 'summary' && (
          <div className='dc-summary'>
            <div className='dc-summary__grid'>
              <div><span>Total stake</span><b>{fmt(totalStake)}</b></div>
              <div><span>Contracts</span><b>{trades.length}</b></div>
              <div><span>Won</span><b className='positive'>{wins}</b></div>
              <div><span>Lost</span><b className='negative'>{trades.length - wins}</b></div>
              <div className='dc-summary__profit'><span>Total profit/loss</span><b className={totalProfit >= 0 ? 'positive' : 'negative'}>{fmtPnl(totalProfit)}</b></div>
            </div>
            <button className='dc-reset' onClick={() => setTrades([])}>Reset records</button>
          </div>
        )}
        {tab === 'transactions' && (
          <div className='dc-record-list'>
            {!trades.length && <div className='dc-empty'>No transactions yet.</div>}
            {trades.map(trade => (
              <div className={`dc-record ${trade.won ? 'won' : 'lost'}`} key={trade.id}>
                <div><b>{trade.type}{trade.barrier != null ? ` @${trade.barrier}` : ''}</b><small>{trade.time.toLocaleTimeString()}</small></div>
                <div><span>{fmt(trade.stake)}</span><strong>{fmtPnl(trade.profit)}</strong></div>
              </div>
            ))}
          </div>
        )}
        {tab === 'journal' && (
          <div className='dc-record-list'>
            {!trades.length && <div className='dc-empty'>Journal will appear after the first settled contract.</div>}
            {trades.map((trade, index) => (
              <div className='dc-journal-row' key={trade.id}>
                <span>#{trades.length - index}</span>
                <p>{trade.type} on {selectedMarket.label} · stake {fmt(trade.stake)} · result <strong className={trade.won ? 'positive' : 'negative'}>{fmtPnl(trade.profit)}</strong></p>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

const CircleAnalyzer = observer(() => {
  const { buyContract: executeTrade, authorized, currency: accountCurrency } = useDerivTrade();
  const [symbols, setSymbols] = useState(DEFAULT_MARKETS);
  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_MARKETS[0]);
  const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
  const [notice, setNotice] = useState('');
  const [tradeLock, setTradeLock] = useState(false);

  useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

  const availableMarkets = ALL_MARKETS.filter(market => !symbols.includes(market.value));
  const selectedMarket = ALL_MARKETS.find(market => market.value === selectedSymbol) ?? ALL_MARKETS[0];

  const addMarket = (value: string) => {
    if (!value || symbols.includes(value)) return;
    setSymbols(prev => [...prev, value]);
    setSelectedSymbol(value);
  };

  const removeMarket = (value: string) => {
    if (symbols.length <= 1) return;
    setSymbols(prev => prev.filter(symbol => symbol !== value));
    if (selectedSymbol === value) setSelectedSymbol(symbols.find(symbol => symbol !== value) ?? symbols[0]);
  };

  const buyContract = useCallback(async (contractType: string, barrier?: number, stake = 0.35, duration = 1): Promise<TradeRecord | null> => {
    if (tradeLock) {
      setNotice('A contract is already being settled. Please wait.');
      return null;
    }
    if (!authorized) {
      setNotice('Connect a Deriv account before trading.');
      return null;
    }
    setTradeLock(true);
    try {
      const record = await new Promise<TradeRecord | null>((resolve, reject) => {
        let settled = false;
        const settle = (result: any) => {
          if (settled) return;
          settled = true;
          const profit = Number(result?.profit ?? 0);
          const record: TradeRecord = {
            id: String(result?.contract_id ?? `${Date.now()}`),
            symbol: selectedSymbol,
            type: contractType,
            barrier,
            stake,
            profit,
            won: result?.status === 'won' || profit > 0,
            time: new Date(),
          };
          setNotice(`${record.won ? 'Profit' : 'Loss'} ${fromUsd(profit).toFixed(2)} ${displayCur}`);
          resolve(record);
        };
        executeTrade({
          symbol: selectedSymbol,
          contract_type: contractType,
          duration,
          duration_unit: 't',
          stake,
          barrier,
          currency: accountCurrency || displayCur,
          metadata: { source: 'dcircles' },
        }, settle).catch(reject);
      });
      return record;
    } catch (e: any) {
      setNotice(e?.message || 'Trade failed');
      return null;
    } finally {
      setTradeLock(false);
    }
  }, [accountCurrency, authorized, displayCur, executeTrade, selectedSymbol, tradeLock]);

  return (
    <div className='dc-page'>
      <header className='dc-page__header'>
        <div>
          <span className='dc-page__eyebrow'>DERIV MARKET INTELLIGENCE</span>
          <h1>D-Circles</h1>
          <p>Live digit distribution, parity flow, barriers and direction across your selected markets.</p>
        </div>
        <div className='dc-page__controls'>
          <label className='dc-add-market'>
            <span>Add market</span>
            <select value='' onChange={e => addMarket(e.target.value)}>
              <option value=''>Choose a market…</option>
              {availableMarkets.map(market => <option key={market.value} value={market.value}>{market.label}</option>)}
            </select>
          </label>
          <span className='dc-page__count'>{symbols.length} cards active</span>
        </div>
      </header>

      {notice && <div className='dc-notice' role='status'>{notice}<button onClick={() => setNotice('')}>×</button></div>}

      <div className='dc-page__layout'>
        <main className='dc-market-grid'>
          {symbols.map(symbol => {
            const market = ALL_MARKETS.find(item => item.value === symbol) ?? { label: symbol, value: symbol };
            return (
              <div className={`dc-market-slot ${selectedSymbol === symbol ? 'dc-market-slot--selected' : ''}`} key={symbol} onClick={() => setSelectedSymbol(symbol)}>
                <MarketCard
                  symbol={symbol}
                  market={market}
                  threshold={thresholds[symbol] ?? 5}
                  onThresholdChange={value => setThresholds(prev => ({ ...prev, [symbol]: value }))}
                  onRemove={() => removeMarket(symbol)}
                  onTrade={() => setSelectedSymbol(symbol)}
                />
              </div>
            );
          })}
        </main>
        <TradeRail selectedSymbol={selectedSymbol} selectedMarket={selectedMarket} currency={displayCur} onTrade={buyContract} />
      </div>
    </div>
  );
});

export default CircleAnalyzer;