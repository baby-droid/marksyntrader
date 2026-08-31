// @ts-nocheck
/**
 * MobileChartView — Deriv-style full-screen mobile trade interface.
 * Replaces the SmartChart + ChartTradePanel layout on screens ≤ 767 px.
 * No SmartChart, no Run button, no Summary/Transactions.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import { publishMasterTrade, getMasterSource, createTradeKey } from '@/utils/trade-bus';
import ChartAiControl from './chart-ai';
import './mobile-chart-view.scss';

/* ── Duration unit helpers (mirror of chart-trade-panel) ──────────────────── */
type DurUnit = 't' | 's' | 'm' | 'h';
const DUR_UNIT_LABELS: Record<DurUnit, string> = { t: 'Ticks', s: 'Seconds', m: 'Minutes', h: 'Hours' };
const DUR_QUICK_PICKS: Record<DurUnit, number[]> = {
    t: [1, 2, 4, 6, 8, 10],
    s: [15, 30, 60, 120, 300, 600],
    m: [1, 2, 5, 10, 30, 60],
    h: [1, 2, 4, 8, 12, 24],
};
const DUR_RANGE: Record<DurUnit, { min: number; max: number }> = {
    t: { min: 1, max: 10 }, s: { min: 15, max: 3600 }, m: { min: 1, max: 1440 }, h: { min: 1, max: 24 },
};

/* ── Shared trade-group definitions (same as ChartTradePanel) ─────────────── */
const TRADE_GROUPS = [
    { id: 'over_under',    label: 'Over / Under',           icon: '↑↓', typeA: 'DIGITOVER',   typeB: 'DIGITUNDER',  needsBarrier: true,  isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 1, maxDur: 10, supportedUnits: ['t'] as DurUnit[]                },
    { id: 'even_odd',      label: 'Even / Odd',              icon: '⚡', typeA: 'DIGITEVEN',   typeB: 'DIGITODD',    needsBarrier: false, isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 1, maxDur: 10, supportedUnits: ['t'] as DurUnit[]                },
    { id: 'match_differ',  label: 'Match / Differ',          icon: '🎯', typeA: 'DIGITMATCH',  typeB: 'DIGITDIFF',   needsBarrier: true,  isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 1, maxDur: 10, supportedUnits: ['t'] as DurUnit[]                },
    { id: 'rise_fall',     label: 'Rise / Fall',             icon: '📈', typeA: 'CALL',        typeB: 'PUT',         needsBarrier: false, isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 1, maxDur: 10, supportedUnits: ['t', 's', 'm', 'h'] as DurUnit[] },
    { id: 'higher_lower',  label: 'Higher / Lower',          icon: '📊', typeA: 'CALL',        typeB: 'PUT',         needsBarrier: false, isAccumulator: false, durationUnit: 'm' as DurUnit, minDur: 1, maxDur: 60, supportedUnits: ['m', 'h'] as DurUnit[]           },
    { id: 'asian',         label: 'Asian Up / Down',         icon: '🌏', typeA: 'ASIANU',      typeB: 'ASIAND',      needsBarrier: false, isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 5, maxDur: 10, supportedUnits: ['t'] as DurUnit[]                },
    { id: 'touch',         label: 'Touch / No Touch',        icon: '✋', typeA: 'ONETOUCH',    typeB: 'NOTOUCH',     needsBarrier: false, isAccumulator: false, durationUnit: 'm' as DurUnit, minDur: 1, maxDur: 60, supportedUnits: ['m', 'h'] as DurUnit[]           },
    { id: 'run_high_low',  label: 'Run High / Run Low',      icon: '🏃', typeA: 'RUNHIGH',     typeB: 'RUNLOW',      needsBarrier: false, isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 1, maxDur: 10, supportedUnits: ['t'] as DurUnit[]                },
    { id: 'reset',         label: 'Reset Call / Reset Put',  icon: '🔄', typeA: 'RESETCALL',   typeB: 'RESETPUT',    needsBarrier: false, isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 5, maxDur: 10, supportedUnits: ['t'] as DurUnit[]                },
    { id: 'ends_between',  label: 'Ends In / Ends Out',      icon: '📍', typeA: 'EXPIRYRANGE', typeB: 'EXPIRYMISS',  needsBarrier: false, isAccumulator: false, durationUnit: 'm' as DurUnit, minDur: 1, maxDur: 60, supportedUnits: ['m', 'h'] as DurUnit[]           },
    { id: 'stays_between', label: 'Stays Between / Goes Out',icon: '🔒', typeA: 'RANGE',       typeB: 'UPORDOWN',    needsBarrier: false, isAccumulator: false, durationUnit: 'm' as DurUnit, minDur: 1, maxDur: 60, supportedUnits: ['m', 'h'] as DurUnit[]           },
];

/* ── Rank-based solid fill colors (like desktop cdo__circle) ─────────────── */
function getRankFill(rank: string): { fill: string; text: string; ring: string } {
    switch (rank) {
        case 'green':  return { fill: '#00E676', text: '#000', ring: '#00B248' };
        case 'blue':   return { fill: '#1E88FF', text: '#000', ring: '#0056b3' };
        case 'yellow': return { fill: '#FFD600', text: '#000', ring: '#c6a800' };
        case 'red':    return { fill: '#FF3D57', text: '#000', ring: '#C62828' };
        default:       return { fill: '#f0f0f0', text: '#000', ring: '#ccc' };
    }
}

interface DigitCircleProps {
    digit: number;
    pct: number;
    rank: string;
    isBarrier: boolean;
    isCurrent: boolean;
    isWin: boolean;
    isLoss: boolean;
    onClick: () => void;
}

