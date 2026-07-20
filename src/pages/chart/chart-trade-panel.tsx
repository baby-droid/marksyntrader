// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import { publishMasterTrade, getMasterSource } from '@/utils/trade-bus';

/* ── All Deriv contract trade groups (digit + directional + touch) ── */
const TRADE_GROUPS = [
    { id: 'over_under',   label: 'Over / Under',      icon: '↑↓', typeA: 'DIGITOVER',  typeB: 'DIGITUNDER',  needsBarrier: true,  durationUnit: 't', minDur: 1, maxDur: 10 },
    { id: 'even_odd',     label: 'Even / Odd',         icon: '⚡', typeA: 'DIGITEVEN',  typeB: 'DIGITODD',    needsBarrier: false, durationUnit: 't', minDur: 1, maxDur: 10 },
    { id: 'match_differ', label: 'Match / Differ',     icon: '🎯', typeA: 'DIGITMATCH', typeB: 'DIGITDIFF',   needsBarrier: true,  durationUnit: 't', minDur: 1, maxDur: 10 },
    { id: 'rise_fall',    label: 'Rise / Fall',        icon: '📈', typeA: 'CALL',       typeB: 'PUT',         needsBarrier: false, durationUnit: 't', minDur: 1, maxDur: 10 },
    { id: 'higher_lower', label: 'Higher / Lower',     icon: '📊', typeA: 'CALL',       typeB: 'PUT',         needsBarrier: false, durationUnit: 'm', minDur: 1, maxDur: 60 },
    { id: 'asian',        label: 'Asian Up / Down',    icon: '🌏', typeA: 'ASIANU',     typeB: 'ASIAND',      needsBarrier: false, durationUnit: 't', minDur: 5, maxDur: 10 },
    { id: 'touch',        label: 'Touch / No Touch',   icon: '✋', typeA: 'ONETOUCH',   typeB: 'NOTOUCH',     needsBarrier: false, durationUnit: 'm', minDur: 1, maxDur: 60 },
    { id: 'reset',        label: 'Reset Call / Put',   icon: '🔄', typeA: 'RESETCALL',  typeB: 'RESETPUT',    needsBarrier: false, durationUnit: 't', minDur: 5, maxDur: 10 },
    { id: 'highlow',      label: 'High Tick / Low Tick', icon: '🔝', typeA: 'TICKHIGH',  typeB: 'TICKLOW',    needsBarrier: false, durationUnit: 't', minDur: 5, maxDur: 10 },
    { id: 'runhighlow',   label: 'Run High / Run Low', icon: '🏃', typeA: 'RUNHIGH',    typeB: 'RUNLOW',      needsBarrier: false, durationUnit: 't', minDur: 1, maxDur: 10 },
];

/* ─── Account badge ─── */
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

interface ChartTradePanelProps {
    symbol: string;
    currentDigit: number | null;
    currentPrice: number | null;
    priceChange: number;
    pipSize: number;
    barrier: number;
    onBarrierChange: (d: number) => void;
}

