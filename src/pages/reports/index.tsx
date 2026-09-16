// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import { getTradeMeta, speedLabel } from '@/utils/trade-metadata';
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

async function fetchContractInfo(contract_id: number, underlying?: string, dateStart?: number, dateExpiry?: number): Promise<any> {
    try {
        // Use proposal_open_contract — returns tick_stream, entry/exit ticks, barrier, etc.
        const res = await (api_base.api.send as any)({
            proposal_open_contract: 1,
            contract_id,
        });
        const poc = res?.proposal_open_contract ?? res?.contract_info ?? null;
        if (!poc) return null;

        // ── Fallback: fetch tick_stream via ticks_history if empty ──────────────
        // Affects 1s markets (V100(1s) etc.) and plain-index markets where
        // proposal_open_contract does not populate tick_stream for settled contracts.
        const hasTicks = poc.tick_stream && poc.tick_stream.length > 0;
        if (!hasTicks) {
            const sym    = poc.underlying_symbol || underlying;
            const tStart = poc.entry_tick_time   || poc.date_start   || dateStart;
            const tEnd   = poc.exit_tick_time    || poc.date_expiry  || dateExpiry;
            if (sym && tStart && tEnd) {
                try {
                    const hist = await (api_base.api.send as any)({
                        ticks_history: sym,
                        start:         Math.max(1, tStart - 2),   // 2 s before entry so we capture entry tick
                        end:           tEnd + 5,                   // 5 s after exit to capture exit tick
                        style:         'ticks',
                        count:         100,                        // enough for any digit contract
                    });
                    if (hist?.history?.prices?.length && hist?.history?.times?.length) {
                        const prices: number[] = hist.history.prices;
                        const times:  number[] = hist.history.times;
                        // Filter to contract window only (entry → exit inclusive)
                        const stream = prices
                            .map((p: number, i: number) => ({
                                tick:               p,
                                tick_display_value: String(p),
                                epoch:              times[i],
                            }))
                            .filter((t: any) => t.epoch >= tStart && t.epoch <= tEnd + 2);
                        if (stream.length > 0) poc.tick_stream = stream;
                    }
                } catch { /* non-fatal — keep poc without tick_stream */ }
            }
        }

        return poc;
    } catch { return null; }
}

/* ── SVG tick chart — mirrors Deriv contract details design ── */
interface TickDatum { epoch: number; tick: number; tick_display_value?: string; }