const DigitCircle: React.FC<DigitCircleProps> = ({
    digit, pct, rank, isBarrier, isCurrent, isWin, isLoss, onClick,
}) => {
    const SIZE   = 76;
    const CX     = SIZE / 2;
    const R      = 30;
    const SW     = 3.5;
    const CIRC   = 2 * Math.PI * R;
    const arcLen = (pct / 100) * CIRC;

    const rankColors = getRankFill(rank);
    // Solid background: colored for ranked, white for default; barrier = dark navy
    const fillColor = isBarrier ? '#0e3348'
                    : isWin     ? '#00E676'
                    : isLoss    ? '#FF3D57'
                    : rankColors.fill;
    const ringStroke = isBarrier ? '#0e3348' : rankColors.ring;
    const textColor  = isBarrier ? '#fff' : '#000';

    return (
        <div className='mcv-circle' onClick={onClick}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                {/* Solid fill circle */}
                <circle cx={CX} cy={CX} r={R} fill={fillColor} stroke={ringStroke} strokeWidth={SW} />
                {/* Digit label — bold black */}
                <text
                    x={CX} y={CX + 1}
                    textAnchor='middle' dominantBaseline='middle'
                    fontSize='22' fontWeight='900'
                    fill={textColor}
                >
                    {digit}
                </text>
            </svg>
            <div className={`mcv-circle__pct${isBarrier ? ' mcv-circle__pct--barrier' : ''}`}>
                {pct.toFixed(1)}%
            </div>
        </div>
    );
};

/* ── Trade-type sheet ─────────────────────────────────────────────────────── */
interface TypeSheetProps {
    current: string;
    onSelect: (id: string) => void;
    onClose: () => void;
}
const TradeTypeSheet: React.FC<TypeSheetProps> = ({ current, onSelect, onClose }) => (
    <div className='mcv-sheet' onClick={onClose}>
        <div className='mcv-sheet__panel' onClick={e => e.stopPropagation()}>
            <div className='mcv-sheet__handle' />
            <div className='mcv-sheet__title'>Select Trade Type</div>
            {TRADE_GROUPS.map(g => (
                <button
                    key={g.id}
                    className={`mcv-sheet__item${g.id === current ? ' active' : ''}`}
                    onClick={() => { onSelect(g.id); onClose(); }}
                >
                    <span className='mcv-sheet__item-icon'>{g.icon}</span>
                    <span className='mcv-sheet__item-label'>{g.label}</span>
                    {g.id === current && <span className='mcv-sheet__item-check'>✓</span>}
                </button>
            ))}
        </div>
    </div>
);

/* ── Market selector sheet ────────────────────────────────────────────────── */
interface MarketSheetProps {
    current: string;
    markets: Array<{ symbol: string; display_name: string }>;
    onSelect: (s: string) => void;
    onClose: () => void;
}
const MarketSheet: React.FC<MarketSheetProps> = ({ current, markets, onSelect, onClose }) => (
    <div className='mcv-sheet' onClick={onClose}>
        <div className='mcv-sheet__panel' onClick={e => e.stopPropagation()}>
            <div className='mcv-sheet__handle' />
            <div className='mcv-sheet__title'>Select Market</div>
            <div className='mcv-sheet__scroll'>
                {markets.map(m => (
                    <button
                        key={m.symbol}
                        className={`mcv-sheet__item${m.symbol === current ? ' active' : ''}`}
                        onClick={() => { onSelect(m.symbol); onClose(); }}
                    >
                        <span className='mcv-sheet__item-label'>{m.display_name}</span>
                        {m.symbol === current && <span className='mcv-sheet__item-check'>✓</span>}
                    </button>
                ))}
            </div>
        </div>
    </div>
);

