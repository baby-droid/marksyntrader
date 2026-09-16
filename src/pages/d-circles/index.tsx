// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { useDigitStats } from '@/hooks/useDigitStats';
import { applyCommission } from '@/utils/commission';
import './d-circles.scss';

/* ─── All markets ───────────────────────────────────────────────────────────── */
const ALL_MARKETS = [
    { label: 'V10',       value: 'R_10'      },
    { label: 'V25',       value: 'R_25'      },
    { label: 'V50',       value: 'R_50'      },
    { label: 'V75',       value: 'R_75'      },
    { label: 'V100',      value: 'R_100'     },
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
    { label: 'Crash 300N', value: 'CRASH300N'},
    { label: 'Crash 500',  value: 'CRASH500' },
    { label: 'Crash 1000', value: 'CRASH1000'},
    { label: 'Boom 300N',  value: 'BOOM300N' },
    { label: 'Boom 500',   value: 'BOOM500'  },
    { label: 'Boom 1000',  value: 'BOOM1000' },
];

const CONTRACT_TYPES = [
    { label: 'Even',   value: 'DIGITEVEN',  needsBarrier: false },
    { label: 'Odd',    value: 'DIGITODD',   needsBarrier: false },
    { label: 'Over',   value: 'DIGITOVER',  needsBarrier: true  },
    { label: 'Under',  value: 'DIGITUNDER', needsBarrier: true  },
    { label: 'Match',  value: 'DIGITMATCH', needsBarrier: true  },
    { label: 'Differ', value: 'DIGITDIFF',  needsBarrier: true  },
    { label: 'Rise',   value: 'CALL',        needsBarrier: false },
    { label: 'Fall',   value: 'PUT',         needsBarrier: false },
];

/* ─── Color logic ───────────────────────────────────────────────────────────── */
// Returns bg color per digit based on rank:
// green=highest, blue=2nd highest, yellow=2nd lowest, red=lowest, white=normal
// Digits sharing the same % get the same color
function getDigitBg(pcts: number[]): string[] {
    const allZero = pcts.every(p => p === 0);
    if (allZero) return new Array(10).fill('#ffffff');

    const sorted = [...pcts].sort((a, b) => b - a); // descending
    const high1 = sorted[0];
    const high2 = sorted.find(v => v < high1) ?? null;
    const low1  = sorted[sorted.length - 1];
    const low2  = sorted.slice().reverse().find(v => v > low1) ?? null;

    return pcts.map(p => {
        if (p === high1)                    return '#22c55e'; // green
        if (high2 !== null && p === high2)  return '#3b82f6'; // blue
        if (low1 !== null  && p === low1)   return '#ef4444'; // red
        if (low2 !== null  && p === low2)   return '#eab308'; // yellow
        return '#ffffff';
    });
}

function getTextColor(bg: string): string {
    if (bg === '#eab308' || bg === '#ffffff') return '#1a1a2e';
    return '#ffffff';
}

/* ─── Per-market row component ──────────────────────────────────────────────── */
interface MarketRowProps {
    symbol: string;
    label: string;
    collapsed: boolean;
    onToggle: () => void;
    onTradeSelect: (sym: string) => void;
}

