// @ts-nocheck
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import NumberField from '@/components/number-field';
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
    { group: 'Bear & Bull', options: [
        { label: 'Bear Market Index', value: 'WBEAR' },
        { label: 'Bull Market Index', value: 'WBULL' },
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
        id: 'over_under', label: 'Over/Under', icon: '🎯',
        hasBarrier: true, barrierType: 'digit' as const, durationUnit: 't' as const,
        types: [
            { label: 'Over',  type: 'DIGITOVER',  color: '#22c55e', icon: '▲' },
            { label: 'Under', type: 'DIGITUNDER', color: '#ef4444', icon: '▼' },
        ],
    },
    {
        id: 'even_odd', label: 'Even/Odd', icon: '⚖️',
        hasBarrier: false, barrierType: 'none' as const, durationUnit: 't' as const,
        types: [
            { label: 'Even', type: 'DIGITEVEN', color: '#3b82f6', icon: '2' },
            { label: 'Odd',  type: 'DIGITODD',  color: '#8b5cf6', icon: '1' },
        ],
    },
    {
        id: 'match_differ', label: 'Match/Differ', icon: '🔢',
        hasBarrier: true, barrierType: 'digit' as const, durationUnit: 't' as const,
        types: [
            { label: 'Matches', type: 'DIGITMATCH', color: '#f59e0b', icon: '=' },
            { label: 'Differs', type: 'DIGITDIFF',  color: '#06b6d4', icon: '≠' },
        ],
    },
    {
        id: 'rise_fall', label: 'Rise/Fall', icon: '📈',
        hasBarrier: false, barrierType: 'none' as const, durationUnit: 't' as const,
        types: [
            { label: 'Rise', type: 'CALL', color: '#22c55e', icon: '↑' },
            { label: 'Fall', type: 'PUT',  color: '#ef4444', icon: '↓' },
        ],
    },
    {
        id: 'touch', label: 'Touch/No Touch', icon: '👆',
        hasBarrier: true, barrierType: 'price' as const, durationUnit: 's' as const,
        types: [
            { label: 'Touch',    type: 'ONETOUCH', color: '#22c55e', icon: '⟳' },
            { label: 'No Touch', type: 'NOTOUCH',  color: '#ef4444', icon: '⊘' },
        ],
    },
    {
        id: 'higher_lower', label: 'Higher/Lower', icon: '⬆',
        hasBarrier: true, barrierType: 'price' as const, durationUnit: 's' as const,
        types: [
            { label: 'Higher', type: 'HIGHER', color: '#22c55e', icon: '⬆' },
            { label: 'Lower',  type: 'LOWER',  color: '#ef4444', icon: '⬇' },
        ],
    },
];

const TICK_DURATIONS = [1, 2, 3, 5, 10];
const HISTORY_SIZE   = 1000;

