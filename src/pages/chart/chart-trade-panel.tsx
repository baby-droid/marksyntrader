// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import { publishMasterTrade, getMasterSource } from '@/utils/trade-bus';

/* ── Symbol display names ─────────────────────────────────────────────────── */
const SYMBOL_NAMES: Record<string, string> = {
    '1HZ100V': 'Volatility 100 (1s) Index',
    '1HZ10V':  'Volatility 10 (1s) Index',
    '1HZ25V':  'Volatility 25 (1s) Index',
    '1HZ50V':  'Volatility 50 (1s) Index',
    '1HZ75V':  'Volatility 75 (1s) Index',
    'R_100':   'Volatility 100 Index',
    'R_10':    'Volatility 10 Index',
    'R_25':    'Volatility 25 Index',
    'R_50':    'Volatility 50 Index',
    'R_75':    'Volatility 75 Index',
};
function symbolName(s: string) { return SYMBOL_NAMES[s] ?? s; }

/* ── Trade type groups ────────────────────────────────────────────────────── */
const TRADE_GROUPS = [
    { id: 'over_under',   label: 'Over / Under',       icon: '↑↓', typeA: 'DIGITOVER',  typeB: 'DIGITUNDER',  needsBarrier: true,  isAccumulator: false, durationUnit: 't', minDur: 1,  maxDur: 10  },
    { id: 'even_odd',     label: 'Even / Odd',          icon: '⚡', typeA: 'DIGITEVEN',  typeB: 'DIGITODD',    needsBarrier: false, isAccumulator: false, durationUnit: 't', minDur: 1,  maxDur: 10  },
    { id: 'match_differ', label: 'Match / Differ',      icon: '🎯', typeA: 'DIGITMATCH', typeB: 'DIGITDIFF',   needsBarrier: true,  isAccumulator: false, durationUnit: 't', minDur: 1,  maxDur: 10  },
    { id: 'accumulator',  label: 'Accumulator',         icon: '📊', typeA: 'ACCU',       typeB: 'ACCU',        needsBarrier: false, isAccumulator: true,  durationUnit: 't', minDur: 1,  maxDur: 10  },
    { id: 'rise_fall',    label: 'Rise / Fall',         icon: '📈', typeA: 'CALL',       typeB: 'PUT',         needsBarrier: false, isAccumulator: false, durationUnit: 't', minDur: 1,  maxDur: 10  },
    { id: 'higher_lower', label: 'Higher / Lower',      icon: '📊', typeA: 'CALL',       typeB: 'PUT',         needsBarrier: false, isAccumulator: false, durationUnit: 'm', minDur: 1,  maxDur: 60  },
    { id: 'asian',        label: 'Asian Up / Down',     icon: '🌏', typeA: 'ASIANU',     typeB: 'ASIAND',      needsBarrier: false, isAccumulator: false, durationUnit: 't', minDur: 5,  maxDur: 10  },
    { id: 'touch',        label: 'Touch / No Touch',    icon: '✋', typeA: 'ONETOUCH',   typeB: 'NOTOUCH',     needsBarrier: false, isAccumulator: false, durationUnit: 'm', minDur: 1,  maxDur: 60  },
    { id: 'reset',        label: 'Reset Call / Put',    icon: '🔄', typeA: 'RESETCALL',  typeB: 'RESETPUT',    needsBarrier: false, isAccumulator: false, durationUnit: 't', minDur: 5,  maxDur: 10  },
    { id: 'highlow',      label: 'High / Low Tick',     icon: '🔝', typeA: 'TICKHIGH',   typeB: 'TICKLOW',     needsBarrier: false, isAccumulator: false, durationUnit: 't', minDur: 5,  maxDur: 10  },
    { id: 'runhighlow',   label: 'Run High / Run Low',  icon: '🏃', typeA: 'RUNHIGH',    typeB: 'RUNLOW',      needsBarrier: false, isAccumulator: false, durationUnit: 't', minDur: 1,  maxDur: 10  },
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
    currentDigit: number | null;
    currentPrice: number | null;
    priceChange: number;
    pipSize: number;
    barrier: number;
    onBarrierChange: (d: number) => void;
}

