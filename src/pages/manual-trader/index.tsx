// @ts-nocheck
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { applyCommission } from '@/utils/commission';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import './manual-trader.scss';

/* ─── Markets ─── */
const ALL_MARKETS = [
    { group: 'Volatility 1s', options: [
        { label: 'Volatility 10 (1s) Index',  value: '1HZ10V'   },
        { label: 'Volatility 25 (1s) Index',  value: '1HZ25V'   },
        { label: 'Volatility 50 (1s) Index',  value: '1HZ50V'   },
        { label: 'Volatility 75 (1s) Index',  value: '1HZ75V'   },
        { label: 'Volatility 100 (1s) Index', value: '1HZ100V'  },
    ]},
    { group: 'Volatility', options: [
        { label: 'Volatility 10 Index',  value: 'R_10'  },
        { label: 'Volatility 25 Index',  value: 'R_25'  },
        { label: 'Volatility 50 Index',  value: 'R_50'  },
        { label: 'Volatility 75 Index',  value: 'R_75'  },
        { label: 'Volatility 100 Index', value: 'R_100' },
    ]},
    { group: 'Jump', options: [
        { label: 'Jump 10 Index',  value: 'JD10'  },
        { label: 'Jump 25 Index',  value: 'JD25'  },
        { label: 'Jump 50 Index',  value: 'JD50'  },
        { label: 'Jump 75 Index',  value: 'JD75'  },
        { label: 'Jump 100 Index', value: 'JD100' },
    ]},
    { group: 'Boom', options: [
        { label: 'Boom 300 Index',  value: 'BOOM300N' },
        { label: 'Boom 500 Index',  value: 'BOOM500'  },
        { label: 'Boom 1000 Index', value: 'BOOM1000' },
    ]},
    { group: 'Crash', options: [
        { label: 'Crash 300 Index',  value: 'CRASH300N' },
        { label: 'Crash 500 Index',  value: 'CRASH500'  },
        { label: 'Crash 1000 Index', value: 'CRASH1000' },
    ]},
    { group: 'Step', options: [
        { label: 'Step Index', value: 'STPX' },
    ]},
    { group: 'Range Break', options: [
        { label: 'Range Break 100 Index', value: 'RDBULL' },
        { label: 'Range Break 200 Index', value: 'RDBEAR' },
    ]},
];

const ALL_SYMBOLS_FLAT = ALL_MARKETS.flatMap(g => g.options);

/* ─── Contract Types ─── */
const CONTRACT_TYPES = [
    {
        id: 'over_under', label: 'Over/Under', icon: '🎯', hasBarrier: true,
        types: [
            { label: 'Over',  type: 'DIGITOVER',  color: '#22c55e', icon: '▲' },
            { label: 'Under', type: 'DIGITUNDER', color: '#ef4444', icon: '▼' },
        ],
    },
    {
        id: 'even_odd', label: 'Even/Odd', icon: '⚖️', hasBarrier: false,
        types: [
            { label: 'Even', type: 'DIGITEVEN', color: '#3b82f6', icon: '2' },
            { label: 'Odd',  type: 'DIGITODD',  color: '#8b5cf6', icon: '1' },
        ],
    },
    {
        id: 'match_differ', label: 'Match/Differ', icon: '🔢', hasBarrier: true,
        types: [
            { label: 'Matches', type: 'DIGITMATCH', color: '#f59e0b', icon: '=' },
            { label: 'Differs', type: 'DIGITDIFF',  color: '#06b6d4', icon: '≠' },
        ],
    },
    {
        id: 'rise_fall', label: 'Rise/Fall', icon: '📈', hasBarrier: false,
        types: [
            { label: 'Rise', type: 'CALL', color: '#22c55e', icon: '↑' },
            { label: 'Fall', type: 'PUT',  color: '#ef4444', icon: '↓' },
        ],
    },
    {
        id: 'touch', label: 'Touch/No Touch', icon: '👆', hasBarrier: true,
        types: [
            { label: 'Touch',    type: 'ONETOUCH', color: '#22c55e', icon: '⟳' },
            { label: 'No Touch', type: 'NOTOUCH',  color: '#ef4444', icon: '⊘' },
        ],
    },
    {
        id: 'higher_lower', label: 'Higher/Lower', icon: '⬆', hasBarrier: false,
        types: [
            { label: 'Higher', type: 'CALL_SPREAD', color: '#22c55e', icon: '⬆' },
            { label: 'Lower',  type: 'PUT_SPREAD',  color: '#ef4444', icon: '⬇' },
        ],
    },
];