/* ── Duration sheet ───────────────────────────────────────────────────────── */
interface DurationSheetProps {
    ticks: number;
    durationUnit: DurUnit;
    supportedUnits: DurUnit[];
    minTickDur: number;
    maxTickDur: number;
    onSet: (n: number, unit: DurUnit) => void;
    onClose: () => void;
}
const DurationSheet: React.FC<DurationSheetProps> = ({
    ticks, durationUnit, supportedUnits, minTickDur, maxTickDur, onSet, onClose,
}) => {
    const [unit, setUnit]   = useState<DurUnit>(durationUnit);
    const [tab,  setTab]    = useState<'quick' | 'custom'>('quick');
    const [val,  setVal]    = useState(ticks);
    const [raw,  setRaw]    = useState(String(ticks));

    const range = unit === 't' ? { min: minTickDur, max: maxTickDur } : DUR_RANGE[unit];
    const picks = DUR_QUICK_PICKS[unit].filter(n => n >= range.min && n <= range.max);

    const handleUnitSwitch = (u: DurUnit) => {
        setUnit(u);
        setTab('quick');
        const r = u === 't' ? { min: minTickDur, max: maxTickDur } : DUR_RANGE[u];
        const ps = DUR_QUICK_PICKS[u].filter(n => n >= r.min && n <= r.max);
        const first = ps.length > 0 ? ps[0] : r.min;
        setVal(first); setRaw(String(first));
    };

    return (
        <div className='mcv-sheet' onClick={onClose}>
            <div className='mcv-sheet__panel' onClick={e => e.stopPropagation()}>
                <div className='mcv-sheet__handle' />
                <div className='mcv-sheet__title'>Duration</div>
                {/* Unit tabs */}
                <div className='mcv-dur__units'>
                    {supportedUnits.map(u => (
                        <button
                            key={u}
                            className={`mcv-dur__unit-btn${unit === u ? ' active' : ''}`}
                            onClick={() => handleUnitSwitch(u)}
                        >{DUR_UNIT_LABELS[u]}</button>
                    ))}
                </div>
                {/* Quick picks / Custom tabs */}
                <div className='mcv-dur__tabs'>
                    <button className={`mcv-dur__tab${tab === 'quick' ? ' active' : ''}`} onClick={() => setTab('quick')}>Quick picks</button>
                    <button className={`mcv-dur__tab${tab === 'custom' ? ' active' : ''}`} onClick={() => { setTab('custom'); setRaw(String(val)); }}>Custom</button>
                </div>
                {tab === 'quick' ? (
                    <div className='mcv-dur__grid'>
                        {picks.map(n => (
                            <button
                                key={n}
                                className={`mcv-dur__opt${val === n ? ' active' : ''}`}
                                onClick={() => setVal(n)}
                            >
                                {n} {unit === 't' ? (n === 1 ? 'tick' : 'ticks')
                                     : unit === 's' ? (n === 1 ? 'sec' : 'secs')
                                     : unit === 'm' ? (n === 1 ? 'min' : 'mins')
                                     : (n === 1 ? 'hr' : 'hrs')}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className='mcv-dur'>
                        <button className='mcv-dur__adj' onClick={() => { const n = Math.max(range.min, val - 1); setVal(n); setRaw(String(n)); }}>−</button>
                        <input
                            className='mcv-dur__custom-inp'
                            type='text'
                            inputMode='numeric'
                            value={raw}
                            onFocus={e => e.target.select()}
                            onChange={e => {
                                const r2 = e.target.value.replace(/[^\d]/g, '');
                                setRaw(r2);
                                const v = parseInt(r2, 10);
                                if (!isNaN(v)) setVal(v);
                            }}
                            onBlur={() => {
                                const v = parseInt(raw, 10);
                                const c = isNaN(v) ? range.min : Math.min(Math.max(v, range.min), range.max);
                                setVal(c); setRaw(String(c));
                            }}
                        />
                        <button className='mcv-dur__adj' onClick={() => { const n = Math.min(range.max, val + 1); setVal(n); setRaw(String(n)); }}>+</button>
                    </div>
                )}
                <div className='mcv-dur__range-hint'>{range.min}–{range.max} {DUR_UNIT_LABELS[unit].toLowerCase()}</div>
                <button className='mcv-dur__apply' onClick={() => { onSet(val, unit); onClose(); }}>Apply</button>
            </div>
        </div>
    );
};

/* ── Amount/Stake sheet ───────────────────────────────────────────────────── */
interface AmountSheetProps {
    stake: number;
    displayCur: string;
    onSet: (n: number) => void;
    onOpenAi: () => void;
    onClose: () => void;
}
const AmountSheet: React.FC<AmountSheetProps> = ({ stake, displayCur, onSet, onOpenAi, onClose }) => {
    const [raw, setRaw] = useState(String(stake));

    const handleKey = (key: string) => {
        if (key === '⌫') {
            setRaw(v => v.slice(0, -1) || '0');
            return;
        }
        if (key === '.' && raw.includes('.')) return;
        if (raw === '0' && key !== '.') { setRaw(key); return; }
        setRaw(v => v + key);
    };

    const keys = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];
    const numVal = parseFloat(raw) || 0;

    return (
        <div className='mcv-sheet' onClick={onClose}>
            <div className='mcv-sheet__panel' onClick={e => e.stopPropagation()}>
                <div className='mcv-sheet__handle' />
                <div className='mcv-sheet__title'>Stake</div>
                <div className='mcv-amt__display'>{raw} <span className='mcv-amt__cur'>{displayCur}</span></div>
                <div className='mcv-amt__presets'>
                    {[0.35, 1, 5, 10, 100].map(p => (
                        <button key={p} className='mcv-amt__preset' onClick={() => setRaw(String(p))}>{p}</button>
                    ))}
                    <button className='mcv-amt__preset mcv-amt__preset--ai' onClick={() => { onOpenAi(); onClose(); }}>AI</button>
                </div>
                <div className='mcv-amt__pad'>
                    {keys.map(k => (
                        <button key={k} className={`mcv-amt__key${k === '⌫' ? ' mcv-amt__key--back' : ''}`} onClick={() => handleKey(k)}>{k}</button>
                    ))}
                </div>
                <button
                    className='mcv-dur__apply'
                    disabled={numVal < 0.35}
                    onClick={() => { onSet(Math.max(0.35, numVal)); onClose(); }}
                >
                    Apply
                </button>
            </div>
        </div>
    );
};

/* ── Colour rank helper ───────────────────────────────────────────────────── */
function getRank(pct: number, sorted: number[]): string {
    const unique = [...new Set(sorted)].sort((a, b) => a - b);
    const max  = unique[unique.length - 1];
    const min  = unique[0];
    const max2 = unique.length >= 2 ? unique[unique.length - 2] : null;
    const min2 = unique.length >= 3 ? unique[1] : null;
    if (pct === max)                    return 'green';
    if (pct === min)                    return 'red';
    if (max2 !== null && pct === max2)  return 'blue';
    if (min2 !== null && pct === min2)  return 'yellow';
    return 'default';
}

/* ── MobileChartView props ────────────────────────────────────────────────── */
export interface MobileChartViewProps {
    symbol: string;
    onSymbolChange: (s: string) => void;
    currentDigit: number | null;
    currentPrice: number | null;
    priceChange: number;
    pipSize: number;
    pcts: number[];
    sorted: number[];
    barrier: number;
    onBarrierChange: (d: number) => void;
    pendingTrades: Array<{ id: string; totalTicks: number; countedTicks: number }>;
    lastTrade: { digit: number; won: boolean } | null;
    activeSymbols: Array<{ symbol: string; display_name: string }>;
}

/* ════════════════════════════════════════════════════════════════════════════ */
const MobileChartView: React.FC<MobileChartViewProps> = ({
    symbol, onSymbolChange,
    currentDigit, currentPrice, priceChange, pipSize,
    pcts, sorted,
    barrier, onBarrierChange,
    pendingTrades, lastTrade,
    activeSymbols,
}) => {
    /* ── Trade state ──────────────────────────────────────────────────────── */
    const [groupIdx,     setGroupIdx]    = useState(0);
    const [ticks,        setTicks]       = useState(5);
    const [durationUnit, setDurationUnit] = useState<DurUnit>(TRADE_GROUPS[0].supportedUnits[0]);
    const [stake,       setStake]       = useState(10.00);
    const [stakeRaw,    setStakeRaw]    = useState('10.00');
    const [displayCur,  setDisplayCur]  = useState(getDisplayCurrency());
    const [loading,     setLoading]     = useState<'over' | 'under' | null>(null);
    const [result,      setResult]      = useState<{ ok: boolean; msg: string } | null>(null);
    const [aiEnabled,   setAiEnabled]   = useState(false);
    const [overPayout,  setOverPayout]  = useState<number | null>(null);
    const [underPayout, setUnderPayout] = useState<number | null>(null);
    const payoutTimerRef = useRef<any>(null);
    // Cached proposal IDs from the last payout-fetch — reused on buy to skip the
    // extra proposal round-trip and execute instantly on the current tick.
    const cachedProposalRef = useRef<{
        key: string;
        overId: string | null;
        overAsk: number;
        underId: string | null;
        underAsk: number;
        expiry: number;
    } | null>(null);
    // Tracks the last tick-count dispatched per contract so we never fire a
    // chart:trade-tick event with the same or fewer ticks than before.
    // Deriv POC fires on every state change, not just new ticks — this ref
    // prevents redundant/stale dispatches that trigger race overwrites in the
    // wrapper. Keyed by numeric contractId.
    const pocLastTickCountRef = useRef<Map<number, number>>(new Map());

    /* ── Win/Loss toast notification ──────────────────────────────────────── */
    // Queue-based: every settled trade gets its own popup; rapid trades don't
    // cancel each other.  toastKey forces React to unmount+remount the element
    // on each new entry so the CSS animation always replays from frame 0.
    const [tradeToast, setTradeToast]   = useState<{ won: boolean; profit: number } | null>(null);
    const [toastKey,   setToastKey]     = useState(0);
    const toastQueueRef  = useRef<Array<{ won: boolean; profit: number }>>([]);
    const toastBusyRef   = useRef(false);
    const toastTimerRef  = useRef<any>(null);

    const showNextToast = useCallback(() => {
        if (toastQueueRef.current.length === 0) { toastBusyRef.current = false; return; }
        const next = toastQueueRef.current.shift()!;
        toastBusyRef.current = true;
        setToastKey(k => k + 1);   // forces remount → animation restarts
        setTradeToast(next);
        toastTimerRef.current = setTimeout(() => {
            setTradeToast(null);
            // small gap between consecutive toasts
            setTimeout(showNextToast, 220);
        }, 4000);
    }, []);

    useEffect(() => {
        const handleSettled = (e: CustomEvent) => {
            const { won, profit } = e.detail;
            toastQueueRef.current.push({ won, profit });
            if (!toastBusyRef.current) showNextToast();
        };
        window.addEventListener('chart:trade-settled', handleSettled as any);
        return () => {
            window.removeEventListener('chart:trade-settled', handleSettled as any);
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, [showNextToast]);

    /* ── Sheet visibility ─────────────────────────────────────────────────── */
    const [showTypeSheet,     setShowTypeSheet]     = useState(false);
    const [showMarketSheet,   setShowMarketSheet]   = useState(false);
    const [showDurationSheet, setShowDurationSheet] = useState(false);
    const [showAmountSheet,   setShowAmountSheet]   = useState(false);

    const group = TRADE_GROUPS[groupIdx] ?? TRADE_GROUPS[0];

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);
    useEffect(() => {
        const firstUnit = group.supportedUnits[0];
        setDurationUnit(firstUnit);
        const range = firstUnit === 't'
            ? { min: group.minDur, max: group.maxDur }
            : DUR_RANGE[firstUnit];
        const picks = DUR_QUICK_PICKS[firstUnit].filter(n => n >= range.min && n <= range.max);
        setTicks(picks.length > 0 ? picks[0] : range.min);
    }, [groupIdx]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Payout fetch ─────────────────────────────────────────────────────── */
    // Also caches proposal IDs so the buy button can execute instantly
    // without a second round-trip to the server.
    const warmProposalCache = useCallback(async () => {
        const api = (api_base as any).api;
        if (!api || !symbol) return;
        const base: any = {
            proposal: 1, amount: stake, basis: 'stake',
            currency: getDisplayCurrency() || 'USD',
            duration: ticks, duration_unit: durationUnit,
            underlying_symbol: symbol,
        };
        if (group.needsBarrier) base.barrier = String(barrier);
        try {
            const [aRes, bRes] = await Promise.all([
                api.send({ ...base, contract_type: group.typeA }),
                api.send({ ...base, contract_type: group.typeB }),
            ]);
            const aP = Number(aRes?.proposal?.payout ?? 0);
            const bP = Number(bRes?.proposal?.payout ?? 0);
            setOverPayout(aP > 0 ? aP : null);
            setUnderPayout(bP > 0 ? bP : null);
            // Cache proposal IDs for instant buy (valid ~30s; we use 25s)
            const cacheKey = `${group.id}|${barrier}|${ticks}|${durationUnit}|${stake}|${symbol}`;
            if (aRes?.proposal?.id || bRes?.proposal?.id) {
                cachedProposalRef.current = {
                    key:      cacheKey,
                    overId:   aRes?.proposal?.id   ?? null,
                    overAsk:  Number(aRes?.proposal?.ask_price  ?? stake),
                    underId:  bRes?.proposal?.id   ?? null,
                    underAsk: Number(bRes?.proposal?.ask_price ?? stake),
                    expiry:   Date.now() + 25000,
                };
            }
        } catch {
            setOverPayout(null); setUnderPayout(null);
        }
    }, [symbol, stake, ticks, durationUnit, barrier, group]);

    useEffect(() => {
        if (payoutTimerRef.current) clearTimeout(payoutTimerRef.current);
        payoutTimerRef.current = setTimeout(warmProposalCache, 600);
        return () => { if (payoutTimerRef.current) clearTimeout(payoutTimerRef.current); };
    }, [warmProposalCache]);

    /* ── Market type (informational) ─────────────────────────────────────── */
    // Tick counting is driven by chart-wrapper.tsx: the entry tick and following
    // ticks are counted, with only pre-entry ticks excluded.
    const is1sMarket   = /^1HZ/i.test(symbol);
    const isJumpMarket = /^JD/i.test(symbol);

    /* ── Buy ──────────────────────────────────────────────────────────────── */
    const buy = useCallback(async (
        side: 'over' | 'under',
        overrides: { ticks?: number; stake?: number; barrier?: number } = {},
    ): Promise<number | null> => {
        if (loading) return null;
        const api = (api_base as any).api;
        if (!api) { setResult({ ok: false, msg: '❌ Not connected' }); return null; }
        const effectiveTicks = overrides.ticks ?? ticks;
        const effectiveStake = overrides.stake ?? stake;
        const effectiveBarrier = overrides.barrier ?? barrier;
        const isOverrideBuy = overrides.ticks != null || overrides.stake != null;
        setLoading(side);
        setResult(null);
        const contractType = side === 'over' ? group.typeA : group.typeB;
        let purchasedContractId: number | null = null;

        // Helper to build a fresh proposal request
        const buildProposalReq = () => {
            const req: any = {
                proposal: 1, amount: effectiveStake, basis: 'stake',
                contract_type: contractType,
                currency: getDisplayCurrency() || 'USD',
                duration: effectiveTicks, duration_unit: durationUnit,
                underlying_symbol: symbol,
            };
            if (group.needsBarrier) req.barrier = String(effectiveBarrier);
            return req;
        };

        try {
            // ── Fast-path: reuse cached proposal to skip one round-trip ────────
            // The payout-fetch effect pre-fetches proposals after every parameter
            // change (barrier, ticks, stake, symbol). Reusing that ID means the
            // buy message hits the server on the very next WebSocket frame — no
            // extra proposal latency — so the contract enters on the current tick.
            const cacheKey = `${group.id}|${effectiveBarrier}|${effectiveTicks}|${durationUnit}|${effectiveStake}|${symbol}`;
            const cached   = cachedProposalRef.current;
            let proposalId: string | null = null;
            let askPrice:   number        = stake;
            let usedCache                 = false;

            if (!isOverrideBuy && cached?.key === cacheKey && cached.expiry > Date.now()) {
                proposalId = side === 'over' ? cached.overId : cached.underId;
                askPrice   = side === 'over' ? cached.overAsk : cached.underAsk;
                if (proposalId) {
                    // Consume: proposal IDs are one-time-use on Deriv
                    cachedProposalRef.current = null;
                    usedCache = true;
                }
            }

            // Cache miss or expired — fetch fresh proposal
            if (!proposalId) {
                const pr = await api.send(buildProposalReq());
                if (pr?.error) throw new Error(pr.error.message);
                proposalId = pr?.proposal?.id ?? null;
                askPrice   = Number(pr?.proposal?.ask_price ?? stake);
                if (!proposalId) throw new Error('Proposal failed');
            }
            const tradeKey = createTradeKey('mobile-chart');

            // PRE-signal for copy trading (before buy so follower gets same tick)
            try {
                publishMasterTrade({
                    symbol, contract_type: contractType, stake: effectiveStake,
                    duration: effectiveTicks, duration_unit: durationUnit,
                    ...(group.needsBarrier ? { barrier: String(effectiveBarrier) } : {}),
                     source: getMasterSource(), time: Date.now(), trade_key: tradeKey,
                });
            } catch { /* non-fatal */ }

            let buyRes = await api.send({ buy: proposalId, price: askPrice });
            // If the cached proposal expired between fetch and now, retry once
            if (buyRes?.error && usedCache) {
                const pr = await api.send(buildProposalReq());
                if (pr?.error) throw new Error(pr.error.message);
                proposalId = pr?.proposal?.id ?? null;
                askPrice   = Number(pr?.proposal?.ask_price ?? stake);
                if (!proposalId) throw new Error('Proposal failed (retry)');
                buyRes = await api.send({ buy: proposalId, price: askPrice });
            }
            if (buyRes?.error) throw new Error(buyRes.error.message);

            const contractId = buyRes?.buy?.contract_id;
            purchasedContractId = contractId != null ? Number(contractId) : null;
            setResult({ ok: true, msg: `✅ #${contractId}` });
            window.dispatchEvent(new CustomEvent('chart:trade-started', {
                detail: { contractId: Number(contractId), ticks: effectiveTicks },
            }));

            // Re-warm the proposal cache immediately so the next buy is also instant
            warmProposalCache();

            // Subscribe POC for settlement
            try {
                const cid = Number(contractId);
                let pocSubId: string | null = null;
                const settleSub = (api_base as any).api.subscribe({
                    proposal_open_contract: 1, contract_id: cid, subscribe: 1,
                });
                const forgetPoc = () => {
                    try { settleSub.unsubscribe?.(); } catch { /* noop */ }
                    if (pocSubId) {
                        try { (api_base as any).api?.send({ forget: pocSubId }).catch(() => {}); } catch { /* noop */ }
                        pocSubId = null;
                    }
                };
                // Per-contract dispatch guard (issue #2):
                // Deriv sends a POC message on EVERY live price tick, not only when a
                // new settlement tick lands. Without this, the same tick_stream fires
                // dozens of chart:trade-tick events per real tick, causing redundant
                // processing and potential race overwrites in chart-wrapper.
                // savedEntryTime: lock the authoritative spot time when available,
                        // falling back to entry_spot_time. Until Deriv provides either
                // value, keep buffering live ticks rather than guessing.
                let savedEntryTime = 0;
                let entryTimeDispatched = false; // fire chart:trade-entry exactly once

                settleSub.subscribe({
                    next: (res: any) => {
                        const poc = res?.proposal_open_contract;
                        if (!poc) return;
                        if (!pocSubId && res.subscription?.id) pocSubId = res.subscription.id;

                        // ── Lock in the authoritative entry/spot time ───────────────
                        // chart-wrapper counts this entry tick and following ticks,
                        // while ignoring only ticks that occurred before entry.
                        if (savedEntryTime === 0) {
                            const pocEntryTime =
                                Number(poc.entry_tick_time) || Number(poc.entry_spot_time) || 0;
                            if (pocEntryTime > 0) {
                                savedEntryTime = pocEntryTime;
                            }
                            if (savedEntryTime > 0 && !entryTimeDispatched) {
                                entryTimeDispatched = true;
                                window.dispatchEvent(new CustomEvent('chart:trade-entry', {
                                    detail: { contractId: cid, entryEpoch: savedEntryTime },
                                }));
                            }
                        }

                        // Settlement handled below; tick labelling driven by chart-wrapper
                        // live-tick path (real-time, no API roundtrip).
                        if (poc.status === 'won' || poc.status === 'lost') {
                            const won    = poc.status === 'won';
                            const profit = Number(poc.profit ?? 0);
                            const exitStr = poc.exit_tick_display_value
                                ? String(poc.exit_tick_display_value).replace('.', '') : null;
                            const exitDigit = exitStr ? parseInt(exitStr[exitStr.length - 1], 10) : null;
                            window.dispatchEvent(new CustomEvent('chart:trade-settled', {
                                detail: { won, profit, exitDigit, barrier: effectiveBarrier, contractType, contractId: cid },
                            }));
                            forgetPoc();
                        }
                    },
                    error: () => forgetPoc(),
                });
            } catch { /* non-fatal */ }

            // POST-signal
            try {
                publishMasterTrade({
                    symbol, contract_type: contractType, stake: effectiveStake,
                    duration: effectiveTicks, duration_unit: durationUnit,
                    ...(group.needsBarrier ? { barrier: String(effectiveBarrier) } : {}),
                     source: getMasterSource(), time: Date.now(), contract_id: Number(contractId), trade_key: tradeKey,
                });
            } catch { /* non-fatal */ }
        } catch (e: any) {
            setResult({ ok: false, msg: `❌ ${e.message}` });
            return null;
        } finally {
            setLoading(null);
            setTimeout(() => setResult(null), 4000);
        }
        return purchasedContractId;
    }, [loading, group, barrier, ticks, durationUnit, stake, symbol, warmProposalCache]);

    /* ── Derived state ────────────────────────────────────────────────────── */
    const OVER_LABELS: Record<string, string>  = { over_under: 'Over', even_odd: 'Even', match_differ: 'Matches', asian: 'Asian Up', touch: 'Touch', run_high_low: 'Run High', reset: 'Reset Call', ends_between: 'Ends In', stays_between: 'Stays Between' };
    const UNDER_LABELS: Record<string, string> = { over_under: 'Under', even_odd: 'Odd', match_differ: 'Differs', asian: 'Asian Down', touch: 'No Touch', run_high_low: 'Run Low', reset: 'Reset Put', ends_between: 'Ends Out', stays_between: 'Goes Outside' };
    const overLabel  = OVER_LABELS[group.id]  ?? 'Rise';
    const underLabel = UNDER_LABELS[group.id] ?? 'Fall';

    /* ── Triangle position ────────────────────────────────────────────────── */
    // triangleRow: 'top' (0-4) or 'bottom' (5-9)
    // trianglePos: 0-4 column index within the row
    const triangleRow = currentDigit !== null && currentDigit >= 5 ? 'bottom' : 'top';
    const triangleCol = currentDigit !== null ? (currentDigit % 5) : null;
    // Left % within the row: col * 20 + 10 (each of 5 items = 20%, center at +10%)
    // Adjusted to better center on larger circles
    const triangleLeft = triangleCol !== null ? `${triangleCol * 20 + 10}%` : '-200px';

    /* ── Current pending trade info ───────────────────────────────────────── */
    const activeTrade = pendingTrades[0] ?? null;
    const activeTickCount = activeTrade?.countedTicks ?? 0;
    const activeTotalTicks = activeTrade?.totalTicks ?? 0;

    /* ── Price display ────────────────────────────────────────────────────── */
    const priceStr  = currentPrice != null ? currentPrice.toFixed(pipSize) : '——';
    const changeAbs = Math.abs(priceChange).toFixed(pipSize);
    const changeDir = priceChange >= 0 ? '+' : '−';
    const changeColor = priceChange >= 0 ? '#22c55e' : '#ef4444';

    /* ── Rows of digits ───────────────────────────────────────────────────── */
    const ROW_TOP    = [0, 1, 2, 3, 4];
    const ROW_BOTTOM = [5, 6, 7, 8, 9];

    const renderRow = (digits: number[]) => (
        <div className='mcv-digits__row'>
            {digits.map(d => {
                const pct   = pcts[d] ?? 0;
                const rank  = getRank(pct, sorted);
                const isCurrent  = currentDigit === d;
                const isBarrier  = barrier === d;
                const isWin  = lastTrade?.won === true  && lastTrade.digit === d;
                const isLoss = lastTrade?.won === false && lastTrade.digit === d;
                return (
                    <DigitCircle
                        key={d}
                        digit={d}
                        pct={pct}
                        rank={rank}
                        isBarrier={isBarrier}
                        isCurrent={isCurrent}
                        isWin={isWin}
                        isLoss={isLoss}
                        onClick={() => onBarrierChange(d)}
                    />
                );
            })}
        </div>
    );

    return (
        <div className='mcv'>
            {/* ── Win/Loss toast notification ────────────────────────────── */}
            {tradeToast && (
                <div className={`mcv-toast mcv-toast--${tradeToast.won ? 'win' : 'loss'}`}>
                    <span className='mcv-toast__icon'>{tradeToast.won ? '🎉' : '💔'}</span>
                    <span className='mcv-toast__msg'>
                        {tradeToast.won
                            ? `Profit Won +${Math.abs(tradeToast.profit).toFixed(2)} ${displayCur}`
                            : `Loss −${Math.abs(tradeToast.profit).toFixed(2)} ${displayCur}`}
                    </span>
                </div>
            )}

            {/* ── Market header ──────────────────────────────────────────── */}
            <div className='mcv__header' onClick={() => setShowMarketSheet(true)}>
                <div className='mcv__market-icon'>
                    <span className='mcv__market-icon-sym'>
                        {symbol.replace(/[^0-9]/g,'').slice(0,3) || '??'}
                    </span>
                </div>
                <div className='mcv__market-info'>
                    <span className='mcv__market-name'>
                        {activeSymbols.find(s => s.symbol === symbol)?.display_name ?? symbol}
                    </span>
                    <span className='mcv__market-price'>
                        <span className='mcv__price-val'>{priceStr}</span>
                        {priceChange !== 0 && (
                            <span className='mcv__price-change' style={{ color: changeColor }}>
                                &nbsp;{changeDir}&nbsp;{changeAbs}
                                &nbsp;{priceChange >= 0 ? '▲' : '▼'}
                            </span>
                        )}
                    </span>
                </div>
                <span className='mcv__market-arrow'>▾</span>
            </div>

            {/* ── Active-trade tick info ─────────────────────────────────── */}
            {activeTrade && (
                <div className='mcv__tick-info'>
                    <span>Tick {activeTickCount}/{activeTotalTicks}</span>
                    {currentPrice != null && (
                        <span>
                            {currentPrice.toFixed(Math.max(0, pipSize - 1))}
                            {currentDigit !== null && (
                                <span className='mcv__tick-digit'>{currentDigit}</span>
                            )}
                        </span>
                    )}
                </div>
            )}

            {/* ── Digit circles ─────────────────────────────────────────── */}
            <div className='mcv-digits'>
                {/* Triangle ABOVE top row — ▼ pointing DOWN at digit 0-4 */}
                <div className='mcv-digits__pointer-row mcv-digits__pointer-row--top'>
                    {currentDigit !== null && triangleRow === 'top' && (
                        <div
                            className='mcv-digits__triangle mcv-digits__triangle--down'
                            style={{ left: triangleLeft }}
                        />
                    )}
                </div>

                {/* Top row (0-4) */}
                {renderRow(ROW_TOP)}

                {/* Bottom row (5-9) */}
                {renderRow(ROW_BOTTOM)}

                {/* Triangle BELOW bottom row — ▲ pointing UP at digit 5-9 */}
                <div className='mcv-digits__pointer-row mcv-digits__pointer-row--bottom'>
                    {currentDigit !== null && triangleRow === 'bottom' && (
                        <div
                            className='mcv-digits__triangle mcv-digits__triangle--up'
                            style={{ left: triangleLeft }}
                        />
                    )}
                </div>
            </div>

            {/* ── Market navigation arrows ───────────────────────────────── */}
            <div className='mcv__nav'>
                <button
                    className='mcv__nav-btn'
                    onClick={() => {
                        const idx = activeSymbols.findIndex(s => s.symbol === symbol);
                        if (idx > 0) onSymbolChange(activeSymbols[idx - 1].symbol);
                    }}
                >
                    {'«'}
                </button>
                <div className='mcv__nav-divider' />
                <button
                    className='mcv__nav-btn'
                    onClick={() => {
                        const idx = activeSymbols.findIndex(s => s.symbol === symbol);
                        if (idx < activeSymbols.length - 1) onSymbolChange(activeSymbols[idx + 1].symbol);
                    }}
                >
                    {'»'}
                </button>
            </div>

            {/* ── Trade panel ────────────────────────────────────────────── */}
            <div className='mcv-panel'>

                {/* "Learn about this trade type" */}
                <div className='mcv-panel__learn' onClick={() => setShowTypeSheet(true)}>
                    Learn about this trade type
                </div>

                {/* Trade type selector row */}
                <button className='mcv-panel__type-row' onClick={() => setShowTypeSheet(true)}>
                    <span className='mcv-panel__type-icon'>{group.icon}</span>
                    <span className='mcv-panel__type-label'>{group.label}</span>
                    <span className='mcv-panel__type-arrow'>›</span>
                </button>

                {/* Digit barrier grid (0-4 / 5-9) */}
                {group.needsBarrier && (
                    <div className='mcv-panel__digit-grid'>
                        <div className='mcv-panel__digit-row'>
                            {[0, 1, 2, 3, 4].map(d => (
                                <button
                                    key={d}
                                    className={`mcv-panel__dgt${barrier === d ? ' active' : ''}${currentDigit === d ? ' current' : ''}`}
                                    onClick={() => onBarrierChange(d)}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                        <div className='mcv-panel__digit-row'>
                            {[5, 6, 7, 8, 9].map(d => (
                                <button
                                    key={d}
                                    className={`mcv-panel__dgt${barrier === d ? ' active' : ''}${currentDigit === d ? ' current' : ''}`}
                                    onClick={() => onBarrierChange(d)}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Duration / Stake summary row */}
                <div className='mcv-panel__summary'>
                    <button className='mcv-panel__summary-item' onClick={() => setShowDurationSheet(true)}>
                        <span className='mcv-panel__summary-lbl'>Duration</span>
                        <span className='mcv-panel__summary-val'>
                            {ticks} {DUR_UNIT_LABELS[durationUnit].toLowerCase()}
                        </span>
                    </button>
                    <div className='mcv-panel__summary-sep' />
                    {/* Inline editable stake — always visible, no sheet needed */}
                    <div className='mcv-panel__stake-inline'>
                        <span className='mcv-panel__summary-lbl'>Stake</span>
                        <input
                            className='mcv-stake-input'
                            type='number'
                            inputMode='decimal'
                            min={0.35}
                            step={0.01}
                            value={stakeRaw}
                            onChange={e => {
                                setStakeRaw(e.target.value);
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v >= 0.35) setStake(v);
                            }}
                            onBlur={() => {
                                const v = parseFloat(stakeRaw);
                                const clamped = Math.max(0.35, isNaN(v) ? 0.35 : v);
                                setStake(clamped);
                                setStakeRaw(clamped.toFixed(2));
                            }}
                        />
                        <span className='mcv-panel__summary-lbl mcv-panel__summary-lbl--cur'>{displayCur}</span>
                        <button
                            className={`mcv-panel__ai-btn${aiEnabled ? ' active' : ''}`}
                            onClick={() => setAiEnabled(v => !v)}
                            title='Open AI market scanner'
                        >
                            AI
                        </button>
                    </div>
                </div>

                <div className={`mcv-panel__ai${aiEnabled ? '' : ' mcv-panel__ai--closed'}`}>
                    <ChartAiControl
                        symbol={symbol}
                        group={group}
                        barrier={barrier}
                        currentDigit={currentDigit}
                        ticks={ticks}
                        durationUnit={durationUnit}
                        stake={stake}
                        onStakeChange={next => { setStake(next); setStakeRaw(next.toFixed(2)); }}
                        pcts={pcts}
                        onAutoTrade={(side, aiTicks, aiStake, aiBarrier) => buy(side, { ticks: aiTicks, stake: aiStake, barrier: aiBarrier })}
                        tradeBusy={!!loading}
                    />
                </div>

                {/* Result feedback */}
                {result && (
                    <div className={`mcv-panel__result ${result.ok ? 'ok' : 'err'}`}>{result.msg}</div>
                )}

                {/* Buy buttons */}
                <div className='mcv-panel__btns'>
                    <button
                        className='mcv-panel__buy mcv-panel__buy--over'
                        onClick={() => buy('over')}
                        disabled={!!loading}
                    >
                        <div className='mcv-panel__buy-top'>
                            <span className='mcv-panel__buy-icon'>↗</span>
                            <span className='mcv-panel__buy-label'>{overLabel}</span>
                        </div>
                        <div className='mcv-panel__buy-payout'>
                            <span>Payout</span>
                            <span>{overPayout != null ? `${fromUsd(overPayout).toFixed(2)} ${displayCur}` : loading === 'over' ? '…' : '—'}</span>
                        </div>
                    </button>

                    <button
                        className='mcv-panel__buy mcv-panel__buy--under'
                        onClick={() => buy('under')}
                        disabled={!!loading}
                    >
                        <div className='mcv-panel__buy-top'>
                            <span className='mcv-panel__buy-icon'>↙</span>
                            <span className='mcv-panel__buy-label'>{underLabel}</span>
                        </div>
                        <div className='mcv-panel__buy-payout'>
                            <span>Payout</span>
                            <span>{underPayout != null ? `${fromUsd(underPayout).toFixed(2)} ${displayCur}` : loading === 'under' ? '…' : '—'}</span>
                        </div>
                    </button>
                </div>

            </div>{/* /mcv-panel */}

            {/* ── Bottom sheets ──────────────────────────────────────────── */}
            {showTypeSheet && (
                <TradeTypeSheet
                    current={group.id}
                    onSelect={id => setGroupIdx(TRADE_GROUPS.findIndex(g => g.id === id))}
                    onClose={() => setShowTypeSheet(false)}
                />
            )}
            {showMarketSheet && activeSymbols.length > 0 && (
                <MarketSheet
                    current={symbol}
                    markets={activeSymbols}
                    onSelect={s => { onSymbolChange(s); }}
                    onClose={() => setShowMarketSheet(false)}
                />
            )}
            {showDurationSheet && (
                <DurationSheet
                    ticks={ticks}
                    durationUnit={durationUnit}
                    supportedUnits={group.supportedUnits}
                    minTickDur={group.minDur}
                    maxTickDur={group.maxDur}
                    onSet={(n, unit) => { setTicks(n); setDurationUnit(unit); }}
                    onClose={() => setShowDurationSheet(false)}
                />
            )}
            {showAmountSheet && (
                <AmountSheet
                    stake={stake}
                    displayCur={displayCur}
                    onSet={setStake}
                    onOpenAi={() => setAiEnabled(true)}
                    onClose={() => setShowAmountSheet(false)}
                />
            )}

        </div>
    );
};

export default MobileChartView;
