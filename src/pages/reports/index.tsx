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
    }).replace(',', '');
};
const fmtShort = (ts: number) => {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).replace(',', '') + ' GMT';
};
const fmtPnl = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;

function extractType(shortcode: string) {
    const map: Record<string, string> = {
        DIGITEVEN: 'EVEN', DIGITODD: 'ODD', DIGITOVER: 'OVER', DIGITUNDER: 'UNDER',
        DIGITMATCH: 'MATCH', DIGITDIFF: 'DIFFER', CALL: 'RISE', PUT: 'FALL',
        ASIANU: 'ASIAN ↑', ASIAND: 'ASIAN ↓', RESETCALL: 'RESET ↑', RESETPUT: 'RESET ↓',
        TICKHIGH: 'HIGH TICK', TICKLOW: 'LOW TICK', RUNHIGH: 'RUN HIGH', RUNLOW: 'RUN LOW',
        ONETOUCH: 'TOUCH', NOTOUCH: 'NO TOUCH',
    };
    const part = (shortcode || '').split('_')[0].toUpperCase();
    return map[part] || part || 'N/A';
}

function getTypeIcon(type: string) {
    const t = type.toUpperCase();
    if (t.includes('OVER') || t.includes('UNDER')) return '↕';
    if (t.includes('RISE') || t.includes('FALL') || t.includes('HIGH') || t.includes('LOW')) return '📈';
    if (t.includes('EVEN') || t.includes('ODD')) return '⚡';
    if (t.includes('MATCH') || t.includes('DIFFER')) return '🎯';
    if (t.includes('TOUCH')) return '✋';
    if (t.includes('ASIAN')) return '🌏';
    return '◆';
}

async function fetchContractInfo(contract_id: number): Promise<any> {
    try {
        const res = await (api_base.api.send as any)({ contract_info: contract_id });
        return res?.contract_info ?? null;
    } catch { return null; }
}

const SIDEBAR_ITEMS = [
    { id: 'open',      label: 'Open positions', icon: '⏳' },
    { id: 'trade',     label: 'Trade table',    icon: '📊' },
    { id: 'statement', label: 'Statement',       icon: '📄' },
];