const MarketRow: React.FC<MarketRowProps> = ({ symbol, label, collapsed, onToggle, onTradeSelect }) => {
    const { digits, lastDigit, currentPrice, isConnected } = useDigitStats(symbol);

    // Rolling live-tick history (grows as live ticks arrive)
    const [history, setHistory] = useState<number[]>([]);
    const [priceHistory, setPriceHistory] = useState<number[]>([]); // for Rise/Fall

    useEffect(() => {
        if (lastDigit === null) return;
        setHistory(prev => [...prev.slice(-999), lastDigit]);
    }, [lastDigit]);

    useEffect(() => {
        if (currentPrice == null) return;
        const n = parseFloat(String(currentPrice));
        if (!isNaN(n)) setPriceHistory(prev => [...prev.slice(-199), n]);
    }, [currentPrice]);

    // Digit stats — use hook's pre-seeded 1000-tick data until we have enough
    // live ticks locally. The hook now computes digits immediately on history
    // load (1000 ticks), so we get accurate data right away without waiting.
    const stats = useMemo(() => {
        if (history.length < 30 && digits && digits.length === 10) {
            // Hook already has 1000-tick history — use it directly
            return Array.from({ length: 10 }, (_, d) => ({
                digit: d,
                count: Math.round((digits[d] ?? 0) * 10), // approximate from pct
                pct: digits[d] ?? 0,
            }));
        }
        const total = history.length || 1;
        return Array.from({ length: 10 }, (_, d) => {
            const count = history.filter(h => h === d).length;
            return { digit: d, count, pct: (count / total) * 100 };
        });
    }, [history, digits]);

    const pcts = stats.map(s => s.pct);
    const bgs  = getDigitBg(pcts);

    // Stats from last 100 ticks
    const last100 = history.slice(-100);
    const l100 = last100.length || 1;
    const evenPct  = (last100.filter(d => d % 2 === 0).length / l100 * 100).toFixed(1);
    const oddPct   = (last100.filter(d => d % 2 !== 0).length / l100 * 100).toFixed(1);
    const over5Pct = (last100.filter(d => d > 4).length / l100 * 100).toFixed(1);
    const und5Pct  = (last100.filter(d => d < 5).length / l100 * 100).toFixed(1);

    // Most-frequent digit from history (for match/differ target)
    const topDigit = stats.reduce((a, b) => b.pct > a.pct ? b : a, stats[0]).digit;

    // Match / Differ for 20 and 50 ticks
    const last20 = history.slice(-20);
    const last50 = history.slice(-50);
    const m20 = last20.filter(d => d === topDigit).length;
    const d20 = last20.length - m20;
    const m50 = last50.filter(d => d === topDigit).length;
    const d50 = last50.length - m50;

    // Rise / Fall from last 100 prices
    const p100 = priceHistory.slice(-101);
    let rises = 0, falls = 0;
    for (let i = 1; i < p100.length; i++) {
        if (p100[i] > p100[i-1]) rises++;
        else if (p100[i] < p100[i-1]) falls++;
    }

    return (
        <div className='dcircles__market-row'>
            <div className='dcircles__row-header' onClick={onToggle}>
                <span className='dcircles__row-label'>{label}</span>
                <span className={`dcircles__row-dot ${isConnected ? 'live' : 'off'}`} />
                {currentPrice != null && (
                    <span className='dcircles__row-price'>{currentPrice}</span>
                )}
                {lastDigit !== null && (
                    <span className='dcircles__row-digit'>{lastDigit}</span>
                )}
                <span className='dcircles__row-ticks'>{history.length}t</span>
                <button
                    className='dcircles__row-trade-btn'
                    onClick={e => { e.stopPropagation(); onTradeSelect(symbol); }}
                    title='Select for trade'
                >
                    Trade
                </button>
                <span className='dcircles__row-chevron'>{collapsed ? '▶' : '▼'}</span>
            </div>

            {!collapsed && (
                <div className='dcircles__row-body'>
                    {/* Circles */}
                    <div className='dcircles__circles-wrap'>
                        {stats.map(s => {
                            const isCurrent = lastDigit === s.digit;
                            const bg = bgs[s.digit];
                            const fg = getTextColor(bg);
                            return (
                                <div key={s.digit} className='dcircles__circle-cell'>
                                    {/* Black triangle pointer above current digit */}
                                    <span className={`dcircles__pointer${isCurrent ? ' dcircles__pointer--on' : ''}`}>▼</span>
                                    <div
                                        className='dcircles__circle'
                                        style={{
                                            background: bg,
                                            color: fg,
                                            border: isCurrent
                                                ? `2.5px solid #000`
                                                : `1.5px solid ${bg === '#ffffff' ? '#d1d5db' : bg}`,
                                            transform: isCurrent ? 'scale(1.12)' : 'scale(1)',
                                            boxShadow: isCurrent ? '0 0 0 3px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.08)',
                                        }}
                                    >
                                        <span className='dcircles__digit-num'>{s.digit}</span>
                                        <span className='dcircles__digit-pct'>{s.pct.toFixed(1)}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Stats bar */}
                    <div className='dcircles__stats-row'>
                        <span className='dcircles__stat-badge dcircles__stat-badge--even'>E {evenPct}%</span>
                        <span className='dcircles__stat-badge dcircles__stat-badge--odd'>O {oddPct}%</span>
                        <span className='dcircles__stat-badge dcircles__stat-badge--over'>OV {over5Pct}%</span>
                        <span className='dcircles__stat-badge dcircles__stat-badge--und'>UND {und5Pct}%</span>
                        <span className='dcircles__stat-badge dcircles__stat-badge--sep'>|</span>
                        <span className='dcircles__stat-badge dcircles__stat-badge--match'>M{topDigit} 20t: {m20}/{d20}</span>
                        <span className='dcircles__stat-badge dcircles__stat-badge--match'>50t: {m50}/{d50}</span>
                        <span className='dcircles__stat-badge dcircles__stat-badge--sep'>|</span>
                        <span className='dcircles__stat-badge dcircles__stat-badge--rise'>↑{rises}</span>
                        <span className='dcircles__stat-badge dcircles__stat-badge--fall'>↓{falls}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ─── Main component ────────────────────────────────────────────────────────── */
interface TradeRecord {
    id: number;
    contractType: string;
    symbol: string;
    stake: number;
    profit: number | null;
    status: 'open' | 'won' | 'lost';
    entrySpot: number | null;
    exitSpot: number | null;
    time: Date;
    duration: number;
}

const DCircles: React.FC = () => {
    const { buyContract, connected, authorized, balance, currency } = useDerivTrade();

    // Collapsed state per market
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
        const init: Record<string, boolean> = {};
        ALL_MARKETS.forEach((m, i) => { init[m.value] = i > 4; }); // first 5 expanded
        return init;
    });

    const toggleCollapse = (sym: string) =>
        setCollapsed(prev => ({ ...prev, [sym]: !prev[sym] }));

    const expandAll  = () => setCollapsed(prev => Object.fromEntries(Object.keys(prev).map(k => [k, false])));
    const collapseAll = () => setCollapsed(prev => Object.fromEntries(Object.keys(prev).map(k => [k, true])));

    // Trade panel
    const [tradeSymbol, setTradeSymbol] = useState('1HZ100V');
    const [contractType, setContractType] = useState('DIGITEVEN');
    const [stake, setStake] = useState(0.35);
    const [duration, setDuration] = useState(1);
    const [barrier, setBarrier] = useState(5);
    const [isBuying, setIsBuying] = useState(false);
    const [trades, setTrades] = useState<TradeRecord[]>([]);
    const [sessionPnl, setSessionPnl] = useState(0);
    const [wins, setWins] = useState(0);
    const [losses, setLosses] = useState(0);
    const tradeIdRef = useRef(0);

    const ctDef = CONTRACT_TYPES.find(c => c.value === contractType) ?? CONTRACT_TYPES[0];
    const needsBarrier = ctDef.needsBarrier;

    const handleBuy = useCallback(async () => {
        if (!authorized || isBuying) return;
        setIsBuying(true);
        const id = ++tradeIdRef.current;
        const record: TradeRecord = {
            id, contractType, symbol: tradeSymbol, stake, profit: null, status: 'open',
            entrySpot: null, exitSpot: null, time: new Date(), duration,
        };
        setTrades(prev => [record, ...prev.slice(0, 199)]);
        try {
            await buyContract(
                {
                    symbol: tradeSymbol,
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
                }
            );
        } catch (e: any) {
            setTrades(prev => prev.filter(t => t.id !== id));
        } finally {
            setIsBuying(false);
        }
    }, [authorized, isBuying, contractType, tradeSymbol, stake, duration, barrier, needsBarrier, buyContract]);

    const fmtPnl = (v: number | null) =>
        v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;

    return (
        <div className='dcircles'>
            {/* ── Header ── */}
            <div className='dcircles__header'>
                <div>
                    <h2 className='dcircles__title'>⬤ D-Circles — All Markets</h2>
                    <p className='dcircles__sub'>1000-tick digit distribution · Live entry signals</p>
                </div>
                <div className='dcircles__header-right'>
                    <span className={`dcircles__conn ${connected ? 'on' : 'off'}`}>
                        {connected ? '● LIVE' : '○ Connecting…'}
                    </span>
                    {balance !== null && (
                        <span className='dcircles__balance'>{Number(balance).toFixed(2)} {currency}</span>
                    )}
                    <button className='dcircles__ctrl-btn' onClick={expandAll}>Expand All</button>
                    <button className='dcircles__ctrl-btn' onClick={collapseAll}>Collapse All</button>
                </div>
            </div>

            {/* ── Color legend ── */}
            <div className='dcircles__legend'>
                <span className='dcircles__legend-item dcircles__legend-item--green'>■ Highest %</span>
                <span className='dcircles__legend-item dcircles__legend-item--blue'>■ 2nd High</span>
                <span className='dcircles__legend-item dcircles__legend-item--yellow'>■ 2nd Low</span>
                <span className='dcircles__legend-item dcircles__legend-item--red'>■ Lowest %</span>
                <span className='dcircles__legend-item dcircles__legend-item--white'>□ Normal</span>
                <span className='dcircles__legend-item'>▼ Current digit</span>
            </div>

            {/* ── Market rows ── */}
            <div className='dcircles__markets'>
                {ALL_MARKETS.map(m => (
                    <MarketRow
                        key={m.value}
                        symbol={m.value}
                        label={m.label}
                        collapsed={!!collapsed[m.value]}
                        onToggle={() => toggleCollapse(m.value)}
                        onTradeSelect={sym => setTradeSymbol(sym)}
                    />
                ))}
            </div>

            {/* ── Trade panel (sticky bottom) ── */}
            <div className='dcircles__trade-panel'>
                <div className='dcircles__trade-row'>
                    <div className='dcircles__trade-field'>
                        <label>Market</label>
                        <select value={tradeSymbol} onChange={e => setTradeSymbol(e.target.value)} className='dcircles__trade-select'>
                            {ALL_MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                    </div>
                    <div className='dcircles__trade-field'>
                        <label>Type</label>
                        <select value={contractType} onChange={e => setContractType(e.target.value)} className='dcircles__trade-select'>
                            {CONTRACT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                        </select>
                    </div>
                    <div className='dcircles__trade-field'>
                        <label>Stake</label>
                        <input type='number' value={stake} min={0.35} step={0.05}
                            onChange={e => setStake(Number(e.target.value))}
                            className='dcircles__trade-input' />
                    </div>
                    <div className='dcircles__trade-field'>
                        <label>Ticks</label>
                        <input type='number' value={duration} min={1} max={10}
                            onChange={e => setDuration(Number(e.target.value))}
                            className='dcircles__trade-input' />
                    </div>
                    {needsBarrier && (
                        <div className='dcircles__trade-field'>
                            <label>Digit</label>
                            <input type='number' value={barrier} min={0} max={9}
                                onChange={e => setBarrier(Number(e.target.value))}
                                className='dcircles__trade-input' />
                        </div>
                    )}
                    <div className='dcircles__trade-field dcircles__trade-field--btn'>
                        <label>&nbsp;</label>
                        <button
                            className={`dcircles__buy-btn ${isBuying ? 'buying' : ''}`}
                            onClick={handleBuy}
                            disabled={!authorized || isBuying}
                        >
                            {!authorized ? '⌛' : isBuying ? '⏳' : `▶ ${ctDef.label}`}
                        </button>
                    </div>
                </div>

                {/* Session stats */}
                {(wins + losses) > 0 && (
                    <div className='dcircles__session-bar'>
                        <span>Session P/L: <strong className={sessionPnl >= 0 ? 'pos' : 'neg'}>{fmtPnl(sessionPnl)} {currency}</strong></span>
                        <span>W: <strong className='pos'>{wins}</strong></span>
                        <span>L: <strong className='neg'>{losses}</strong></span>
                        <span>Rate: <strong>{wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(0) : '—'}%</strong></span>
                        <button className='dcircles__clear-btn' onClick={() => { setTrades([]); setSessionPnl(0); setWins(0); setLosses(0); }}>Clear</button>
                    </div>
                )}

                {/* Recent trades */}
                {trades.slice(0, 5).map(t => (
                    <div key={t.id} className={`dcircles__trade-log-row ${t.status}`}>
                        <span>{t.contractType}</span>
                        <span>{t.symbol}</span>
                        <span>{t.stake.toFixed(2)}</span>
                        <span>In: {t.entrySpot ?? '…'}</span>
                        <span>Out: {t.exitSpot ?? (t.status === 'open' ? '…' : '—')}</span>
                        <span className={t.profit === null ? '' : t.profit >= 0 ? 'pos' : 'neg'}>
                            {t.profit === null ? '⏳' : fmtPnl(t.profit)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DCircles;