const TICK_DURATIONS = [1, 2, 3, 5, 10];
const HISTORY_SIZE   = 1000;

function getLastDigit(q: number) {
    const s = q.toFixed(2).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

function getDigitCircleColors(pcts: number[]): string[] {
    const nonZero = pcts.filter(p => p > 0);
    if (nonZero.length === 0) return new Array(10).fill('#94a3b8');
    const uniqueSorted = [...new Set(pcts)].filter(p => p > 0).sort((a, b) => b - a);
    const cm: Record<string, string> = {};
    if (uniqueSorted.length >= 2) cm[String(uniqueSorted[uniqueSorted.length - 2])] = '#eab308';
    if (uniqueSorted.length >= 1) cm[String(uniqueSorted[uniqueSorted.length - 1])] = '#ef4444';
    if (uniqueSorted.length >= 2) cm[String(uniqueSorted[1])] = '#3b82f6';
    if (uniqueSorted.length >= 1) cm[String(uniqueSorted[0])] = '#22c55e';
    return pcts.map(p => (p > 0 ? (cm[String(p)] ?? '#94a3b8') : '#94a3b8'));
}

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

/* ─── Rich SVG Price Chart ─── */
const PriceChart: React.FC<{ prices: number[]; currentPrice: number | null }> = ({ prices, currentPrice }) => {
    const W = 800, H = 210, PAD_L = 6, PAD_R = 72, PAD_T = 12, PAD_B = 24;
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;

    if (prices.length < 2) {
        return (
            <div className='mt-chart-empty'>
                <span>📡 Waiting for price data…</span>
            </div>
        );
    }

    const pMin = Math.min(...prices), pMax = Math.max(...prices);
    const range = pMax - pMin || 0.001;
    const padV  = range * 0.12;
    const yMin  = pMin - padV, yMax = pMax + padV;
    const yRange = yMax - yMin;

    const px = (i: number) => PAD_L + (i / (prices.length - 1)) * innerW;
    const py = (p: number)  => PAD_T + (1 - (p - yMin) / yRange) * innerH;

    const pts = prices.map((p, i) => ({ x: px(i), y: py(p) }));
    const polyPts = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaD = `M${pts[0].x.toFixed(1)},${(PAD_T + innerH).toFixed(1)} ` +
        pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
        ` L${pts[pts.length - 1].x.toFixed(1)},${(PAD_T + innerH).toFixed(1)} Z`;

    const lastX = pts[pts.length - 1].x;
    const lastY = pts[pts.length - 1].y;
    const curY  = currentPrice != null ? py(currentPrice) : lastY;

    // Y-axis grid (5 levels)
    const gridN = 5;
    const gridLevels = Array.from({ length: gridN }, (_, i) => {
        const frac  = i / (gridN - 1);
        const price = yMax - frac * yRange;
        const y     = PAD_T + frac * innerH;
        return { y, price };
    });

    // Time axis labels (5 points)
    const timeLabels = [0, 0.25, 0.5, 0.75, 1].map(frac => ({
        x: PAD_L + frac * innerW,
        label: `-${Math.round((1 - frac) * (prices.length - 1))}`,
    }));

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className='mt-chart__svg' preserveAspectRatio='none'>
            <defs>
                <linearGradient id='mtChartGrad' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%'   stopColor='#3b82f6' stopOpacity='0.32' />
                    <stop offset='100%' stopColor='#3b82f6' stopOpacity='0.02' />
                </linearGradient>
                <clipPath id='mtChartClip'>
                    <rect x={PAD_L} y={PAD_T} width={innerW} height={innerH} />
                </clipPath>
            </defs>

            {/* Horizontal gridlines + Y labels */}
            {gridLevels.map(({ y, price }, i) => (
                <g key={i}>
                    <line x1={PAD_L} y1={y.toFixed(1)} x2={(PAD_L + innerW).toFixed(1)} y2={y.toFixed(1)}
                        stroke='rgba(255,255,255,0.06)' strokeWidth='1' />
                    <text x={(PAD_L + innerW + 5).toFixed(1)} y={(y + 3.5).toFixed(1)}
                        fill='rgba(148,163,184,0.65)' fontSize='9' textAnchor='start' fontFamily='monospace'>
                        {price.toFixed(2)}
                    </text>
                </g>
            ))}

            {/* Chart content clipped */}
            <g clipPath='url(#mtChartClip)'>
                <path d={areaD} fill='url(#mtChartGrad)' />
                <polyline points={polyPts} fill='none' stroke='#3b82f6' strokeWidth='1.8' strokeLinejoin='round' />
                <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r='3.5' fill='#60a5fa' stroke='#fff' strokeWidth='1.5' />
            </g>

            {/* Current price dotted line */}
            <line x1={PAD_L} y1={curY.toFixed(1)} x2={(PAD_L + innerW).toFixed(1)} y2={curY.toFixed(1)}
                stroke='#60a5fa' strokeWidth='1' strokeDasharray='4 3' opacity='0.8' />
            <rect x={(PAD_L + innerW + 1).toFixed(1)} y={(curY - 9).toFixed(1)}
                width={(PAD_R - 4).toFixed(1)} height='18' rx='3' fill='#2563eb' opacity='0.95' />
            <text x={(PAD_L + innerW + PAD_R / 2 - 1).toFixed(1)} y={(curY + 4.5).toFixed(1)}
                fill='#fff' fontSize='10' textAnchor='middle' fontFamily='monospace' fontWeight='700'>
                {(currentPrice ?? prices[prices.length - 1]).toFixed(2)}
            </text>

            {/* Time axis */}
            {timeLabels.map(({ x, label }, i) => (
                <text key={i} x={x.toFixed(1)} y={(H - 5).toFixed(1)}
                    fill='rgba(100,116,139,0.55)' fontSize='8' textAnchor='middle' fontFamily='monospace'>
                    {label}
                </text>
            ))}
        </svg>
    );
};

