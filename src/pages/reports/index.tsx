// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import './reports.scss';

interface Statement {
  transaction_id: number;
  contract_id: number;
  action_type: string;
  amount: number;
  balance_after: number;
  short_code: string;
  purchase_time: number;
  sell_time: number;
  pnl: number;
  longcode: string;
  contract_type: string;
}

const TABS = ['Profit & Loss', 'Open Positions', 'Statement'];

const Reports = observer(() => {
  const { balance, currency } = useDerivTrading();
  const [activeTab, setActiveTab] = useState(0);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [openContracts, setOpenContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [totalPnl, setTotalPnl] = useState(0);
  const [winRate, setWinRate] = useState(0);

  const fetchStatement = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { statement: 1, description: 1, limit: 100 };
      if (dateFrom) params.date_from = Math.floor(new Date(dateFrom).getTime() / 1000);
      if (dateTo) params.date_to = Math.floor(new Date(dateTo).getTime() / 1000);

      const res = await api_base.api.send(params);
      if (res?.statement?.transactions) {
        const txns = res.statement.transactions;
        const sells = txns.filter((t: any) => t.action_type === 'sell');
        setStatements(sells.map((t: any) => ({
          transaction_id: t.transaction_id,
          contract_id: t.contract_id,
          action_type: t.action_type,
          amount: parseFloat(t.amount || '0'),
          balance_after: parseFloat(t.balance_after || '0'),
          longcode: t.longcode || '',
          purchase_time: t.purchase_time,
          sell_time: t.sell_time,
          pnl: parseFloat(t.amount || '0'),
          contract_type: (t.shortcode || '').split('_')[0] || 'N/A',
        })));
        const pnl = sells.reduce((s: number, t: any) => s + parseFloat(t.amount || '0'), 0);
        setTotalPnl(pnl);
        const wins = sells.filter((t: any) => parseFloat(t.amount || '0') > 0).length;
        setWinRate(sells.length > 0 ? (wins / sells.length) * 100 : 0);
      }
    } catch (e) {
      console.error('Statement error', e);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  const fetchOpenContracts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api_base.api.send({ proposal_open_contract: 1 });
      if (res?.proposal_open_contract) {
        const c = res.proposal_open_contract;
        setOpenContracts(Array.isArray(c) ? c : [c]);
      }
    } catch (e) {
      console.error('Open contracts error', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 0 || activeTab === 2) fetchStatement();
    else if (activeTab === 1) fetchOpenContracts();
  }, [activeTab]);

  const formatDate = (ts: number) => {
    if (!ts) return '---';
    return new Date(ts * 1000).toLocaleString();
  };

  const groupByDay = (stmts: Statement[]) => {
    const groups: { [day: string]: Statement[] } = {};
    stmts.forEach(s => {
      const day = s.sell_time ? new Date(s.sell_time * 1000).toLocaleDateString() : 'Unknown';
      if (!groups[day]) groups[day] = [];
      groups[day].push(s);
    });
    return groups;
  };

  return (
    <div className='reports'>
      <div className='reports__header'>
        <h1>📊 Reports</h1>
        {balance !== null && (
          <div className='reports__balance'>{currency} {balance.toFixed(2)}</div>
        )}
      </div>

      <div className='reports__tabs'>
        {TABS.map((t, i) => (
          <button key={t} className={`reports__tab ${activeTab === i ? 'active' : ''}`} onClick={() => setActiveTab(i)}>
            {t}
          </button>
        ))}
      </div>

      {(activeTab === 0 || activeTab === 2) && (
        <div className='reports__filters'>
          <label>From: <input type='date' value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label>
          <label>To: <input type='date' value={dateTo} onChange={e => setDateTo(e.target.value)} /></label>
          <button className='reports__refresh-btn' onClick={fetchStatement} disabled={isLoading}>
            {isLoading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      )}

      {activeTab === 0 && (
        <div className='reports__pnl'>
          <div className='reports__summary-cards'>
            <div className='reports__summary-card'>
              <span>Total P/L</span>
              <strong className={totalPnl >= 0 ? 'pos' : 'neg'}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} {currency}</strong>
            </div>
            <div className='reports__summary-card'>
              <span>Total Trades</span>
              <strong>{statements.length}</strong>
            </div>
            <div className='reports__summary-card'>
              <span>Wins</span>
              <strong className='pos'>{statements.filter(s => s.pnl > 0).length}</strong>
            </div>
            <div className='reports__summary-card'>
              <span>Losses</span>
              <strong className='neg'>{statements.filter(s => s.pnl <= 0).length}</strong>
            </div>
            <div className='reports__summary-card'>
              <span>Win Rate</span>
              <strong>{winRate.toFixed(1)}%</strong>
            </div>
          </div>

          {isLoading && <div className='reports__loading'>Loading trades...</div>}

          {!isLoading && statements.length === 0 && (
            <div className='reports__empty'>No trades found. Make some trades first!</div>
          )}

          {!isLoading && Object.entries(groupByDay(statements)).map(([day, trades]) => (
            <div key={day} className='reports__day-group'>
              <div className='reports__day-header'>
                <span>{day}</span>
                <span className={trades.reduce((s, t) => s + t.pnl, 0) >= 0 ? 'pos' : 'neg'}>
                  {trades.reduce((s, t) => s + t.pnl, 0) >= 0 ? '+' : ''}
                  {trades.reduce((s, t) => s + t.pnl, 0).toFixed(2)}
                </span>
              </div>
              <div className='reports__day-trades'>
                {trades.map(t => (
                  <div key={t.transaction_id} className={`reports__trade-row ${t.pnl > 0 ? 'won' : 'lost'}`}>
                    <div className='reports__trade-type'>{t.contract_type}</div>
                    <div className='reports__trade-desc'>{t.longcode.slice(0, 60)}...</div>
                    <div className='reports__trade-time'>{formatDate(t.sell_time)}</div>
                    <div className={`reports__trade-pnl ${t.pnl > 0 ? 'pos' : 'neg'}`}>
                      {t.pnl > 0 ? '+' : ''}{t.pnl.toFixed(2)}
                    </div>
                    <div className='reports__trade-balance'>{t.balance_after.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 1 && (
        <div className='reports__open'>
          {isLoading && <div className='reports__loading'>Loading positions...</div>}
          {!isLoading && openContracts.length === 0 && (
            <div className='reports__empty'>No open positions.</div>
          )}
          {!isLoading && openContracts.map((c, i) => (
            <div key={i} className='reports__open-contract'>
              <div className='reports__open-header'>
                <strong>{c.contract_type || 'N/A'}</strong>
                <span className='reports__open-status'>{c.status || 'open'}</span>
              </div>
              <div className='reports__open-details'>
                <span>Stake: {c.buy_price?.toFixed(2) ?? '---'}</span>
                <span>Entry: {c.entry_spot ?? '---'}</span>
                <span>Current: {c.current_spot ?? '---'}</span>
                <span className={parseFloat(c.profit || '0') >= 0 ? 'pos' : 'neg'}>
                  P/L: {parseFloat(c.profit || '0').toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 2 && (
        <div className='reports__statement'>
          {isLoading && <div className='reports__loading'>Loading statement...</div>}
          {!isLoading && (
            <table className='reports__table'>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {statements.map(s => (
                  <tr key={s.transaction_id} className={s.pnl > 0 ? 'won' : 'lost'}>
                    <td>{s.contract_type}</td>
                    <td className={s.pnl > 0 ? 'pos' : 'neg'}>{s.pnl > 0 ? '+' : ''}{s.pnl.toFixed(2)}</td>
                    <td>{s.balance_after.toFixed(2)}</td>
                    <td>{formatDate(s.sell_time)}</td>
                  </tr>
                ))}
                {statements.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>No data</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
});

export default Reports;
