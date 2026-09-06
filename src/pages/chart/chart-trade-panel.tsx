// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import { publishMasterTrade, getMasterSource, createTradeKey } from '@/utils/trade-bus';
import ChartAiControl from './chart-ai';
import { getPocEntryEpoch, getPocStreamCount, getPocTickCount } from './chart-trade-ticks';

/* ── Symbol display names ─────────────────────────────────────────────────── */
const SYMBOL_NAMES: Record<string, string> = {
    '1HZ10V':  'Volatility 10 (1s) Index',
    '1HZ25V':  'Volatility 25 (1s) Index',
    '1HZ50V':  'Volatility 50 (1s) Index',
    '1HZ75V':  'Volatility 75 (1s) Index',
    '1HZ100V': 'Volatility 100 (1s) Index',
    'R_10':    'Volatility 10 Index',
    'R_25':    'Volatility 25 Index',
    'R_50':    'Volatility 50 Index',
    'R_75':    'Volatility 75 Index',
    'R_100':   'Volatility 100 Index',
};
function symbolName(s: string) { return SYMBOL_NAMES[s] ?? s; }

/**
 * Sort market symbols in canonical order:
 * 1) Volatility 1s (1HZ*) — lowest to highest
 * 2) Volatility plain (R_*) — lowest to highest
 * 3) Bear Market
 * 4) Bull Market
 * 5) Jump indices (JD*)
 * 6) Crash indices
 * 7) Boom indices
 * 8) Step indices (STP*)
 * 9) Range Break (RB*)
 * 10) Everything else alphabetically
 */
function marketGroupOrder(sym: string): number {
    const s = String(sym ?? '').toUpperCase();
    if (/^1HZ/.test(s))   return 0;
    if (/^R_/.test(s))    return 1;
    if (/BEAR/.test(s))   return 2;
    if (/BULL/.test(s))   return 3;
    if (/^JD/.test(s))    return 4;
    if (/CRASH/.test(s))  return 5;
    if (/BOOM/.test(s))   return 6;
    if (/^STP/.test(s))   return 7;
    if (/^RB/.test(s))    return 8;
    return 9;
}

/** Extract the numeric part for secondary sort within a group (e.g. "10", "25", "100"). */
function marketNumericKey(sym: string): number {
    const m = sym.match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
}

function sortActiveSymbols(list: Array<{symbol: string; display_name: string}>) {
    return [...list].sort((a, b) => {
        const ga = marketGroupOrder(a.symbol);
        const gb = marketGroupOrder(b.symbol);
        if (ga !== gb) return ga - gb;
        const na = marketNumericKey(a.symbol);
        const nb = marketNumericKey(b.symbol);
        if (na !== nb) return na - nb;
        return a.display_name.localeCompare(b.display_name);
    });
}

/* ── Duration unit metadata ───────────────────────────────────────────────── */
type DurUnit = 't' | 's' | 'm' | 'h';

const DUR_UNIT_LABELS: Record<DurUnit, string> = {
    t: 'Ticks', s: 'Seconds', m: 'Minutes', h: 'Hours',
};

/** Quick-pick presets for each duration unit */
const DUR_QUICK_PICKS: Record<DurUnit, number[]> = {
    t: [1, 2, 3, 4, 5, 6, 8, 10],
    s: [15, 30, 60, 120, 300, 600],
    m: [1, 2, 5, 10, 30, 60],
    h: [1, 2, 4, 8, 12, 24],
};

/** Min / Max for each unit — matched to Deriv synthetic-index limits */
const DUR_RANGE: Record<DurUnit, { min: number; max: number }> = {
    t: { min: 1,  max: 10  },
    s: { min: 15, max: 3600 },
    m: { min: 1,  max: 60  },
    h: { min: 1,  max: 24  },
};

/* ── Trade type groups ────────────────────────────────────────────────────── */
const TRADE_GROUPS = [
    { id: 'over_under',   label: 'Over / Under',       icon: '↑↓', typeA: 'DIGITOVER',  typeB: 'DIGITUNDER',  needsBarrier: true,  isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 1,  maxDur: 10, supportedUnits: ['t'] as DurUnit[]                },
    { id: 'even_odd',     label: 'Even / Odd',          icon: '⚡', typeA: 'DIGITEVEN',  typeB: 'DIGITODD',    needsBarrier: false, isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 1,  maxDur: 10, supportedUnits: ['t'] as DurUnit[]                },
    { id: 'match_differ', label: 'Match / Differ',      icon: '🎯', typeA: 'DIGITMATCH', typeB: 'DIGITDIFF',   needsBarrier: true,  isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 1,  maxDur: 10, supportedUnits: ['t'] as DurUnit[]                },
    { id: 'accumulator',  label: 'Accumulator',         icon: '📊', typeA: 'ACCU',       typeB: 'ACCU',        needsBarrier: false, isAccumulator: true,  durationUnit: 't' as DurUnit, minDur: 1,  maxDur: 10, supportedUnits: ['t'] as DurUnit[]                },
    { id: 'rise_fall',    label: 'Rise / Fall',         icon: '📈', typeA: 'CALL',       typeB: 'PUT',         needsBarrier: false, isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 1,  maxDur: 10, supportedUnits: ['t', 's', 'm', 'h'] as DurUnit[] },
    { id: 'higher_lower', label: 'Higher / Lower',      icon: '📊', typeA: 'CALL',       typeB: 'PUT',         needsBarrier: false, isAccumulator: false, durationUnit: 'm' as DurUnit, minDur: 1,  maxDur: 60, supportedUnits: ['m', 'h'] as DurUnit[]           },
    { id: 'asian',        label: 'Asian Up / Down',     icon: '🌏', typeA: 'ASIANU',     typeB: 'ASIAND',      needsBarrier: false, isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 5,  maxDur: 10, supportedUnits: ['t'] as DurUnit[]                },
    { id: 'touch',        label: 'Touch / No Touch',    icon: '✋', typeA: 'ONETOUCH',   typeB: 'NOTOUCH',     needsBarrier: false, isAccumulator: false, durationUnit: 'm' as DurUnit, minDur: 1,  maxDur: 60, supportedUnits: ['m', 'h'] as DurUnit[]           },
    { id: 'reset',        label: 'Reset Call / Put',    icon: '🔄', typeA: 'RESETCALL',  typeB: 'RESETPUT',    needsBarrier: false, isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 5,  maxDur: 10, supportedUnits: ['t'] as DurUnit[]                },
    { id: 'highlow',      label: 'High / Low Tick',     icon: '🔝', typeA: 'TICKHIGH',   typeB: 'TICKLOW',     needsBarrier: false, isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 5,  maxDur: 10, supportedUnits: ['t'] as DurUnit[]                },
    { id: 'runhighlow',   label: 'Run High / Run Low',  icon: '🏃', typeA: 'RUNHIGH',    typeB: 'RUNLOW',      needsBarrier: false, isAccumulator: false, durationUnit: 't' as DurUnit, minDur: 1,  maxDur: 10, supportedUnits: ['t'] as DurUnit[]                },
];