/* ── Contract Detail Modal — matches dtrader.deriv.com layout ── */
const ContractDetailModal: React.FC<{ trade: any; info: any; cur: string; onClose: () => void }> = ({ trade, info, cur, onClose }) => (
    <div className='rp__modal-overlay' onClick={onClose}>
        <div className='rp__modal' onClick={e => e.stopPropagation()}>
            <div className='rp__modal-titlebar'>
                <h2>Contract details</h2>
                <button className='rp__modal-close' onClick={onClose}>✕</button>
            </div>
            <div className='rp__modal-body'>
                {/* Left info panel */}
                <div className='rp__modal-info'>
                    <div className='rp__modal-market'>
                        <span className='rp__modal-market-icon'>📈</span>
                        <span className='rp__modal-market-name'>{trade.underlying || info?.underlying_symbol || '—'}</span>
                        <span className='rp__modal-separator'>·</span>
                        <span className='rp__modal-type-badge'>{getTypeIcon(trade.contract_type)} {trade.contract_type}</span>
                    </div>

                    <span className='rp__modal-cur-badge'>{cur}</span>

                    <div className={`rp__modal-pnl ${trade.pnl >= 0 ? 'pos' : 'neg'}`}>
                        <span className='rp__modal-pnl-label'>Total profit/loss</span>
                        <span className='rp__modal-pnl-val'>{fmtPnl(trade.pnl)}</span>
                    </div>

                    <div className='rp__modal-row'>
                        <span>Contract value</span>
                        <strong>{trade.sell_price > 0 ? trade.sell_price.toFixed(2) : '—'}</strong>
                    </div>
                    <div className='rp__modal-row'>
                        <span>Stake</span>
                        <strong>{trade.buy_price > 0 ? trade.buy_price.toFixed(2) : '—'}</strong>
                    </div>
                    <div className='rp__modal-row'>
                        <span>Potential payout</span>
                        <strong>{trade.sell_price > 0 ? trade.sell_price.toFixed(2) : '—'}</strong>
                    </div>

                    <div className='rp__modal-divider' />

                    <div className='rp__modal-row rp__modal-row--id'>
                        <span>Reference ID</span>
                        <div>
                            <div className='rp__modal-id'>{trade.contract_id} <span className='rp__modal-id-tag'>Buy</span></div>
                            {trade.transaction_id && <div className='rp__modal-id'>{trade.transaction_id} <span className='rp__modal-id-tag'>Sell</span></div>}
                        </div>
                    </div>

                    <div className='rp__modal-divider' />

                    {info?.tick_count && (
                        <div className='rp__modal-row'>
                            <span>Duration</span>
                            <strong>{info.tick_count} ticks</strong>
                        </div>
                    )}
                    {(info?.barrier || info?.selected_tick) && (
                        <div className='rp__modal-row'>
                            <span>Target</span>
                            <strong>{trade.contract_type} {info.barrier ?? info.selected_tick}</strong>
                        </div>
                    )}

                    <div className='rp__modal-row'>
                        <span>Start time</span>
                        <strong>{fmtShort(trade.purchase_time)}</strong>
                    </div>
                    {(info?.entry_tick || info?.entry_spot) && (
                        <div className='rp__modal-row'>
                            <span>Entry spot</span>
                            <strong>{info.entry_tick ?? info.entry_spot}</strong>
                        </div>
                    )}
                    {(info?.exit_tick || info?.exit_spot) && (
                        <div className='rp__modal-row'>
                            <span>Exit spot</span>
                            <strong>{info.exit_tick ?? info.exit_spot}</strong>
                        </div>
                    )}
                    <div className='rp__modal-row'>
                        <span>Exit time</span>
                        <strong>{fmtShort(trade.sell_time)}</strong>
                    </div>
                </div>

                {/* Right mini-chart placeholder (tick visualizer) */}
                <div className='rp__modal-chart'>
                    <div className='rp__modal-chart-inner'>
                        <div className='rp__modal-chart-label'>Settlement Ticks</div>
                        <div className='rp__modal-ticks'>
                            {info?.tick_count ? Array.from({ length: info.tick_count }, (_, i) => (
                                <div key={i} className={`rp__modal-tick ${i === (info.tick_count - 1) ? (trade.pnl >= 0 ? 'win' : 'loss') : ''}`}>
                                    <span className='rp__modal-tick-num'>{i + 1}</span>
                                </div>
                            )) : (
                                <div className='rp__modal-tick-empty'>Tick data not available</div>
                            )}
                        </div>
                        <div className='rp__modal-spots'>
                            {(info?.entry_tick || info?.entry_spot) && (
                                <div className='rp__modal-spot-row'>
                                    <span className='rp__modal-spot-label'>Entry</span>
                                    <span className='rp__modal-spot-val'>{info.entry_tick ?? info.entry_spot}</span>
                                </div>
                            )}
                            {(info?.exit_tick || info?.exit_spot) && (
                                <div className={`rp__modal-spot-row ${trade.pnl >= 0 ? 'win' : 'loss'}`}>
                                    <span className='rp__modal-spot-label'>Exit</span>
                                    <span className='rp__modal-spot-val'>{info.exit_tick ?? info.exit_spot}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const Reports = observer(() => {
    const { balance, currency } = useDerivTrading();
    const [activeSection, setActiveSection] = useState<'open' | 'trade' | 'statement'>('trade');
    const [statements, setStatements]       = useState<any[]>([]);
    const [statementRows, setStatementRows] = useState<any[]>([]);
    const [openContracts, setOpenContracts] = useState<any[]>([]);
    const [isLoading, setIsLoading]         = useState(false);
    const [dateFrom, setDateFrom]           = useState('');
    const [dateTo, setDateTo]               = useState('');
    const [totalPnl, setTotalPnl]           = useState(0);
    const [limit, setLimit]                 = useState(50);
    const [selectedTrade, setSelectedTrade] = useState<any>(null);
    const infoCache = useRef<Record<number, any>>({});
    const [infoMap, setInfoMap]             = useState<Record<number, any>>({});

    const fetchProfitTable = useCallback(async (lim = limit) => {
        setIsLoading(true);
        try {
            const params: any = { profit_table: 1, description: 1, limit: lim, sort: 'DESC' };
            if (dateFrom) params.date_from = Math.floor(new Date(dateFrom).getTime() / 1000);
            if (dateTo)   params.date_to   = Math.floor(new Date(dateTo).getTime() / 1000) + 86399;

            const res = await (api_base.api.send as any)(params);
            if (res?.profit_table?.transactions) {
                const txns = res.profit_table.transactions;
                const rows = txns.map((t: any) => ({
                    transaction_id: t.transaction_id,
                    contract_id:    t.contract_id,
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
                setTotalPnl(rows.reduce((s: number, t: any) => s + t.pnl, 0));

                const ids = rows.slice(0, 30).map((t: any) => t.contract_id).filter(Boolean);
                const missing = ids.filter((id: number) => !infoCache.current[id]);
                if (missing.length > 0) {
                    const infos = await Promise.allSettled(missing.map(fetchContractInfo));
                    infos.forEach((r, i) => {
                        if (r.status === 'fulfilled' && r.value) infoCache.current[missing[i]] = r.value;
                    });
                    setInfoMap({ ...infoCache.current });
                }
            }
        } catch (e) { console.error('Profit table error', e); }
        finally { setIsLoading(false); }
    }, [dateFrom, dateTo, limit]);

    const fetchStatement = useCallback(async (lim = limit) => {
        setIsLoading(true);
        try {
            const params: any = { statement: 1, description: 1, limit: lim };
            if (dateFrom) params.date_from = Math.floor(new Date(dateFrom).getTime() / 1000);
            if (dateTo)   params.date_to   = Math.floor(new Date(dateTo).getTime() / 1000) + 86399;

            const res = await (api_base.api.send as any)(params);
            if (res?.statement?.transactions) {
                const sells = res.statement.transactions.filter((t: any) => t.action_type === 'sell');
                setStatementRows(sells.map((t: any) => ({
                    transaction_id: t.transaction_id,
                    contract_id:    t.contract_id,
                    action_type:    t.action_type,
                    amount:         parseFloat(t.amount || '0'),
                    balance_after:  parseFloat(t.balance_after || '0'),
                    longcode:       t.longcode  || '',
                    shortcode:      t.shortcode || '',
                    purchase_time:  t.purchase_time,
                    sell_time:      t.sell_time,
                    pnl:            parseFloat(t.amount || '0'),
                    contract_type:  extractType(t.shortcode || ''),
                })));
            }
        } catch (e) { console.error('Statement error', e); }
        finally { setIsLoading(false); }
    }, [dateFrom, dateTo, limit]);

    const openMapRef = useRef<Record<number, any>>({});
    const openSubRef = useRef<any>(null);

    const syncOpen = useCallback(() => {
        setOpenContracts(Object.values(openMapRef.current).sort((a: any, b: any) => (b.date_start || 0) - (a.date_start || 0)));
    }, []);

    const subscribeOpen = useCallback(() => {
        setIsLoading(true);
        try {
            openSubRef.current = api_base.api.subscribe({ proposal_open_contract: 1, subscribe: 1 });
            openSubRef.current.subscribe((res: any) => {
                setIsLoading(false);
                const poc = res?.proposal_open_contract;
                if (!poc || !poc.contract_id) return;
                openMapRef.current[poc.contract_id] = poc;
                syncOpen();
                if (poc.is_sold) {
                    setTimeout(() => { delete openMapRef.current[poc.contract_id]; syncOpen(); }, 1200);
                }
            }, () => setIsLoading(false));
        } catch { setIsLoading(false); }
    }, [syncOpen]);

    const unsubscribeOpen = useCallback(() => {
        try { openSubRef.current?.unsubscribe?.(); } catch {}
        openSubRef.current = null;
        openMapRef.current = {};
    }, []);

    useEffect(() => {
        if (activeSection === 'trade') fetchProfitTable();
        else if (activeSection === 'statement') fetchStatement();
        else if (activeSection === 'open') {
            subscribeOpen();
            return () => unsubscribeOpen();
        }
    }, [activeSection]); // eslint-disable-line

    const cur = currency || 'USD';

    return (
        <div className='rp'>
            {/* ── Sidebar ── */}
            <aside className='rp__sidebar'>
                <div className='rp__sidebar-title'>Reports</div>
                {SIDEBAR_ITEMS.map(item => (
                    <button
                        key={item.id}
                        className={`rp__sidebar-item ${activeSection === item.id ? 'active' : ''}`}
                        onClick={() => setActiveSection(item.id as any)}
                    >
                        <span className='rp__sidebar-icon'>{item.icon}</span>
                        <span className='rp__sidebar-label'>{item.label}</span>
                    </button>
                ))}
                {balance !== null && (
                    <div className='rp__sidebar-balance'>
                        <span>Balance</span>
                        <strong>{cur} {balance.toFixed(2)}</strong>
                    </div>
                )}
            </aside>

            {/* ── Main content ── */}
            <main className='rp__main'>

                {/* ── Trade table (P&L History) ── */}
                {activeSection === 'trade' && (
                    <div className='rp__trade'>
                        {/* Filters */}
                        <div className='rp__filters'>
                            <div className='rp__filter-group'>
                                <span className='rp__filter-icon'>📅</span>
                                <input type='date' placeholder='Date from' value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)} className='rp__date-input' />
                            </div>
                            <div className='rp__filter-group'>
                                <span className='rp__filter-icon'>📅</span>
                                <input type='date' placeholder='Today' value={dateTo}
                                    onChange={e => setDateTo(e.target.value)} className='rp__date-input' />
                            </div>
                            <select className='rp__limit-select' value={limit} onChange={e => setLimit(Number(e.target.value))}>
                                {[25,50,100,200].map(n => <option key={n} value={n}>Last {n}</option>)}
                            </select>
                            <button className='rp__refresh-btn' onClick={() => fetchProfitTable(limit)} disabled={isLoading}>
                                {isLoading ? '⏳' : '🔄'} Refresh
                            </button>
                        </div>

                        {/* Table */}
                        <div className='rp__table-wrap'>
                            <table className='rp__table'>
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Ref. ID</th>
                                        <th>Currency</th>
                                        <th>Buy time</th>
                                        <th>Stake</th>
                                        <th>Sell time</th>
                                        <th>Contract value</th>
                                        <th>Total profit/loss</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading && (
                                        <tr><td colSpan={8} className='rp__table-msg'>Loading trades…</td></tr>
                                    )}
                                    {!isLoading && statements.length === 0 && (
                                        <tr><td colSpan={8} className='rp__table-msg'>No trades found. Make some trades first!</td></tr>
                                    )}
                                    {statements.map(t => (
                                        <tr key={t.transaction_id}
                                            className={`rp__trade-row ${t.pnl >= 0 ? 'won' : 'lost'}`}
                                            onClick={() => setSelectedTrade(t)}>
                                            <td>
                                                <div className='rp__type-cell'>
                                                    <span className='rp__type-icon'>{getTypeIcon(t.contract_type)}</span>
                                                    <span className='rp__type-label'>{t.contract_type}</span>
                                                    {t.underlying && <span className='rp__mkt-label'>{t.underlying}</span>}
                                                </div>
                                            </td>
                                            <td className='rp__refid'>{t.contract_id}</td>
                                            <td><span className='rp__cur-badge'>{cur}</span></td>
                                            <td className='rp__time'>{fmtShort(t.purchase_time)}</td>
                                            <td className='rp__stake'>{t.buy_price > 0 ? t.buy_price.toFixed(2) : '—'}</td>
                                            <td className='rp__time'>{fmtShort(t.sell_time)}</td>
                                            <td className='rp__val'>{t.sell_price > 0 ? t.sell_price.toFixed(2) : '—'}</td>
                                            <td className={`rp__pnl ${t.pnl >= 0 ? 'pos' : 'neg'}`}>{fmtPnl(t.pnl)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer summary */}
                        {!isLoading && statements.length > 0 && (
                            <div className='rp__table-footer'>
                                Profit/loss on the last {statements.length} contracts:&nbsp;
                                <strong className={totalPnl >= 0 ? 'pos' : 'neg'}>{fmtPnl(totalPnl)}</strong>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Open positions ── */}
                {activeSection === 'open' && (
                    <div className='rp__open'>
                        <div className='rp__open-header'>
                            <span className={`rp__live-badge ${isLoading ? 'connecting' : ''}`}>
                                {isLoading ? '⏳ Connecting…' : '● LIVE'}
                            </span>
                        </div>
                        {!isLoading && openContracts.length === 0 && (
                            <div className='rp__empty'>No open positions.</div>
                        )}
                        <table className='rp__table'>
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Symbol</th>
                                    <th>Stake</th>
                                    <th>Entry</th>
                                    <th>Current</th>
                                    <th>Status</th>
                                    <th>P/L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {openContracts.map((c: any) => (
                                    <tr key={c.contract_id} className={c.is_sold ? (parseFloat(c.profit || '0') >= 0 ? 'won' : 'lost') : ''}>
                                        <td><span className='rp__type-label'>{c.contract_type || extractType(c.shortcode || '')}</span></td>
                                        <td>{c.underlying || c.underlying_symbol || '—'}</td>
                                        <td>{Number(c.buy_price ?? 0).toFixed(2)} {cur}</td>
                                        <td>{c.entry_spot ?? c.entry_tick ?? '—'}</td>
                                        <td>{c.current_spot ?? '—'}</td>
                                        <td>
                                            <span className={`rp__status-badge ${c.is_sold ? (parseFloat(c.profit || '0') >= 0 ? 'won' : 'lost') : 'open'}`}>
                                                {c.is_sold ? (parseFloat(c.profit || '0') >= 0 ? 'WON' : 'LOST') : 'OPEN'}
                                            </span>
                                        </td>
                                        <td className={parseFloat(c.profit || '0') >= 0 ? 'rp__pnl pos' : 'rp__pnl neg'}>
                                            {parseFloat(c.profit || '0').toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Statement ── */}
                {activeSection === 'statement' && (
                    <div className='rp__stmt'>
                        <div className='rp__filters'>
                            <div className='rp__filter-group'>
                                <span className='rp__filter-icon'>📅</span>
                                <input type='date' value={dateFrom} onChange={e => setDateFrom(e.target.value)} className='rp__date-input' />
                            </div>
                            <div className='rp__filter-group'>
                                <span className='rp__filter-icon'>📅</span>
                                <input type='date' value={dateTo} onChange={e => setDateTo(e.target.value)} className='rp__date-input' />
                            </div>
                            <button className='rp__refresh-btn' onClick={() => fetchStatement(limit)} disabled={isLoading}>
                                {isLoading ? '⏳' : '🔄'} Refresh
                            </button>
                        </div>
                        <div className='rp__table-wrap'>
                            <table className='rp__table'>
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Ref. ID</th>
                                        <th>Currency</th>
                                        <th>Buy time</th>
                                        <th>Amount</th>
                                        <th>Balance after</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading && <tr><td colSpan={6} className='rp__table-msg'>Loading…</td></tr>}
                                    {!isLoading && statementRows.length === 0 && (
                                        <tr><td colSpan={6} className='rp__table-msg'>No data</td></tr>
                                    )}
                                    {statementRows.map(s => (
                                        <tr key={s.transaction_id} className={s.pnl >= 0 ? 'won' : 'lost'}>
                                            <td><span className='rp__type-label'>{s.contract_type}</span></td>
                                            <td className='rp__refid'>{s.contract_id}</td>
                                            <td><span className='rp__cur-badge'>{cur}</span></td>
                                            <td className='rp__time'>{fmtShort(s.purchase_time)}</td>
                                            <td className={`rp__pnl ${s.pnl >= 0 ? 'pos' : 'neg'}`}>{fmtPnl(s.pnl)}</td>
                                            <td>{s.balance_after.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* Contract detail modal */}
            {selectedTrade && (
                <ContractDetailModal
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
