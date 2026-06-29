import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import './speedlab.scss';

const SYMBOLS = [
  { label: 'V10',      value: 'R_10'       },
  { label: 'V25',      value: 'R_25'       },
  { label: 'V50',      value: 'R_50'       },
  { label: 'V75',      value: 'R_75'       },
  { label: 'V100',     value: 'R_100'      },
  { label: 'V10 1s',   value: '1HZ10V'    },
  { label: 'V25 1s',   value: '1HZ25V'    },
  { label: 'V50 1s',   value: '1HZ50V'    },
  { label: 'V75 1s',   value: '1HZ75V'    },
  { label: 'V100 1s',  value: '1HZ100V'   },
  { label: 'Jump 10',  value: 'JD10'      },
  { label: 'Jump 25',  value: 'JD25'      },
  { label: 'Jump 50',  value: 'JD50'      },
  { label: 'Jump 75',  value: 'JD75'      },
  { label: 'Jump 100', value: 'JD100'     },
];

const CONTRACTS = [
  { label: '⬆ Rise',    value: 'CALL',        needs_barrier: false },
  { label: '⬇ Fall',    value: 'PUT',         needs_barrier: false },
  { label: 'Even',       value: 'DIGITEVEN',  needs_barrier: false },
  { label: 'Odd',        value: 'DIGITODD',   needs_barrier: false },
  { label: 'Over 4',     value: 'DIGITOVER',  needs_barrier: true, barrier: 4 },
  { label: 'Under 5',    value: 'DIGITUNDER', needs_barrier: true, barrier: 5 },
  { label: 'Match',      value: 'DIGITMATCH', needs_barrier: true, barrier: 7 },
  { label: 'Differ',     value: 'DIGITDIFF',  needs_barrier: true, barrier: 7 },
];

interface TradeLog {
  id: number;
  contract: string;
  symbol: string;
  stake: number;
  status: 'SENT' | 'WON' | 'LOST' | 'OPEN';
  profit: number;
  ms: number;
  contractId?: number;
}

function getLastDigit(quote: number): number {
  const s = quote.toFixed(2).replace('.', '');
  return parseInt(s[s.length - 1], 10);
}

