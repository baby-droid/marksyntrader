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

/* ── Trade Detail Modal ── */
interface TradeDetailModalProps {
    trade: any;
    info: any;
    cur: string;
    onClose: () => void;
}
const TradeDetailModal: React.FC<TradeDetailModalProps> = ({ trade, info, cur, onClose }) => (
    <div className='reports__modal-overlay' onClick={onClose}>
        <div className='reports__modal' onClick={e => e.stopPropagation()}>
            <div className='reports__modal-header'>
                <h3>Trade Detail</h3>
                <button className='reports__modal-close' onClick={onClose}>✕</button>
            </div>
            <div className='reports__modal-body'>
                <div className='reports__modal-grid'>
                    <div className='reports__modal-field'>
                        <span>Type</span>
                        <strong>{trade.contract_type}</strong>
                    </div>
                    <div className='reports__modal-field'>
                        <span>Market</span>
                        <strong>{trade.underlying || info?.underlying_symbol || '—'}</strong>
                    </div>
                    <div className='reports__modal-field'>
                        <span>Result</span>
                        <strong className={trade.pnl > 0 ? 'pos' : 'neg'}>
                            {trade.pnl > 0 ? '✓ WIN' : '✗ LOSS'}
                        </strong>
                    </div>
                    <div className='reports__modal-field'>
                        <span>P/L ({cur})</span>
                        <strong className={trade.pnl > 0 ? 'pos' : 'neg'}>
                            {trade.pnl > 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                        </strong>
                    </div>
                    <div className='reports__modal-field'>
                        <span>Stake</span>
                        <strong>{trade.buy_price > 0 ? trade.buy_price.toFixed(2) : '—'}</strong>
                    </div>
                    <div className='reports__modal-field'>
                        <span>Entry Time</span>
                        <strong>{fmt(trade.purchase_time)}</strong>
                    </div>
                    <div className='reports__modal-field'>
                        <span>Exit Time</span>
                        <strong>{fmt(trade.sell_time)}</strong>
                    </div>
                    <div className='reports__modal-field'>
                        <span>Entry Spot</span>
                        <strong>{info?.entry_tick ?? info?.entry_spot ?? '—'}</strong>
                    </div>
                    <div className='reports__modal-field'>
                        <span>Exit Spot</span>
                        <strong>{info?.exit_tick ?? info?.exit_spot ?? '—'}</strong>
                    </div>
                    <div className='reports__modal-field'>
                        <span>Contract ID</span>
                        <strong style={{ fontSize: '1rem', wordBreak: 'break-all' }}>{trade.contract_id || '—'}</strong>
                    </div>
                    {info?.barrier && (
                        <div className='reports__modal-field'>
                            <span>Barrier</span>
                            <strong>{info.barrier}</strong>
                        </div>
                    )}
                    {info?.tick_count && (
                        <div className='reports__modal-field'>
                            <span>Duration</span>
                            <strong>{info.tick_count} ticks</strong>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
);

const Reports = observer(() => {
    const { balance, currency } = useDerivTrading();
    const [activeTab, setActiveTab]     = useState(0);
    const [statements, setStatements]   = useState<any[]>([]); // profit_table rows (P&L History tab)
    const [statementRows, setStatementRows] = useState<any[]>([]); // statement rows (Statement tab)
    const [openContracts, setOpenContracts] = useState<any[]>([]);
    const [isLoading, setIsLoading]     = useState(false);
    const [dateFrom, setDateFrom]       = useState('');
    const [dateTo, setDateTo]           = useState('');
    const [totalPnl, setTotalPnl]       = useState(0);
    const [winRate, setWinRate]         = useState(0);
    const [limit, setLimit]             = useState(50);
    const [selectedTrade, setSelectedTrade] = useState<any>(null);
    /* contract_info cache: contract_id → details */
    const infoCache = useRef<Record<number, any>>({});
    const [infoMap, setInfoMap]         = useState<Record<number, any>>({});

    /* P&L History uses `profit_table` — the exact call Deriv.com's own Reports >
       Profit Table page uses (unlike `statement`, which is a raw ledger of every
       money movement including deposits/withdrawals/adjustments, not just trade
       P/L). `profit_loss` here is already the settled profit/loss for the
       contract, matching what deriv.com displays. */
    const fetchProfitTable = useCallback(async (lim = limit) => {
        setIsLoading(true);
        try {
            const params: any = { profit_table: 1, description: 1, limit: lim, sort: 'DESC' };
            if (dateFrom) params.date_from = Math.floor(new Date(dateFrom).getTime() / 1000);
            if (dateTo)   params.date_to   = Math.floor(new Date(dateTo).getTime() / 1000) + 86399; // include the whole "to" day

            const res = await (api_base.api.send as any)(params);
            if (res?.profit_table?.transactions) {
                const txns = res.profit_table.transactions;
                const rows = txns.map((t: any) => ({
                    transaction_id: t.transaction_id,
                    contract_id:    t.contract_id,
                    balance_after:  0, // profit_table has no running balance — statement tab covers that
                    longcode:       t.longcode  || '',
                    shortcode:      t.shortcode || '',
                    purchase_time:  t.purchase_time,
                    sell_time:      t.sell_time,
                    buy_price:      parseFloat(t.buy_price  || '0'),
                    sell_price:     parseFloat(t.sell_price || '0'),
                    pnl:            parseFloat(t.profit_loss ?? (parseFloat(t.sell_price || '0') - parseFloat(t.buy_price || '0'))),
                    contract_type:  extractType(t.shortcode || ''),
                    underlying:     t.underlying_symbol || '',
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
            console.error('Profit table error', e);
        } finally {
            setIsLoading(false);
        }
    }, [dateFrom, dateTo, limit]);

    /* Statement tab keeps using the real `statement` ledger (deposits, sells,
       adjustments, etc.) — this is what deriv.com's own Statement tab shows,
       distinct from the Profit Table. */
    const fetchStatement = useCallback(async (lim = limit) => {
        setIsLoading(true);
        try {
            const params: any = { statement: 1, description: 1, limit: lim };
            if (dateFrom) params.date_from = Math.floor(new Date(dateFrom).getTime() / 1000);
            if (dateTo)   params.date_to   = Math.floor(new Date(dateTo).getTime() / 1000) + 86399;

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
                setStatementRows(rows);

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

    /* Open Positions — mirrors deriv.com's live-updating Open Positions tab:
       one persistent `proposal_open_contract` stream (no contract_id) that
       pushes every update for every currently open contract, rather than a
       single-shot poll. Contracts drop off the list ~1.2s after they settle
       (is_sold) so the user still sees the final tick before it disappears. */
    const openMapRef = useRef<Record<number, any>>({});
    const openSubRef  = useRef<any>(null);

    const syncOpenContracts = useCallback(() => {
        setOpenContracts(Object.values(openMapRef.current).sort((a: any, b: any) => (b.date_start || 0) - (a.date_start || 0)));
    }, []);

    const subscribeOpenContracts = useCallback(() => {
        setIsLoading(true);
        try {
            openSubRef.current = api_base.api.subscribe({ proposal_open_contract: 1, subscribe: 1 });
            openSubRef.current.subscribe((res: any) => {
                setIsLoading(false);
                const poc = res?.proposal_open_contract;
                if (!poc || !poc.contract_id) return;
                openMapRef.current[poc.contract_id] = poc;
                syncOpenContracts();
                if (poc.is_sold) {
                    setTimeout(() => {
                        delete openMapRef.current[poc.contract_id];
                        syncOpenContracts();
                    }, 1200);
                }
            }, (err: any) => { console.error('Open positions stream error', err); setIsLoading(false); });
        } catch (e) {
            console.error('Open positions subscribe error', e);
            setIsLoading(false);
        }
    }, [syncOpenContracts]);

    const unsubscribeOpenContracts = useCallback(() => {
        try { openSubRef.current?.unsubscribe?.(); } catch {}
        openSubRef.current = null;
        openMapRef.current = {};
    }, []);

    useEffect(() => {
        if (activeTab === 0) fetchProfitTable();
        else if (activeTab === 2) fetchStatement();
        else if (activeTab === 1) {
            subscribeOpenContracts();
            return () => unsubscribeOpenContracts();
        }
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
                        onClick={() => (activeTab === 0 ? fetchProfitTable(limit) : fetchStatement(limit))} disabled={isLoading}>
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
                                    <div>Type / Market</div>
                                    <div>Buy time / Price</div>
                                    <div>Sell time / Price</div>
                                    <div>Entry spot</div>
                                    <div>Exit spot</div>
                                    <div>P/L ({cur})</div>
                                </div>
                                {trades.map(t => {
                                    const info = infoMap[t.contract_id];
                                    return (
                                        <div key={t.transaction_id}
                                            className={`reports__trade-row ${t.pnl > 0 ? 'won' : 'lost'}`}
                                            onClick={() => setSelectedTrade(t)}
                                            style={{ cursor: 'pointer' }}>
                                            <div className='reports__trade-type-cell'>
                                                <span className='reports__trade-type'>{t.contract_type}</span>
                                                {t.underlying && <span className='reports__trade-mkt'>{t.underlying}</span>}
                                            </div>
                                            <div className='reports__trade-time-cell'>
                                                <span className='ts'>{fmtTime(t.purchase_time)}</span>
                                                <span className='sub'>{t.buy_price > 0 ? t.buy_price.toFixed(2) : ''}</span>
                                            </div>
                                            <div className='reports__trade-time-cell'>
                                                <span className='ts'>{fmtTime(t.sell_time)}</span>
                                                <span className='sub'>{t.sell_price > 0 ? t.sell_price.toFixed(2) : ''}</span>
                                            </div>
                                            <div className='reports__trade-spot'>
                                                {info?.entry_tick ?? info?.entry_spot ?? '—'}
                                            </div>
                                            <div className='reports__trade-spot'>
                                                {info?.exit_tick ?? info?.exit_spot ?? '—'}
                                            </div>
                                            <div className={`reports__trade-pnl ${t.pnl > 0 ? 'pos' : 'neg'}`}>
                                                {t.pnl > 0 ? '+' : ''}{t.pnl.toFixed(2)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Open Positions — live stream, like deriv.com's Reports > Open Positions ── */}
            {activeTab === 1 && (
                <div className='reports__open'>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                        <span className='reports__live-badge'>{isLoading ? '⏳ Connecting…' : '● LIVE'}</span>
                    </div>
                    {!isLoading && openContracts.length === 0 && (
                        <div className='reports__empty'>No open positions.</div>
                    )}
                    {openContracts.map((c: any) => (
                        <div key={c.contract_id} className={`reports__open-contract ${c.is_sold ? (parseFloat(c.profit || '0') >= 0 ? 'settled-won' : 'settled-lost') : ''}`}>
                            <div className='reports__open-header'>
                                <strong>{c.contract_type || extractType(c.shortcode || '')}</strong>
                                <span className={`reports__open-status ${c.is_sold ? (parseFloat(c.profit || '0') >= 0 ? 'won' : 'lost') : ''}`}>
                                    {c.is_sold ? (parseFloat(c.profit || '0') >= 0 ? 'won' : 'lost') : 'open'}
                                </span>
                            </div>
                            <div className='reports__open-details'>
                                <span>Symbol: <b>{c.underlying || c.underlying_symbol || c.symbol || '—'}</b></span>
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
                                {statementRows.map(s => {
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
                                {statementRows.length === 0 && (
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

        {/* Trade detail modal */}
        {selectedTrade && (
            <TradeDetailModal
                trade={selectedTrade}
                info={infoMap[selectedTrade.contract_id]}
                cur={cur}
                onClose={() => setSelectedTrade(null)}
            />
        )}
    </div>
    );
});

export default Reports;
