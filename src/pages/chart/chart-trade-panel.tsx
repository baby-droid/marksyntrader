// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import { publishMasterTrade, getMasterSource } from '@/utils/trade-bus';

const TRADE_GROUPS = [
    { id: 'over_under',   label: 'Over / Under',   typeA: 'DIGITOVER',  typeB: 'DIGITUNDER',  needsBarrier: true  },
    { id: 'even_odd',     label: 'Even / Odd',      typeA: 'DIGITEVEN',  typeB: 'DIGITODD',    needsBarrier: false },
    { id: 'match_differ', label: 'Match / Differ',  typeA: 'DIGITMATCH', typeB: 'DIGITDIFF',   needsBarrier: true  },
    { id: 'rise_fall',    label: 'Rise / Fall',     typeA: 'CALL',       typeB: 'PUT',         needsBarrier: false },
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
    const groupIndex = useRef(0);
    const [group, setGroup]       = useState(TRADE_GROUPS[0]);
    const [ticks, setTicks]       = useState(5);
    const [stake, setStake]       = useState(10.00);
    const [stakeMode, setStakeMode] = useState<'stake' | 'payout'>('stake');
    const [loading, setLoading]   = useState<'over' | 'under' | null>(null);
    const [result, setResult]     = useState<{ ok: boolean; msg: string } | null>(null);
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());

    // Live payout amounts from proposal API
    const [overPayout,  setOverPayout]  = useState<number | null>(null);
    const [underPayout, setUnderPayout] = useState<number | null>(null);
    const [overPct,     setOverPct]     = useState<number | null>(null);
    const [underPct,    setUnderPct]    = useState<number | null>(null);
    const payoutTimerRef = useRef<any>(null);

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    // Navigate through trade groups
    const prevGroup = () => {
        groupIndex.current = (groupIndex.current - 1 + TRADE_GROUPS.length) % TRADE_GROUPS.length;
        setGroup(TRADE_GROUPS[groupIndex.current]);
    };
    const nextGroup = () => {
        groupIndex.current = (groupIndex.current + 1) % TRADE_GROUPS.length;
        setGroup(TRADE_GROUPS[groupIndex.current]);
    };

    // ── Fetch live payout from Deriv proposal API ─────────────────────────────
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
                duration_unit: 't',
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
        }, 600); // debounce 600 ms
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
                duration_unit: 't',
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
            setResult({ ok: true, msg: `✅ Contract #${contractId} open` });

            // ── Publish to copy-trading engine ──────────────────────────────
            try {
                publishMasterTrade({
                    symbol,
                    contract_type: contractType,
                    stake,
                    duration:      ticks,
                    duration_unit: 't',
                    ...(group.needsBarrier ? { barrier: String(barrier) } : {}),
                    source:      getMasterSource(),
                    time:        Date.now(),
                    contract_id: Number(contractId),
                });
            } catch { /* never block trade on copy error */ }
        } catch (e: any) {
            setResult({ ok: false, msg: `❌ ${e.message}` });
        } finally {
            setLoading(null);
            setTimeout(() => setResult(null), 4000);
        }
    }, [loading, group, barrier, ticks, stake, symbol]);

    // ── Label helpers ─────────────────────────────────────────────────────────
    const overLabel  = group.id === 'over_under' ? 'Over'    : group.id === 'rise_fall' ? 'Rise'  : group.id === 'even_odd' ? 'Even'  : 'Matches';
    const underLabel = group.id === 'over_under' ? 'Under'   : group.id === 'rise_fall' ? 'Fall'  : group.id === 'even_odd' ? 'Odd'   : 'Differs';

    return (
        <div className='ctp'>

            {/* ── Header ── */}
            <div className='ctp__header'>
                <span className='ctp__header-hint'>Learn about this trade type</span>
            </div>

            {/* ── Trade Type Navigator ── */}
            <div className='ctp__type-nav'>
                <button className='ctp__type-nav-btn' onClick={prevGroup}>‹</button>
                <div className='ctp__type-nav-label'>
                    <span className='ctp__type-nav-icon'>
                        {group.id === 'over_under' ? '↑↓' : group.id === 'rise_fall' ? '📈' : group.id === 'even_odd' ? '⚡' : '🎯'}
                    </span>
                    {group.label}
                </div>
                <button className='ctp__type-nav-btn' onClick={nextGroup}>›</button>
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
                    Ticks
                    <span className='ctp__section-val'>{ticks} tick{ticks !== 1 ? 's' : ''}</span>
                </div>
                <input
                    type='range' min={1} max={10} step={1}
                    value={ticks}
                    onChange={e => setTicks(Number(e.target.value))}
                    className='ctp__slider'
                />
                <div className='ctp__slider-marks'>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <span key={n} className={ticks === n ? 'active' : ''}>{n}</span>
                    ))}
                </div>
            </div>

            {/* ── Last Digit Prediction ── */}
            {group.needsBarrier && (
                <div className='ctp__section'>
                    <div className='ctp__section-label'>
                        Last Digit Prediction
                        <span className='ctp__section-val'>{barrier}</span>
                    </div>
                    <div className='ctp__digits'>
                        {[0,1,2,3,4,5,6,7,8,9].map(d => (
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

            {/* ── Buy Buttons with Payout Amounts ── */}
            <div className='ctp__buy-row'>
                {/* Over */}
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

                {/* Under */}
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
