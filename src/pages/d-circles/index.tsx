// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { useDigitStats } from '@/hooks/useDigitStats';
import { applyCommission } from '@/utils/commission';
import './d-circles.scss';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface TradeRecord {
    id: number;
    contractType: string;
    symbol: string;
    stake: number;
    profit: number | null;  // null = still open
    status: 'open' | 'won' | 'lost';
    entrySpot: number | null;
    exitSpot: number | null;
    time: Date;
    duration: number;
}

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const SYMBOLS = [
    { label: 'V10',      value: 'R_10'      },
    { label: 'V25',      value: 'R_25'      },
    { label: 'V50',      value: 'R_50'      },
    { label: 'V75',      value: 'R_75'      },
    { label: 'V100',     value: 'R_100'     },
    { label: 'V10 1s',   value: '1HZ10V'   },
    { label: 'V25 1s',   value: '1HZ25V'   },
    { label: 'V50 1s',   value: '1HZ50V'   },
    { label: 'V75 1s',   value: '1HZ75V'   },
    { label: 'V100 1s',  value: '1HZ100V'  },
];

const CONTRACT_TYPES = [
    { label: 'Even',  value: 'DIGITEVEN',  color: '#60a5fa', needsBarrier: false },
    { label: 'Odd',   value: 'DIGITODD',   color: '#a78bfa', needsBarrier: false },
    { label: 'Over',  value: 'DIGITOVER',  color: '#4ade80', needsBarrier: true  },
    { label: 'Under', value: 'DIGITUNDER', color: '#f87171', needsBarrier: true  },
    { label: 'Match', value: 'DIGITMATCH', color: '#fbbf24', needsBarrier: true  },
    { label: 'Differ',value: 'DIGITDIFF',  color: '#fb923c', needsBarrier: true  },
    { label: 'Rise',  value: 'CALL',        color: '#22c55e', needsBarrier: false },
    { label: 'Fall',  value: 'PUT',         color: '#ef4444', needsBarrier: false },
];

const DIGIT_COLORS = [
    '#a78bfa','#60a5fa','#34d399','#fbbf24','#f87171',
    '#c084fc','#38bdf8','#4ade80','#fb923c','#e879f9',
];

