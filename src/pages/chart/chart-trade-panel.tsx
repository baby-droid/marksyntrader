// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';

/** Extract last digit from price using pip_size decimal places */
function getLastDigit(price: number, pipSize = 2): number {
    const s = price.toFixed(pipSize).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

/* ─── Constants ─── */
const MARKETS = [
    { label: 'Volatility 10 (1s)',  value: '1HZ10V'   },
    { label: 'Volatility 25 (1s)',  value: '1HZ25V'   },
    { label: 'Volatility 50 (1s)',  value: '1HZ50V'   },
    { label: 'Volatility 75 (1s)',  value: '1HZ75V'   },
    { label: 'Volatility 100 (1s)', value: '1HZ100V'  },
    { label: 'Volatility 10',       value: 'R_10'      },
    { label: 'Volatility 25',       value: 'R_25'      },
    { label: 'Volatility 50',       value: 'R_50'      },
    { label: 'Volatility 75',       value: 'R_75'      },
    { label: 'Volatility 100',      value: 'R_100'     },
    { label: 'Jump 10',             value: 'JD10'      },
    { label: 'Jump 25',             value: 'JD25'      },
    { label: 'Jump 50',             value: 'JD50'      },
    { label: 'Jump 75',             value: 'JD75'      },
    { label: 'Jump 100',            value: 'JD100'     },
];

const TRADE_GROUPS = [
    { id: 'over_under',    label: 'Over / Under',   typeA: 'DIGITOVER',  typeB: 'DIGITUNDER',  needsBarrier: true  },
    { id: 'even_odd',      label: 'Even / Odd',     typeA: 'DIGITEVEN',  typeB: 'DIGITODD',    needsBarrier: false },
    { id: 'match_differ',  label: 'Match / Differ', typeA: 'DIGITMATCH', typeB: 'DIGITDIFF',   needsBarrier: true  },
    { id: 'rise_fall',     label: 'Rise / Fall',    typeA: 'CALL',       typeB: 'PUT',         needsBarrier: false },
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

/* ─── Main Chart Trade Panel ─── */
export const ChartTradePanel: React.FC<{ symbol?: string; onSymbolChange?: (s: string) => void }> = ({
    symbol: propSymbol,
    onSymbolChange,
}) => {
    const [market, setMarket] = useState(propSymbol || '1HZ100V');
    const [group, setGroup]   = useState(TRADE_GROUPS[0]);
    const [barrier, setBarrier] = useState(5);
    const [ticks, setTicks]   = useState(5);
    const [stake, setStake]   = useState(1.00);
    const [stakeMode, setStakeMode] = useState<'stake' | 'payout'>('stake');
    const [loading, setLoading] = useState<'over' | 'under' | null>(null);
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());

    // Live tick data
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceChange, setPriceChange]   = useState<number>(0);
    const [lastDigit, setLastDigit]       = useState<number | null>(null);
    const [digitCounts, setDigitCounts]   = useState<number[]>(new Array(10).fill(0));
    const [pipSize, setPipSize]           = useState(2);
    const prevPriceRef = useRef<number | null>(null);
    const digitHistoryRef = useRef<number[]>([]);
    const tickSubRef = useRef<any>(null);
    const historyRef = useRef(false);

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    // Sync external symbol prop
    useEffect(() => {
        if (propSymbol && propSymbol !== market) setMarket(propSymbol);
    }, [propSymbol]);

    // Subscribe to live ticks + load history
    useEffect(() => {
        historyRef.current = false;
        digitHistoryRef.current = [];
        setCurrentPrice(null);
        setPriceChange(0);
        setLastDigit(null);
        setDigitCounts(new Array(10).fill(0));

        if (!api_base?.api) return;

        let alive = true;

        // Load last 1000 ticks for digit stats
        (api_base.api as any).send({
            ticks_history: market, count: 1000, end: 'latest', style: 'ticks',
        }).then((res: any) => {
            if (!alive) return;
            const prices: number[] = res?.history?.prices ?? [];
            if (prices.length > 0) {
                // Determine pip_size from price (count decimal places)
                const sampleStr = String(prices[0]);
                const dotIdx = sampleStr.indexOf('.');
                const ps = dotIdx === -1 ? 0 : sampleStr.length - dotIdx - 1;
                setPipSize(ps);
                const digits = prices.map((p: number) => getLastDigit(p, ps));
                digitHistoryRef.current = digits;
                const counts = new Array(10).fill(0);
                digits.forEach((d: number) => counts[d]++);
                setDigitCounts([...counts]);
                historyRef.current = true;
            }
        }).catch(() => {});

        // Subscribe to live ticks
        const sub = (api_base.api as any).subscribe({ ticks: market, subscribe: 1 });
        tickSubRef.current = sub;
        sub.subscribe({
            next: (res: any) => {
                if (!alive) return;
                const tick = res?.tick;
                if (!tick) return;
                const price = Number(tick.quote);
                const ps = tick.pip_size ?? pipSize;
                setPipSize(ps);
                setCurrentPrice(price);
                if (prevPriceRef.current !== null) {
                    setPriceChange(price - prevPriceRef.current);
                }
                prevPriceRef.current = price;
                const d = getLastDigit(price, ps);
                setLastDigit(d);
                digitHistoryRef.current = [...digitHistoryRef.current.slice(-999), d];
                const counts = new Array(10).fill(0);
                digitHistoryRef.current.forEach(x => counts[x]++);
                setDigitCounts([...counts]);
            },
            error: () => {},
        });

        return () => {
            alive = false;
            sub?.unsubscribe?.();
        };
    }, [market]);

    const handleMarketChange = (val: string) => {
        setMarket(val);
        onSymbolChange?.(val);
    };

    const buy = useCallback(async (side: 'over' | 'under') => {
        if (loading) return;
        const api = (api_base as any).api;
        if (!api) { setResult({ ok: false, msg: '❌ Not connected' }); return; }

        setLoading(side);
        setResult(null);

        const contractType = side === 'over'
            ? group.typeA
            : group.typeB;

        try {
            const proposalReq: any = {
                proposal: 1,
                amount: stake,
                basis: 'stake',
                contract_type: contractType,
                currency: getDisplayCurrency() || 'USD',
                duration: ticks,
                duration_unit: 't',
                underlying_symbol: market,
            };
            if (group.needsBarrier) proposalReq.barrier = String(barrier);

            const pr = await api.send(proposalReq);
            if (pr?.error) throw new Error(pr.error.message);
            const proposalId = pr?.proposal?.id;
            const askPrice = Number(pr?.proposal?.ask_price ?? stake);
            if (!proposalId) throw new Error('Proposal failed');

            const buyRes = await api.send({ buy: proposalId, price: askPrice });
            if (buyRes?.error) throw new Error(buyRes.error.message);

            const contractId = buyRes?.buy?.contract_id;
            setResult({ ok: true, msg: `✅ Contract #${contractId} open` });
        } catch (e: any) {
            setResult({ ok: false, msg: `❌ ${e.message}` });
        } finally {
            setLoading(null);
            setTimeout(() => setResult(null), 4000);
        }
    }, [loading, group, barrier, ticks, stake, market]);

    // Digit circle stats
    const total = digitHistoryRef.current.length || 1;
    const pcts = digitCounts.map(c => (c / total) * 100);
    const maxPct = Math.max(...pcts);

    const selectedMkt = MARKETS.find(m => m.value === market);

    return (
        <div className='ctp'>
            {/* ── Market Selector ── */}
            <div className='ctp__market'>
                <div className='ctp__market-top'>
                    <select
                        className='ctp__market-sel'
                        value={market}
                        onChange={e => handleMarketChange(e.target.value)}
                    >
                        {MARKETS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                    <AccountBadge />
                </div>
                <div className='ctp__market-price'>
                    <span className='ctp__market-val'>
                        {currentPrice != null ? currentPrice.toFixed(pipSize) : '—'}
                    </span>
                    <span className={`ctp__market-chg ${priceChange > 0 ? 'up' : priceChange < 0 ? 'dn' : ''}`}>
                        {priceChange > 0 ? '▲' : priceChange < 0 ? '▼' : '●'}
                        {' '}
                        {Math.abs(priceChange).toFixed(pipSize)}
                    </span>
                    <span className={`ctp__digit-live ${lastDigit !== null ? 'active' : ''}`}>
                        {lastDigit !== null ? lastDigit : '—'}
                    </span>
                </div>
            </div>

            {/* ── Trade Type ── */}
            <div className='ctp__section'>
                <div className='ctp__section-label'>Trade Type</div>
                <div className='ctp__type-grid'>
                    {TRADE_GROUPS.map(g => (
                        <button
                            key={g.id}
                            className={`ctp__type-btn ${group.id === g.id ? 'active' : ''}`}
                            onClick={() => setGroup(g)}
                        >
                            {g.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tick Duration Slider ── */}
            <div className='ctp__section'>
                <div className='ctp__section-label'>
                    Tick Duration
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

            {/* ── Prediction (digit barrier) ── */}
            {group.needsBarrier && group.id !== 'match_differ' || group.id === 'over_under' ? (
                <div className='ctp__section'>
                    <div className='ctp__section-label'>
                        Prediction Digit
                        <span className='ctp__section-val'>{barrier}</span>
                    </div>
                    <div className='ctp__digits'>
                        {[0,1,2,3,4,5,6,7,8,9].map(d => (
                            <button
                                key={d}
                                className={`ctp__digit-btn ${barrier === d ? 'active' : ''} ${lastDigit === d ? 'current' : ''}`}
                                onClick={() => setBarrier(d)}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>
            ) : group.needsBarrier ? (
                <div className='ctp__section'>
                    <div className='ctp__section-label'>
                        Match Digit
                        <span className='ctp__section-val'>{barrier}</span>
                    </div>
                    <div className='ctp__digits'>
                        {[0,1,2,3,4,5,6,7,8,9].map(d => (
                            <button
                                key={d}
                                className={`ctp__digit-btn ${barrier === d ? 'active' : ''} ${lastDigit === d ? 'current' : ''}`}
                                onClick={() => setBarrier(d)}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* ── Stake Panel ── */}
            <div className='ctp__section'>
                <div className='ctp__stake-tabs'>
                    <button
                        className={`ctp__stake-tab ${stakeMode === 'stake' ? 'active' : ''}`}
                        onClick={() => setStakeMode('stake')}
                    >
                        Stake
                    </button>
                    <button
                        className={`ctp__stake-tab ${stakeMode === 'payout' ? 'active' : ''}`}
                        onClick={() => setStakeMode('payout')}
                    >
                        Payout
                    </button>
                </div>
                <div className='ctp__stake-ctrl'>
                    <button className='ctp__stake-adj' onClick={() => setStake(s => Math.max(0.35, parseFloat((s - 0.5).toFixed(2))))}>
                        −
                    </button>
                    <div className='ctp__stake-mid'>
                        <input
                            className='ctp__stake-inp'
                            type='number' min={0.35} step={0.5}
                            value={stake}
                            onChange={e => setStake(parseFloat(e.target.value) || 0.35)}
                        />
                        <span className='ctp__stake-cur'>{displayCur}</span>
                    </div>
                    <button className='ctp__stake-adj' onClick={() => setStake(s => parseFloat((s + 0.5).toFixed(2)))}>
                        +
                    </button>
                </div>
                <div className='ctp__stake-presets'>
                    {[0.5, 1, 2, 5, 10].map(p => (
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
                <button
                    className='ctp__buy-btn ctp__buy-btn--over'
                    onClick={() => buy('over')}
                    disabled={!!loading}
                >
                    <span className='ctp__buy-arrow'>▲</span>
                    <span className='ctp__buy-label'>
                        {group.id === 'over_under' ? 'Over' : group.id === 'rise_fall' ? 'Rise' : group.id === 'even_odd' ? 'Even' : 'Matches'}
                    </span>
                    {loading === 'over' && <span className='ctp__buy-spin'>…</span>}
                </button>
                <button
                    className='ctp__buy-btn ctp__buy-btn--under'
                    onClick={() => buy('under')}
                    disabled={!!loading}
                >
                    <span className='ctp__buy-arrow'>▼</span>
                    <span className='ctp__buy-label'>
                        {group.id === 'over_under' ? 'Under' : group.id === 'rise_fall' ? 'Fall' : group.id === 'even_odd' ? 'Odd' : 'Differs'}
                    </span>
                    {loading === 'under' && <span className='ctp__buy-spin'>…</span>}
                </button>
            </div>

            {/* ── Digit Statistics Circles ── */}
            <div className='ctp__stats'>
                <div className='ctp__stats-label'>Last Digit Statistics</div>
                <div className='ctp__circles'>
                    {Array.from({ length: 10 }, (_, d) => {
                        const pct = pcts[d] ?? 0;
                        const isHot = pct === maxPct;
                        const isCurrent = lastDigit === d;
                        const isSelected = group.needsBarrier && barrier === d;
                        return (
                            <div key={d} className='ctp__circle-wrap'>
                                <div
                                    className={[
                                        'ctp__circle',
                                        isHot ? 'hot' : '',
                                        isCurrent ? 'current' : '',
                                        isSelected ? 'selected' : '',
                                    ].filter(Boolean).join(' ')}
                                    onClick={() => group.needsBarrier && setBarrier(d)}
                                >
                                    {d}
                                </div>
                                <span className='ctp__circle-pct'>{pct.toFixed(1)}%</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ChartTradePanel;
