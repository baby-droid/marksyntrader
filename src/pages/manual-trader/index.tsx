// @ts-nocheck
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { applyCommission } from '@/utils/commission';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import './manual-trader.scss';

/* ─── Constants ─── */
const SYMBOLS = [
    { group: 'Volatility', subs: [
        {label:'V10',value:'R_10'},{label:'V25',value:'R_25'},{label:'V50',value:'R_50'},
        {label:'V75',value:'R_75'},{label:'V100',value:'R_100'},
    ]},
    { group: 'Volatility 1s', subs: [
        {label:'V10 1s',value:'1HZ10V'},{label:'V25 1s',value:'1HZ25V'},
        {label:'V50 1s',value:'1HZ50V'},{label:'V75 1s',value:'1HZ75V'},{label:'V100 1s',value:'1HZ100V'},
    ]},
    { group: 'Jump', subs: [
        {label:'Jump 10',value:'JD10'},{label:'Jump 25',value:'JD25'},
        {label:'Jump 50',value:'JD50'},{label:'Jump 75',value:'JD75'},{label:'Jump 100',value:'JD100'},
    ]},
];

const ALL_SYMBOLS = SYMBOLS.flatMap(g => g.subs);

const CONTRACT_TABS = [
    {
        id: 'rise_fall', label: 'Rise/Fall', icon: '📈',
        types: [
            { label: '↑ RISE', type: 'CALL', color: '#22c55e', desc: 'Win if price rises after entry' },
            { label: '↓ FALL', type: 'PUT',  color: '#ef4444', desc: 'Win if price falls after entry' },
        ],
        durationUnit: 't', hasDuration: true, hasBarrier: false,
    },
    {
        id: 'even_odd', label: 'Even/Odd', icon: '⚖️',
        types: [
            { label: 'EVEN', type: 'DIGITEVEN', color: '#3b82f6', desc: 'Win if last digit is even (0,2,4,6,8)' },
            { label: 'ODD',  type: 'DIGITODD',  color: '#8b5cf6', desc: 'Win if last digit is odd (1,3,5,7,9)' },
        ],
        durationUnit: 't', hasDuration: true, hasBarrier: false,
    },
    {
        id: 'over_under', label: 'Over/Under', icon: '🎯',
        types: [
            { label: '▲ OVER',  type: 'DIGITOVER',  color: '#22c55e', desc: 'Win if last digit is over the barrier' },
            { label: '▼ UNDER', type: 'DIGITUNDER', color: '#ef4444', desc: 'Win if last digit is under the barrier' },
        ],
        durationUnit: 't', hasDuration: true, hasBarrier: true,
    },
    {
        id: 'match_diff', label: 'Match/Differ', icon: '🔢',
        types: [
            { label: '= MATCH',  type: 'DIGITMATCH', color: '#f59e0b', desc: 'Win if last digit matches exactly' },
            { label: '≠ DIFFER', type: 'DIGITDIFF',  color: '#06b6d4', desc: 'Win if last digit differs from prediction' },
        ],
        durationUnit: 't', hasDuration: true, hasBarrier: true,
    },
];

const TICK_DURATIONS = [1, 2, 3, 5, 10];
const STAKE_PRESETS  = [0.35, 0.5, 1, 2, 5, 10];

// Digit coloring (matches official dTrader palette)
const DIGIT_COLORS = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e','#14b8a6','#06b6d4','#3b82f6','#8b5cf6','#ec4899'];