const TickChart: React.FC<{
    tickStream: TickDatum[];
    entryTick: number | string | null | undefined;
    exitTick:  number | string | null | undefined;
    won: boolean;
    tickCount: number;
}> = ({ tickStream, entryTick, exitTick, won, tickCount }) => {
    if (!tickStream || tickStream.length === 0) {
        // Fallback: numbered circles only (no price data)
        if (!tickCount) return (
            <div className='rp__tick-empty'>
                <span>📊</span> Settlement tick data not available for this contract.
            </div>
        );
        return (
            <div className='rp__tick-circles'>
                {Array.from({ length: tickCount }, (_, i) => (
                    <div key={i} className={`rp__tick-circle ${i === tickCount - 1 ? (won ? 'win' : 'loss') : ''}`}>
                        <span>{i + 1}</span>
                    </div>
                ))}
            </div>
        );
    }

    // SVG line chart
    const W = 420, H = 160, PAD = 28;
    const prices  = tickStream.map(t => Number(t.tick));
    const epochs  = tickStream.map(t => Number(t.epoch));
    const minP    = Math.min(...prices);
    const maxP    = Math.max(...prices);
    const range   = maxP - minP || 1;
    const n       = tickStream.length;

    const xOf = (i: number) => PAD + (i / Math.max(n - 1, 1)) * (W - PAD * 2);
    const yOf = (p: number) => PAD + (1 - (p - minP) / range) * (H - PAD * 2);

    const polyline = tickStream.map((t, i) => `${xOf(i).toFixed(1)},${yOf(Number(t.tick)).toFixed(1)}`).join(' ');
    const fillPath = `M${xOf(0).toFixed(1)},${yOf(Number(tickStream[0].tick)).toFixed(1)} ` +
        tickStream.map((t, i) => `L${xOf(i).toFixed(1)},${yOf(Number(t.tick)).toFixed(1)}`).join(' ') +
        ` L${xOf(n - 1).toFixed(1)},${H - PAD} L${xOf(0).toFixed(1)},${H - PAD} Z`;

    const exitColor = won ? '#00E676' : '#FF3D57';
    const fmtTime   = (epoch: number) => {
        const d = new Date(epoch * 1000);
        return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
    };

    return (
        <div className='rp__tick-chart'>
            <svg viewBox={`0 0 ${W} ${H}`} width='100%' style={{ overflow: 'visible' }}>
                <defs>
                    <linearGradient id='rp-fill-grad' x1='0' y1='0' x2='0' y2='1'>
                        <stop offset='0%'   stopColor={won ? '#00E676' : '#FF3D57'} stopOpacity='0.18' />
                        <stop offset='100%' stopColor={won ? '#00E676' : '#FF3D57'} stopOpacity='0.0'  />
                    </linearGradient>
                </defs>

                {/* Filled area under line */}
                <path d={fillPath} fill='url(#rp-fill-grad)' />

                {/* Line */}
                <polyline points={polyline} fill='none' stroke='#aac' strokeWidth='1.5' />

                {/* Tick dots + labels */}
                {tickStream.map((t, i) => {
                    const x   = xOf(i);
                    const y   = yOf(Number(t.tick));
                    const isLast = i === n - 1;
                    const dotR   = isLast ? 5 : 3.5;
                    const color  = isLast ? exitColor : '#1E88FF';
                    const dv     = t.tick_display_value ?? t.tick;
                    return (
                        <g key={i}>
                            {/* Price bubble above dot */}
                            <rect x={x - 26} y={y - 28} width={52} height={16} rx={4}
                                fill={isLast ? exitColor : '#e8f0fe'} opacity={isLast ? 1 : 0.9} />
                            <text x={x} y={y - 17} textAnchor='middle'
                                fontSize='9' fill={isLast ? '#fff' : '#1a1a2e'} fontWeight='700'>
                                {dv}
                            </text>
                            {/* Time below x-axis */}
                            <text x={x} y={H - 4} textAnchor='middle' fontSize='8' fill='#aaa'>
                                {fmtTime(Number(t.epoch))}
                            </text>
                            {/* Numbered dot */}
                            <circle cx={x} cy={y} r={dotR} fill={color} stroke='#fff' strokeWidth='1.5'
                                filter={isLast ? `drop-shadow(0 0 4px ${exitColor})` : undefined} />
                            {/* Tick number inside */}
                            <text x={x} y={y + 3.5} textAnchor='middle' fontSize='7' fill='#fff' fontWeight='900'>
                                {i + 1}
                            </text>
                        </g>
                    );
                })}

                {/* Dashed entry vertical line */}
                {n > 0 && (
                    <line x1={xOf(0)} y1={PAD - 8} x2={xOf(0)} y2={H - PAD}
                        stroke='#bbb' strokeWidth='1' strokeDasharray='3,3' />
                )}
                {/* Dashed exit vertical line */}
                {n > 1 && (
                    <line x1={xOf(n - 1)} y1={PAD - 8} x2={xOf(n - 1)} y2={H - PAD}
                        stroke={exitColor} strokeWidth='1.5' strokeDasharray='3,3' />
                )}
            </svg>
        </div>
    );
};

const SIDEBAR_ITEMS = [
    { id: 'open',      label: 'Open positions', icon: '⏳' },
    { id: 'trade',     label: 'Trade table',    icon: '📊' },
    { id: 'statement', label: 'Statement',       icon: '📄' },
];