/* ─── Digit Circles Row ─── */
interface TradeState {
    ticks: { digit: number; order: number }[];
    duration: number;
    settled: boolean;
    result: 'won' | 'lost' | null;
    profit: number;
    exitDigit: number | null;
}

const DigitRow: React.FC<{
    pcts: number[];
    counts: number[];
    currentDigit: number | null;
    tradeState: TradeState | null;
    totalTicks: number;
    historyReady: boolean;
}> = ({ pcts, counts, currentDigit, tradeState, totalTicks, historyReady }) => {
    const colors = useMemo(() => getDigitCircleColors(pcts), [pcts]);

    return (
        <div className='mt-circles'>
            <div className='mt-circles__hdr'>
                <span className='mt-circles__label'>Last Digit Stats</span>
                <span className='mt-circles__ticks'>
                    {historyReady
                        ? `${Math.min(totalTicks, HISTORY_SIZE).toLocaleString()} / ${HISTORY_SIZE.toLocaleString()} ticks`
                        : 'Loading history…'}
                </span>
                {tradeState && !tradeState.settled && (
                    <span className='mt-circles__trade-ind'>
                        ● Tick {tradeState.ticks.length}/{tradeState.duration}
                    </span>
                )}
            </div>

            <div className='mt-circles__row'>
                {Array.from({ length: 10 }, (_, d) => {
                    const isCurrent   = d === currentDigit;
                    const color       = colors[d];
                    const pct         = pcts[d];
                    const tradeCount  = tradeState?.ticks.filter(t => t.digit === d).length ?? 0;
                    const isExit      = tradeState?.exitDigit === d && tradeState?.settled;
                    const tradeResult = tradeState?.result;

                    let borderColor = color;
                    let glow        = 'none';
                    if (isExit && tradeResult === 'won') {
                        borderColor = '#22c55e';
                        glow = '0 0 0 3px #22c55e88, 0 0 18px #22c55e55';
                    } else if (isExit && tradeResult === 'lost') {
                        borderColor = '#ef4444';
                        glow = '0 0 0 3px #ef444488, 0 0 18px #ef444455';
                    } else if (isCurrent) {
                        glow = `0 0 0 2px ${color}66`;
                    }

                    return (
                        <div key={d} className={`mt-circle-cell ${isCurrent ? 'is-current' : ''}`}>
                            {/* Moving triangle */}
                            <div className={`mt-tri ${isCurrent ? 'mt-tri--on' : ''}`}>▼</div>

                            {/* White circle */}
                            <div
                                className={`mt-circle ${isExit ? `mt-circle--${tradeResult}` : ''}`}
                                style={{
                                    borderColor,
                                    boxShadow: glow !== 'none' ? glow : undefined,
                                    transform: isCurrent ? 'scale(1.1)' : 'scale(1)',
                                }}
                            >
                                <span className='mt-circle__num'>{d}</span>
                                <span className='mt-circle__pct'>{pct.toFixed(1)}%</span>
                                <span className='mt-circle__cnt'>{counts[d]}</span>
                                {tradeCount > 0 && (
                                    <span className='mt-circle__trade-dot'
                                        style={{
                                            background: isExit && tradeResult === 'won' ? '#22c55e'
                                                : isExit && tradeResult === 'lost' ? '#ef4444'
                                                : '#3b82f6',
                                        }}>
                                        {tradeCount}
                                    </span>
                                )}
                            </div>

                            {/* Win/loss amount beneath exit digit */}
                            {isExit && tradeResult && (
                                <div className={`mt-circle__result mt-circle__result--${tradeResult}`}>
                                    {tradeResult === 'won'
                                        ? `+${(tradeState?.profit ?? 0).toFixed(2)}`
                                        : `${(tradeState?.profit ?? 0).toFixed(2)}`}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className='mt-circles__legend'>
                <span style={{ color: '#22c55e' }}>● Highest</span>
                <span style={{ color: '#3b82f6' }}>● 2nd High</span>
                <span style={{ color: '#ef4444' }}>● Lowest</span>
                <span style={{ color: '#eab308' }}>● 2nd Low</span>
                <span style={{ color: '#94a3b8' }}>● Others</span>
                <span style={{ color: '#ef4444' }}>▼ Current</span>
            </div>
        </div>
    );
};

/* ─── ManualTrader Component ─── */
const ManualTrader: React.FC = () => {
    const { buyContract, subscribeTicks, connected, authorized, balance, currency, send } = useDerivTrade();
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    const [symbolValue, setSymbolValue]   = useState('1HZ100V');
    const [ctIdx, setCtIdx]               = useState(0); // contract type index
    const [duration, setDuration]         = useState(5);
    const [barrier, setBarrier]           = useState(4);
    const [stake, setStake]               = useState('1.00');
    const [pnl, setPnl]                   = useState(0);
    const [positions, setPositions]       = useState<any[]>([]);
    const [payouts, setPayouts]           = useState<Record<string, number | null>>({});
    const [payoutLoading, setPayoutLoading] = useState(false);

    const [currentDigit, setCurrentDigit] = useState<number | null>(null);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceHistory, setPriceHistory] = useState<number[]>([]);
    const [digitHistory, setDigitHistory] = useState<number[]>([]);
    const [historyReady, setHistoryReady] = useState(false);

    const [tradeState, setTradeState] = useState<TradeState | null>(null);
    const tradeActiveRef = useRef(false);
    const tradeDurRef    = useRef(0);
    const tradeTicksRef  = useRef<{ digit: number; order: number }[]>([]);

    const proposalTimer = useRef<any>(null);
    const idRef = useRef(0);

    const ctDef  = CONTRACT_TYPES[ctIdx];
    const symbol = useMemo(() => ALL_SYMBOLS_FLAT.find(s => s.value === symbolValue) ?? ALL_SYMBOLS_FLAT[0], [symbolValue]);

    /* Load 1000-tick history when symbol changes */
    useEffect(() => {
        setHistoryReady(false);
        setDigitHistory([]);
        setPriceHistory([]);
        setCurrentDigit(null);
        setCurrentPrice(null);
        if (!authorized || !send) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await send({ ticks_history: symbolValue, count: 1000, end: 'latest', style: 'ticks' });
                if (cancelled) return;
                const prices: number[] = res?.history?.prices || [];
                setDigitHistory(prices.map(getLastDigit));
                setPriceHistory(prices.slice(-120));
                setHistoryReady(true);
            } catch { setHistoryReady(true); }
        })();
        return () => { cancelled = true; };
    }, [symbolValue, authorized, send]);

    /* Live tick subscription */
    useEffect(() => {
        const unsub = subscribeTicks(symbolValue, tick => {
            setCurrentDigit(tick.digit);
            setCurrentPrice(tick.quote);
            setPriceHistory(prev => [...prev.slice(-119), tick.quote]);
            setDigitHistory(prev => [...prev, tick.digit].slice(-HISTORY_SIZE));

            if (tradeActiveRef.current && tradeTicksRef.current.length < tradeDurRef.current) {
                const entry = { digit: tick.digit, order: tradeTicksRef.current.length + 1 };
                tradeTicksRef.current = [...tradeTicksRef.current, entry];
                setTradeState(prev => prev ? { ...prev, ticks: [...tradeTicksRef.current] } : prev);
            }
        });
        return unsub;
    }, [symbolValue, subscribeTicks]);

    /* Computed stats */
    const pcts = useMemo(() => {
        const total = digitHistory.length;
        if (total === 0) return new Array(10).fill(0);
        const c = new Array(10).fill(0);
        digitHistory.forEach(d => c[d]++);
        return c.map(v => (v / total) * 100);
    }, [digitHistory]);

    const digitCounts = useMemo(() => {
        const c = new Array(10).fill(0);
        digitHistory.forEach(d => c[d]++);
        return c;
    }, [digitHistory]);

    /* Fetch proposals */
    useEffect(() => {
        if (proposalTimer.current) clearTimeout(proposalTimer.current);
        proposalTimer.current = setTimeout(async () => {
            if (!authorized || !send) { setPayouts({}); return; }
            const s = parseFloat(stake);
            if (isNaN(s) || s < 0.35) { setPayouts({}); return; }
            setPayoutLoading(true);
            try {
                const results: Record<string, number | null> = {};
                await Promise.all(ctDef.types.map(async def => {
                    try {
                        const req: any = {
                            proposal: 1, amount: s, basis: 'stake',
                            contract_type: def.type, currency: currency || 'USD',
                            duration, duration_unit: 't', symbol: symbolValue,
                        };
                        if (ctDef.hasBarrier) req.barrier = String(barrier);
                        const res = await send(req);
                        results[def.type] = res?.proposal?.payout ? parseFloat(res.proposal.payout) : null;
                    } catch { results[def.type] = null; }
                }));
                setPayouts(results);
            } catch { setPayouts({}); }
            finally { setPayoutLoading(false); }
        }, 500);
        return () => { if (proposalTimer.current) clearTimeout(proposalTimer.current); };
    }, [stake, duration, symbolValue, ctDef, barrier, authorized, currency, send]);

    /* Execute trade */
    const buy = useCallback(async (def: typeof ctDef.types[0]) => {
        if (!authorized) return;
        const s = parseFloat(stake);
        if (isNaN(s) || s < 0.35) return;

        const tradeId = idRef.current++;
        tradeTicksRef.current = [];
        tradeActiveRef.current = true;
        tradeDurRef.current = duration;
        setTradeState({ ticks: [], duration, settled: false, result: null, profit: 0, exitDigit: null });

        const pos = {
            id: tradeId, symbol: symbol.label, type: def.label,
            contractType: def.type, stake: s, status: 'open',
            profit: 0, tick: 0, duration, time: Date.now(),
        };
        setPositions(p => [pos, ...p.slice(0, 49)]);

        let t = 0;
        const iv = setInterval(() => {
            t++;
            setPositions(p => p.map(x => x.id === tradeId && x.status === 'open' ? { ...x, tick: Math.min(t, duration) } : x));
            if (t >= duration) clearInterval(iv);
        }, 1000);

        try {
            await buyContract(
                {
                    symbol: symbolValue, contract_type: def.type as any,
                    duration, duration_unit: 't', stake: s,
                    ...(ctDef.hasBarrier ? { barrier } : {}),
                },
                c => {
                    clearInterval(iv);
                    const profit    = applyCommission(c.profit);
                    const exitSpot  = c.exit_spot;
                    const exitDigit = exitSpot ? getLastDigit(Number(exitSpot)) : null;
                    tradeActiveRef.current = false;
                    setTradeState(prev => prev ? {
                        ...prev, settled: true,
                        result: c.status === 'won' ? 'won' : 'lost',
                        profit, exitDigit,
                    } : null);
                    setPositions(p => p.map(x => x.id === tradeId
                        ? { ...x, status: c.status, profit, entry: c.entry_spot, exit: c.exit_spot }
                        : x));
                    setPnl(prev => prev + profit);
                    setTimeout(() => setTradeState(null), 6000);
                }
            );
        } catch {
            clearInterval(iv);
            tradeActiveRef.current = false;
            setTradeState(null);
            setPositions(p => p.filter(x => x.id !== tradeId));
        }
    }, [authorized, stake, symbolValue, duration, barrier, ctDef, symbol, buyContract]);

    const fmt       = (usd: number) => `${fromUsd(usd).toFixed(2)} ${displayCur}`;
    const stakeNum  = parseFloat(stake) || 0;
    const openPos   = positions.filter(p => p.status === 'open');
    const closedPos = positions.filter(p => p.status !== 'open');

    return (
        <div className='mt-page'>
            {/* ─── Topbar ─── */}
            <div className='mt-topbar'>
                <div className='mt-topbar__left'>
                    <span className={`mt-conn ${connected ? 'on' : 'off'}`}>
                        {connected ? '● LIVE' : '○ OFF'}
                    </span>

                    {/* Market dropdown */}
                    <select className='mt-market-sel' value={symbolValue}
                        onChange={e => setSymbolValue(e.target.value)}>
                        {ALL_MARKETS.map(g => (
                            <optgroup key={g.group} label={g.group}>
                                {g.options.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>

                    {currentPrice != null && (
                        <span className='mt-topbar__price'>{currentPrice.toFixed(5)}</span>
                    )}
                    <AccountBadge />
                </div>
                <div className='mt-topbar__right'>
                    {balance !== null && (
                        <div className='mt-topbar__stat'>
                            <span>Balance</span>
                            <strong>{fmt(balance)}</strong>
                        </div>
                    )}
                    <div className={`mt-topbar__stat ${pnl >= 0 ? 'pos' : 'neg'}`}>
                        <span>Session P/L</span>
                        <strong>{pnl >= 0 ? '+' : ''}{fmt(pnl)}</strong>
                    </div>
                </div>
            </div>

            {/* ─── Body ─── */}
            <div className='mt-body'>
                {/* ── Chart + circles column ── */}
                <div className='mt-chart-col'>
                    {/* Chart card */}
                    <div className='mt-chart-card'>
                        <div className='mt-chart-card__hdr'>
                            <span className='mt-chart-card__sym'>{symbol.label}</span>
                            {currentPrice != null && (
                                <span className='mt-chart-card__px'>{currentPrice.toFixed(5)}</span>
                            )}
                            {currentDigit != null && (
                                <span className='mt-chart-card__dg'>Last digit: <b>{currentDigit}</b></span>
                            )}
                        </div>
                        <PriceChart prices={priceHistory} currentPrice={currentPrice} />
                    </div>

                    {/* Digit circles */}
                    <DigitRow
                        pcts={pcts}
                        counts={digitCounts}
                        currentDigit={currentDigit}
                        tradeState={tradeState}
                        totalTicks={digitHistory.length}
                        historyReady={historyReady}
                    />

                    {/* Recent digit stream */}
                    <div className='mt-stream-card'>
                        <div className='mt-stream-card__label'>Recent Digits</div>
                        <div className='mt-stream'>
                            {digitHistory.slice(-40).reverse().map((d, i) => {
                                const c = getDigitCircleColors(pcts)[d];
                                return (
                                    <span key={i}
                                        className={`mt-chip ${i === 0 ? 'latest' : ''}`}
                                        style={{
                                            background: c === '#94a3b8' ? 'rgba(148,163,184,0.15)' : `${c}22`,
                                            color: c,
                                            border: `1px solid ${c}44`,
                                        }}>
                                        {d}
                                    </span>
                                );
                            })}
                            {digitHistory.length === 0 && (
                                <span className='mt-stream__empty'>Waiting for ticks…</span>
                            )}
                        </div>
                    </div>

                    {/* Positions */}
                    {(openPos.length > 0 || closedPos.length > 0) && (
                        <div className='mt-positions'>
                            <div className='mt-positions__hdr'>
                                Contracts
                                {closedPos.length > 0 && (
                                    <button className='mt-clear-btn'
                                        onClick={() => setPositions(p => p.filter(x => x.status === 'open'))}>
                                        Clear
                                    </button>
                                )}
                            </div>
                            {openPos.map(p => (
                                <div key={p.id} className='mt-pos-row open'>
                                    <span className='mt-pos-sym'>{p.symbol}</span>
                                    <span className='mt-pos-type'>{p.type}</span>
                                    <span className='mt-pos-stake'>{fmt(p.stake)}</span>
                                    <div className='mt-pos-prog'>
                                        <div style={{ width: `${(p.tick / p.duration) * 100}%` }} />
                                    </div>
                                    <span className='mt-pos-tick'>{p.tick}/{p.duration}T</span>
                                </div>
                            ))}
                            {closedPos.slice(0, 15).map(p => (
                                <div key={p.id} className={`mt-pos-row ${p.status}`}>
                                    <span className='mt-pos-sym'>{p.symbol}</span>
                                    <span className='mt-pos-type'>{p.type}</span>
                                    <span className='mt-pos-stake'>{fmt(p.stake)}</span>
                                    {p.entry && <span className='mt-pos-price'>In: {p.entry}</span>}
                                    {p.exit  && <span className='mt-pos-price'>Out: {p.exit}</span>}
                                    <span className={`mt-pos-badge ${p.status}`}>
                                        {p.status === 'won' ? '✓ WIN' : '✗ LOSS'}
                                    </span>
                                    <span className={`mt-pos-profit ${p.profit >= 0 ? 'pos' : 'neg'}`}>
                                        {p.profit >= 0 ? '+' : ''}{fmt(p.profit)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Right Trade Panel ── */}
                <div className='mt-trade-panel'>
                    {/* Contract type navigator */}
                    <div className='mtp-type-nav'>
                        <button className='mtp-type-nav__arr'
                            onClick={() => setCtIdx(i => (i - 1 + CONTRACT_TYPES.length) % CONTRACT_TYPES.length)}>
                            ‹
                        </button>
                        <div className='mtp-type-nav__center'>
                            <span className='mtp-type-nav__icon'>{ctDef.icon}</span>
                            <span className='mtp-type-nav__name'>{ctDef.label}</span>
                        </div>
                        <button className='mtp-type-nav__arr'
                            onClick={() => setCtIdx(i => (i + 1) % CONTRACT_TYPES.length)}>
                            ›
                        </button>
                    </div>

                    {/* All contract types dropdown */}
                    <select className='mtp-ct-select' value={ctIdx}
                        onChange={e => setCtIdx(Number(e.target.value))}>
                        {CONTRACT_TYPES.map((ct, i) => (
                            <option key={ct.id} value={i}>{ct.icon} {ct.label}</option>
                        ))}
                    </select>

                    {/* Duration */}
                    <div className='mtp-section'>
                        <div className='mtp-section__label'>Ticks</div>
                        <div className='mtp-dur-row'>
                            {TICK_DURATIONS.map(v => (
                                <button key={v}
                                    className={`mtp-dur-btn ${duration === v ? 'active' : ''}`}
                                    onClick={() => setDuration(v)}>
                                    {v}
                                </button>
                            ))}
                            <input className='mtp-dur-inp' type='number' min='1' max='10'
                                value={duration}
                                onChange={e => setDuration(Math.max(1, Math.min(10, +e.target.value)))} />
                        </div>
                        <div className='mtp-dur-label'>{duration} Ticks</div>
                    </div>

                    {/* Digit prediction */}
                    {ctDef.hasBarrier && (
                        <div className='mtp-section'>
                            <div className='mtp-section__label'>Last Digit Prediction</div>
                            <div className='mtp-digit-grid'>
                                {[0, 1, 2, 3, 4].map(d => (
                                    <button key={d}
                                        className={`mtp-dg-btn ${barrier === d ? 'active' : ''}`}
                                        onClick={() => setBarrier(d)}>
                                        {d}
                                    </button>
                                ))}
                            </div>
                            <div className='mtp-digit-grid'>
                                {[5, 6, 7, 8, 9].map(d => (
                                    <button key={d}
                                        className={`mtp-dg-btn ${barrier === d ? 'active' : ''}`}
                                        onClick={() => setBarrier(d)}>
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stake */}
                    <div className='mtp-section'>
                        <div className='mtp-section__label'>Stake</div>
                        <div className='mtp-stake-row'>
                            <button className='mtp-stake-adj'
                                onClick={() => setStake(s => Math.max(0.35, parseFloat(s) - 0.5).toFixed(2))}>
                                −
                            </button>
                            <div className='mtp-stake-mid'>
                                <input className='mtp-stake-inp' type='number' min='0.35' step='0.01'
                                    value={stake}
                                    onChange={e => setStake(e.target.value)} />
                                <span className='mtp-stake-cur'>{currency || 'USD'}</span>
                            </div>
                            <button className='mtp-stake-adj'
                                onClick={() => setStake(s => (parseFloat(s) + 0.5).toFixed(2))}>
                                +
                            </button>
                        </div>
                    </div>

                    {!authorized && (
                        <div className='mtp-auth-warn'>⚠ Connecting to account…</div>
                    )}

                    {/* Buy buttons — one block per type */}
                    {ctDef.types.map((def, i) => {
                        const po  = payouts[def.type];
                        const pct = po != null && stakeNum > 0
                            ? ((po / stakeNum) * 100).toFixed(1)
                            : null;
                        return (
                            <div key={def.type} className='mtp-buy-block'>
                                <div className='mtp-payout-row'>
                                    <span className='mtp-payout-lbl'>Payout</span>
                                    <span className='mtp-payout-val'>
                                        {payoutLoading ? '…' : po != null ? fmt(po) : '—'}
                                        <span className='mtp-payout-info'> ℹ</span>
                                    </span>
                                </div>
                                <button
                                    className={`mtp-buy-btn ${i === 0 ? 'mtp-buy-btn--a' : 'mtp-buy-btn--b'}`}
                                    style={{ '--bc': def.color } as React.CSSProperties}
                                    onClick={() => buy(def)}
                                    disabled={!authorized}>
                                    <span className='mtp-buy-btn__icon'>{def.icon}</span>
                                    <span className='mtp-buy-btn__label'>{def.label}</span>
                                    {pct != null && (
                                        <span className='mtp-buy-btn__pct'>{pct}%</span>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ManualTrader;