export const ChartTradePanel: React.FC<ChartTradePanelProps> = ({
    symbol,
    currentDigit,
    currentPrice,
    priceChange,
    pipSize,
    barrier,
    onBarrierChange,
}) => {
    const [groupId, setGroupId]     = useState(TRADE_GROUPS[0].id);
    const group = TRADE_GROUPS.find(g => g.id === groupId) ?? TRADE_GROUPS[0];

    const [ticks, setTicks]         = useState(5);
    const [stake, setStake]         = useState(10.00);
    const [stakeMode, setStakeMode] = useState<'stake' | 'payout'>('stake');
    const [loading, setLoading]     = useState<'over' | 'under' | null>(null);
    const [result, setResult]       = useState<{ ok: boolean; msg: string } | null>(null);
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());

    const [overPayout,  setOverPayout]  = useState<number | null>(null);
    const [underPayout, setUnderPayout] = useState<number | null>(null);
    const [overPct,     setOverPct]     = useState<number | null>(null);
    const [underPct,    setUnderPct]    = useState<number | null>(null);
    const payoutTimerRef = useRef<any>(null);

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    // Clamp ticks to group limits when group changes
    useEffect(() => {
        setTicks(t => Math.min(Math.max(t, group.minDur), group.maxDur));
    }, [group]);

    const fetchPayouts = useCallback(() => {
        if (payoutTimerRef.current) clearTimeout(payoutTimerRef.current);
        payoutTimerRef.current = setTimeout(async () => {
            const api = (api_base as any).api;
            if (!api || !symbol) return;

            const base: any = {
                proposal: 1,
                amount:   stake,
                basis:    'stake',
                currency: getDisplayCurrency() || 'USD',
                duration: ticks,
                duration_unit: group.durationUnit,
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

    const buy = useCallback(async (side: 'over' | 'under') => {
        if (loading) return;
        const api = (api_base as any).api;
        if (!api) { setResult({ ok: false, msg: '❌ Not connected' }); return; }

        setLoading(side);
        setResult(null);

        const contractType = side === 'over' ? group.typeA : group.typeB;

        try {
            const proposalReq: any = {
                proposal: 1,
                amount: stake,
                basis: 'stake',
                contract_type: contractType,
                currency: getDisplayCurrency() || 'USD',
                duration: ticks,
                duration_unit: group.durationUnit,
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
            setResult({ ok: true, msg: `✅ #${contractId} open` });

            // Emit tick counter start event
            window.dispatchEvent(new CustomEvent('chart:trade-started', {
                detail: { contractId: Number(contractId), ticks },
            }));

            // Subscribe to contract settlement
            try {
                const settleSub = (api_base as any).api.subscribe({
                    proposal_open_contract: 1,
                    contract_id: Number(contractId),
                    subscribe: 1,
                });
                settleSub.subscribe({
                    next: (res: any) => {
                        const poc = res?.proposal_open_contract;
                        if (!poc) return;
                        if (poc.status === 'won' || poc.status === 'lost') {
                            const won    = poc.status === 'won';
                            const profit = Number(poc.profit ?? 0);
                            const exitStr = poc.exit_tick_display_value
                                ? String(poc.exit_tick_display_value).replace('.', '')
                                : null;
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

            // Publish to copy-trading engine
            try {
                publishMasterTrade({
                    symbol,
                    contract_type: contractType,
                    stake,
                    duration:      ticks,
                    duration_unit: group.durationUnit,
                    ...(group.needsBarrier ? { barrier: String(barrier) } : {}),
                    source:      getMasterSource(),
                    time:        Date.now(),
                    contract_id: Number(contractId),
                });
            } catch { /* never block trade */ }
        } catch (e: any) {
            setResult({ ok: false, msg: `❌ ${e.message}` });
        } finally {
            setLoading(null);
            setTimeout(() => setResult(null), 4000);
        }
    }, [loading, group, barrier, ticks, stake, symbol]);

    const overLabel  = group.id === 'over_under' ? 'Over'  : group.id === 'rise_fall' || group.id === 'higher_lower' ? 'Rise'   : group.id === 'even_odd' ? 'Even'  : group.id === 'asian' ? 'Asian Up'    : group.id === 'touch' ? 'Touch'    : group.id === 'reset' ? 'Reset ↑' : group.id === 'highlow' ? 'High Tick'  : group.id === 'runhighlow' ? 'Run High' : 'Matches';
    const underLabel = group.id === 'over_under' ? 'Under' : group.id === 'rise_fall' || group.id === 'higher_lower' ? 'Fall'   : group.id === 'even_odd' ? 'Odd'   : group.id === 'asian' ? 'Asian Down'  : group.id === 'touch' ? 'No Touch' : group.id === 'reset' ? 'Reset ↓' : group.id === 'highlow' ? 'Low Tick'   : group.id === 'runhighlow' ? 'Run Low'  : 'Differs';

    // Digit layout: row 1 = [0,1,2,3,4], row 2 = [9,8,7,6,5]
    const digitRows = [[0, 1, 2, 3, 4], [9, 8, 7, 6, 5]];

    return (
        <div className='ctp'>

            {/* ── Trade Type Dropdown ── */}
            <div className='ctp__type-select-wrap'>
                <label className='ctp__type-label'>{group.icon} {group.label}</label>
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

            {/* ── Account + Price Row ── */}
            <div className='ctp__price-row'>
                <div className='ctp__price-val'>
                    {currentPrice != null ? currentPrice.toFixed(pipSize) : '—'}
                    {priceChange !== 0 && (
                        <span className={`ctp__price-chg ${priceChange > 0 ? 'up' : 'dn'}`}>
                            {priceChange > 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(pipSize)}
                        </span>
                    )}
                </div>
                <AccountBadge />
            </div>

            {/* ── Tick Duration ── */}
            <div className='ctp__section'>
                <div className='ctp__section-label'>
                    {group.durationUnit === 't' ? 'Ticks' : 'Minutes'}
                    <span className='ctp__section-val'>{ticks} {group.durationUnit === 't' ? 'tick' : 'min'}{ticks !== 1 ? 's' : ''}</span>
                </div>
                {group.durationUnit === 't' ? (
                    /* Two-row tick buttons: [1-5] then [6-10] */
                    <div className='ctp__tick-rows'>
                        {[[1,2,3,4,5],[6,7,8,9,10]].map((row, ri) => (
                            <div key={ri} className='ctp__tick-row'>
                                {row.filter(n => n >= group.minDur && n <= group.maxDur).map(n => (
                                    <button
                                        key={n}
                                        className={`ctp__tick-btn${ticks === n ? ' active' : ''}`}
                                        onClick={() => setTicks(n)}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Minutes: keep slider */
                    <>
                        <input
                            type='range' min={group.minDur} max={group.maxDur} step={1}
                            value={ticks}
                            onChange={e => setTicks(Number(e.target.value))}
                            className='ctp__slider'
                            style={{ display: 'block' }}
                        />
                        <div className='ctp__slider-marks'>
                            {Array.from({ length: group.maxDur - group.minDur + 1 }, (_, i) => group.minDur + i)
                                .filter((_, i, arr) => arr.length <= 10 || i % Math.ceil(arr.length / 10) === 0 || i === arr.length - 1)
                                .map(n => (
                                <span key={n} className={ticks === n ? 'active' : ''}>{n}</span>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ── Last Digit Prediction (2-row layout: [0-4] top, [9-5] bottom) ── */}
            {group.needsBarrier && (
                <div className='ctp__section'>
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
                                            barrier === d  ? 'active'  : '',
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

            {/* ── Stake Panel ── */}
            <div className='ctp__section'>
                <div className='ctp__stake-tabs'>
                    <button className={`ctp__stake-tab ${stakeMode === 'stake' ? 'active' : ''}`} onClick={() => setStakeMode('stake')}>Stake</button>
                    <button className={`ctp__stake-tab ${stakeMode === 'payout' ? 'active' : ''}`} onClick={() => setStakeMode('payout')}>Payout</button>
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
                    <button className='ctp__stake-adj ctp__stake-adj--reset' onClick={() => setStake(1)}>‹</button>
                </div>
                <div className='ctp__stake-presets'>
                    {[1, 2, 5, 10, 50].map(p => (
                        <button key={p} className={`ctp__preset ${stake === p ? 'active' : ''}`} onClick={() => setStake(p)}>
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Result ── */}
            {result && (
                <div className={`ctp__result ${result.ok ? 'ok' : 'err'}`}>{result.msg}</div>
            )}

            {/* ── Buy Buttons ── */}
            <div className='ctp__buy-row'>
                <div className='ctp__buy-block'>
                    <div className='ctp__payout-line'>
                        Payout {overPayout != null
                            ? `${fromUsd(overPayout).toFixed(2)} ${displayCur}`
                            : '—'}
                        <span className='ctp__payout-info'>ℹ</span>
                    </div>
                    <button
                        className='ctp__buy-btn ctp__buy-btn--over'
                        onClick={() => buy('over')}
                        disabled={!!loading}
                    >
                        <span className='ctp__buy-arrow'>↑</span>
                        <span className='ctp__buy-label'>{overLabel}</span>
                        <span className='ctp__buy-pct'>
                            {overPct != null ? `${overPct.toFixed(2)}%` : loading === 'over' ? '…' : '—'}
                        </span>
                    </button>
                </div>

                <div className='ctp__buy-block'>
                    <div className='ctp__payout-line'>
                        Payout {underPayout != null
                            ? `${fromUsd(underPayout).toFixed(2)} ${displayCur}`
                            : '—'}
                        <span className='ctp__payout-info'>ℹ</span>
                    </div>
                    <button
                        className='ctp__buy-btn ctp__buy-btn--under'
                        onClick={() => buy('under')}
                        disabled={!!loading}
                    >
                        <span className='ctp__buy-arrow'>↓</span>
                        <span className='ctp__buy-label'>{underLabel}</span>
                        <span className='ctp__buy-pct'>
                            {underPct != null ? `${underPct.toFixed(2)}%` : loading === 'under' ? '…' : '—'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChartTradePanel;