const SpeedLab: React.FC = () => {
  const { connected, balance, currency, send, subscribeTicks, buyContract } = useDerivTrade();
  const [symbolIdx, setSymbolIdx] = useState(9); // 1HZ100V
  const [contractIdx, setContractIdx] = useState(0); // CALL
  const [stake, setStake] = useState('0.35');
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<TradeLog[]>([]);
  const [totalPnl, setTotalPnl] = useState(0);
  const [tradeCount, setTradeCount] = useState(0);
  const [speed, setSpeed] = useState(500);
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  const [digitFreq, setDigitFreq] = useState<number[]>(new Array(10).fill(0));
  const [totalTicks, setTotalTicks] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idRef = useRef(0);
  const activeContractsRef = useRef<Map<number, TradeLog>>(new Map());

  const symbol = SYMBOLS[symbolIdx];
  const contract = CONTRACTS[contractIdx];

  // Subscribe to live ticks for current digit display
  useEffect(() => {
    if (!connected) return;
    const unsub = subscribeTicks(symbol.value, (tick) => {
      setLastDigit(tick.digit);
      setDigitFreq(prev => {
        const next = [...prev];
        next[tick.digit]++;
        return next;
      });
      setTotalTicks(p => p + 1);
    });
    setDigitFreq(new Array(10).fill(0));
    setTotalTicks(0);
    setLastDigit(null);
    return unsub;
  }, [connected, symbol.value, subscribeTicks]);

  // Monitor open contracts for win/loss
  const monitorContract = useCallback((contractId: number, logId: number, stakeAmt: number) => {
    try {
      const obs = (window as any).__derivApi?.subscribe?.({
        proposal_open_contract: 1,
        contract_id: contractId,
      });
      if (!obs) return;
      const sub = obs.subscribe({
        next: (res: any) => {
          const poc = res?.proposal_open_contract;
          if (!poc) return;
          if (poc.is_sold || poc.status === 'won' || poc.status === 'lost') {
            const profit = parseFloat(poc.profit || '0');
            const won = poc.status === 'won' || profit > 0;
            setLogs(prev => prev.map(l => l.id === logId ? {
              ...l,
              status: won ? 'WON' : 'LOST',
              profit,
            } : l));
            setTotalPnl(prev => prev + profit);
            try { sub.unsubscribe(); } catch (_) {}
          }
        },
        error: () => {},
      });
    } catch (_) {}
  }, []);

  const executeTrade = useCallback(async () => {
    if (!connected) return;
    const start = performance.now();
    const s = parseFloat(stake) || 0.35;
    const logId = idRef.current++;
    const entry: TradeLog = {
      id: logId,
      contract: contract.label,
      symbol: symbol.label,
      stake: s,
      status: 'SENT',
      profit: 0,
      ms: 0,
    };
    setLogs(prev => [entry, ...prev].slice(0, 100));
    setTradeCount(prev => prev + 1);

    try {
      const params: any = {
        symbol: symbol.value,
        contract_type: contract.value as any,
        duration: 1,
        duration_unit: 't',
        stake: s,
      };
      if (contract.needs_barrier) params.barrier = (contract as any).barrier;

      const res = await buyContract(params);
      const ms = Math.round(performance.now() - start);
      setLogs(prev => prev.map(l => l.id === logId ? {
        ...l,
        ms,
        contractId: res?.contract_id,
        status: 'OPEN',
      } : l));

      if (res?.contract_id) {
        monitorContract(res.contract_id, logId, s);
      }
    } catch (e: any) {
      const ms = Math.round(performance.now() - start);
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, ms, status: 'LOST', profit: -s } : l));
    }
  }, [connected, contract, symbol, stake, buyContract, monitorContract]);

  const toggleRun = () => {
    if (running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRunning(false);
    } else {
      if (!connected) return;
      setRunning(true);
      intervalRef.current = setInterval(executeTrade, speed);
    }
  };

  useEffect(() => {
    if (running && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(executeTrade, speed);
    }
  }, [speed, executeTrade, running]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const clearLogs = () => { setLogs([]); setTotalPnl(0); setTradeCount(0); };

  const wonLogs = logs.filter(l => l.status === 'WON');
  const lostLogs = logs.filter(l => l.status === 'LOST');
  const winRate = (wonLogs.length + lostLogs.length) > 0
    ? ((wonLogs.length / (wonLogs.length + lostLogs.length)) * 100).toFixed(1)
    : '0.0';

  const maxFreq = Math.max(...digitFreq, 1);

  return (
    <div className='speedlab'>
      {/* Current Digit Triangle */}
      {lastDigit !== null && (
        <div className='speedlab__digit-badge'>
          <div className='speedlab__digit-triangle'>▲</div>
          <div className='speedlab__digit-current'>{lastDigit}</div>
          <div className='speedlab__digit-label'>LAST DIGIT</div>
        </div>
      )}

      <div className='speedlab__header'>
        <div>
          <h2 className='speedlab__title'>⚡ SpeedLab</h2>
          <p className='speedlab__sub'>Ultra-fast live trading laboratory — {currency} account</p>
        </div>
        <div className='speedlab__header-right'>
          <div className='speedlab__balance-box'>
            <span>Balance</span>
            <strong>{currency} {balance !== null ? Number(balance).toFixed(2) : '—'}</strong>
          </div>
          <div className='speedlab__stats-strip'>
            <div className='speedlab__stat'><span>Trades</span><strong>{tradeCount}</strong></div>
            <div className='speedlab__stat'><span>Win%</span><strong style={{ color: '#22c55e' }}>{winRate}%</strong></div>
            <div className='speedlab__stat'>
              <span>P&amp;L</span>
              <strong className={totalPnl >= 0 ? 'pos' : 'neg'}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}</strong>
            </div>
            <div className={`speedlab__conn ${connected ? 'on' : 'off'}`}>
              {connected ? '● LIVE' : '○ Offline'}
            </div>
          </div>
        </div>
      </div>

      {/* Digit frequency bar */}
      {totalTicks > 0 && (
        <div className='speedlab__digit-freq'>
          {Array.from({ length: 10 }, (_, d) => (
            <div key={d} className={`speedlab__freq-bar ${lastDigit === d ? 'active' : ''}`}>
              <div className='speedlab__freq-fill' style={{ height: `${(digitFreq[d] / maxFreq) * 48}px` }} />
              <span>{d}</span>
            </div>
          ))}
        </div>
      )}

      <div className='speedlab__controls'>
        {/* Symbol selector */}
        <div className='speedlab__field speedlab__field--full'>
          <label>Market</label>
          <div className='speedlab__pills'>
            {SYMBOLS.map((s, i) => (
              <button key={s.value} className={`speedlab__pill ${symbolIdx === i ? 'active' : ''}`}
                onClick={() => setSymbolIdx(i)}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* Contract type */}
        <div className='speedlab__field speedlab__field--full'>
          <label>Contract Type</label>
          <div className='speedlab__pills'>
            {CONTRACTS.map((c, i) => (
              <button key={c.value} className={`speedlab__pill ${contractIdx === i ? 'active' : ''}`}
                onClick={() => setContractIdx(i)}>{c.label}</button>
            ))}
          </div>
        </div>

        <div className='speedlab__field'>
          <label>Stake ({currency})</label>
          <input type='number' min='0.35' step='0.01' value={stake} onChange={e => setStake(e.target.value)} />
        </div>
        <div className='speedlab__field'>
          <label>Interval (ms): <strong>{speed}</strong></label>
          <input type='range' min={200} max={5000} step={100} value={speed}
            onChange={e => setSpeed(+e.target.value)} />
        </div>
        <button
          className={`speedlab__run-btn ${running ? 'stop' : ''}`}
          onClick={toggleRun}
          disabled={!connected}
        >
          {running ? '⏹ STOP' : '⚡ START LIVE'}
        </button>
        <button className='speedlab__clear-btn' onClick={clearLogs}>↺ Clear</button>
      </div>

      <div className='speedlab__log'>
        <div className='speedlab__log-header'>
          <span>Live Trade Log</span>
          <span className={`speedlab__live-dot ${running ? 'on' : ''}`}>{running ? '● LIVE' : '○ Idle'}</span>
        </div>
        <div className='speedlab__log-body'>
          {logs.map(log => (
            <div key={log.id} className={`speedlab__log-row ${log.status.toLowerCase()}`}>
              <span className='speedlab__log-id'>#{log.id}</span>
              <span className='speedlab__log-contract'>{log.contract}</span>
              <span className='speedlab__log-symbol'>{log.symbol}</span>
              <span className='speedlab__log-stake'>{log.stake.toFixed(2)}</span>
              <span className={`speedlab__log-status ${log.status.toLowerCase()}`}>{log.status}</span>
              {log.status !== 'SENT' && log.status !== 'OPEN' ? (
                <span className={`speedlab__log-profit ${log.profit >= 0 ? 'pos' : 'neg'}`}>
                  {log.profit >= 0 ? '+' : ''}{log.profit.toFixed(2)}
                </span>
              ) : <span className='speedlab__log-profit' style={{ opacity: 0.4 }}>—</span>}
              <span className='speedlab__log-ms'>{log.ms > 0 ? `${log.ms}ms` : '...'}</span>
            </div>
          ))}
          {logs.length === 0 && <div className='speedlab__log-empty'>No live trades yet. Connect account and click START LIVE.</div>}
        </div>
      </div>
    </div>
  );
};

export default SpeedLab;