/* ── Contract Detail Modal — matches dtrader.deriv.com layout ── */
const ContractDetailModal: React.FC<{ trade: any; info: any; cur: string; onClose: () => void }> = ({ trade, info, cur, onClose }) => {
    const meta = getTradeMeta(trade?.contract_id);
    return (
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
                    {/* Entry spot — full price, last digit highlighted */}
                    {(info?.entry_tick_display_value || info?.entry_spot || info?.entry_spot_display_value) && (() => {
                        const raw = String(info.entry_tick_display_value ?? info.entry_spot_display_value ?? info.entry_spot ?? '');
                        const body = raw.slice(0, -1);
                        const lastDigit = raw.slice(-1);
                        return (
                            <div className='rp__modal-row'>
                                <span>Entry spot</span>
                                <strong className='rp__entry-spot'>
                                    <span className='rp__entry-spot-body'>{body}</span>
                                    <span className='rp__entry-spot-digit'>{lastDigit}</span>
                                </strong>
                            </div>
                        );
                    })()}
                    {(info?.exit_tick_display_value || info?.exit_spot || info?.exit_spot_display_value) && (() => {
                        const raw = String(info.exit_tick_display_value ?? info.exit_spot_display_value ?? info.exit_spot ?? '');
                        const body = raw.slice(0, -1);
                        const lastDigit = raw.slice(-1);
                        return (
                            <div className='rp__modal-row'>
                                <span>Exit spot</span>
                                <strong className={`rp__entry-spot ${trade.pnl >= 0 ? 'win' : 'loss'}`}>
                                    <span className='rp__entry-spot-body'>{body}</span>
                                    <span className='rp__entry-spot-digit'>{lastDigit}</span>
                                </strong>
                            </div>
                        );
                    })()}
                    <div className='rp__modal-row'>
                        <span>Exit time</span>
                        <strong>{fmtShort(trade.sell_time)}</strong>
                    </div>

                    {/* ── Trading context (speed mode, page, bot) ── */}
                    {meta && (
                        <>
                            <div className='rp__modal-divider' />
                            <div className='rp__modal-meta'>
                                <div className='rp__modal-meta-title'>Trading Context</div>
                                <div className='rp__modal-meta-row'>
                                    <span className='rp__modal-meta-label'>⚡ Speed Mode</span>
                                    <span className={`rp__modal-meta-badge rp__modal-meta-badge--speed rp__modal-meta-badge--${meta.speed}${meta.fast ? ' fast' : ''}`}>
                                        {speedLabel(meta)}
                                    </span>
                                </div>
                                <div className='rp__modal-meta-row'>
                                    <span className='rp__modal-meta-label'>📍 Page Used</span>
                                    <span className='rp__modal-meta-val'>{meta.page}</span>
                                </div>
                                {meta.bot && (
                                    <div className='rp__modal-meta-row'>
                                        <span className='rp__modal-meta-label'>🤖 Bot / Strategy</span>
                                        <span className='rp__modal-meta-val'>{meta.bot}</span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Right: Tick chart + settlement data */}
                <div className='rp__modal-chart'>
                    <div className='rp__modal-chart-inner'>
                        <div className='rp__modal-chart-label'>Settlement Ticks</div>
                        <TickChart tickStream={info?.tick_stream ?? []}
                                   entryTick={info?.entry_tick ?? info?.entry_spot}
                                   exitTick={info?.exit_tick   ?? info?.exit_spot}
                                   won={trade.pnl >= 0}
                                   tickCount={info?.tick_count ?? 0} />
                        <div className='rp__modal-spots'>
                            {(info?.entry_tick_display_value || info?.entry_spot) && (() => {
                                const raw = String(info.entry_tick_display_value ?? info.entry_spot_display_value ?? info.entry_spot ?? '');
                                return (
                                    <div className='rp__modal-spot-row'>
                                        <span className='rp__modal-spot-label'>Entry spot</span>
                                        <span className='rp__modal-spot-val rp__entry-spot'>
                                            <span className='rp__entry-spot-body'>{raw.slice(0, -1)}</span>
                                            <span className='rp__entry-spot-digit'>{raw.slice(-1)}</span>
                                        </span>
                                        {info?.entry_tick_time && <span className='rp__modal-spot-time'>{fmtShort(info.entry_tick_time)}</span>}
                                    </div>
                                );
                            })()}
                            {(info?.exit_tick_display_value || info?.exit_spot) && (() => {
                                const raw = String(info.exit_tick_display_value ?? info.exit_spot_display_value ?? info.exit_spot ?? '');
                                const won = trade.pnl >= 0;
                                return (
                                    <div className={`rp__modal-spot-row ${won ? 'win' : 'loss'}`}>
                                        <span className='rp__modal-spot-label'>Exit spot</span>
                                        <span className={`rp__modal-spot-val rp__entry-spot ${won ? 'win' : 'loss'}`}>
                                            <span className='rp__entry-spot-body'>{raw.slice(0, -1)}</span>
                                            <span className='rp__entry-spot-digit'>{raw.slice(-1)}</span>
                                        </span>
                                        {info?.exit_tick_time && <span className='rp__modal-spot-time'>{fmtShort(info.exit_tick_time)}</span>}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    );
};

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
                    const infos = await Promise.allSettled(missing.map((id: number) => {
                        const tr = rows.find((r: any) => r.contract_id === id);
                        return fetchContractInfo(id, tr?.underlying, tr?.purchase_time, tr?.sell_time);
                    }));
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
                // Show ALL action types: sell, buy, transfer, withdrawal, deposit
                const rows = res.statement.transactions.map((t: any) => ({
                    transaction_id: t.transaction_id,
                    contract_id:    t.contract_id,
                    action_type:    t.action_type,   // sell | buy | transfer | withdrawal | deposit
                    amount:         parseFloat(t.amount || '0'),
                    balance_after:  parseFloat(t.balance_after || '0'),
                    longcode:       t.longcode  || '',
                    shortcode:      t.shortcode || '',
                    referrer_type:  t.referrer_type  || '',
                    purchase_time:  t.purchase_time,
                    sell_time:      t.sell_time,
                    pnl:            parseFloat(t.amount || '0'),
                    contract_type:  extractType(t.shortcode || ''),
                }));
                setStatementRows(rows);
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
                            <select className='rp__limit-select' value={limit} onChange={e => setLimit(Number(e.target.value))}>
                                {[25,50,100,200].map(n => <option key={n} value={n}>Last {n}</option>)}
                            </select>
                            <button className='rp__refresh-btn' onClick={() => fetchStatement(limit)} disabled={isLoading}>
                                {isLoading ? '⏳' : '🔄'} Refresh
                            </button>
                        </div>
                        <div className='rp__table-wrap'>
                            <table className='rp__table'>
                                <thead>
                                    <tr>
                                        <th>Action</th>
                                        <th>Ref. ID</th>
                                        <th>Currency</th>
                                        <th>Date &amp; Time</th>
                                        <th>Amount</th>
                                        <th>Balance after</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading && <tr><td colSpan={6} className='rp__table-msg'>Loading…</td></tr>}
                                    {!isLoading && statementRows.length === 0 && (
                                        <tr><td colSpan={6} className='rp__table-msg'>No statement data found.</td></tr>
                                    )}
                                    {statementRows.map(s => {
                                        const act = (s.action_type || '').toLowerCase();
                                        const isDeposit    = act === 'deposit';
                                        const isWithdrawal = act === 'withdrawal';
                                        const isTransfer   = act === 'transfer';
                                        const isTrade      = act === 'sell' || act === 'buy';
                                        const rowClass = isDeposit ? 'stmt-deposit'
                                            : isWithdrawal ? 'stmt-withdrawal'
                                            : isTransfer   ? 'stmt-transfer'
                                            : s.pnl >= 0   ? 'won' : 'lost';
                                        const actionIcon = isDeposit ? '⬇ Deposit'
                                            : isWithdrawal ? '⬆ Withdrawal'
                                            : isTransfer   ? '⇄ Transfer'
                                            : act === 'buy' ? `${getTypeIcon(s.contract_type)} Buy · ${s.contract_type}`
                                            : `${getTypeIcon(s.contract_type)} ${s.contract_type}`;
                                        const amtClass = s.amount >= 0 ? 'pos' : 'neg';
                                        const dateTs = s.sell_time || s.purchase_time;
                                        return (
                                            <tr
                                                key={s.transaction_id}
                                                className={`rp__stmt-row ${rowClass}`}
                                                onClick={() => isTrade && s.contract_id ? setSelectedTrade(s) : undefined}
                                                style={{ cursor: isTrade && s.contract_id ? 'pointer' : 'default' }}
                                            >
                                                <td>
                                                    <div className='rp__stmt-action'>
                                                        <span className={`rp__stmt-badge rp__stmt-badge--${act}`}>{actionIcon}</span>
                                                    </div>
                                                </td>
                                                <td className='rp__refid'>{s.transaction_id}</td>
                                                <td><span className='rp__cur-badge'>{cur}</span></td>
                                                <td className='rp__time'>{fmtShort(dateTs)}</td>
                                                <td className={`rp__pnl ${amtClass}`}>{s.amount >= 0 ? '+' : ''}{s.amount.toFixed(2)}</td>
                                                <td>{s.balance_after.toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
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
