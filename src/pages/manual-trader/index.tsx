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

const HISTORY_SIZE = 1000; // ticks to track for stats

function getLastDigit(q: number) {
    const s = q.toFixed(2).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

/** Compute circle colors based on rank in 1000 ticks.
 *  green=highest, blue=2nd-highest, red=lowest, yellow=2nd-lowest
 *  Same % → same color. Others → white.
 */
function getDigitCircleColors(pcts: number[]): string[] {
    const nonZero = pcts.filter(p => p > 0);
    if (nonZero.length === 0) return new Array(10).fill('white');

    const uniqueSorted = [...new Set(pcts)].filter(p => p > 0).sort((a, b) => b - a);
    const colorMap: Record<string, string> = {};

    // Assign from lowest priority → highest (higher priority overwrites)
    if (uniqueSorted.length >= 2) colorMap[String(uniqueSorted[uniqueSorted.length - 2])] = '#eab308'; // yellow 2nd lowest
    if (uniqueSorted.length >= 1) colorMap[String(uniqueSorted[uniqueSorted.length - 1])] = '#ef4444'; // red lowest
    if (uniqueSorted.length >= 2) colorMap[String(uniqueSorted[1])] = '#3b82f6'; // blue 2nd highest
    if (uniqueSorted.length >= 1) colorMap[String(uniqueSorted[0])] = '#22c55e'; // green highest

    return pcts.map(p => (p > 0 ? (colorMap[String(p)] ?? 'white') : 'white'));
}

interface Position {
    id: number; symbol: string; type: string; contractType: string;
    stake: number; status: 'open'|'won'|'lost'; profit: number;
    tick: number; duration: number; entry?: number; exit?: number; time: number;
}

/* ─── SVG Sparkline ─── */
const PriceChart: React.FC<{ prices: number[]; currentDigit: number | null }> = ({ prices, currentDigit }) => {
    if (prices.length < 2) {
        return (
            <div className='mt-spark__empty'>
                <span>Waiting for price data…</span>
            </div>
        );
    }
    const W = 600, H = 120, PAD = 8;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const pts = prices.map((p, i) => {
        const x = PAD + (i / (prices.length - 1)) * (W - PAD * 2);
        const y = H - PAD - ((p - min) / range) * (H - PAD * 2);
        return `${x},${y}`;
    });
    const lastX = PAD + ((prices.length - 1) / (prices.length - 1)) * (W - PAD * 2);
    const lastY = H - PAD - ((prices[prices.length - 1] - min) / range) * (H - PAD * 2);
    const lastPrice = prices[prices.length - 1];

    return (
        <div className='mt-spark'>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio='none' className='mt-spark__svg'>
                <defs>
                    <linearGradient id='sparkGrad' x1='0' y1='0' x2='0' y2='1'>
                        <stop offset='0%' stopColor='#3b82f6' stopOpacity='0.35' />
                        <stop offset='100%' stopColor='#3b82f6' stopOpacity='0.02' />
                    </linearGradient>
                </defs>
                {/* Fill area */}
                <path
                    d={`M${PAD},${H} L${pts.join(' L')} L${lastX},${H} Z`}
                    fill='url(#sparkGrad)'
                />
                {/* Line */}
                <polyline
                    points={pts.join(' ')}
                    fill='none'
                    stroke='#3b82f6'
                    strokeWidth='1.5'
                    strokeLinejoin='round'
                />
                {/* Last point dot */}
                <circle cx={lastX} cy={lastY} r='3.5' fill='#22c55e' stroke='#fff' strokeWidth='1.5' />
            </svg>
            <div className='mt-spark__info'>
                <span className='mt-spark__price'>{lastPrice.toFixed(5)}</span>
                {currentDigit !== null && (
                    <span className='mt-spark__digit-badge'>
                        Last digit: <strong>{currentDigit}</strong>
                    </span>
                )}
                <span className='mt-spark__range'>
                    Range: {min.toFixed(3)} – {max.toFixed(3)}
                </span>
            </div>
        </div>
    );
};

/* ─── Digit Circles with Triangle Indicator ─── */
const DigitCirclesPanel: React.FC<{
    pcts: number[];
    counts: number[];
    totalTicks: number;
    currentDigit: number | null;
    historyReady: boolean;
}> = ({ pcts, counts, totalTicks, currentDigit, historyReady }) => {
    const colors = useMemo(() => getDigitCircleColors(pcts), [pcts]);

    return (
        <div className='mt-dcircles'>
            <div className='mt-dcircles__header'>
                <span className='mt-dcircles__title'>Digit Frequency</span>
                <span className='mt-dcircles__ticks'>{totalTicks >= HISTORY_SIZE ? `${HISTORY_SIZE} ticks` : `${totalTicks} / ${HISTORY_SIZE} ticks`}</span>
                {!historyReady && <span className='mt-dcircles__loading'>Loading…</span>}
            </div>
            <div className='mt-dcircles__grid'>
                {Array.from({ length: 10 }, (_, d) => {
                    const isCurrent = d === currentDigit;
                    const color = colors[d];
                    const pct = pcts[d];
                    const isHighlighted = color !== 'white' && color !== undefined;

                    return (
                        <div key={d} className={`mt-dc__cell ${isCurrent ? 'mt-dc__cell--current' : ''}`}>
                            {/* Triangle indicator */}
                            <div className={`mt-dc__triangle ${isCurrent ? 'mt-dc__triangle--visible' : ''}`}>▼</div>
                            {/* Circle */}
                            <div
                                className={`mt-dc__circle ${isCurrent ? 'mt-dc__circle--current' : ''}`}
                                style={{
                                    borderColor: isCurrent ? color : (isHighlighted ? color : 'rgba(100,120,150,0.3)'),
                                    background: isCurrent
                                        ? (color === 'white' ? 'rgba(255,255,255,0.12)' : `${color}22`)
                                        : (isHighlighted ? `${color}18` : 'rgba(30,40,60,0.4)'),
                                    boxShadow: isCurrent ? `0 0 0 2px ${color === 'white' ? '#ef4444' : color}88, 0 0 14px ${color === 'white' ? '#ef4444' : color}44` : 'none',
                                }}
                            >
                                <span
                                    className='mt-dc__num'
                                    style={{ color: isHighlighted ? color : isCurrent ? '#fff' : 'rgba(200,210,230,0.7)' }}
                                >
                                    {d}
                                </span>
                                <span
                                    className='mt-dc__pct'
                                    style={{ color: isHighlighted ? `${color}cc` : 'rgba(150,165,190,0.7)' }}
                                >
                                    {pct.toFixed(1)}%
                                </span>
                                <span className='mt-dc__count'>{counts[d]}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Color legend */}
            <div className='mt-dcircles__legend'>
                <span className='mt-dcircles__legend-item' style={{ color: '#22c55e' }}>● Highest</span>
                <span className='mt-dcircles__legend-item' style={{ color: '#3b82f6' }}>● 2nd High</span>
                <span className='mt-dcircles__legend-item' style={{ color: '#ef4444' }}>● Lowest</span>
                <span className='mt-dcircles__legend-item' style={{ color: '#eab308' }}>● 2nd Low</span>
                <span className='mt-dcircles__legend-item' style={{ color: '#e2e8f0' }}>● Others</span>
                <span className='mt-dcircles__legend-item' style={{ color: '#ef4444' }}>▼ Current</span>
            </div>
        </div>
    );
};

/* ─── Account Badge ─── */
const AccountBadge: React.FC = () => {
    const [isDemo, setIsDemo] = useState(false);
    useEffect(() => {
        const check = () => {
            const id = localStorage.getItem('active_loginid') || '';
            setIsDemo(id.startsWith('VRTC') || id.startsWith('VR'));
        };
        check();
        window.addEventListener('storage', check);
        return () => window.removeEventListener('storage', check);
    }, []);
    return (
        <span className={`mt-acct-badge ${isDemo ? 'demo' : 'real'}`}>
            {isDemo ? '🔵 DEMO' : '🟢 REAL'}
        </span>
    );
};

/* ─── Component ─── */
const ManualTrader: React.FC = () => {
    const { buyContract, subscribeTicks, connected, authorized, balance, currency, send } = useDerivTrade();
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    // --- Market state ---
    const [symbolValue, setSymbolValue] = useState('R_100');
    const [tabId,  setTabId]   = useState('rise_fall');
    const [typeIdx, setTypeIdx] = useState(0);
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
    const [priceHistory, setPriceHistory] = useState<number[]>([]); // for sparkline (last 60)

    // --- 1000-tick digit stats ---
    const [digitCounts, setDigitCounts] = useState<number[]>(new Array(10).fill(0));
    const [totalTicks, setTotalTicks]   = useState(0);
    const [historyReady, setHistoryReady] = useState(false);
    const [digitHistory, setDigitHistory] = useState<number[]>([]);

    const idRef = useRef(0);
    const proposalTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

    const tab = CONTRACT_TABS.find(t => t.id === tabId) ?? CONTRACT_TABS[0];
    const contractDef = tab.types[Math.min(typeIdx, tab.types.length - 1)];

    const symbol = useMemo(() => ALL_SYMBOLS.find(s => s.value === symbolValue) ?? ALL_SYMBOLS[0], [symbolValue]);

    // Fetch initial 1000 ticks for history
    useEffect(() => {
        setHistoryReady(false);
        setDigitCounts(new Array(10).fill(0));
        setTotalTicks(0);
        setCurrentDigit(null);
        setCurrentPrice(null);
        setPriceHistory([]);
        setDigitHistory([]);

        if (!authorized || !send) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await send({ ticks_history: symbolValue, count: HISTORY_SIZE, end: 'latest', style: 'ticks' });
                if (cancelled) return;
                const prices: number[] = res?.history?.prices || [];
                const counts = new Array(10).fill(0);
                prices.forEach((p: number) => { counts[getLastDigit(p)]++; });
                const digits = prices.map((p: number) => getLastDigit(p));
                setDigitCounts(counts);
                setTotalTicks(prices.length);
                setDigitHistory(digits);
                setPriceHistory(prices.slice(-60));
                setHistoryReady(true);
            } catch {
                setHistoryReady(true); // allow live ticks to accumulate
            }
        })();
        return () => { cancelled = true; };
    }, [symbolValue, authorized, send]);

    // Subscribe to live ticks — accumulate into rolling 1000
    useEffect(() => {
        const unsub = subscribeTicks(symbolValue, tick => {
            setCurrentDigit(tick.digit);
            setCurrentPrice(tick.quote);
            setPriceHistory(prev => [...prev.slice(-59), tick.quote]);
            setDigitHistory(prev => {
                const next = [...prev, tick.digit];
                return next.slice(-HISTORY_SIZE);
            });
            setDigitCounts(prev => {
                const next = [...prev];
                next[tick.digit]++;
                return next;
            });
            setTotalTicks(p => Math.min(p + 1, HISTORY_SIZE));
        });
        return unsub;
    }, [symbolValue, subscribeTicks]);

    // Recompute counts when digitHistory changes (rolling 1000)
    const pcts = useMemo(() => {
        const total = digitHistory.length;
        if (total === 0) return new Array(10).fill(0);
        const counts = new Array(10).fill(0);
        digitHistory.forEach(d => { counts[d]++; });
        return counts.map(c => (c / total) * 100);
    }, [digitHistory]);

    const digitCountsFromHistory = useMemo(() => {
        const counts = new Array(10).fill(0);
        digitHistory.forEach(d => { counts[d]++; });
        return counts;
    }, [digitHistory]);

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
                } else { setPayout(null); }
            } catch { setPayout(null); }
            finally { setPayoutLoading(false); }
        }, 400);
        return () => { if (proposalTimerRef.current) clearTimeout(proposalTimerRef.current); };
    }, [stake, duration, symbolValue, contractDef.type, barrier, tab.hasBarrier, authorized, currency, send]);

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
                    <AccountBadge />
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

                    {/* Barrier/digit */}
                    {tab.hasBarrier && (
                        <div className='manual-trader__section-card'>
                            <label className='manual-trader__sec-label'>Barrier Digit</label>
                            <div className='manual-trader__barrier-row'>
                                {[0,1,2,3,4,5,6,7,8,9].map(d => (
                                    <button key={d}
                                        className={`manual-trader__barrier-btn ${barrier === d ? 'active' : ''}`}
                                        style={barrier === d ? { background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' } : {}}
                                        onClick={() => setBarrier(d)}>
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Payout */}
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
                                {payout != null ? `+${fmt(payout - parseFloat(stake))}` : '—'}
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

                {/* ─── RIGHT — Chart + Digit Analysis ─── */}
                <div className='manual-trader__analysis-col'>

                    {/* Price Chart */}
                    <div className='manual-trader__chart-card'>
                        <div className='manual-trader__chart-header'>
                            <span className='manual-trader__chart-title'>{symbol.label} — Live Price Chart</span>
                            {currentPrice && <span className='manual-trader__chart-price'>{currentPrice.toFixed(5)}</span>}
                        </div>
                        <PriceChart prices={priceHistory} currentDigit={currentDigit} />
                    </div>

                    {/* Digit Circles */}
                    <DigitCirclesPanel
                        pcts={pcts}
                        counts={digitCountsFromHistory}
                        totalTicks={digitHistory.length}
                        currentDigit={currentDigit}
                        historyReady={historyReady}
                    />

                    {/* Recent digit stream */}
                    <div className='manual-trader__history-card'>
                        <div className='manual-trader__freq-title'>Recent Digits</div>
                        <div className='manual-trader__digit-stream'>
                            {digitHistory.slice(-30).reverse().map((d, i) => {
                                const colors = getDigitCircleColors(pcts);
                                const col = colors[d];
                                return (
                                    <span key={i}
                                        className={`manual-trader__digit-chip ${i === 0 ? 'latest' : ''}`}
                                        style={{
                                            background: col === 'white' ? 'rgba(200,210,230,0.15)' : `${col}33`,
                                            color: col === 'white' ? '#e2e8f0' : col,
                                            border: `1px solid ${col === 'white' ? 'rgba(200,210,230,0.2)' : `${col}55`}`,
                                        }}>
                                        {d}
                                    </span>
                                );
                            })}
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