function getLastDigitByPip(q: number, pipSize = 2): number {
    const s = q.toFixed(pipSize).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

/**
 * Assign colours by strict rank of each digit's percentage.
 * Rank is per-digit (index), not per-percentage value — so ties are broken
 * by digit index and no two digits ever share a colour incorrectly.
 */
const CIRCLE_DEFAULT_BG = '#ffffff'; // white background for unranked circles (matches design spec)
const CIRCLE_COLORED_BG_MAP = new Map([
    ['#22c55e', true],
    ['#3b82f6', true],
    ['#eab308', true],
    ['#ef4444', true],
]);

function getDigitCircleColors(pcts: number[]): string[] {
    const colors = new Array(10).fill(CIRCLE_DEFAULT_BG);
    const allZero = pcts.every(p => p === 0);
    if (allZero) return colors;

    // Sort digits by pct descending; break ties by digit value ascending
    const ranked = pcts
        .map((p, d) => ({ d, p }))
        .sort((a, b) => b.p - a.p || a.d - b.d);

    colors[ranked[0].d] = '#22c55e';   // highest  → green
    colors[ranked[1].d] = '#3b82f6';   // 2nd high → blue
    colors[ranked[8].d] = '#eab308';   // 2nd low  → amber
    colors[ranked[9].d] = '#ef4444';   // lowest   → red
    // ranks 2-7 keep the white default bg
    return colors;
}

// Returns dark text color for light/white circles, white for colored circles
function getCircleTextColor(bg: string): string {
    return CIRCLE_COLORED_BG_MAP.has(bg) ? '#ffffff' : '#1a1a2e';
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
const PriceChart: React.FC<{ prices: number[]; currentPrice: number | null; pipSize?: number }> = ({ prices, currentPrice, pipSize = 2 }) => {
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
                {(currentPrice ?? prices[prices.length - 1]).toFixed(pipSize)}
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
    activeTradeTickDigit?: number | null;
    tradeTickMap?: Map<number, number[]>;
}> = ({ pcts, counts, currentDigit, tradeState, totalTicks, historyReady, activeTradeTickDigit, tradeTickMap }) => {
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
                    const isExit      = tradeState?.exitDigit === d && tradeState?.settled;
                    const tradeResult = tradeState?.result;
                    // "colored" = has a meaningful rank colour (green/blue/amber/red), not the dark default
                    const isColored   = color !== CIRCLE_DEFAULT_BG;

                    /* Tick orders (T1, T2, …) that landed on this digit during current trade */
                    const tickOrders        = tradeTickMap?.get(d) ?? [];
                    const hasTickDuringTrade = tickOrders.length > 0 && tradeState && !tradeState.settled;
                    const latestOrder       = tickOrders.at(-1);

                    /* Active-tick flash */
                    const isActiveTick = activeTradeTickDigit === d && tradeState && !tradeState.settled;

                    return (
                        <div key={d} className={`mt-circle-cell ${isCurrent ? 'is-current' : ''}`}>
                            {/* Triangle / tick label — above each circle */}
                            <div className={`mt-tri ${(isCurrent || hasTickDuringTrade) ? 'mt-tri--on' : ''} ${hasTickDuringTrade ? 'mt-tri--tick-label' : ''}`}>
                                {hasTickDuringTrade ? `T${latestOrder}` : '▼'}
                            </div>

                            {/* Circle */}
                            <div
                                className={[
                                    'mt-circle',
                                    isColored ? 'mt-circle--filled' : 'mt-circle--plain',
                                    isExit ? `mt-circle--${tradeResult}` : '',
                                    hasTickDuringTrade ? 'mt-circle--trade-tick' : '',
                                    isActiveTick ? 'mt-circle--tick-active' : '',
                                ].filter(Boolean).join(' ')}
                                style={{
                                    '--cc': isExit && tradeResult === 'won'
                                        ? '#22c55e'
                                        : isExit && tradeResult === 'lost'
                                        ? '#ef4444'
                                        : hasTickDuringTrade
                                        ? '#f0f4ff'
                                        : color,
                                    boxShadow: isExit && tradeResult === 'won'
                                        ? '0 0 0 4px #22c55e99, 0 0 22px #22c55e77'
                                        : isExit && tradeResult === 'lost'
                                        ? '0 0 0 4px #ef444499, 0 0 22px #ef444477'
                                        : isCurrent
                                        ? '0 0 0 2.5px #000, 0 0 10px rgba(0,0,0,0.3)'
                                        : undefined,
                                    transform: (isCurrent || isExit) ? 'scale(1.12)' : 'scale(1)',
                                } as React.CSSProperties}
                            >
                                {/* Text color: dark on white/plain circles, white on coloured */}
                                <span className='mt-circle__num' style={{
                                    color: isExit
                                        ? '#ffffff'
                                        : hasTickDuringTrade
                                        ? '#1a1a2e'
                                        : getCircleTextColor(color),
                                }}>
                                    {d}
                                </span>

                                {/* T1/T2 badges inside circle for intermediate ticks */}
                                {hasTickDuringTrade && tickOrders.map(order => (
                                    <span key={order} className='mt-circle__tick-badge'>T{order}</span>
                                ))}

                                {/* WIN / LOSS label on the exit circle */}
                                {isExit && tradeResult && (
                                    <span className={`mt-circle__exit-label mt-circle__exit-label--${tradeResult}`}>
                                        {tradeResult === 'won' ? 'WIN' : 'LOSS'}
                                    </span>
                                )}
                            </div>

                            {/* Percentage — outside below circle */}
                            <div className='mt-circle__pct-ext'>{pct.toFixed(1)}%</div>

                            {/* Profit readout on exit digit */}
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
                <span style={{ color: '#7c3aed' }}>▼ Current</span>
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
    const [secDuration, setSecDuration]   = useState(60); // for seconds-based contracts
    const [barrier, setBarrier]           = useState(4);  // digit barrier (0-9)
    const [priceBarrier, setPriceBarrier] = useState('+0.10'); // price barrier for HIGHER/LOWER/TOUCH
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

    /* pip_size — derived from first live tick; used to decode digit from price */
    const pipSizeRef = useRef(2);
    const rawHistoryRef = useRef<number[]>([]); // raw prices from ticks_history

    const [tradeState, setTradeState] = useState<TradeState | null>(null);
    const tradeActiveRef = useRef(false);
    const tradeDurRef    = useRef(0);
    const tradeTicksRef  = useRef<{ digit: number; order: number }[]>([]);

    /* ── Bulk trade ── */
    const [bulkMode, setBulkMode]   = useState(false);
    const [bulkCount, setBulkCount] = useState(5);

    /* ── Active-tick highlight during contract settlement ── */
    const [activeTradeTickDigit, setActiveTradeTickDigit] = useState<number | null>(null);
    const activeTickTimerRef = useRef<any>(null);
    /* ── Trade-state clear timeout — tracked so new trades cancel the old timer ── */
    const tradeStateTimeoutRef = useRef<any>(null);

    /* ── Skip entry tick (1s markets send the entry tick first; it should not count as T1) ── */
    const skipNextTickRef = useRef(false);

    /* ── Positions sidebar ── */
    const [positionsPanelOpen, setPositionsPanelOpen] = useState(true);
    const [positionsTab, setPositionsTab] = useState<'open' | 'closed'>('open');

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
        pipSizeRef.current = 2; // reset until first live tick tells us the real pip_size
        rawHistoryRef.current = [];
        if (!authorized || !send) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await send({ ticks_history: symbolValue, count: 1000, end: 'latest', style: 'ticks' });
                if (cancelled) return;
                const prices: number[] = res?.history?.prices || [];
                rawHistoryRef.current = prices;
                // Decode with current pip_size (may be updated later when first live tick arrives)
                setDigitHistory(prices.map(p => getLastDigitByPip(p, pipSizeRef.current)));
                setPriceHistory(prices.slice(-120));
                setHistoryReady(true);
            } catch { setHistoryReady(true); }
        })();
        return () => { cancelled = true; };
    }, [symbolValue, authorized, send]);

    /* No-tick timeout — detect stale/unavailable markets (e.g. WBEAR, WBULL) */
    const [noTickWarning, setNoTickWarning] = useState(false);
    const noTickTimerRef = useRef<any>(null);
    useEffect(() => {
        setNoTickWarning(false);
        if (noTickTimerRef.current) clearTimeout(noTickTimerRef.current);
        noTickTimerRef.current = setTimeout(() => {
            setNoTickWarning(prev => {
                // Only warn if we still have no digits after 10 s
                return digitHistory.length === 0;
            });
        }, 10000);
        return () => { if (noTickTimerRef.current) clearTimeout(noTickTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbolValue]);
    // Clear warning as soon as first tick arrives
    useEffect(() => {
        if (digitHistory.length > 0) {
            setNoTickWarning(false);
            if (noTickTimerRef.current) clearTimeout(noTickTimerRef.current);
        }
    }, [digitHistory.length]);

    /* Live tick subscription */
    useEffect(() => {
        const unsub = subscribeTicks(symbolValue, tick => {
            /* First live tick — lock in the authoritative pip_size and recompute history */
            if (tick.pip_size && tick.pip_size !== pipSizeRef.current) {
                pipSizeRef.current = tick.pip_size;
                if (rawHistoryRef.current.length > 0) {
                    setDigitHistory(rawHistoryRef.current.map(p => getLastDigitByPip(p, tick.pip_size)));
                }
            }
            const d = getLastDigitByPip(tick.quote, pipSizeRef.current);
            setCurrentDigit(d);
            setCurrentPrice(tick.quote);
            setPriceHistory(prev => [...prev.slice(-119), tick.quote]);
            setDigitHistory(prev => [...prev, d].slice(-HISTORY_SIZE));

            if (tradeActiveRef.current) {
                /* Skip the entry tick — in 1s markets the entry tick arrives first
                   before the contract actually starts counting. T1 is the tick AFTER entry. */
                if (skipNextTickRef.current) {
                    skipNextTickRef.current = false;
                    return; // don't count this tick
                }

                if (tradeTicksRef.current.length < tradeDurRef.current) {
                    const entry = { digit: d, order: tradeTicksRef.current.length + 1 };
                    tradeTicksRef.current = [...tradeTicksRef.current, entry];
                    setTradeState(prev => prev ? { ...prev, ticks: [...tradeTicksRef.current] } : prev);

                    /* Flash the digit circle for this tick */
                    if (activeTickTimerRef.current) clearTimeout(activeTickTimerRef.current);
                    setActiveTradeTickDigit(d);
                    activeTickTimerRef.current = setTimeout(() => setActiveTradeTickDigit(null), 550);
                }
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
            const isSecBased = ctDef.durationUnit === 's';
            const dur = isSecBased ? secDuration : duration;
            const durUnit = ctDef.durationUnit;
            try {
                const results: Record<string, number | null> = {};
                await Promise.all(ctDef.types.map(async def => {
                    try {
                        const req: any = {
                            proposal: 1, amount: s, basis: 'stake',
                            contract_type: def.type, currency: currency || 'USD',
                            duration: dur, duration_unit: durUnit,
                            underlying_symbol: symbolValue,
                        };
                        if (ctDef.barrierType === 'digit') req.barrier = String(barrier);
                        if (ctDef.barrierType === 'price') req.barrier = priceBarrier;
                        const res = await send(req);
                        results[def.type] = res?.proposal?.payout ? parseFloat(res.proposal.payout) : null;
                    } catch { results[def.type] = null; }
                }));
                setPayouts(results);
            } catch { setPayouts({}); }
            finally { setPayoutLoading(false); }
        }, 500);
        return () => { if (proposalTimer.current) clearTimeout(proposalTimer.current); };
    }, [stake, duration, secDuration, symbolValue, ctDef, barrier, priceBarrier, authorized, currency, send]);

    /* ── API request / response log ── */
    const [apiLog, setApiLog] = useState<{ type: 'request'|'response'|'error'; label: string; payload: any; ts: string }[]>([]);
    const [apiLogOpen, setApiLogOpen] = useState(false);
    const pushLog = (type: 'request'|'response'|'error', label: string, payload: any) =>
        setApiLog(prev => [{ type, label, payload, ts: new Date().toLocaleTimeString('en', { hour12: false }) }, ...prev].slice(0, 30));

    /* Execute trade — single or bulk */
    const buy = useCallback(async (
        def: typeof ctDef.types[0],
        _ctDef: typeof ctDef,
        _duration: number,
        _secDuration: number,
        _barrier: number,
        _priceBarrier: string,
        _stake: string,
        _bulkMode: boolean,
        _bulkCount: number,
        _symbolValue: string,
        _symbol: typeof symbol,
    ) => {
        if (!authorized) return;
        const s = parseFloat(_stake);
        if (isNaN(s) || s < 0.35) return;

        const isSecBased = _ctDef.durationUnit === 's';
        const dur     = isSecBased ? _secDuration : _duration;
        const durUnit = _ctDef.durationUnit;

        /* ── Build barrier value ── */
        let barrierVal: string | undefined;
        if (_ctDef.barrierType === 'digit') barrierVal = String(_barrier);
        if (_ctDef.barrierType === 'price') barrierVal = _priceBarrier;

        /* ── Build contract params ── */
        const contractParams: any = {
            symbol: _symbolValue,
            contract_type: def.type as any,
            duration: dur,
            duration_unit: durUnit,
            stake: s,
            ...(barrierVal !== undefined ? { barrier: barrierVal } : {}),
        };

        /* ── Bulk mode: fire N individual contracts simultaneously ── */
        if (_bulkMode && _bulkCount > 1) {
            /* Track ticks visually using the first contract */
            tradeTicksRef.current = [];
            tradeActiveRef.current = true;
            skipNextTickRef.current = _symbolValue.startsWith('1HZ'); // only skip on 1s markets
            tradeDurRef.current = isSecBased ? 0 : dur;
            setTradeState({ ticks: [], duration: dur, settled: false, result: null, profit: 0, exitDigit: null });

            pushLog('request', `BUY ×${_bulkCount} ${def.label}`, {
                contracts: _bulkCount, stake_each: s, total_stake: s * _bulkCount,
                parameters: contractParams,
            });

            /* Create N individual position entries immediately */
            const bulkIds = Array.from({ length: _bulkCount }, () => idRef.current++);
            const now = Date.now();
            const newPositions = bulkIds.map(id => ({
                id, symbol: _symbol.label, type: def.label,
                contractType: def.type, stake: s,
                status: 'open', profit: 0, tick: 0, duration: dur, time: now,
            }));
            setPositions(p => [...newPositions, ...p.slice(0, 49)]);

            /* Tick progress counter for all bulk positions */
            let t = 0;
            const iv = setInterval(() => {
                t++;
                setPositions(p => p.map(x =>
                    bulkIds.includes(x.id) && x.status === 'open'
                        ? { ...x, tick: Math.min(t, dur) } : x));
                if (t >= dur) clearInterval(iv);
            }, 1000);

            /* Fire all N contracts simultaneously — each is a separate Deriv contract */
            let firstSettled = true;
            const results = await Promise.allSettled(
                bulkIds.map((id, idx) =>
                    new Promise<{ id: number; profit: number; status: string; entry?: number; exit?: number }>(resolve =>
                        buyContract(contractParams, c => {
                            const profit = applyCommission(c.profit);
                            const exitSpot = c.exit_spot;
                            /* Only the first settled contract drives the visual trade state */
                            if (firstSettled) {
                                firstSettled = false;
                                const exitDigit = exitSpot ? getLastDigitByPip(Number(exitSpot), pipSizeRef.current) : null;
                                setTradeState(prev => prev ? {
                                    ...prev, settled: true,
                                    result: profit >= 0 ? 'won' : 'lost',
                                    profit,
                                    exitDigit,
                                } : null);
                            }
                            setPositions(p => p.map(x => x.id === id
                                ? { ...x, status: c.status ?? (profit >= 0 ? 'won' : 'lost'), profit, entry: c.entry_spot, exit: exitSpot }
                                : x));
                            resolve({ id, profit, status: c.status ?? 'lost', entry: c.entry_spot, exit: exitSpot });
                        }).catch(() => {
                            setPositions(p => p.filter(x => x.id !== id));
                            resolve({ id, profit: 0, status: 'lost' });
                        })
                    )
                )
            );

            clearInterval(iv);
            tradeActiveRef.current = false;

            const settled = results
                .filter(r => r.status === 'fulfilled')
                .map(r => (r as any).value);
            const totalProfit = settled.reduce((a: number, r: any) => a + r.profit, 0);
            const anyResult   = settled[0];

            setPnl(prev => prev + totalProfit);

            pushLog(totalProfit >= 0 ? 'response' : 'error', `BULK RESULT ×${_bulkCount}`, {
                total_profit: totalProfit.toFixed(2),
                per_contract: (totalProfit / _bulkCount).toFixed(2),
                won: settled.filter((r: any) => r.profit > 0).length,
                lost: settled.filter((r: any) => r.profit <= 0).length,
                entry_spot: anyResult?.entry,
                exit_spot: anyResult?.exit,
            });

            if (tradeStateTimeoutRef.current) clearTimeout(tradeStateTimeoutRef.current);
            tradeStateTimeoutRef.current = setTimeout(() => setTradeState(null), 5000);
            return;
        }

        /* ── Single contract ── */
        const tradeId = idRef.current++;
        tradeTicksRef.current = [];
        tradeActiveRef.current = true;
        // Only skip the entry tick on 1s markets — on plain/bear/bull markets the
        // first tick AFTER execution is T1 and must NOT be skipped.
        skipNextTickRef.current = _symbolValue.startsWith('1HZ');
        tradeDurRef.current = isSecBased ? 0 : dur; // only track digit ticks for tick-based contracts
        setTradeState({ ticks: [], duration: dur, settled: false, result: null, profit: 0, exitDigit: null });

        const pos = {
            id: tradeId, symbol: _symbol.label, type: def.label,
            contractType: def.type, stake: s, status: 'open',
            profit: 0, tick: 0, duration: dur, time: Date.now(),
        };
        setPositions(p => [pos, ...p.slice(0, 49)]);

        /* Log the buy request (Deriv API format) */
        pushLog('request', `BUY ${def.label}`, {
            buy: '1', price: s,
            parameters: {
                contract_type: def.type,
                currency: 'USD',
                duration: dur,
                duration_unit: durUnit,
                basis: 'stake',
                amount: s,
                underlying_symbol: _symbolValue,
                ...(barrierVal !== undefined ? { barrier: barrierVal } : {}),
            },
        });

        let t = 0;
        const iv = setInterval(() => {
            t++;
            setPositions(p => p.map(x => x.id === tradeId && x.status === 'open' ? { ...x, tick: Math.min(t, dur) } : x));
            if (t >= dur) clearInterval(iv);
        }, isSecBased ? 1000 : 1000);

        try {
            await buyContract(
                contractParams,
                c => {
                    clearInterval(iv);
                    const profit    = applyCommission(c.profit);
                    const exitSpot  = c.exit_spot;
                    const exitDigit = exitSpot ? getLastDigitByPip(Number(exitSpot), pipSizeRef.current) : null;
                    /* Log the settled contract response */
                    pushLog(c.status === 'won' ? 'response' : 'error', `CONTRACT ${c.contract_id}`, {
                        contract_id: c.contract_id,
                        status: c.status,
                        profit: profit.toFixed(2),
                        entry_spot: c.entry_spot,
                        exit_spot: c.exit_spot,
                        exit_digit: exitDigit,
                    });
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
                    if (tradeStateTimeoutRef.current) clearTimeout(tradeStateTimeoutRef.current);
                    tradeStateTimeoutRef.current = setTimeout(() => setTradeState(null), 5000);
                }
            );
        } catch (err: any) {
            clearInterval(iv);
            tradeActiveRef.current = false;
            pushLog('error', 'BUY FAILED', { message: err?.message || 'Unknown error' });
            setTradeState(null);
            setPositions(p => p.filter(x => x.id !== tradeId));
        }
    }, [authorized, buyContract]);

    /* Build map: digit → [T1, T2, …] order numbers that landed on it */
    const tradeTickMap = useMemo(() => {
        const m = new Map<number, number[]>();
        if (!tradeState?.ticks) return m;
        tradeState.ticks.forEach(t => {
            if (!m.has(t.digit)) m.set(t.digit, []);
            m.get(t.digit)!.push(t.order);
        });
        return m;
    }, [tradeState?.ticks]);

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
                {/* ── Positions Sidebar (left) ── */}
                <div className={`mt-pos-sidebar${positionsPanelOpen ? ' open' : ''}`}>
                    <div className='mt-pos-sidebar__hdr'>
                        <span>Positions</span>
                        <button className='mt-pos-sidebar__close' onClick={() => setPositionsPanelOpen(false)}>×</button>
                    </div>
                    <div className='mt-pos-sidebar__tabs'>
                        <button className={`mt-pos-sidebar__tab${positionsTab === 'open' ? ' active' : ''}`}
                            onClick={() => setPositionsTab('open')}>
                            Open
                            {openPos.length > 0 && <span className='mt-pos-sidebar__tab-badge'>{openPos.length}</span>}
                        </button>
                        <button className={`mt-pos-sidebar__tab${positionsTab === 'closed' ? ' active' : ''}`}
                            onClick={() => setPositionsTab('closed')}>
                            Closed
                        </button>
                    </div>
                    <div className='mt-pos-sidebar__body'>
                        {positionsTab === 'open' ? (
                            openPos.length === 0 ? (
                                <div className='mt-pos-sidebar__empty'>
                                    <span className='mt-pos-sidebar__empty-icon'>🧳</span>
                                    <p>You have no open positions.</p>
                                </div>
                            ) : openPos.map(p => (
                                <div key={p.id} className='mt-pos-sidebar__row open'>
                                    <div className='mt-pos-sidebar__r-top'>
                                        <span className='mt-pos-sidebar__sym'>{p.symbol}</span>
                                        <span className='mt-pos-sidebar__dot'>● LIVE</span>
                                    </div>
                                    <span className='mt-pos-sidebar__type'>{p.type}</span>
                                    <div className='mt-pos-sidebar__prog'>
                                        <div style={{ width: `${Math.min(100, (p.tick / p.duration) * 100)}%` }} />
                                    </div>
                                    <div className='mt-pos-sidebar__r-bot'>
                                        <span>{fmt(p.stake)}</span>
                                        <span className='mt-pos-sidebar__tick'>{p.tick}/{p.duration}T</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            closedPos.length === 0 ? (
                                <div className='mt-pos-sidebar__empty'>
                                    <span className='mt-pos-sidebar__empty-icon'>📋</span>
                                    <p>No closed positions yet.</p>
                                </div>
                            ) : closedPos.slice(0, 25).map(p => (
                                <div key={p.id} className={`mt-pos-sidebar__row ${p.status}`}>
                                    <div className='mt-pos-sidebar__r-top'>
                                        <span className='mt-pos-sidebar__sym'>{p.symbol}</span>
                                        <span className={`mt-pos-sidebar__badge ${p.status}`}>
                                            {p.status === 'won' ? '✓ WIN' : '✗ LOSS'}
                                        </span>
                                    </div>
                                    <span className='mt-pos-sidebar__type'>{p.type}</span>
                                    {(p.entry || p.exit) && (
                                        <div className='mt-pos-sidebar__spots'>
                                            {p.entry && <span>In: {p.entry}</span>}
                                            {p.exit  && <span>Out: {p.exit}</span>}
                                        </div>
                                    )}
                                    <div className='mt-pos-sidebar__r-bot'>
                                        <span>{fmt(p.stake)}</span>
                                        <span className={`mt-pos-sidebar__profit ${p.profit >= 0 ? 'pos' : 'neg'}`}>
                                            {p.profit >= 0 ? '+' : ''}{fmt(p.profit)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Positions toggle button — shows when sidebar is closed */}
                {!positionsPanelOpen && (
                    <button className='mt-pos-sidebar__toggle' onClick={() => setPositionsPanelOpen(true)}>
                        <span>📋</span>
                        <span>Pos</span>
                    </button>
                )}

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
                        <PriceChart prices={priceHistory} currentPrice={currentPrice} pipSize={pipSizeRef.current} />
                    </div>

                    {/* Digit circles */}
                    <DigitRow
                        pcts={pcts}
                        counts={digitCounts}
                        currentDigit={currentDigit}
                        tradeState={tradeState}
                        totalTicks={digitHistory.length}
                        historyReady={historyReady}
                        activeTradeTickDigit={activeTradeTickDigit}
                        tradeTickMap={tradeTickMap}
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
                            {digitHistory.length === 0 && !noTickWarning && (
                                <span className='mt-stream__empty'>Waiting for ticks…</span>
                            )}
                            {noTickWarning && (
                                <span className='mt-stream__empty' style={{ color: '#f59e0b', display: 'block', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}>
                                    ⚠ No ticks received for {symbolValue}. This market may be unavailable or require a different account type.
                                </span>
                            )}
                        </div>
                    </div>

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

                    {/* Duration — ticks for digit/rise-fall, seconds for higher/lower & touch */}
                    {ctDef.durationUnit === 't' ? (
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
                                <NumberField className='mtp-dur-inp' min={1} max={10}
                                    value={duration}
                                    onCommit={n => setDuration(n)} />
                            </div>
                            <div className='mtp-dur-label'>{duration} Ticks</div>
                        </div>
                    ) : (
                        <div className='mtp-section'>
                            <div className='mtp-section__label'>Duration (seconds)</div>
                            <div className='mtp-dur-row'>
                                {[15, 30, 60, 120, 300].map(v => (
                                    <button key={v}
                                        className={`mtp-dur-btn ${secDuration === v ? 'active' : ''}`}
                                        onClick={() => setSecDuration(v)}>
                                        {v >= 60 ? `${v / 60}m` : `${v}s`}
                                    </button>
                                ))}
                                <NumberField className='mtp-dur-inp' min={15} max={3600}
                                    value={secDuration}
                                    onCommit={n => setSecDuration(n)} />
                            </div>
                            <div className='mtp-dur-label'>{secDuration >= 60 ? `${(secDuration / 60).toFixed(1)} min` : `${secDuration} sec`}</div>
                        </div>
                    )}

                    {/* Digit prediction — for DIGITOVER/UNDER/MATCH/DIFFER */}
                    {ctDef.barrierType === 'digit' && (
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

                    {/* Price barrier — for HIGHER/LOWER & TOUCH/NO-TOUCH */}
                    {ctDef.barrierType === 'price' && (
                        <div className='mtp-section'>
                            <div className='mtp-section__label'>Barrier (relative, e.g. +0.10)</div>
                            <div className='mtp-price-barrier-row'>
                                {['-0.10', '-0.05', '+0.05', '+0.10', '+0.20'].map(v => (
                                    <button key={v}
                                        className={`mtp-dur-btn mtp-pb-preset ${priceBarrier === v ? 'active' : ''}`}
                                        onClick={() => setPriceBarrier(v)}>
                                        {v}
                                    </button>
                                ))}
                            </div>
                            <input
                                className='mtp-price-barrier-inp'
                                type='text'
                                value={priceBarrier}
                                onChange={e => setPriceBarrier(e.target.value)}
                                placeholder='+0.10'
                            />
                            <div className='mtp-dur-label'>Barrier offset from entry spot</div>
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

                    {/* ── Bulk Trade Toggle ── */}
                    <div className='mtp-section'>
                        <div className='mtp-bulk-row'>
                            <button
                                className={`mtp-bulk-toggle ${bulkMode ? 'active' : ''}`}
                                onClick={() => setBulkMode(v => !v)}>
                                {bulkMode ? '⚡ BULK ON' : '○ BULK OFF'}
                            </button>
                            {bulkMode && (
                                <div className='mtp-bulk-count'>
                                    <span>×</span>
                                    {[2, 3, 5, 10, 20].map(n => (
                                        <button key={n}
                                            className={`mtp-dur-btn ${bulkCount === n ? 'active' : ''}`}
                                            onClick={() => setBulkCount(n)}>
                                            {n}
                                        </button>
                                    ))}
                                    <NumberField
                                        className='mtp-bulk-count-inp'
                                        min={1} max={100}
                                        value={bulkCount}
                                        onCommit={n => setBulkCount(n)}
                                    />
                                </div>
                            )}
                        </div>
                        {bulkMode && (
                            <div className='mtp-bulk-info'>
                                {bulkCount} contracts × {parseFloat(stake).toFixed(2)} = {(bulkCount * parseFloat(stake)).toFixed(2)} {currency || 'USD'} total
                            </div>
                        )}
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
                                    onClick={() => buy(def, ctDef, duration, secDuration, barrier, priceBarrier, stake, bulkMode, bulkCount, symbolValue, symbol)}
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

                    {/* ── API Request / Response Log ── */}
                    <div className='mtp-api-log'>
                        <button className='mtp-api-log__toggle' onClick={() => setApiLogOpen(v => !v)}>
                            <span>{'</>'} API Log</span>
                            <span className='mtp-api-log__count'>{apiLog.length}</span>
                            <span className='mtp-api-log__arrow'>{apiLogOpen ? '▲' : '▼'}</span>
                        </button>
                        {apiLogOpen && (
                            <div className='mtp-api-log__body'>
                                {apiLog.length === 0 && (
                                    <div className='mtp-api-log__empty'>No API calls yet. Place a trade to see request/response.</div>
                                )}
                                {apiLog.map((entry, i) => (
                                    <div key={i} className={`mtp-api-entry mtp-api-entry--${entry.type}`}>
                                        <div className='mtp-api-entry__hdr'>
                                            <span className={`mtp-api-entry__badge mtp-api-entry__badge--${entry.type}`}>
                                                {entry.type === 'request' ? '↑ REQ' : entry.type === 'response' ? '↓ RES' : '✗ ERR'}
                                            </span>
                                            <span className='mtp-api-entry__label'>{entry.label}</span>
                                            <span className='mtp-api-entry__ts'>{entry.ts}</span>
                                        </div>
                                        <pre className='mtp-api-entry__json'>{JSON.stringify(entry.payload, null, 2)}</pre>
                                    </div>
                                ))}
                                {apiLog.length > 0 && (
                                    <button className='mtp-api-log__clear' onClick={() => setApiLog([])}>Clear log</button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManualTrader;