/* ── Account badge ────────────────────────────────────────────────────────── */
const AccountBadge: React.FC = () => {
    const [isDemo, setIsDemo] = React.useState(false);
    React.useEffect(() => {
        const check = () => {
            const id = localStorage.getItem('active_loginid') || '';
            setIsDemo(id.startsWith('VRTC') || id.startsWith('VR'));
        };
        check();
        window.addEventListener('storage', check);
        return () => window.removeEventListener('storage', check);
    }, []);
    return (
        <span className={`ctp-acct-badge ${isDemo ? 'demo' : 'real'}`}>
            {isDemo ? 'DEMO' : 'REAL'}
        </span>
    );
};

/* ── Props ─────────────────────────────────────────────────────────────────── */
interface ChartTradePanelProps {
    symbol: string;
    onSymbolChange?: (s: string) => void;
    currentDigit: number | null;
    pcts?: number[];
    currentPrice: number | null;
    priceChange: number;
    pipSize: number;
    barrier: number;
    onBarrierChange: (d: number) => void;
    onTradeGroupChange?: (groupId: string) => void;
    onAccumulatorGrowthRateChange?: (rate: number) => void;
}

/* ════════════════════════════════════════════════════════════════════════════ */
export const ChartTradePanel: React.FC<ChartTradePanelProps> = ({
    symbol,
    onSymbolChange,
    currentDigit,
    pcts = [],
    currentPrice,
    priceChange,
    pipSize,
    barrier,
    onBarrierChange,
    onTradeGroupChange,
    onAccumulatorGrowthRateChange,
}) => {
    /* ── Active symbols list for market selector ──────────────────────────
       Load once on mount, then re-read whenever api_base populates the list
       (api_base fires 'active_symbols_updated' after authorize). No polling —
       polling every 1500 ms hammers the WebSocket and competes with live ticks. */
    const [activeSymbols, setActiveSymbols] = React.useState<Array<{symbol: string; display_name: string}>>([]);
    React.useEffect(() => {
        const build = () => {
            const syms = (api_base as any)?.active_symbols ?? [];
            if (syms.length > 0) {
                const list = syms.map((s: any) => ({
                    symbol: s.symbol || s.underlying_symbol || '',
                    display_name: s.display_name || s.symbol || '',
                })).filter((s: any) => s.symbol);
                setActiveSymbols(sortActiveSymbols(list));
                return true;
            }
            return false;
        };

        if (!build()) {
            // Not ready yet — poll briefly until data arrives, then stop
            let attempts = 0;
            const probe = setInterval(() => {
                attempts++;
                if (build() || attempts >= 20) clearInterval(probe);
            }, 400);
            // Also listen for the event api_base fires after authorize
            const onUpdate = () => { build(); };
            window.addEventListener('active_symbols_updated', onUpdate);
            return () => { clearInterval(probe); window.removeEventListener('active_symbols_updated', onUpdate); };
        }
        const onUpdate = () => build();
        window.addEventListener('active_symbols_updated', onUpdate);
        return () => window.removeEventListener('active_symbols_updated', onUpdate);
    }, []);
    const [groupId, setGroupId]       = useState(TRADE_GROUPS[0].id);
    const group = TRADE_GROUPS.find(g => g.id === groupId) ?? TRADE_GROUPS[0];

    useEffect(() => {
        onTradeGroupChange?.(groupId);
    }, [groupId, onTradeGroupChange]);

    const [ticks,        setTicks]       = useState(2);
    const [durationUnit, setDurationUnit] = useState<DurUnit>(TRADE_GROUPS[0].supportedUnits[0]);
    const [durTab,       setDurTab]      = useState<'quick' | 'custom'>('quick');
    const [customDurRaw, setCustomDurRaw] = useState('');
    const [stake,      setStake]      = useState(10.00);
    const [stakeRaw,   setStakeRaw]   = useState('10');   // raw string for the input — can be empty
    const [growthRate, setGrowthRate] = useState(0.03); // Accumulator growth rate: 1%, 2%, 3%, 4%, 5%
    const [stakeMode, setStakeMode]   = useState<'stake' | 'payout'>('stake');
    const [allowEquals, setAllowEquals] = useState(false);
    const [loading,   setLoading]     = useState<'over' | 'under' | 'accu' | null>(null);
    const [accumContractId, setAccumContractId] = useState<number | null>(null);
    const [result,    setResult]      = useState<{ ok: boolean; msg: string } | null>(null);
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
    const [aiEnabled, setAiEnabled] = useState(false);

    // Accumulator-specific extras
    const [accumTakeProfitEnabled, setAccumTakeProfitEnabled] = useState(false);
    const [accumTakeProfit,        setAccumTakeProfit]        = useState(100);
    const [accumTakeProfitRaw,     setAccumTakeProfitRaw]     = useState('100');
    const [accumMaxPayout, setAccumMaxPayout] = useState<number | null>(null);
    const [accumMaxTicks,  setAccumMaxTicks]  = useState<number | null>(null);
    const accumProposalTimerRef = useRef<any>(null);
    const accumPocRef = useRef<{ subscription: any; subscriptionId: string | null } | null>(null);
    const [accumLive, setAccumLive] = useState<{
        status: string;
        tickPassed: number | null;
        profit: number | null;
        profitPercentage: number | null;
        currentValue: number | null;
        currentSpot: number | null;
        entrySpot: number | null;
    } | null>(null);

    const stopAccumulatorPoc = useCallback(() => {
        const current = accumPocRef.current;
        if (!current) return;
        try { current.subscription?.unsubscribe?.(); } catch { /* noop */ }
        if (current.subscriptionId) {
            try { (api_base as any).api?.send({ forget: current.subscriptionId }).catch(() => {}); } catch { /* noop */ }
        }
        accumPocRef.current = null;
    }, []);

    useEffect(() => () => stopAccumulatorPoc(), [stopAccumulatorPoc]);

    useEffect(() => {
        if (group.isAccumulator) {
            onAccumulatorGrowthRateChange?.(growthRate);
        }
    }, [group.isAccumulator, growthRate, onAccumulatorGrowthRateChange]);

    const [overPayout,  setOverPayout]  = useState<number | null>(null);
    const [underPayout, setUnderPayout] = useState<number | null>(null);
    const [overPct,     setOverPct]     = useState<number | null>(null);
    const [underPct,    setUnderPct]    = useState<number | null>(null);
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

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    useEffect(() => {
        // When group changes: reset to first supported unit, reset ticks to group min
        if (!group.isAccumulator) {
            stopAccumulatorPoc();
            setAccumContractId(null);
            setAccumLive(null);
        }
        const firstUnit = group.supportedUnits[0];
        setDurationUnit(firstUnit);
        setDurTab('quick');
        const range = firstUnit === 't'
            ? { min: group.minDur, max: group.maxDur }
            : DUR_RANGE[firstUnit];
        setTicks(range.min);
        setCustomDurRaw('');
        setAllowEquals(false);
    }, [group.id, group.isAccumulator, stopAccumulatorPoc]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Payout fetch (600ms debounce) — also warms the buy proposal cache ── */
    // Caching the proposal IDs lets buy() skip a full round-trip to Deriv and
    // execute on the exact tick the user sees, not 150-300 ms later.
    const warmProposalCache = useCallback(async () => {
        const api = (api_base as any).api;
        if (!api || !symbol) return;
        // Allow-equals switches CALL→CALLE and PUT→PUTE (Rise/Fall group only)
        const effTypeA = (group.id === 'rise_fall' && allowEquals) ? 'CALLE' : group.typeA;
        const effTypeB = (group.id === 'rise_fall' && allowEquals) ? 'PUTE'  : group.typeB;
        const base: any = {
            proposal: 1, amount: stake, basis: 'stake',
            currency: getDisplayCurrency() || 'USD',
            duration: ticks, duration_unit: durationUnit,
            underlying_symbol: symbol,
        };
        if (group.needsBarrier) base.barrier = String(barrier);
        try {
            const [aRes, bRes] = await Promise.all([
                api.send({ ...base, contract_type: effTypeA }),
                api.send({ ...base, contract_type: effTypeB }),
            ]);
            const aPayout = Number(aRes?.proposal?.payout ?? 0);
            const bPayout = Number(bRes?.proposal?.payout ?? 0);
            setOverPayout(aPayout > 0 ? aPayout : null);
            setUnderPayout(bPayout > 0 ? bPayout : null);
            setOverPct(aPayout > 0 ? ((aPayout - stake) / stake) * 100 : null);
            setUnderPct(bPayout > 0 ? ((bPayout - stake) / stake) * 100 : null);
            // Cache proposal IDs for instant buy (valid ~30s on Deriv; use 25s)
            const cacheKey = `${group.id}|${barrier}|${ticks}|${durationUnit}|${allowEquals}|${stake}|${symbol}`;
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
            setOverPct(null);   setUnderPct(null);
        }
    }, [symbol, stake, ticks, durationUnit, allowEquals, barrier, group]);

    const fetchPayouts = useCallback(() => {
        if (payoutTimerRef.current) clearTimeout(payoutTimerRef.current);
        payoutTimerRef.current = setTimeout(warmProposalCache, 600);
    }, [warmProposalCache]);

    useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

    /* ── Accumulator proposal — fetch max_payout, max_ticks ─────────────── */
    useEffect(() => {
        if (!group.isAccumulator || !symbol) return;
        if (accumProposalTimerRef.current) clearTimeout(accumProposalTimerRef.current);
        accumProposalTimerRef.current = setTimeout(async () => {
            const api = (api_base as any).api;
            if (!api) return;
            try {
                const pr = await api.send({
                    proposal: 1, amount: stake, basis: 'stake',
                    contract_type: 'ACCU',
                    currency: getDisplayCurrency() || 'USD',
                    growth_rate: growthRate,
                    underlying_symbol: symbol,
                });
                if (pr?.proposal) {
                    setAccumMaxPayout(pr.proposal.max_payout != null ? Number(pr.proposal.max_payout) : null);
                    setAccumMaxTicks(pr.proposal.max_ticks != null ? Number(pr.proposal.max_ticks) : null);
                }
            } catch { /* non-fatal */ }
        }, 600);
        return () => { if (accumProposalTimerRef.current) clearTimeout(accumProposalTimerRef.current); };
    }, [group.isAccumulator, symbol, growthRate, stake]);

    /* ── Accumulator buy ─────────────────────────────────────────────────── */
    const watchAccumulator = useCallback((contractId: number) => {
        const api = (api_base as any).api;
        if (!api || !contractId) return;
        stopAccumulatorPoc();
        try {
            const stream = api.subscribe({
                proposal_open_contract: 1,
                contract_id: contractId,
                subscribe: 1,
            });
            const current = { subscription: stream, subscriptionId: null as string | null };
            accumPocRef.current = current;
            stream.subscribe({
                next: (res: any) => {
                    const poc = res?.proposal_open_contract;
                    if (!poc) return;
                    if (!current.subscriptionId && res.subscription?.id) {
                        current.subscriptionId = res.subscription.id;
                    }
                    const profit = Number(poc.profit);
                    const profitPercentage = Number(poc.profit_percentage);
                    const currentValue = Number(poc.bid_price ?? poc.sell_price ?? poc.payout);
                    const currentSpot = Number(poc.current_spot ?? poc.exit_spot);
                    const entrySpot = Number(poc.entry_spot);
                    setAccumLive({
                        status: String(poc.status || 'open'),
                        tickPassed: Number.isFinite(Number(poc.tick_passed)) ? Number(poc.tick_passed) : null,
                        profit: Number.isFinite(profit) ? profit : null,
                        profitPercentage: Number.isFinite(profitPercentage) ? profitPercentage : null,
                        currentValue: Number.isFinite(currentValue) ? currentValue : null,
                        currentSpot: Number.isFinite(currentSpot) ? currentSpot : null,
                        entrySpot: Number.isFinite(entrySpot) ? entrySpot : null,
                    });

                    if (poc.status === 'sold' || poc.status === 'won' || poc.status === 'lost') {
                        const settledProfit = Number.isFinite(profit) ? profit : 0;
                        setAccumContractId(null);
                        setResult({
                            ok: poc.status === 'won' || (poc.status === 'sold' && settledProfit >= 0),
                            msg: `${poc.status === 'lost' ? '⚠ Accumulator lost' : '✅ Accumulator closed'} · ${fromUsd(settledProfit).toFixed(2)} ${displayCur}`,
                        });
                        stopAccumulatorPoc();
                    }
                },
                error: () => stopAccumulatorPoc(),
            });
        } catch { /* non-fatal: the buy itself already succeeded */ }
    }, [displayCur, stopAccumulatorPoc]);

    const buyAccumulator = useCallback(async () => {
        if (loading) return;
        const api = (api_base as any).api;
        if (!api) { setResult({ ok: false, msg: '❌ Not connected' }); return; }
        setLoading('accu');
        setResult(null);
        try {
            const proposalReq: any = {
                proposal: 1, amount: stake, basis: 'stake',
                contract_type: 'ACCU',
                currency: getDisplayCurrency() || 'USD',
                growth_rate: growthRate,
                underlying_symbol: symbol,
            };
            if (accumTakeProfitEnabled && accumTakeProfit > 0) {
                proposalReq.limit_order = { take_profit: accumTakeProfit };
            }
            const pr = await api.send(proposalReq);
            if (pr?.error) throw new Error(pr.error.message);
            const proposalId = pr?.proposal?.id;
            const askPrice   = Number(pr?.proposal?.ask_price ?? stake);
            if (!proposalId) throw new Error('Proposal failed');
            const tradeKey = createTradeKey('chart-accu');
            try {
                publishMasterTrade({
                    symbol,
                    contract_type: 'ACCU',
                    stake,
                    growth_rate: growthRate,
                    limit_order: proposalReq.limit_order,
                    source: getMasterSource(),
                    time: Date.now(),
                    trade_key: tradeKey,
                });
            } catch { /* never block the accumulator purchase */ }
            const buyRes = await api.send({ buy: proposalId, price: askPrice });
            if (buyRes?.error) throw new Error(buyRes.error.message);
            const contractId = Number(buyRes?.buy?.contract_id);
            try {
                publishMasterTrade({
                    symbol,
                    contract_type: 'ACCU',
                    stake,
                    growth_rate: growthRate,
                    limit_order: proposalReq.limit_order,
                    source: getMasterSource(),
                    time: Date.now(),
                    contract_id: contractId,
                    trade_key: tradeKey,
                });
            } catch { /* never block the accumulator purchase */ }
            setAccumContractId(contractId);
            setAccumLive({
                status: 'open',
                tickPassed: 0,
                profit: 0,
                profitPercentage: 0,
                currentValue: stake,
                currentSpot: null,
                entrySpot: null,
            });
            watchAccumulator(contractId);
            setResult({ ok: true, msg: `✅ Accumulator #${contractId} running` });
        } catch (e: any) {
            setResult({ ok: false, msg: `❌ ${e.message}` });
        } finally {
            setLoading(null);
            setTimeout(() => setResult(null), 6000);
        }
    }, [loading, growthRate, stake, symbol, accumTakeProfitEnabled, accumTakeProfit, watchAccumulator]);

    const sellAccumulator = useCallback(async () => {
        if (!accumContractId || loading) return;
        const api = (api_base as any).api;
        if (!api) return;
        setLoading('accu');
        try {
            const res = await api.send({ sell: accumContractId, price: 0 });
            if (res?.error) throw new Error(res.error.message);
            const profit = Number(res?.sell?.sold_for ?? 0) - stake;
            stopAccumulatorPoc();
            setAccumLive(prev => ({
                status: 'sold',
                tickPassed: prev?.tickPassed ?? null,
                profit,
                profitPercentage: stake > 0 ? (profit / stake) * 100 : null,
                currentValue: Number(res?.sell?.sold_for ?? 0),
                currentSpot: prev?.currentSpot ?? null,
                entrySpot: prev?.entrySpot ?? null,
            }));
            window.dispatchEvent(new CustomEvent('chart:trade-settled', {
                detail: { won: profit >= 0, profit, exitDigit: null, contractId: accumContractId },
            }));
            setAccumContractId(null);
            setResult({ ok: profit >= 0, msg: `${profit >= 0 ? '✅ Sold' : '⚠ Sold'} +${res?.sell?.sold_for ?? 0}` });
        } catch (e: any) {
            setResult({ ok: false, msg: `❌ ${e.message}` });
        } finally {
            setLoading(null);
            setTimeout(() => setResult(null), 4000);
        }
    }, [accumContractId, loading, stake, stopAccumulatorPoc]);

    /* ── Market type (informational) ─────────────────────────────────────── */
    // Entry-tick handling is uniform across market types; the chart counter
    // includes the entry tick and ignores only ticks before the entry epoch.
    const is1sMarket   = /^1HZ/i.test(symbol);
    const isJumpMarket = /^JD/i.test(symbol);

    /* ── Buy ─────────────────────────────────────────────────────────────── */
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
        let purchasedContractId: number | null = null;
        // Allow-equals: CALL→CALLE, PUT→PUTE for Rise/Fall
        const contractType = side === 'over'
            ? (group.id === 'rise_fall' && allowEquals ? 'CALLE' : group.typeA)
            : (group.id === 'rise_fall' && allowEquals ? 'PUTE'  : group.typeB);

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
            // warmProposalCache() pre-fetches proposals after every parameter
            // change. Reusing the cached ID means the buy message hits the server
            // on the very next WebSocket frame — no extra proposal latency — so
            // the contract enters on the tick the user is currently watching.
            const cacheKey = `${group.id}|${effectiveBarrier}|${effectiveTicks}|${durationUnit}|${allowEquals}|${effectiveStake}|${symbol}`;
            const cached   = cachedProposalRef.current;
            let proposalId: string | null = null;
            let askPrice:   number        = stake;
            let usedCache                 = false;

            if (!isOverrideBuy && cached?.key === cacheKey && cached.expiry > Date.now()) {
                proposalId = side === 'over' ? cached.overId : cached.underId;
                askPrice   = side === 'over' ? cached.overAsk : cached.underAsk;
                if (proposalId) {
                    cachedProposalRef.current = null; // one-time-use
                    usedCache = true;
                }
            }

            if (!proposalId) {
                const pr = await api.send(buildProposalReq());
                if (pr?.error) throw new Error(pr.error.message);
                proposalId = pr?.proposal?.id ?? null;
                askPrice   = Number(pr?.proposal?.ask_price ?? stake);
                if (!proposalId) throw new Error('Proposal failed');
            }
            const tradeKey = createTradeKey('chart');

            // ── PRE-SIGNAL (copy-trading timing fix) ──────────────────────────
            try {
                publishMasterTrade({
                    symbol, contract_type: contractType, stake: effectiveStake,
                    duration: effectiveTicks, duration_unit: durationUnit,
                    ...(group.needsBarrier ? { barrier: String(effectiveBarrier) } : {}),
                     source: getMasterSource(), time: Date.now(), trade_key: tradeKey,
                });
            } catch { /* never block trade */ }

            let buyRes = await api.send({ buy: proposalId, price: askPrice });
            // If the cached proposal expired, retry once with a fresh one
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
                detail: {
                    contractId: Number(contractId),
                    ticks: effectiveTicks,
                    purchaseTime: Number(buyRes?.buy?.purchase_time) || 0,
                    startTime: Number(buyRes?.buy?.start_time) || 0,
                },
            }));

            // Re-warm the proposal cache immediately so the next buy is also instant
            warmProposalCache();

            try {
                const cid = Number(contractId);
                const settleSub = (api_base as any).api.subscribe({
                    proposal_open_contract: 1, contract_id: cid, subscribe: 1,
                });
                let pocSubId: string | null = null;

                const forgetPoc = () => {
                    try { settleSub.unsubscribe?.(); } catch { /* noop */ }
                    if (pocSubId) {
                        try { (api_base as any).api?.send({ forget: pocSubId }).catch(() => {}); } catch { /* noop */ }
                        pocSubId = null;
                    }
                };

                // POC is the contract-side source of truth. The public chart
                // stream remains responsible for low-latency display updates.
                let savedEntryTime = 0;
                let entryTimeDispatched = false; // fire chart:trade-entry exactly once

                settleSub.subscribe({
                    next: (res: any) => {
                        const poc = res?.proposal_open_contract;
                        if (!poc) return;

                        if (!pocSubId && res.subscription?.id) pocSubId = res.subscription.id;

                        // ── Lock in the authoritative entry/spot time ───────────────
                        // chart-wrapper counts the entry tick and every following tick,
                        // while ignoring only ticks that occurred before entry.
                        if (savedEntryTime === 0) {
                            const pocEntryTime = getPocEntryEpoch(poc);
                            if (pocEntryTime !== null) {
                                savedEntryTime = pocEntryTime;
                            }
                            // Dispatch chart:trade-entry exactly once so chart-wrapper can
                            // immediately anchor its live-tick buffer to the correct epoch.
                            if (savedEntryTime > 0 && !entryTimeDispatched) {
                                entryTimeDispatched = true;
                                window.dispatchEvent(new CustomEvent('chart:trade-entry', {
                                    detail: { contractId: cid, entryEpoch: savedEntryTime },
                                }));
                            }
                        }

                        const pocTickCount = getPocTickCount(poc);
                        const pocStreamCount = getPocStreamCount(
                            poc.tick_stream,
                            savedEntryTime || getPocEntryEpoch(poc),
                        );
                        if (pocTickCount != null || pocStreamCount != null) {
                            window.dispatchEvent(new CustomEvent('chart:trade-progress', {
                                detail: {
                                    contractId: cid,
                                    tickCount: pocTickCount,
                                    tickStream: poc.tick_stream,
                                    entryEpoch: savedEntryTime || getPocEntryEpoch(poc),
                                },
                            }));
                        }

                        if (poc.status === 'won' || poc.status === 'lost') {
                            const won       = poc.status === 'won';
                            const profit    = Number(poc.profit ?? 0);
                            const exitStr   = poc.exit_tick_display_value
                                ? String(poc.exit_tick_display_value).replace('.', '') : null;
                            const exitDigit = exitStr
                                ? parseInt(exitStr[exitStr.length - 1], 10) : null;
                            window.dispatchEvent(new CustomEvent('chart:trade-settled', {
                                detail: {
                                    won, profit, exitDigit, barrier: effectiveBarrier,
                                    contractType, contractId: cid,
                                    tickCount: pocTickCount,
                                    tickStream: poc.tick_stream,
                                    entryEpoch: savedEntryTime || getPocEntryEpoch(poc),
                                },
                            }));
                            forgetPoc();
                        }
                    },
                    error: () => forgetPoc(),
                });
            } catch { /* non-fatal */ }

            try {
                if (contractId) {
                    publishMasterTrade({
                        symbol, contract_type: contractType, stake: effectiveStake,
                        duration: effectiveTicks, duration_unit: durationUnit,
                        ...(group.needsBarrier ? { barrier: String(effectiveBarrier) } : {}),
                         source: getMasterSource(), time: Date.now(), contract_id: Number(contractId), trade_key: tradeKey,
                    });
                }
            } catch { /* never block */ }
        } catch (e: any) {
            setResult({ ok: false, msg: `❌ ${e.message}` });
            return null;
        } finally {
            setLoading(null);
            setTimeout(() => setResult(null), 4000);
        }
        return purchasedContractId;
    }, [loading, group, allowEquals, barrier, ticks, durationUnit, stake, symbol, warmProposalCache]);

    /* ── Label helpers ───────────────────────────────────────────────────── */
    const overLabel  = group.id === 'over_under' ? 'Over'   : group.id === 'even_odd' ? 'Even'  : group.id === 'asian' ? 'Asian Up'   : group.id === 'touch' ? 'Touch'    : group.id === 'reset' ? 'Reset ↑' : group.id === 'highlow' ? 'High Tick'  : group.id === 'runhighlow' ? 'Run High' : group.id === 'match_differ' ? 'Matches' : 'Rise';
    const underLabel = group.id === 'over_under' ? 'Under'  : group.id === 'even_odd' ? 'Odd'   : group.id === 'asian' ? 'Asian Down' : group.id === 'touch' ? 'No Touch' : group.id === 'reset' ? 'Reset ↓' : group.id === 'highlow' ? 'Low Tick'   : group.id === 'runhighlow' ? 'Run Low'  : group.id === 'match_differ' ? 'Differs' : 'Fall';

    const digitRows = [[0, 1, 2, 3, 4], [9, 8, 7, 6, 5]];

    /* ── Duration picker helpers ─────────────────────────────────────────── */
    const durRange = durationUnit === 't'
        ? { min: group.minDur, max: group.maxDur }
        : DUR_RANGE[durationUnit];

    // Quick-pick buttons, filtered to the active unit's allowed range
    const durQuickPicks = DUR_QUICK_PICKS[durationUnit].filter(
        n => n >= durRange.min && n <= durRange.max
    );

    /** Display string for the duration display field */
    const durDisplayVal = `${ticks} ${DUR_UNIT_LABELS[durationUnit].toLowerCase()}`;
    const accumulatorMovement = accumLive?.currentSpot != null && accumLive?.entrySpot != null
        ? accumLive.currentSpot - accumLive.entrySpot
        : null;
    const accumulatorProgress = accumLive?.tickPassed != null && accumMaxTicks
        ? Math.min(100, Math.max(0, (accumLive.tickPassed / accumMaxTicks) * 100))
        : accumLive?.tickPassed != null ? Math.min(96, 18 + accumLive.tickPassed * 4) : 0;
    const accumulatorDecimals = Math.min(8, Math.max(2, String(pipSize || 0.01).split('.')[1]?.length || 2));
    const accumulatorMoney = (value: number | null | undefined) =>
        value == null ? '—' : `${value >= 0 ? '+' : ''}${fromUsd(value).toFixed(2)} ${displayCur}`;

    /** Called when user switches duration unit tab */
    const handleUnitChange = (unit: DurUnit) => {
        setDurationUnit(unit);
        setDurTab('quick');
        setCustomDurRaw('');
        const range = unit === 't' ? { min: group.minDur, max: group.maxDur } : DUR_RANGE[unit];
        // pick first quick-pick that fits, otherwise range.min
        const picks = DUR_QUICK_PICKS[unit].filter(n => n >= range.min && n <= range.max);
        setTicks(picks.length > 0 ? picks[0] : range.min);
    };

    /* ════════════════════════════════════════════════════════════════════ */
    return (
        <div className='ctp'>

            {/* ── Market selector (live — syncs SmartChart) ──────────── */}
            <div className='ctp__section ctp__section--market'>
                <div className='ctp__section-label'>
                    Market
                    <AccountBadge />
                </div>
                <select
                    className='ctp__type-select ctp__type-select--market'
                    value={symbol}
                    onChange={e => onSymbolChange?.(e.target.value)}
                    disabled={!onSymbolChange || activeSymbols.length === 0}
                >
                    {activeSymbols.length > 0
                        ? activeSymbols.map(s => (
                            <option key={s.symbol} value={s.symbol}>{s.display_name}</option>
                          ))
                        : <option value={symbol}>{symbolName(symbol)}</option>
                    }
                </select>
            </div>

            {/* ── Contract type ─────────────────────────────────────── */}
            <div className='ctp__section ctp__section--contract'>
                <div className='ctp__section-label'>Contract Type</div>
                <select
                    className='ctp__type-select'
                    value={groupId}
                    onChange={e => setGroupId(e.target.value)}
                >
                    {TRADE_GROUPS.map(g => (
                        <option key={g.id} value={g.id}>{g.icon} {g.label}</option>
                    ))}
                </select>
            </div>

            {/* ── Accumulator growth rate ───────────────────────────── */}
            {group.isAccumulator && (
                <div className='ctp__section ctp__section--ticks'>
                    <div className='ctp__section-label'>
                        Growth Rate
                        <span className='ctp__section-val'>{(growthRate * 100).toFixed(0)}%</span>
                    </div>
                    <div className='ctp__tick-row'>
                        {[0.01, 0.02, 0.03, 0.04, 0.05].map(r => (
                            <button
                                key={r}
                                className={`ctp__tick-btn${growthRate === r ? ' active' : ''}`}
                                onClick={() => setGrowthRate(r)}
                            >
                                {(r * 100).toFixed(0)}%
                            </button>
                        ))}
                    </div>
                    {accumContractId && (
                        <div className='ctp__accu-running'>
                            <span className='ctp__accu-dot' />
                            Accumulator #{accumContractId} running
                        </div>
                    )}
                </div>
            )}

            {/* ── Live accumulator position ───────────────────────────── */}
            {group.isAccumulator && (accumContractId || accumLive) && (
                <div className='ctp__accu-stats' aria-live='polite'>
                    <div className='ctp__accu-stats-head'>
                        <span>Accumulator position</span>
                        <strong className={`ctp__accu-status ctp__accu-status--${accumLive?.status || 'open'}`}>
                            {accumLive?.status === 'sold' ? 'Sold' : accumLive?.status === 'won' ? 'Won' : accumLive?.status === 'lost' ? 'Lost' : 'Live'}
                        </strong>
                    </div>
                    <div className='ctp__accu-progress' role='progressbar' aria-valuenow={Math.round(accumulatorProgress)} aria-valuemin={0} aria-valuemax={100}>
                        <span style={{ width: `${accumulatorProgress}%` }} />
                    </div>
                    <div className='ctp__accu-stats-grid'>
                        <div>
                            <span>Ticks</span>
                            <strong>{accumLive?.tickPassed ?? 0}{accumMaxTicks ? ` / ${accumMaxTicks}` : ''}</strong>
                        </div>
                        <div>
                            <span>Movement</span>
                            <strong className={accumulatorMovement != null && accumulatorMovement >= 0 ? 'is-positive' : 'is-negative'}>
                                {accumulatorMovement == null ? '—' : `${accumulatorMovement >= 0 ? '+' : ''}${accumulatorMovement.toFixed(accumulatorDecimals)}`}
                            </strong>
                        </div>
                        <div>
                            <span>Profit / loss</span>
                            <strong className={(accumLive?.profit ?? 0) >= 0 ? 'is-positive' : 'is-negative'}>
                                {accumulatorMoney(accumLive?.profit)}
                            </strong>
                        </div>
                        <div>
                            <span>Return</span>
                            <strong className={(accumLive?.profitPercentage ?? 0) >= 0 ? 'is-positive' : 'is-negative'}>
                                {accumLive?.profitPercentage == null ? '—' : `${accumLive.profitPercentage >= 0 ? '+' : ''}${accumLive.profitPercentage.toFixed(2)}%`}
                            </strong>
                        </div>
                    </div>
                    {accumLive?.currentValue != null && (
                        <div className='ctp__accu-value-row'>
                            <span>Current sell value</span>
                            <strong>{fromUsd(accumLive.currentValue).toFixed(2)} {displayCur}</strong>
                        </div>
                    )}
                </div>
            )}

            {/* ── Accumulator Take Profit + info row ───────────────── */}
            {group.isAccumulator && (
                <div className='ctp__section ctp__accu-tp-section'>
                    <div className='ctp__accu-tp-row'>
                        <label className='ctp__accu-tp-label'>
                            <input
                                type='checkbox'
                                className='ctp__accu-tp-check'
                                checked={accumTakeProfitEnabled}
                                onChange={e => setAccumTakeProfitEnabled(e.target.checked)}
                                disabled={!!accumContractId}
                            />
                            <span>Take profit</span>
                        </label>
                        <span className='ctp__info-icon' title='Automatically sell when your profit reaches this amount'>ⓘ</span>
                    </div>
                    {accumTakeProfitEnabled && !accumContractId && (
                        <div className='ctp__stake-ctrl ctp__accu-tp-ctrl'>
                            <button className='ctp__stake-adj' onClick={() => {
                                const next = Math.max(1, parseFloat((accumTakeProfit - 10).toFixed(2)));
                                setAccumTakeProfit(next); setAccumTakeProfitRaw(String(next));
                            }}>−</button>
                            <div className='ctp__stake-mid'>
                                <input
                                    className='ctp__stake-inp'
                                    type='text'
                                    inputMode='decimal'
                                    value={accumTakeProfitRaw}
                                    onFocus={e => e.target.select()}
                                    onChange={e => {
                                        const raw = e.target.value;
                                        if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                                            setAccumTakeProfitRaw(raw);
                                            const v = parseFloat(raw);
                                            if (!isNaN(v) && v > 0) setAccumTakeProfit(v);
                                        }
                                    }}
                                    onBlur={() => {
                                        const v = parseFloat(accumTakeProfitRaw);
                                        const c = isNaN(v) || v < 1 ? 1 : parseFloat(v.toFixed(2));
                                        setAccumTakeProfit(c); setAccumTakeProfitRaw(String(c));
                                    }}
                                />
                                <span className='ctp__stake-cur'>{displayCur}</span>
                            </div>
                            <button className='ctp__stake-adj' onClick={() => {
                                const next = parseFloat((accumTakeProfit + 10).toFixed(2));
                                setAccumTakeProfit(next); setAccumTakeProfitRaw(String(next));
                            }}>+</button>
                        </div>
                    )}
                    {(accumMaxPayout != null || accumMaxTicks != null) && (
                        <div className='ctp__accu-info'>
                            {accumMaxPayout != null && (
                                <div className='ctp__accu-info-row'>
                                    <span className='ctp__accu-info-key'>Max. payout</span>
                                    <span className='ctp__accu-info-val'>{fromUsd(accumMaxPayout).toFixed(2)} {displayCur}</span>
                                </div>
                            )}
                            {accumMaxTicks != null && (
                                <div className='ctp__accu-info-row'>
                                    <span className='ctp__accu-info-key'>Max. ticks</span>
                                    <span className='ctp__accu-info-val'>{accumMaxTicks} ticks</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Duration Picker ───────────────────────────────────── */}
            {!group.isAccumulator && (
            <div className='ctp__section ctp__section--duration'>
                {/* Header row: label + current value display */}
                <div className='ctp__section-label'>
                    ⏱ Duration
                    <span className='ctp__dur-display'>{durDisplayVal}</span>
                </div>
                <div className='ctp__dur-picker'>
                    {/* Left sidebar: unit selector */}
                    <div className='ctp__dur-units'>
                        {group.supportedUnits.map(unit => (
                            <button
                                key={unit}
                                className={`ctp__dur-unit-btn${durationUnit === unit ? ' active' : ''}`}
                                onClick={() => handleUnitChange(unit)}
                            >
                                {DUR_UNIT_LABELS[unit]}
                            </button>
                        ))}
                    </div>
                    {/* Right area: Quick picks / Custom tabs + content */}
                    <div className='ctp__dur-right'>
                        <div className='ctp__dur-tabs'>
                            <button
                                className={`ctp__dur-tab${durTab === 'quick' ? ' active' : ''}`}
                                onClick={() => setDurTab('quick')}
                            >Quick picks</button>
                            <button
                                className={`ctp__dur-tab${durTab === 'custom' ? ' active' : ''}`}
                                onClick={() => { setDurTab('custom'); setCustomDurRaw(String(ticks)); }}
                            >Custom</button>
                        </div>
                        {durTab === 'quick' ? (
                            <div className='ctp__dur-picks'>
                                {durQuickPicks.map(n => (
                                    <button
                                        key={n}
                                        className={`ctp__dur-pick-btn${ticks === n ? ' active' : ''}`}
                                        onClick={() => setTicks(n)}
                                    >
                                        {n} {durationUnit === 't' ? (n === 1 ? 'tick' : 'ticks')
                                             : durationUnit === 's' ? (n === 1 ? 'sec' : 'secs')
                                             : durationUnit === 'm' ? (n === 1 ? 'min' : 'mins')
                                             : (n === 1 ? 'hr' : 'hrs')}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className='ctp__dur-custom'>
                                <div className='ctp__dur-custom-row'>
                                    <button className='ctp__dur-custom-adj' onClick={() => {
                                        const next = Math.max(durRange.min, ticks - 1);
                                        setTicks(next); setCustomDurRaw(String(next));
                                    }}>−</button>
                                    <input
                                        className='ctp__dur-custom-inp'
                                        type='text'
                                        inputMode='numeric'
                                        value={customDurRaw}
                                        placeholder={String(durRange.min)}
                                        onFocus={e => e.target.select()}
                                        onChange={e => {
                                            const raw = e.target.value.replace(/[^\d]/g, '');
                                            setCustomDurRaw(raw);
                                            const v = parseInt(raw, 10);
                                            if (!isNaN(v)) setTicks(v);
                                        }}
                                        onBlur={() => {
                                            const v = parseInt(customDurRaw, 10);
                                            const clamped = isNaN(v)
                                                ? durRange.min
                                                : Math.min(Math.max(v, durRange.min), durRange.max);
                                            setTicks(clamped);
                                            setCustomDurRaw(String(clamped));
                                        }}
                                    />
                                    <button className='ctp__dur-custom-adj' onClick={() => {
                                        const next = Math.min(durRange.max, ticks + 1);
                                        setTicks(next); setCustomDurRaw(String(next));
                                    }}>+</button>
                                </div>
                                <div className='ctp__dur-custom-range'>
                                    {durRange.min}–{durRange.max} {DUR_UNIT_LABELS[durationUnit].toLowerCase()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            )}{/* /!group.isAccumulator duration section */}

            {/* ── Last Digit Prediction ─────────────────────────────── */}
            {group.needsBarrier && (
                <div className='ctp__section ctp__section--digit'>
                    <div className='ctp__section-label'>
                        🎯 Last Digit Prediction
                        <span className='ctp__section-val'>Selected: {barrier}</span>
                    </div>
                    <div className='ctp__digits'>
                        {digitRows.map((row, ri) => (
                            <div key={ri} className='ctp__digits-row'>
                                {row.map(d => (
                                    <button
                                        key={d}
                                        className={[
                                            'ctp__digit-btn',
                                            barrier === d     ? 'active'  : '',
                                            currentDigit === d ? 'current' : '',
                                        ].filter(Boolean).join(' ')}
                                        onClick={() => onBarrierChange(d)}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Stake ─────────────────────────────────────────────── */}
            <div className='ctp__section ctp__section--stake'>
                <div className='ctp__section-label'>
                    💰 Stake Amount
                    <span className='ctp__section-val'>{stakeRaw || '0'} {displayCur}</span>
                </div>
                <div className='ctp__stake-tabs'>
                    <button className={`ctp__stake-tab${stakeMode === 'stake' ? ' active' : ''}`} onClick={() => setStakeMode('stake')}>Stake</button>
                    <button className={`ctp__stake-tab${stakeMode === 'payout' ? ' active' : ''}`} onClick={() => setStakeMode('payout')}>Payout</button>
                </div>
                <div className='ctp__stake-ctrl'>
                    <button className='ctp__stake-adj' onClick={() => {
                        const next = parseFloat(Math.max(0.35, stake - 1).toFixed(2));
                        setStake(next); setStakeRaw(String(next));
                    }}>−</button>
                    <div className='ctp__stake-mid'>
                        <input
                            className='ctp__stake-inp'
                            type='text'
                            inputMode='decimal'
                            value={stakeRaw}
                            onFocus={e => e.target.select()}
                            onChange={e => {
                                const raw = e.target.value;
                                // Allow empty string and any partial number while typing
                                if (raw === '' || /^-?\d*\.?\d*$/.test(raw)) {
                                    setStakeRaw(raw);
                                    const v = parseFloat(raw);
                                    if (!isNaN(v)) setStake(v);
                                }
                            }}
                            onBlur={() => {
                                const v = parseFloat(stakeRaw);
                                const clamped = isNaN(v) || v < 0.35 ? 0.35 : parseFloat(v.toFixed(2));
                                setStake(clamped);
                                setStakeRaw(String(clamped));
                            }}
                        />
                        <span className='ctp__stake-cur'>{displayCur}</span>
                    </div>
                    <button className='ctp__stake-adj' onClick={() => {
                        const next = parseFloat((stake + 1).toFixed(2));
                        setStake(next); setStakeRaw(String(next));
                    }}>+</button>
                </div>
                {/* Preset quick-select chips — click to apply, click active to clear */}
                <div className='ctp__stake-presets'>
                    {[0.35, 1, 2, 10].map(p => {
                        const isActive = stake === p;
                        return (
                            <button
                                key={p}
                                className={`ctp__preset${isActive ? ' active' : ''}`}
                                onClick={() => {
                                    const next = isActive ? 0.35 : p;
                                    setStake(next); setStakeRaw(String(next));
                                }}
                                title={isActive ? 'Click to clear preset' : `Set stake to ${p}`}
                            >
                                {p === 0.35 ? '0.35' : p}
                                {isActive && <span className='ctp__preset-x'>✕</span>}
                            </button>
                        );
                    })}
                    <button
                        className={`ctp__preset ctp__preset--ai${aiEnabled ? ' active' : ''}`}
                        onClick={() => setAiEnabled(v => !v)}
                        title='Open AI market scanner'
                    >
                        AI
                    </button>
                </div>
            </div>

            <div className={`ctp__ai-slot${aiEnabled ? '' : ' ctp__ai-slot--closed'}`}>
                <ChartAiControl
                    symbol={symbol}
                    group={group}
                    barrier={barrier}
                    currentDigit={currentDigit}
                    ticks={ticks}
                    durationUnit={durationUnit}
                    stake={stake}
                    onStakeChange={next => { setStake(next); setStakeRaw(String(next)); }}
                    pcts={pcts}
                    onAutoTrade={(side, aiTicks, aiStake, aiBarrier) => buy(side, { ticks: aiTicks, stake: aiStake, barrier: aiBarrier })}
                    tradeBusy={!!loading}
                />
            </div>

            {/* ── Result feedback ───────────────────────────────────── */}
            {result && (
                <div className={`ctp__result ${result.ok ? 'ok' : 'err'}`}>{result.msg}</div>
            )}

            {/* ── Accumulator buttons ───────────────────────────────── */}
            {group.isAccumulator ? (
                <div className='ctp__section ctp__section--over'>
                    {!accumContractId ? (
                        <button
                            className='ctp__buy-btn ctp__buy-btn--over'
                            onClick={buyAccumulator}
                            disabled={!!loading}
                        >
                            <div className='ctp__buy-inner'>
                                <div className='ctp__buy-top'>
                                    <span className='ctp__buy-arrow'>📊</span>
                                    <span className='ctp__buy-label'>Buy Accumulator</span>
                                    <span className='ctp__buy-pct'>{(growthRate * 100).toFixed(0)}%/tick</span>
                                </div>
                                <div className='ctp__buy-sub'>Grows by {(growthRate * 100).toFixed(0)}% each tick · sell anytime</div>
                            </div>
                        </button>
                    ) : (
                        <button
                            className='ctp__buy-btn ctp__buy-btn--accu-sell'
                            onClick={sellAccumulator}
                            disabled={!!loading}
                        >
                            <div className='ctp__buy-inner'>
                                <div className='ctp__buy-top'>
                                    <span className='ctp__buy-arrow'>💰</span>
                                    <span className='ctp__buy-label'>Sell Now</span>
                                    <span className='ctp__buy-pct'>#{accumContractId}</span>
                                </div>
                                <div className='ctp__buy-sub'>Take profit on your accumulator</div>
                            </div>
                        </button>
                    )}
                </div>
            ) : (
                <>
                {/* ── Over button ─────────────────────────────────── */}
                <div className='ctp__section ctp__section--over'>
                    <button
                        className='ctp__buy-btn ctp__buy-btn--over'
                        onClick={() => buy('over')}
                        disabled={!!loading}
                    >
                        <div className='ctp__buy-inner'>
                            <div className='ctp__buy-top'>
                                <span className='ctp__buy-arrow'>↑</span>
                                <span className='ctp__buy-label'>{overLabel}</span>
                                <span className='ctp__buy-pct'>
                                    {overPct != null ? `${overPct.toFixed(2)}%` : loading === 'over' ? '…' : '—'}
                                </span>
                            </div>
                            <div className='ctp__buy-sub'>
                                {overPayout != null
                                    ? `Payout ${fromUsd(overPayout).toFixed(2)} ${displayCur}`
                                    : '\u00A0'}
                            </div>
                        </div>
                    </button>
                </div>

                {/* ── Under button ────────────────────────────────── */}
                <div className='ctp__section ctp__section--under'>
                    <button
                        className='ctp__buy-btn ctp__buy-btn--under'
                        onClick={() => buy('under')}
                        disabled={!!loading}
                    >
                        <div className='ctp__buy-inner'>
                            <div className='ctp__buy-top'>
                                <span className='ctp__buy-arrow'>↓</span>
                                <span className='ctp__buy-label'>{underLabel}</span>
                                <span className='ctp__buy-pct'>
                                    {underPct != null ? `${underPct.toFixed(2)}%` : loading === 'under' ? '…' : '—'}
                                </span>
                            </div>
                            <div className='ctp__buy-sub'>
                                {underPayout != null
                                    ? `Payout ${fromUsd(underPayout).toFixed(2)} ${displayCur}`
                                    : '\u00A0'}
                            </div>
                        </div>
                    </button>
                </div>
                </>
            )}

        </div>
    );
};

export default ChartTradePanel;