function getLastDigit(q: number) {
    const s = q.toFixed(2).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

interface Position {
    id: number; symbol: string; type: string; contractType: string;
    stake: number; status: 'open'|'won'|'lost'; profit: number;
    tick: number; duration: number; entry?: number; exit?: number; time: number;
}

/* ─── Component ─── */
const ManualTrader: React.FC = () => {
    const { buyContract, subscribeTicks, connected, authorized, balance, currency, send } = useDerivTrade();
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    // --- Market state ---
    const [symbolValue, setSymbolValue] = useState('R_100');
    const [tabId,  setTabId]   = useState('rise_fall');
    const [typeIdx, setTypeIdx] = useState(0);  // 0 or 1 within the tab
    const [stake,  setStake]   = useState('1.00');
    const [duration, setDuration] = useState(5);
    const [barrier, setBarrier]   = useState(4);
    const [positions, setPositions] = useState<Position[]>([]);
    const [pnl, setPnl] = useState(0);
    const [payout, setPayout] = useState<number | null>(null);
    const [payoutLoading, setPayoutLoading] = useState(false);

    // --- Live tick state ---
    const [currentDigit, setCurrentDigit] = useState<number|null>(null);
    const [currentPrice, setCurrentPrice] = useState<number|null>(null);
    const [digitHistory, setDigitHistory] = useState<number[]>([]);
    const [digitStats,   setDigitStats]   = useState<number[]>(new Array(10).fill(0));
    const [totalTicks,   setTotalTicks]   = useState(0);

    const idRef = useRef(0);
    const proposalTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

    const tab = CONTRACT_TABS.find(t => t.id === tabId) ?? CONTRACT_TABS[0];
    const contractDef = tab.types[Math.min(typeIdx, tab.types.length - 1)];

    const symbol = useMemo(() => ALL_SYMBOLS.find(s => s.value === symbolValue) ?? ALL_SYMBOLS[0], [symbolValue]);

    // Subscribe to ticks
    useEffect(() => {
        const unsub = subscribeTicks(symbolValue, tick => {
            setCurrentDigit(tick.digit);
            setCurrentPrice(tick.quote);
            setDigitHistory(prev => [tick.digit, ...prev].slice(0, 50));
            setDigitStats(prev => {
                const next = [...prev]; next[tick.digit]++; return next;
            });
            setTotalTicks(p => p + 1);
        });
        setDigitStats(new Array(10).fill(0));
        setTotalTicks(0);
        setCurrentDigit(null); setCurrentPrice(null); setDigitHistory([]);
        return unsub;
    }, [symbolValue]);

    // Fetch proposal (payout estimate)
    useEffect(() => {
        if (proposalTimerRef.current) clearTimeout(proposalTimerRef.current);
        proposalTimerRef.current = setTimeout(async () => {
            if (!authorized || !send) { setPayout(null); return; }
            const stakeNum = parseFloat(stake);
            if (isNaN(stakeNum) || stakeNum < 0.35) { setPayout(null); return; }
            try {
                setPayoutLoading(true);
                const req: any = {
                    proposal: 1, amount: stakeNum, basis: 'stake',
                    contract_type: contractDef.type, currency: currency || 'USD',
                    duration, duration_unit: 't', symbol: symbolValue,
                };
                if (tab.hasBarrier) req.barrier = String(barrier);
                const res = await send(req);
                if (res?.proposal?.payout != null) {
                    setPayout(parseFloat(res.proposal.payout));
                } else {
                    setPayout(null);
                }
            } catch { setPayout(null); }
            finally { setPayoutLoading(false); }
        }, 400);
        return () => { if (proposalTimerRef.current) clearTimeout(proposalTimerRef.current); };
    }, [stake, duration, symbolValue, contractDef.type, barrier, tab.hasBarrier, authorized, currency, send]);

    const pcts = useMemo(() =>
        digitStats.map(c => totalTicks > 0 ? (c / totalTicks) * 100 : 0),
    [digitStats, totalTicks]);

    const maxPct = Math.max(...pcts);
    const minPct = Math.min(...pcts.filter((_, i) => digitStats[i] > 0));
    const maxDigit = pcts.indexOf(maxPct);
    const minDigit = pcts.findIndex((p, i) => p === minPct && digitStats[i] > 0);

    const buy = useCallback(async (def: typeof contractDef) => {
        const s = parseFloat(stake);
        if (!authorized) return;
        const pos: Position = {
            id: idRef.current++, symbol: symbol.label, type: def.label,
            contractType: def.type, stake: s, status: 'open',
            profit: 0, tick: 0, duration, time: Date.now(),
        };
        setPositions(p => [pos, ...p.slice(0, 49)]);

        try {
            let t = 0;
            const iv = setInterval(() => {
                t++;
                setPositions(p => p.map(x => x.id === pos.id && x.status === 'open'
                    ? { ...x, tick: Math.min(t, duration) } : x));
                if (t >= duration) clearInterval(iv);
            }, 1000);

            await buyContract(
                {
                    symbol: symbolValue, contract_type: def.type as any,
                    duration, duration_unit: 't', stake: s,
                    ...(tab.hasBarrier ? { barrier } : {}),
                },
                c => {
                    clearInterval(iv);
                    const profit = applyCommission(c.profit);
                    setPositions(p => p.map(x => x.id === pos.id
                        ? { ...x, status: c.status, profit, entry: c.entry_spot, exit: c.exit_spot } : x));
                    setPnl(prev => prev + profit);
                }
            );
        } catch {
            setPositions(p => p.filter(x => x.id !== pos.id));
        }
    }, [authorized, stake, symbolValue, duration, barrier, tab, contractDef, symbol, buyContract]);

    const fmt = (usd: number) => `${fromUsd(usd).toFixed(2)} ${displayCur}`;
    const fmtProfit = (usd: number) => `${usd >= 0 ? '+' : ''}${fromUsd(usd).toFixed(2)} ${displayCur}`;

    const openPositions   = positions.filter(p => p.status === 'open');
    const closedPositions = positions.filter(p => p.status !== 'open');

    return (
        <div className='manual-trader'>
            {/* ─── Top bar ─── */}
            <div className='manual-trader__topbar'>
                <div className='manual-trader__topbar-left'>
                    <span className={`manual-trader__conn ${connected ? 'on' : 'off'}`}>
                        {connected ? '● LIVE' : '○ Offline'}
                    </span>
                    <h2 className='manual-trader__title'>Manual Trader</h2>
                    {currentPrice && (
                        <span className='manual-trader__live-price'>{currentPrice.toFixed(5)}</span>
                    )}
                </div>
                <div className='manual-trader__topbar-right'>
                    {balance !== null && (
                        <div className='manual-trader__balance'>
                            <span>Balance</span>
                            <strong>{fmt(balance)}</strong>
                        </div>
                    )}
                    <div className={`manual-trader__pnl ${pnl >= 0 ? 'pos' : 'neg'}`}>
                        <span>Session P/L</span>
                        <strong>{fmtProfit(pnl)}</strong>
                    </div>
                </div>
            </div>

            <div className='manual-trader__layout'>
                {/* ─── LEFT — Trade Form ─── */}
                <div className='manual-trader__form-col'>

                    {/* Symbol selector */}
                    <div className='manual-trader__section-card'>
                        <label className='manual-trader__sec-label'>Market</label>
                        <div className='manual-trader__symbol-groups'>
                            {SYMBOLS.map(g => (
                                <div key={g.group} className='manual-trader__symbol-group'>
                                    <span className='manual-trader__symbol-group-name'>{g.group}</span>
                                    <div className='manual-trader__symbol-pills'>
                                        {g.subs.map(s => (
                                            <button key={s.value}
                                                className={`manual-trader__symbol-pill ${symbolValue === s.value ? 'active' : ''}`}
                                                onClick={() => { setSymbolValue(s.value); }}>
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Contract type tabs */}
                    <div className='manual-trader__section-card'>
                        <label className='manual-trader__sec-label'>Trade Type</label>
                        <div className='manual-trader__contract-tabs'>
                            {CONTRACT_TABS.map(t => (
                                <button key={t.id}
                                    className={`manual-trader__contract-tab ${tabId === t.id ? 'active' : ''}`}
                                    onClick={() => { setTabId(t.id); setTypeIdx(0); }}>
                                    <span>{t.icon}</span> {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration */}
                    <div className='manual-trader__section-card'>
                        <label className='manual-trader__sec-label'>Duration (ticks)</label>
                        <div className='manual-trader__dur-row'>
                            {TICK_DURATIONS.map(v => (
                                <button key={v}
                                    className={`manual-trader__dur-btn ${duration === v ? 'active' : ''}`}
                                    onClick={() => setDuration(v)}>
                                    {v}T
                                </button>
                            ))}
                            <input className='manual-trader__dur-input' type='number' min='1' max='10'
                                value={duration} onChange={e => setDuration(Math.max(1, Math.min(10, +e.target.value)))} />
                        </div>
                    </div>

                    {/* Stake */}
                    <div className='manual-trader__section-card'>
                        <label className='manual-trader__sec-label'>Stake</label>
                        <div className='manual-trader__stake-presets'>
                            {STAKE_PRESETS.map(v => (
                                <button key={v}
                                    className={`manual-trader__stake-preset ${parseFloat(stake) === v ? 'active' : ''}`}
                                    onClick={() => setStake(v.toFixed(2))}>
                                    {displayCur === 'USD' ? '$' : ''}{v}
                                </button>
                            ))}
                        </div>
                        <div className='manual-trader__stake-input-row'>
                            <span className='manual-trader__stake-cur'>{currency || 'USD'}</span>
                            <input className='manual-trader__stake-input' type='number' min='0.35' step='0.01'
                                value={stake} onChange={e => setStake(e.target.value)} />
                        </div>
                    </div>

                    {/* Barrier/digit (only for Over/Under and Match/Differ) */}
                    {tab.hasBarrier && (
                        <div className='manual-trader__section-card'>
                            <label className='manual-trader__sec-label'>Barrier Digit</label>
                            <div className='manual-trader__barrier-row'>
                                {[0,1,2,3,4,5,6,7,8,9].map(d => (
                                    <button key={d}
                                        className={`manual-trader__barrier-btn ${barrier === d ? 'active' : ''}`}
                                        style={barrier === d ? { background: DIGIT_COLORS[d] } : {}}
                                        onClick={() => setBarrier(d)}>
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Payout display */}
                    <div className='manual-trader__payout-card'>
                        <div className='manual-trader__payout-row'>
                            <span className='manual-trader__payout-label'>Payout estimate</span>
                            <span className='manual-trader__payout-val'>
                                {payoutLoading ? '…' : payout != null ? fmt(payout) : '—'}
                            </span>
                        </div>
                        <div className='manual-trader__payout-row'>
                            <span className='manual-trader__payout-label'>Profit if win</span>
                            <span className={`manual-trader__payout-profit ${payout != null ? 'has' : ''}`}>
                                {payout != null
                                    ? `+${fmt(payout - parseFloat(stake))}`
                                    : '—'}
                            </span>
                        </div>
                    </div>

                    {/* Buy buttons */}
                    <div className='manual-trader__buy-btns'>
                        {tab.types.map((def, i) => (
                            <button key={def.type}
                                className={`manual-trader__buy-btn ${i === 1 ? 'second' : ''}`}
                                style={{ '--btn-color': def.color } as React.CSSProperties}
                                onClick={() => buy(def)}
                                disabled={!authorized}>
                                <span className='manual-trader__buy-label'>{def.label}</span>
                                <span className='manual-trader__buy-desc'>{def.desc}</span>
                            </button>
                        ))}
                    </div>

                    {!authorized && (
                        <div className='manual-trader__auth-notice'>
                            ⚠ Connecting to Deriv account…
                        </div>
                    )}
                </div>

                {/* ─── RIGHT — Digit Analysis ─── */}
                <div className='manual-trader__analysis-col'>
                    {/* Current price + digit */}
                    <div className='manual-trader__price-display'>
                        <div className='manual-trader__symbol-badge'>{symbol.label}</div>
                        <div className='manual-trader__price-num'>
                            {currentPrice != null ? currentPrice.toFixed(5) : '———'}
                        </div>
                        <div className='manual-trader__digit-hero'
                            style={{ background: currentDigit != null ? DIGIT_COLORS[currentDigit] : '#374151' }}>
                            {currentDigit ?? '—'}
                        </div>
                        <span className='manual-trader__digit-caption'>LAST DIGIT</span>
                    </div>

                    {/* Digit frequency bars */}
                    <div className='manual-trader__freq-card'>
                        <div className='manual-trader__freq-title'>
                            Digit Frequency <span>{totalTicks} ticks</span>
                        </div>
                        <div className='manual-trader__freq-grid'>
                            {Array.from({length:10}, (_,d) => {
                                const pct = pcts[d];
                                const isMax = d === maxDigit && totalTicks > 10;
                                const isMin = d === minDigit && totalTicks > 10;
                                const isCur = d === currentDigit;
                                return (
                                    <div key={d} className={`manual-trader__freq-item ${isCur ? 'current' : ''} ${isMax ? 'max' : ''} ${isMin ? 'min' : ''}`}>
                                        <div className='manual-trader__freq-bar-wrap'>
                                            <div className='manual-trader__freq-bar'
                                                style={{
                                                    height: `${Math.max(4, pct * 1.8)}px`,
                                                    background: DIGIT_COLORS[d],
                                                    opacity: isCur ? 1 : 0.7,
                                                }} />
                                        </div>
                                        <div className='manual-trader__freq-digit'
                                            style={{ color: DIGIT_COLORS[d] }}>
                                            {d}
                                        </div>
                                        <div className='manual-trader__freq-pct'>{pct.toFixed(1)}%</div>
                                        {isMax && <div className='manual-trader__freq-badge max'>▲ HOT</div>}
                                        {isMin && <div className='manual-trader__freq-badge min'>▼ COLD</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Recent digit history */}
                    <div className='manual-trader__history-card'>
                        <div className='manual-trader__freq-title'>Recent Digits</div>
                        <div className='manual-trader__digit-stream'>
                            {digitHistory.slice(0, 30).map((d, i) => (
                                <span key={i}
                                    className={`manual-trader__digit-chip ${i === 0 ? 'latest' : ''}`}
                                    style={{ background: DIGIT_COLORS[d] }}>
                                    {d}
                                </span>
                            ))}
                            {digitHistory.length === 0 && (
                                <span className='manual-trader__stream-empty'>Waiting for ticks…</span>
                            )}
                        </div>
                    </div>

                    {/* Open Positions */}
                    {openPositions.length > 0 && (
                        <div className='manual-trader__positions-card'>
                            <div className='manual-trader__pos-header'>
                                <span>Open Contracts</span>
                                <span className='manual-trader__pos-count'>{openPositions.length}</span>
                            </div>
                            {openPositions.map(p => (
                                <div key={p.id} className='manual-trader__pos-row open'>
                                    <span className='manual-trader__pos-sym'>{p.symbol}</span>
                                    <span className='manual-trader__pos-type'>{p.type}</span>
                                    <span>{fmt(p.stake)}</span>
                                    <div className='manual-trader__pos-progress'>
                                        <div style={{ width: `${(p.tick / p.duration) * 100}%` }} />
                                    </div>
                                    <span className='manual-trader__pos-tick'>{p.tick}/{p.duration}T</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Closed Positions */}
                    {closedPositions.length > 0 && (
                        <div className='manual-trader__positions-card'>
                            <div className='manual-trader__pos-header'>
                                <span>Closed Contracts</span>
                                <span className='manual-trader__pos-count'>{closedPositions.length}</span>
                                <button className='manual-trader__clear-btn'
                                    onClick={() => setPositions(p => p.filter(x => x.status === 'open'))}>
                                    Clear
                                </button>
                            </div>
                            {closedPositions.slice(0, 15).map(p => (
                                <div key={p.id} className={`manual-trader__pos-row ${p.status}`}>
                                    <span className='manual-trader__pos-sym'>{p.symbol}</span>
                                    <span className='manual-trader__pos-type'>{p.type}</span>
                                    <span>{fmt(p.stake)}</span>
                                    {p.entry && <span className='manual-trader__pos-entry'>In: {p.entry}</span>}
                                    {p.exit  && <span className='manual-trader__pos-exit'>Out: {p.exit}</span>}
                                    <span className={`manual-trader__pos-badge ${p.status}`}>
                                        {p.status === 'won' ? '✓ WON' : '✗ LOST'}
                                    </span>
                                    <span className={`manual-trader__pos-profit ${p.profit >= 0 ? 'pos' : 'neg'}`}>
                                        {fmtProfit(p.profit)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManualTrader;