/* ════════════════════════════════════════════════════════════════════════════ */
export const ChartTradePanel: React.FC<ChartTradePanelProps> = ({
    symbol,
    currentDigit,
    currentPrice,
    priceChange,
    pipSize,
    barrier,
    onBarrierChange,
}) => {
    const [groupId, setGroupId]       = useState(TRADE_GROUPS[0].id);
    const group = TRADE_GROUPS.find(g => g.id === groupId) ?? TRADE_GROUPS[0];

    const [ticks,      setTicks]      = useState(2);
    const [stake,      setStake]      = useState(10.00);
    const [growthRate, setGrowthRate] = useState(0.03); // Accumulator growth rate: 1%, 2%, 3%, 4%, 5%
    const [stakeMode, setStakeMode]   = useState<'stake' | 'payout'>('stake');
    const [loading,   setLoading]     = useState<'over' | 'under' | 'accu' | null>(null);
    const [accumContractId, setAccumContractId] = useState<number | null>(null);
    const [result,    setResult]      = useState<{ ok: boolean; msg: string } | null>(null);
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());

    const [overPayout,  setOverPayout]  = useState<number | null>(null);
    const [underPayout, setUnderPayout] = useState<number | null>(null);
    const [overPct,     setOverPct]     = useState<number | null>(null);
    const [underPct,    setUnderPct]    = useState<number | null>(null);
    const payoutTimerRef = useRef<any>(null);

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    useEffect(() => {
        setTicks(t => Math.min(Math.max(t, group.minDur), group.maxDur));
    }, [group]);

    /* ── Payout fetch (600ms debounce) ──────────────────────────────────── */
    const fetchPayouts = useCallback(() => {
        if (payoutTimerRef.current) clearTimeout(payoutTimerRef.current);
        payoutTimerRef.current = setTimeout(async () => {
            const api = (api_base as any).api;
            if (!api || !symbol) return;
            const base: any = {
                proposal: 1, amount: stake, basis: 'stake',
                currency: getDisplayCurrency() || 'USD',
                duration: ticks, duration_unit: group.durationUnit,
                underlying_symbol: symbol,
            };
            if (group.needsBarrier) base.barrier = String(barrier);
            try {
                const [aRes, bRes] = await Promise.all([
                    api.send({ ...base, contract_type: group.typeA }),
                    api.send({ ...base, contract_type: group.typeB }),
                ]);
                const aPayout = Number(aRes?.proposal?.payout ?? 0);
                const bPayout = Number(bRes?.proposal?.payout ?? 0);
                setOverPayout(aPayout > 0 ? aPayout : null);
                setUnderPayout(bPayout > 0 ? bPayout : null);
                setOverPct(aPayout > 0 ? ((aPayout - stake) / stake) * 100 : null);
                setUnderPct(bPayout > 0 ? ((bPayout - stake) / stake) * 100 : null);
            } catch {
                setOverPayout(null); setUnderPayout(null);
                setOverPct(null);   setUnderPct(null);
            }
        }, 600);
    }, [symbol, stake, ticks, barrier, group]);

    useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

    /* ── Accumulator buy ─────────────────────────────────────────────────── */
    const buyAccumulator = useCallback(async () => {
        if (loading) return;
        const api = (api_base as any).api;
        if (!api) { setResult({ ok: false, msg: '❌ Not connected' }); return; }
        setLoading('accu');
        setResult(null);
        try {
            const pr = await api.send({
                proposal: 1, amount: stake, basis: 'stake',
                contract_type: 'ACCU',
                currency: getDisplayCurrency() || 'USD',
                growth_rate: growthRate,
                underlying_symbol: symbol,
            });
            if (pr?.error) throw new Error(pr.error.message);
            const proposalId = pr?.proposal?.id;
            const askPrice   = Number(pr?.proposal?.ask_price ?? stake);
            if (!proposalId) throw new Error('Proposal failed');
            const buyRes = await api.send({ buy: proposalId, price: askPrice });
            if (buyRes?.error) throw new Error(buyRes.error.message);
            const contractId = Number(buyRes?.buy?.contract_id);
            setAccumContractId(contractId);
            setResult({ ok: true, msg: `✅ Accumulator #${contractId} running` });
        } catch (e: any) {
            setResult({ ok: false, msg: `❌ ${e.message}` });
        } finally {
            setLoading(null);
            setTimeout(() => setResult(null), 6000);
        }
    }, [loading, growthRate, stake, symbol]);

    const sellAccumulator = useCallback(async () => {
        if (!accumContractId || loading) return;
        const api = (api_base as any).api;
        if (!api) return;
        setLoading('accu');
        try {
            const res = await api.send({ sell: accumContractId, price: 0 });
            if (res?.error) throw new Error(res.error.message);
            const profit = Number(res?.sell?.sold_for ?? 0) - stake;
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
    }, [accumContractId, loading, stake]);

    /* ── Buy ─────────────────────────────────────────────────────────────── */
    const buy = useCallback(async (side: 'over' | 'under') => {
        if (loading) return;
        const api = (api_base as any).api;
        if (!api) { setResult({ ok: false, msg: '❌ Not connected' }); return; }
        setLoading(side);
        setResult(null);
        const contractType = side === 'over' ? group.typeA : group.typeB;
        try {
            const proposalReq: any = {
                proposal: 1, amount: stake, basis: 'stake',
                contract_type: contractType,
                currency: getDisplayCurrency() || 'USD',
                duration: ticks, duration_unit: group.durationUnit,
                underlying_symbol: symbol,
            };
            if (group.needsBarrier) proposalReq.barrier = String(barrier);
            const pr = await api.send(proposalReq);
            if (pr?.error) throw new Error(pr.error.message);
            const proposalId = pr?.proposal?.id;
            const askPrice   = Number(pr?.proposal?.ask_price ?? stake);
            if (!proposalId) throw new Error('Proposal failed');
            const buyRes = await api.send({ buy: proposalId, price: askPrice });
            if (buyRes?.error) throw new Error(buyRes.error.message);
            const contractId = buyRes?.buy?.contract_id;
            setResult({ ok: true, msg: `✅ #${contractId}` });
            window.dispatchEvent(new CustomEvent('chart:trade-started', {
                detail: { contractId: Number(contractId), ticks },
            }));
            try {
                const settleSub = (api_base as any).api.subscribe({
                    proposal_open_contract: 1, contract_id: Number(contractId), subscribe: 1,
                });
                settleSub.subscribe({
                    next: (res: any) => {
                        const poc = res?.proposal_open_contract;
                        if (!poc) return;
                        if (poc.status === 'won' || poc.status === 'lost') {
                            const won       = poc.status === 'won';
                            const profit    = Number(poc.profit ?? 0);
                            const exitStr   = poc.exit_tick_display_value ? String(poc.exit_tick_display_value).replace('.', '') : null;
                            const exitDigit = exitStr ? parseInt(exitStr[exitStr.length - 1], 10) : null;
                            window.dispatchEvent(new CustomEvent('chart:trade-settled', {
                                detail: { won, profit, exitDigit, barrier, contractType, contractId: Number(contractId) },
                            }));
                            settleSub.unsubscribe?.();
                        }
                    },
                    error: () => { try { settleSub.unsubscribe?.(); } catch { /* noop */ } },
                });
            } catch { /* non-fatal */ }
            try {
                publishMasterTrade({
                    symbol, contract_type: contractType, stake,
                    duration: ticks, duration_unit: group.durationUnit,
                    ...(group.needsBarrier ? { barrier: String(barrier) } : {}),
                    source: getMasterSource(), time: Date.now(), contract_id: Number(contractId),
                });
            } catch { /* never block */ }
        } catch (e: any) {
            setResult({ ok: false, msg: `❌ ${e.message}` });
        } finally {
            setLoading(null);
            setTimeout(() => setResult(null), 4000);
        }
    }, [loading, group, barrier, ticks, stake, symbol]);

    /* ── Label helpers ───────────────────────────────────────────────────── */
    const overLabel  = group.id === 'over_under' ? 'Over'   : group.id === 'even_odd' ? 'Even'  : group.id === 'asian' ? 'Asian Up'   : group.id === 'touch' ? 'Touch'    : group.id === 'reset' ? 'Reset ↑' : group.id === 'highlow' ? 'High Tick'  : group.id === 'runhighlow' ? 'Run High' : group.id === 'match_differ' ? 'Matches' : 'Rise';
    const underLabel = group.id === 'over_under' ? 'Under'  : group.id === 'even_odd' ? 'Odd'   : group.id === 'asian' ? 'Asian Down' : group.id === 'touch' ? 'No Touch' : group.id === 'reset' ? 'Reset ↓' : group.id === 'highlow' ? 'Low Tick'   : group.id === 'runhighlow' ? 'Run Low'  : group.id === 'match_differ' ? 'Differs' : 'Fall';

    const digitRows = [[0, 1, 2, 3, 4], [9, 8, 7, 6, 5]];
    const tickButtons = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(n => n >= group.minDur && n <= group.maxDur);

    /* ════════════════════════════════════════════════════════════════════ */
    return (
        <div className='ctp'>

            {/* ── Market selector (display only) ─────────────────────── */}
            <div className='ctp__section ctp__section--market'>
                <div className='ctp__section-label'>Market</div>
                <div className='ctp__market-display'>
                    <span className='ctp__market-icon'>V</span>
                    <span className='ctp__market-name'>{symbolName(symbol)}</span>
                    <AccountBadge />
                </div>
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

            {/* ── Ticks / Duration ──────────────────────────────────── */}
            {!group.isAccumulator && (
            <div className='ctp__section ctp__section--ticks'>
                <div className='ctp__section-label'>
                    {group.durationUnit === 't' ? 'Ticks' : 'Minutes'}
                    <span className='ctp__section-val'>{ticks}{group.durationUnit === 't' ? ' Ticks' : 'm'}</span>
                </div>
                {group.durationUnit === 't' ? (
                    <div className='ctp__tick-row'>
                        {tickButtons.map(n => (
                            <button
                                key={n}
                                className={`ctp__tick-btn${ticks === n ? ' active' : ''}`}
                                onClick={() => setTicks(n)}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                ) : (
                    <>
                        <input
                            type='range' min={group.minDur} max={group.maxDur} step={1}
                            value={ticks}
                            onChange={e => setTicks(Number(e.target.value))}
                            className='ctp__slider'
                        />
                        <div className='ctp__slider-marks'>
                            {[group.minDur, Math.round((group.minDur + group.maxDur) / 2), group.maxDur].map(n => (
                                <span key={n} className={ticks === n ? 'active' : ''}>{n}</span>
                            ))}
                        </div>
                    </>
                )}
            </div>
            )}{/* /!group.isAccumulator ticks section */}

            {/* ── Last Digit Prediction ─────────────────────────────── */}
            {group.needsBarrier && (
                <div className='ctp__section ctp__section--digit'>
                    <div className='ctp__section-label'>
                        Last Digit Prediction
                        <span className='ctp__section-val'>{barrier}</span>
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
                <div className='ctp__stake-tabs'>
                    <button className={`ctp__stake-tab${stakeMode === 'stake' ? ' active' : ''}`} onClick={() => setStakeMode('stake')}>Stake</button>
                    <button className={`ctp__stake-tab${stakeMode === 'payout' ? ' active' : ''}`} onClick={() => setStakeMode('payout')}>Payout</button>
                </div>
                <div className='ctp__stake-ctrl'>
                    <button className='ctp__stake-adj' onClick={() => setStake(s => Math.max(0.35, parseFloat((s - 1).toFixed(2))))}>−</button>
                    <div className='ctp__stake-mid'>
                        <input
                            className='ctp__stake-inp'
                            type='number' min={0.35} step={1}
                            value={stake}
                            onChange={e => setStake(parseFloat(e.target.value) || 0.35)}
                        />
                        <span className='ctp__stake-cur'>{displayCur}</span>
                    </div>
                    <button className='ctp__stake-adj' onClick={() => setStake(s => parseFloat((s + 1).toFixed(2)))}>+</button>
                </div>
                <div className='ctp__stake-presets'>
                    {[0.35, 1, 2, 10, 50].map(p => (
                        <button key={p} className={`ctp__preset${stake === p ? ' active' : ''}`} onClick={() => setStake(p)}>
                            {p === 0.35 ? '0.35' : p}
                        </button>
                    ))}
                </div>
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