const TABS = ['Summary', 'Transactions', 'Journal'] as const;
type Tab = typeof TABS[number];

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function fmtTime(d: Date) {
    return d.toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getStreak(ticks: number[], digit: number): number {
    let streak = 0;
    for (let i = ticks.length - 1; i >= 0; i--) {
        if (ticks[i] === digit) streak++;
        else break;
    }
    return streak;
}

/* ─── Contract type icon (2×2 colored squares like Deriv dBot) ─────────────── */
function ContractIcon({ color }: { color: string }) {
    return (
        <span style={{ display: 'inline-grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, width: 14, height: 14, flexShrink: 0 }}>
            {[0,1,2,3].map(i => (
                <span key={i} style={{ background: i < 2 ? color : color + '66', borderRadius: 1 }} />
            ))}
        </span>
    );
}

/* ─── Main component ────────────────────────────────────────────────────────── */
const DCircles: React.FC = () => {
    /* Live digit stats from the shared hook */
    const [symbol, setSymbol] = useState('1HZ100V');
    const { digits, lastDigit, currentPrice, isConnected } = useDigitStats(symbol);

    /* Trading hook (rides the app's authenticated connection) */
    const { buyContract, connected, authorized, balance, currency } = useDerivTrade();

    /* Digit history (last 1000 raw digits) */
    const [tickHistory, setTickHistory] = useState<number[]>([]);
    useEffect(() => {
        if (lastDigit !== null) {
            setTickHistory(prev => [...prev.slice(-999), lastDigit]);
        }
    }, [lastDigit]);

    /* Tabs */
    const [activeTab, setActiveTab] = useState<Tab>('Summary');

    /* Trading state */
    const [contractType, setContractType] = useState('DIGITEVEN');
    const [stake, setStake] = useState(0.35);
    const [duration, setDuration] = useState(1);
    const [barrier, setBarrier] = useState(5);
    const [trades, setTrades] = useState<TradeRecord[]>([]);
    const [sessionPnl, setSessionPnl] = useState(0);
    const [wins, setWins] = useState(0);
    const [losses, setLosses] = useState(0);
    const [isBuying, setIsBuying] = useState(false);
    const [journalLog, setJournalLog] = useState<string[]>([]);
    const tradeIdRef = useRef(0);

    const addJournal = useCallback((msg: string) => {
        setJournalLog(prev => [`[${fmtTime(new Date())}] ${msg}`, ...prev].slice(0, 200));
    }, []);

    /* Derived digit stats */
    const stats = useMemo(() => Array.from({ length: 10 }, (_, d) => {
        const count = tickHistory.filter(t => t === d).length;
        const pct = tickHistory.length > 0 ? (count / tickHistory.length) * 100 : 10;
        return { digit: d, count, pct };
    }), [tickHistory]);

    const maxPct = Math.max(...stats.map(s => s.pct));
    const minPct = tickHistory.length > 0 ? Math.min(...stats.filter(s => s.count > 0).map(s => s.pct)) : 0;
    const hotDigit = stats.reduce((a, b) => b.pct > a.pct ? b : a, stats[0]);
    const coldDigit = tickHistory.length > 0
        ? stats.filter(s => s.count > 0).reduce((a, b) => b.pct < a.pct ? b : a, stats.filter(s => s.count > 0)[0])
        : null;

    const overPct  = stats.filter(s => s.digit > 4).reduce((a, s) => a + s.count, 0) / Math.max(tickHistory.length, 1) * 100;
    const underPct = stats.filter(s => s.digit < 5).reduce((a, s) => a + s.count, 0) / Math.max(tickHistory.length, 1) * 100;
    const evenPct  = stats.filter(s => s.digit % 2 === 0).reduce((a, s) => a + s.count, 0) / Math.max(tickHistory.length, 1) * 100;
    const oddPct   = stats.filter(s => s.digit % 2 !== 0).reduce((a, s) => a + s.count, 0) / Math.max(tickHistory.length, 1) * 100;

    /* AI suggestion */
    const aiSignal = useMemo(() => {
        if (tickHistory.length < 20) return null;
        const sigs: Array<{ label: string; confidence: number; type: string; color: string }> = [];
        if (Math.abs(overPct - 50) > 5)
            sigs.push({ label: overPct > 50 ? `OVER ${hotDigit.digit > 4 ? hotDigit.digit - 1 : 4}` : `UNDER ${coldDigit?.digit ?? 5}`, confidence: Math.abs(overPct - 50), type: overPct > 50 ? 'DIGITOVER' : 'DIGITUNDER', color: overPct > 50 ? '#22c55e' : '#f97316' });
        if (Math.abs(evenPct - 50) > 5)
            sigs.push({ label: evenPct > 50 ? 'EVEN' : 'ODD', confidence: Math.abs(evenPct - 50), type: evenPct > 50 ? 'DIGITEVEN' : 'DIGITODD', color: evenPct > 50 ? '#60a5fa' : '#a78bfa' });
        return sigs.sort((a, b) => b.confidence - a.confidence)[0] ?? null;
    }, [tickHistory, overPct, evenPct, hotDigit, coldDigit]);

    /* ─── Buy one contract ──────────────────────────────────────────────────── */
    const ctDef = CONTRACT_TYPES.find(c => c.value === contractType) ?? CONTRACT_TYPES[0];
    const needsBarrier = ctDef.needsBarrier;

    const handleBuy = useCallback(async () => {
        if (!authorized || isBuying) return;
        setIsBuying(true);
        const id = ++tradeIdRef.current;
        const record: TradeRecord = {
            id, contractType, symbol, stake, profit: null, status: 'open',
            entrySpot: null, exitSpot: null, time: new Date(), duration,
        };
        setTrades(prev => [record, ...prev.slice(0, 199)]);
        setActiveTab('Transactions');
        addJournal(`▶ Buy ${contractType}${needsBarrier ? ' @' + barrier : ''} on ${symbol} stake:${stake}`);
        try {
            await buyContract(
                {
                    symbol,
                    contract_type: contractType as any,
                    duration,
                    duration_unit: 't',
                    stake,
                    barrier: needsBarrier ? barrier : undefined,
                },
                settled => {
                    const profit = applyCommission(settled.profit ?? 0);
                    setTrades(prev => prev.map(t => t.id === id
                        ? { ...t, profit, status: settled.status, entrySpot: settled.entry_spot ?? null, exitSpot: settled.exit_spot ?? null }
                        : t
                    ));
                    setSessionPnl(p => p + profit);
                    if (profit >= 0) setWins(w => w + 1);
                    else setLosses(l => l + 1);
                    addJournal(`${profit >= 0 ? '✅ WIN' : '❌ LOSS'} #${id} P/L: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} ${currency}`);
                }
            );
        } catch (e: any) {
            const msg = e?.error?.message || e?.message || 'Buy failed';
            setTrades(prev => prev.filter(t => t.id !== id));
            addJournal(`⚠️ ${msg}`);
        } finally {
            setIsBuying(false);
        }
    }, [authorized, isBuying, contractType, symbol, stake, duration, barrier, needsBarrier, buyContract, currency, addJournal]);

    const fmtPnl = (v: number | null) =>
        v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;

    const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(0) : '—';

    /* ─── Render ────────────────────────────────────────────────────────────── */
    return (
        <div className='dcircles'>
            {/* ── Header ── */}
            <div className='dcircles__header'>
                <div className='dcircles__title-wrap'>
                    <h2 className='dcircles__title'>⬤ D-Circles — Digit Analyzer</h2>
                    <p className='dcircles__sub'>Real-time digit frequency · AI signals · Live trade execution</p>
                </div>
                <div className='dcircles__controls'>
                    <select className='dcircles__select' value={symbol} onChange={e => setSymbol(e.target.value)}>
                        {SYMBOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <span className={`dcircles__conn ${isConnected ? 'on' : 'off'}`}>
                        {isConnected ? '● LIVE' : '○ Connecting…'}
                    </span>
                    {balance !== null && (
                        <span className='dcircles__balance'>{Number(balance).toFixed(2)} {currency}</span>
                    )}
                </div>
            </div>

            {/* ── Live ticker ── */}
            <div className='dcircles__ticker'>
                <div className='dcircles__ticker-left'>
                    <span className='dcircles__live-dot' style={{ background: isConnected ? '#22c55e' : '#475569' }} />
                    <span className='dcircles__ticker-price'>{currentPrice?.toFixed(2) ?? '—'}</span>
                    {lastDigit !== null && (
                        <span className='dcircles__ticker-digit' style={{ background: DIGIT_COLORS[lastDigit] }}>
                            {lastDigit}
                        </span>
                    )}
                </div>
                <div className='dcircles__ticker-stream'>
                    {tickHistory.slice(-32).reverse().map((d, i) => (
                        <span key={i} className='dcircles__tick-chip'
                            style={{
                                background: DIGIT_COLORS[d] + (i === 0 ? 'ff' : '55'),
                                color: i === 0 ? '#fff' : 'rgba(255,255,255,0.7)',
                                transform: i === 0 ? 'scale(1.15)' : 'scale(1)',
                                fontWeight: i === 0 ? 700 : 400,
                            }}
                        >
                            {d}
                        </span>
                    ))}
                </div>
                <span className='dcircles__tick-count'>{tickHistory.length} ticks</span>
            </div>

            {/* ── AI Signal bar ── */}
            {aiSignal && (
                <div className='dcircles__ai-bar' style={{ borderColor: aiSignal.color + '44', background: aiSignal.color + '11' }}>
                    <span className='dcircles__ai-icon'>🤖</span>
                    <span className='dcircles__ai-text'>
                        <strong style={{ color: aiSignal.color }}>AHMED AI: {aiSignal.label}</strong>
                        {' '} — {aiSignal.confidence.toFixed(1)}% confidence
                    </span>
                    <button
                        className='dcircles__ai-fire'
                        style={{ background: aiSignal.color }}
                        disabled={!authorized || isBuying}
                        onClick={() => {
                            setContractType(aiSignal.type);
                            setTimeout(handleBuy, 0);
                        }}
                    >
                        Fire
                    </button>
                </div>
            )}

            {/* ── Digit circles ── */}
            <div className='dcircles__grid'>
                {stats.map(s => {
                    const isCurrent = lastDigit === s.digit;
                    const isHot = s.pct === maxPct && tickHistory.length > 0;
                    const isCold = tickHistory.length > 0 && s.count > 0 && s.pct === minPct;
                    const color = DIGIT_COLORS[s.digit];
                    const barPct = tickHistory.length > 0 ? s.pct : 10;
                    const streak = getStreak(tickHistory, s.digit);
                    return (
                        <div key={s.digit}
                            className={`dcircles__cell ${isCurrent ? 'dcircles__cell--current' : ''} ${isHot ? 'dcircles__cell--hot' : ''} ${isCold ? 'dcircles__cell--cold' : ''}`}
                        >
                            <div className='dcircles__circle' style={{
                                '--digit-color': color,
                                borderColor: isCurrent ? '#fff' : color + '88',
                                boxShadow: isCurrent ? `0 0 0 3px ${color}55, 0 0 16px ${color}44` : isHot ? `0 0 14px ${color}55` : 'none',
                                transform: isCurrent ? 'scale(1.08)' : 'scale(1)',
                            } as React.CSSProperties}>
                                <span className='dcircles__digit-num' style={{ color }}>{s.digit}</span>
                                <span className='dcircles__digit-pct' style={{ color: color + 'bb' }}>{s.pct.toFixed(1)}%</span>
                                {streak > 1 && <span className='dcircles__streak'>×{streak}</span>}
                                {isHot && <span className='dcircles__badge dcircles__badge--hot'>🔥</span>}
                                {isCold && <span className='dcircles__badge dcircles__badge--cold'>🧊</span>}
                            </div>
                            <div className='dcircles__bar-wrap'>
                                <div className='dcircles__bar' style={{ width: `${barPct}%`, background: color, opacity: isHot ? 1 : 0.6 }} />
                            </div>
                            <span className='dcircles__count'>{s.count}</span>
                        </div>
                    );
                })}
            </div>

            {/* ── Quick trade panel ── */}
            <div className='dcircles__trade-panel'>
                <div className='dcircles__trade-types'>
                    {CONTRACT_TYPES.map(ct => (
                        <button
                            key={ct.value}
                            className={`dcircles__ct-btn ${contractType === ct.value ? 'active' : ''}`}
                            style={contractType === ct.value ? { borderColor: ct.color, background: ct.color + '22', color: ct.color } : {}}
                            onClick={() => setContractType(ct.value)}
                        >
                            {ct.label}
                        </button>
                    ))}
                </div>
                <div className='dcircles__trade-params'>
                    <label>Stake
                        <input type='number' value={stake} min={0.35} step={0.05}
                            onChange={e => setStake(Number(e.target.value))} />
                    </label>
                    <label>Ticks
                        <input type='number' value={duration} min={1} max={10}
                            onChange={e => setDuration(Number(e.target.value))} />
                    </label>
                    {needsBarrier && (
                        <label>Digit
                            <input type='number' value={barrier} min={0} max={9}
                                onChange={e => setBarrier(Number(e.target.value))} />
                        </label>
                    )}
                    <button
                        className={`dcircles__buy-btn ${isBuying ? 'buying' : ''}`}
                        style={{ background: ctDef.color }}
                        onClick={handleBuy}
                        disabled={!authorized || isBuying}
                    >
                        {!authorized ? '⌛ Connecting…' : isBuying ? '⏳ Buying…' : `▶ ${ctDef.label}`}
                    </button>
                </div>
            </div>

            {/* ── Summary / Transactions / Journal tabs ── */}
            <div className='dcircles__tabs-wrap'>
                {/* Tab bar */}
                <div className='dcircles__tab-bar'>
                    {TABS.map(t => (
                        <button
                            key={t}
                            className={`dcircles__tab ${activeTab === t ? 'active' : ''}`}
                            onClick={() => setActiveTab(t)}
                        >
                            {t}
                            {t === 'Transactions' && trades.length > 0 && (
                                <span className='dcircles__tab-badge'>{trades.length}</span>
                            )}
                        </button>
                    ))}
                    {(wins + losses) > 0 && (
                        <button
                            className='dcircles__tab-clear'
                            onClick={() => { setTrades([]); setSessionPnl(0); setWins(0); setLosses(0); setJournalLog([]); }}
                        >
                            ↺ Clear
                        </button>
                    )}
                </div>

                {/* Summary */}
                {activeTab === 'Summary' && (
                    <div className='dcircles__summary'>
                        <div className='dcircles__summary-stats'>
                            <div className='dcircles__sum-card'>
                                <span>Total Ticks</span>
                                <strong>{tickHistory.length}</strong>
                            </div>
                            <div className='dcircles__sum-card'>
                                <span>🔥 Hottest</span>
                                <strong style={{ color: DIGIT_COLORS[hotDigit.digit] }}>
                                    {hotDigit.digit} ({hotDigit.pct.toFixed(1)}%)
                                </strong>
                            </div>
                            <div className='dcircles__sum-card'>
                                <span>🧊 Coldest</span>
                                <strong style={{ color: coldDigit ? DIGIT_COLORS[coldDigit.digit] : '#94a3b8' }}>
                                    {coldDigit ? `${coldDigit.digit} (${coldDigit.pct.toFixed(1)}%)` : '—'}
                                </strong>
                            </div>
                            <div className='dcircles__sum-card'>
                                <span>⬆ Over %</span>
                                <strong style={{ color: overPct > 55 ? '#22c55e' : overPct < 45 ? '#ef4444' : '#94a3b8' }}>
                                    {tickHistory.length > 0 ? overPct.toFixed(1) + '%' : '—'}
                                </strong>
                            </div>
                            <div className='dcircles__sum-card'>
                                <span>⬇ Under %</span>
                                <strong style={{ color: underPct > 55 ? '#22c55e' : underPct < 45 ? '#ef4444' : '#94a3b8' }}>
                                    {tickHistory.length > 0 ? underPct.toFixed(1) + '%' : '—'}
                                </strong>
                            </div>
                            <div className='dcircles__sum-card'>
                                <span>Even %</span>
                                <strong style={{ color: evenPct > 55 ? '#60a5fa' : '#94a3b8' }}>
                                    {tickHistory.length > 0 ? evenPct.toFixed(1) + '%' : '—'}
                                </strong>
                            </div>
                            <div className='dcircles__sum-card'>
                                <span>Odd %</span>
                                <strong style={{ color: oddPct > 55 ? '#a78bfa' : '#94a3b8' }}>
                                    {tickHistory.length > 0 ? oddPct.toFixed(1) + '%' : '—'}
                                </strong>
                            </div>
                        </div>
                        {/* Session P/L summary */}
                        {(wins + losses) > 0 && (
                            <div className='dcircles__session-stats'>
                                <div className='dcircles__sum-card'>
                                    <span>Session P/L</span>
                                    <strong className={sessionPnl >= 0 ? 'pos' : 'neg'}>
                                        {sessionPnl >= 0 ? '+' : ''}{sessionPnl.toFixed(2)} {currency}
                                    </strong>
                                </div>
                                <div className='dcircles__sum-card'>
                                    <span>Trades</span>
                                    <strong>{wins + losses}</strong>
                                </div>
                                <div className='dcircles__sum-card'>
                                    <span>Wins</span>
                                    <strong className='pos'>{wins}</strong>
                                </div>
                                <div className='dcircles__sum-card'>
                                    <span>Losses</span>
                                    <strong className='neg'>{losses}</strong>
                                </div>
                                <div className='dcircles__sum-card'>
                                    <span>Win Rate</span>
                                    <strong>{winRate}%</strong>
                                </div>
                            </div>
                        )}
                        {/* Digit bar chart */}
                        <div className='dcircles__digit-bars'>
                            {stats.map(s => (
                                <div key={s.digit} className='dcircles__digit-bar-row'>
                                    <span className='dcircles__digit-bar-label' style={{ color: DIGIT_COLORS[s.digit] }}>{s.digit}</span>
                                    <div className='dcircles__digit-bar-track'>
                                        <div className='dcircles__digit-bar-fill'
                                            style={{ width: `${s.pct}%`, background: DIGIT_COLORS[s.digit] }}
                                        />
                                    </div>
                                    <span className='dcircles__digit-bar-pct'>{s.pct.toFixed(1)}%</span>
                                    <span className='dcircles__digit-bar-cnt'>{s.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Transactions */}
                {activeTab === 'Transactions' && (
                    <div className='dcircles__transactions'>
                        {trades.length === 0 ? (
                            <div className='dcircles__empty'>No transactions yet. Buy a contract to get started.</div>
                        ) : (
                            <table className='dcircles__tx-table'>
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Entry / Exit spot</th>
                                        <th>Buy price and P/L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trades.map(t => {
                                        const ctColor = CONTRACT_TYPES.find(c => c.value === t.contractType)?.color ?? '#94a3b8';
                                        const ctLabel = CONTRACT_TYPES.find(c => c.value === t.contractType)?.label ?? t.contractType;
                                        return (
                                            <tr key={t.id} className={`dcircles__tx-row ${t.status}`}>
                                                <td className='dcircles__tx-type'>
                                                    <ContractIcon color={ctColor} />
                                                    <span className='dcircles__tx-label'>{ctLabel}</span>
                                                </td>
                                                <td className='dcircles__tx-spots'>
                                                    <div className='dcircles__tx-spot'>
                                                        <span className='dcircles__spot-entry'>●</span>
                                                        <span>{t.entrySpot != null ? t.entrySpot.toFixed(2) : '—'}</span>
                                                    </div>
                                                    <div className='dcircles__tx-spot'>
                                                        <span className='dcircles__spot-exit'>○</span>
                                                        <span>{t.exitSpot != null ? t.exitSpot.toFixed(2) : t.status === 'open' ? '…' : '—'}</span>
                                                    </div>
                                                </td>
                                                <td className='dcircles__tx-pnl'>
                                                    <div>{t.stake.toFixed(2)} {currency}</div>
                                                    <div className={`dcircles__pnl ${t.profit === null ? 'open' : t.profit >= 0 ? 'pos' : 'neg'}`}>
                                                        {t.profit === null
                                                            ? <span className='dcircles__pnl-pending'>⏳ open</span>
                                                            : `${fmtPnl(t.profit)} ${currency}`}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Journal */}
                {activeTab === 'Journal' && (
                    <div className='dcircles__journal'>
                        {journalLog.length === 0 ? (
                            <div className='dcircles__empty'>No journal entries yet.</div>
                        ) : (
                            journalLog.map((l, i) => (
                                <div key={i} className={`dcircles__journal-entry ${
                                    l.includes('WIN') ? 'win' : l.includes('LOSS') ? 'loss' : l.includes('⚠') ? 'warn' : ''
                                }`}>
                                    {l}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DCircles;
