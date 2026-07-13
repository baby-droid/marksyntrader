// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import './reports.scss';

/* ── helpers ── */
const fmt = (ts: number) => {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
};
const fmtTime = (ts: number) => {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleTimeString('en-GB', { hour12: false });
};
const fmtPnl = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;

function extractType(shortcode: string) {
    const map: Record<string, string> = {
        DIGITEVEN: 'EVEN', DIGITODD: 'ODD', DIGITOVER: 'OVER', DIGITUNDER: 'UNDER',
        DIGITMATCH: 'MATCH', DIGITDIFF: 'DIFFER', CALL: 'RISE', PUT: 'FALL',
    };
    const part = (shortcode || '').split('_')[0].toUpperCase();
    return map[part] || part || 'N/A';
}

/* ── Fetch contract info (entry/exit spots, buy price) ── */
async function fetchContractInfo(contract_id: number): Promise<any> {
    try {
        const res = await (api_base.api.send as any)({ contract_info: contract_id });
        return res?.contract_info ?? null;
    } catch { return null; }
}

const TABS = ['P&L History', 'Open Positions', 'Statement'];

const Reports = observer(() => {
    const { balance, currency } = useDerivTrading();
    const [activeTab, setActiveTab]     = useState(0);
    const [statements, setStatements]   = useState<any[]>([]);
    const [openContracts, setOpenContracts] = useState<any[]>([]);
    const [isLoading, setIsLoading]     = useState(false);
    const [dateFrom, setDateFrom]       = useState('');
    const [dateTo, setDateTo]           = useState('');
    const [totalPnl, setTotalPnl]       = useState(0);
    const [winRate, setWinRate]         = useState(0);
    const [limit, setLimit]             = useState(50);
    /* contract_info cache: contract_id → details */
    const infoCache = useRef<Record<number, any>>({});
    const [infoMap, setInfoMap]         = useState<Record<number, any>>({});

    const fetchStatement = useCallback(async (lim = limit) => {
        setIsLoading(true);
        try {
            const params: any = { statement: 1, description: 1, limit: lim };
            if (dateFrom) params.date_from = Math.floor(new Date(dateFrom).getTime() / 1000);
            if (dateTo)   params.date_to   = Math.floor(new Date(dateTo).getTime() / 1000);

            const res = await (api_base.api.send as any)(params);
            if (res?.statement?.transactions) {
                const txns = res.statement.transactions;
                const sells = txns.filter((t: any) => t.action_type === 'sell');
                const rows = sells.map((t: any) => ({
                    transaction_id: t.transaction_id,
                    contract_id:    t.contract_id,
                    action_type:    t.action_type,
                    amount:         parseFloat(t.amount  || '0'),
                    balance_after:  parseFloat(t.balance_after || '0'),
                    longcode:       t.longcode  || '',
                    shortcode:      t.shortcode || '',
                    purchase_time:  t.purchase_time,
                    sell_time:      t.sell_time,
                    pnl:            parseFloat(t.amount  || '0'),
                    contract_type:  extractType(t.shortcode || ''),
                }));
                setStatements(rows);
                const pnl = rows.reduce((s: number, t: any) => s + t.pnl, 0);
                setTotalPnl(pnl);
                const wins = rows.filter((t: any) => t.pnl > 0).length;
                setWinRate(rows.length > 0 ? (wins / rows.length) * 100 : 0);

                /* Batch-fetch contract details for entry/exit spots */
                const ids = rows.slice(0, 30).map((t: any) => t.contract_id).filter(Boolean);
                const missing = ids.filter((id: number) => !infoCache.current[id]);
                if (missing.length > 0) {
                    const infos = await Promise.allSettled(missing.map(fetchContractInfo));
                    infos.forEach((r, i) => {
                        if (r.status === 'fulfilled' && r.value) {
                            infoCache.current[missing[i]] = r.value;
                        }
                    });
                    setInfoMap({ ...infoCache.current });
                }
            }
        } catch (e) {
            console.error('Statement error', e);
        } finally {
            setIsLoading(false);
        }
    }, [dateFrom, dateTo, limit]);

    const fetchOpenContracts = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await (api_base.api.send as any)({ proposal_open_contract: 1 });
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
    }, [activeTab]); // eslint-disable-line

    const groupByDay = (stmts: any[]) => {
        const groups: Record<string, any[]> = {};
        stmts.forEach(s => {
            const day = s.sell_time
                ? new Date(s.sell_time * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'Unknown';
            if (!groups[day]) groups[day] = [];
            groups[day].push(s);
        });
        return groups;
    };

    const cur = currency || 'USD';

    return (
        <div className='reports'>
            <div className='reports__header'>
                <h1>📊 Reports</h1>
                {balance !== null && (
                    <div className='reports__balance'>{cur} {balance.toFixed(2)}</div>
                )}
            </div>

            <div className='reports__tabs'>
                {TABS.map((t, i) => (
                    <button key={t}
                        className={`reports__tab ${activeTab === i ? 'active' : ''}`}
                        onClick={() => setActiveTab(i)}>
                        {t}
                    </button>
                ))}
            </div>

            {(activeTab === 0 || activeTab === 2) && (
                <div className='reports__filters'>
                    <label>From: <input type='date' value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label>
                    <label>To:   <input type='date' value={dateTo}   onChange={e => setDateTo(e.target.value)}   /></label>
                    <label>Limit:
                        <select value={limit} onChange={e => setLimit(Number(e.target.value))}>
                            {[25,50,100,200].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                    <button className='reports__refresh-btn'
                        onClick={() => fetchStatement(limit)} disabled={isLoading}>
                        {isLoading ? '⏳' : '🔄'} Refresh
                    </button>
                </div>
            )}

            {/* ── P&L History ── */}
            {activeTab === 0 && (
                <div className='reports__pnl'>
                    <div className='reports__summary-cards'>
                        <div className='reports__summary-card'>
                            <span>Total P/L</span>
                            <strong className={totalPnl >= 0 ? 'pos' : 'neg'}>{fmtPnl(totalPnl)} {cur}</strong>
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

                    {isLoading && <div className='reports__loading'>Loading trades…</div>}
                    {!isLoading && statements.length === 0 && (
                        <div className='reports__empty'>No trades found. Make some trades first!</div>
                    )}

                    {!isLoading && Object.entries(groupByDay(statements)).map(([day, trades]) => (
                        <div key={day} className='reports__day-group'>
                            <div className='reports__day-header'>
                                <span>{day}</span>
                                <span className={trades.reduce((s,t) => s+t.pnl,0) >= 0 ? 'pos' : 'neg'}>
                                    {fmtPnl(trades.reduce((s,t) => s+t.pnl, 0))} {cur}
                                </span>
                            </div>
                            <div className='reports__day-trades'>
                                {/* Table header */}
                                <div className='reports__trade-row reports__trade-row--head'>
                                    <div>Type</div>
                                    <div>Buy</div>
                                    <div>Sell / Close</div>
                                    <div>Entry spot</div>
                                    <div>Exit spot</div>
                                    <div>P/L</div>
                                    <div>Balance</div>
                                </div>
                                {trades.map(t => {
                                    const info = infoMap[t.contract_id];
                                    return (
                                        <div key={t.transaction_id}
                                            className={`reports__trade-row ${t.pnl > 0 ? 'won' : 'lost'}`}>
                                            <div className='reports__trade-type'>{t.contract_type}</div>
                                            <div className='reports__trade-time-cell'>
                                                <span className='ts'>{fmtTime(t.purchase_time)}</span>
                                                {info?.buy_price != null && (
                                                    <span className='sub'>{Number(info.buy_price).toFixed(2)}</span>
                                                )}
                                            </div>
                                            <div className='reports__trade-time-cell'>
                                                <span className='ts'>{fmtTime(t.sell_time)}</span>
                                            </div>
                                            <div className='reports__trade-spot'>
                                                {info?.entry_tick ?? info?.entry_spot ?? '—'}
                                            </div>
                                            <div className='reports__trade-spot'>
                                                {info?.exit_tick ?? info?.exit_spot ?? '—'}
                                            </div>
                                            <div className={`reports__trade-pnl ${t.pnl > 0 ? 'pos' : 'neg'}`}>
                                                {fmtPnl(t.pnl)}
                                            </div>
                                            <div className='reports__trade-balance'>
                                                {t.balance_after.toFixed(2)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Open Positions ── */}
            {activeTab === 1 && (
                <div className='reports__open'>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button className='reports__refresh-btn' onClick={fetchOpenContracts} disabled={isLoading}>
                            {isLoading ? '⏳' : '🔄'} Refresh
                        </button>
                    </div>
                    {isLoading && <div className='reports__loading'>Loading positions…</div>}
                    {!isLoading && openContracts.length === 0 && (
                        <div className='reports__empty'>No open positions.</div>
                    )}
                    {!isLoading && openContracts.map((c, i) => (
                        <div key={i} className='reports__open-contract'>
                            <div className='reports__open-header'>
                                <strong>{c.contract_type || 'N/A'}</strong>
                                <span className={`reports__open-status ${c.status === 'won' ? 'won' : ''}`}>
                                    {c.status || 'open'}
                                </span>
                            </div>
                            <div className='reports__open-details'>
                                <span>Symbol: <b>{c.underlying_symbol || c.symbol || '—'}</b></span>
                                <span>Stake: <b>{Number(c.buy_price ?? 0).toFixed(2)} {cur}</b></span>
                                <span>Entry: <b>{c.entry_spot ?? c.entry_tick ?? '—'}</b></span>
                                <span>Current: <b>{c.current_spot ?? '—'}</b></span>
                                <span>Exit: <b>{c.exit_spot ?? c.exit_tick ?? '—'}</b></span>
                                <span>Buy: <b>{fmt(c.date_start)}</b></span>
                                <span>Expires: <b>{fmt(c.date_expiry)}</b></span>
                                <span className={parseFloat(c.profit || '0') >= 0 ? 'pos' : 'neg'}>
                                    P/L: <b>{parseFloat(c.profit || '0').toFixed(2)} {cur}</b>
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Statement ── */}
            {activeTab === 2 && (
                <div className='reports__statement'>
                    {isLoading && <div className='reports__loading'>Loading statement…</div>}
                    {!isLoading && (
                        <table className='reports__table'>
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>P/L</th>
                                    <th>Balance</th>
                                    <th>Buy time</th>
                                    <th>Sell time</th>
                                    <th>Entry</th>
                                    <th>Exit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statements.map(s => {
                                    const info = infoMap[s.contract_id];
                                    return (
                                        <tr key={s.transaction_id} className={s.pnl > 0 ? 'won' : 'lost'}>
                                            <td>{s.contract_type}</td>
                                            <td className={s.pnl > 0 ? 'pos' : 'neg'}>{fmtPnl(s.pnl)}</td>
                                            <td>{s.balance_after.toFixed(2)}</td>
                                            <td>{fmt(s.purchase_time)}</td>
                                            <td>{fmt(s.sell_time)}</td>
                                            <td>{info?.entry_tick ?? info?.entry_spot ?? '—'}</td>
                                            <td>{info?.exit_tick  ?? info?.exit_spot  ?? '—'}</td>
                                        </tr>
                                    );
                                })}
                                {statements.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>
                                            No data
                                        </td>
                                    </tr>
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
