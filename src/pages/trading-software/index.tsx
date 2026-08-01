// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { useApiBase } from '@/hooks/useApiBase';
import './trading-software.scss';

/* ─── Market list ───────────────────────────────────────────────────────────── */
const MARKETS = [
    { value: 'R_10',      label: 'V10',        group: 'Volatility' },
    { value: 'R_25',      label: 'V25',        group: 'Volatility' },
    { value: 'R_50',      label: 'V50',        group: 'Volatility' },
    { value: 'R_75',      label: 'V75',        group: 'Volatility' },
    { value: 'R_100',     label: 'V100',       group: 'Volatility' },
    { value: '1HZ10V',    label: 'V10 (1s)',   group: 'Volatility 1s' },
    { value: '1HZ25V',    label: 'V25 (1s)',   group: 'Volatility 1s' },
    { value: '1HZ50V',    label: 'V50 (1s)',   group: 'Volatility 1s' },
    { value: '1HZ75V',    label: 'V75 (1s)',   group: 'Volatility 1s' },
    { value: '1HZ100V',   label: 'V100 (1s)',  group: 'Volatility 1s' },
    { value: 'JD10',      label: 'Jump 10',    group: 'Jump' },
    { value: 'JD25',      label: 'Jump 25',    group: 'Jump' },
    { value: 'JD50',      label: 'Jump 50',    group: 'Jump' },
    { value: 'JD75',      label: 'Jump 75',    group: 'Jump' },
    { value: 'JD100',     label: 'Jump 100',   group: 'Jump' },
    { value: 'CRASH300N', label: 'Crash 300',  group: 'Crash/Boom' },
    { value: 'CRASH500',  label: 'Crash 500',  group: 'Crash/Boom' },
    { value: 'CRASH1000', label: 'Crash 1000', group: 'Crash/Boom' },
    { value: 'BOOM300N',  label: 'Boom 300',   group: 'Crash/Boom' },
    { value: 'BOOM500',   label: 'Boom 500',   group: 'Crash/Boom' },
    { value: 'BOOM1000',  label: 'Boom 1000',  group: 'Crash/Boom' },
    { value: 'stpRNG',    label: 'Step',       group: 'Other' },
];

/* ─── Contract type colours ─────────────────────────────────────────────────── */
const CT_COLOR: Record<string, string> = {
    CALL: '#22c55e', PUT: '#ef4444',
    DIGITOVER: '#3b82f6', DIGITUNDER: '#f59e0b',
    DIGITEVEN: '#a855f7', DIGITODD: '#ec4899',
    DIGITMATCH: '#14b8a6', DIGITDIFF: '#f97316',
};

/* ─── Panel: Live Ticker ────────────────────────────────────────────────────── */
function LiveTicker({ symbol }: { symbol: string }) {
    const [ticks, setTicks] = useState<{ epoch: number; price: number }[]>([]);
    const subRef = useRef<any>(null);

    useEffect(() => {
        setTicks([]);
        let sub: any;
        (async () => {
            try {
                sub = api_base.api.subscribe({ ticks: symbol, subscribe: 1 });
                subRef.current = sub;
                sub.subscribe((res: any) => {
                    if (res?.tick) {
                        const p = Number(res.tick.quote);
                        setTicks(prev => [...prev.slice(-59), { epoch: res.tick.epoch, price: p }]);
                    }
                });
            } catch {}
        })();
        return () => { try { sub?.unsubscribe(); } catch {} };
    }, [symbol]);

    const prices = ticks.map(t => t.price);
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 1;
    const range = max - min || 1;
    const last = prices[prices.length - 1];
    const prev = prices[prices.length - 2];
    const change = last !== undefined && prev !== undefined ? last - prev : 0;
    const w = 320, h = 80;

    const pts = prices.map((p, i) => {
        const x = (i / Math.max(prices.length - 1, 1)) * (w - 2) + 1;
        const y = h - 6 - ((p - min) / range) * (h - 12);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className='ts-live-ticker'>
            <div className='ts-live-ticker__header'>
                <span className='ts-live-ticker__symbol'>{symbol}</span>
                {last !== undefined && (
                    <span className={`ts-live-ticker__price ${change >= 0 ? 'up' : 'down'}`}>
                        {last.toFixed(2)} <span className='ts-live-ticker__chg'>{change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(4)}</span>
                    </span>
                )}
                <span className='ts-live-ticker__badge'>LIVE</span>
            </div>
            <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio='none' className='ts-live-ticker__chart'>
                {prices.length >= 2 && (
                    <>
                        <defs>
                            <linearGradient id='tsgr' x1='0' y1='0' x2='0' y2='1'>
                                <stop offset='0%' stopColor={change >= 0 ? '#22c55e' : '#ef4444'} stopOpacity='0.3' />
                                <stop offset='100%' stopColor={change >= 0 ? '#22c55e' : '#ef4444'} stopOpacity='0.02' />
                            </linearGradient>
                        </defs>
                        <polygon
                            points={`1,${h} ${pts} ${(prices.length - 1) / Math.max(prices.length - 1, 1) * (w - 2) + 1},${h}`}
                            fill='url(#tsgr)'
                        />
                        <polyline points={pts} fill='none' stroke={change >= 0 ? '#22c55e' : '#ef4444'} strokeWidth='1.5' />
                    </>
                )}
            </svg>
            <div className='ts-live-ticker__footer'>
                <span>H: {prices.length ? max.toFixed(4) : '—'}</span>
                <span>L: {prices.length ? min.toFixed(4) : '—'}</span>
                <span>{ticks.length} ticks</span>
            </div>
        </div>
    );
}

/* ─── Panel: Digit Heatmap ──────────────────────────────────────────────────── */
function DigitHeatmap({ symbol }: { symbol: string }) {
    const [digits, setDigits] = useState<number[]>([]);
    const pipRef = useRef(2);

    useEffect(() => {
        setDigits([]);
        let sub: any;
        (async () => {
            try {
                sub = api_base.api.subscribe({ ticks: symbol, subscribe: 1 });
                sub.subscribe((res: any) => {
                    if (res?.tick) {
                        const pip = res.tick.pip_size ?? pipRef.current;
                        pipRef.current = pip;
                        const s = Number(res.tick.quote).toFixed(pip);
                        const d = parseInt(s[s.length - 1], 10);
                        setDigits(prev => [...prev.slice(-199), d]);
                    }
                });
            } catch {}
        })();
        return () => { try { sub?.unsubscribe(); } catch {} };
    }, [symbol]);

    const freq = Array.from({ length: 10 }, (_, i) => digits.filter(d => d === i).length);
    const total = digits.length || 1;
    const maxFreq = Math.max(...freq, 1);

    return (
        <div className='ts-heatmap'>
            <div className='ts-heatmap__title'>🎯 Digit Heatmap <span className='ts-heatmap__count'>{digits.length} ticks</span></div>
            <div className='ts-heatmap__grid'>
                {freq.map((cnt, d) => {
                    const pct = cnt / total * 100;
                    const intensity = cnt / maxFreq;
                    const hue = pct > 12 ? 142 : pct < 8 ? 0 : 45;
                    return (
                        <div key={d} className='ts-heatmap__cell'
                            style={{ '--intensity': intensity, '--hue': hue } as any}>
                            <span className='ts-heatmap__digit'>{d}</span>
                            <div className='ts-heatmap__bar' style={{ height: `${intensity * 60}px` }} />
                            <span className='ts-heatmap__pct'>{pct.toFixed(1)}%</span>
                        </div>
                    );
                })}
            </div>
            <div className='ts-heatmap__hint'>
                <span>🟢 Hot: {freq.reduce((a, c, i) => c === Math.max(...freq) ? i : a, 0)}</span>
                <span>🔴 Cold: {freq.reduce((a, c, i) => c === Math.min(...freq) ? i : a, 0)}</span>
                <span>E/O: {digits.filter(d => d % 2 === 0).length}/{digits.filter(d => d % 2 !== 0).length}</span>
            </div>
        </div>
    );
}

/* ─── Panel: Market Scanner ─────────────────────────────────────────────────── */
function MarketScanner({ onSelect }: { onSelect: (sym: string) => void }) {
    const [rows, setRows] = useState<{ symbol: string; label: string; price: number; change: number; active: boolean }[]>(
        MARKETS.slice(0, 10).map(m => ({ symbol: m.value, label: m.label, price: 0, change: 0, active: true }))
    );
    const subs = useRef<any[]>([]);

    useEffect(() => {
        subs.current.forEach(s => { try { s?.unsubscribe(); } catch {} });
        subs.current = [];
        const targets = MARKETS.slice(0, 10);
        targets.forEach((m, idx) => {
            let prev = 0;
            try {
                const sub = api_base.api.subscribe({ ticks: m.value, subscribe: 1 });
                subs.current.push(sub);
                sub.subscribe((res: any) => {
                    if (res?.tick) {
                        const price = Number(res.tick.quote);
                        setRows(r => r.map((row, i) => i === idx
                            ? { ...row, price, change: prev ? price - prev : 0, active: true }
                            : row
                        ));
                        prev = price;
                    }
                });
            } catch {}
        });
        return () => { subs.current.forEach(s => { try { s?.unsubscribe(); } catch {} }); };
    }, []);

    return (
        <div className='ts-scanner'>
            <div className='ts-scanner__title'>📡 Market Scanner</div>
            <div className='ts-scanner__list'>
                {rows.map(row => (
                    <div key={row.symbol} className={`ts-scanner__row ${row.active ? '' : 'inactive'}`}
                        onClick={() => onSelect(row.symbol)}>
                        <span className='ts-scanner__label'>{row.label}</span>
                        <span className='ts-scanner__price'>{row.price ? row.price.toFixed(2) : '—'}</span>
                        <span className={`ts-scanner__chg ${row.change >= 0 ? 'up' : 'down'}`}>
                            {row.change >= 0 ? '+' : ''}{row.change.toFixed(4)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── Panel: Quick Trade ────────────────────────────────────────────────────── */
function QuickTrade({ symbol }: { symbol: string }) {
    const { connectionStatus } = useApiBase();
    const [ctType, setCtType] = useState<'CALL' | 'PUT' | 'DIGITOVER' | 'DIGITUNDER' | 'DIGITEVEN' | 'DIGITODD'>('CALL');
    const [stake, setStake] = useState('1.00');
    const [duration, setDuration] = useState(5);
    const [barrier, setBarrier] = useState(5);
    const [status, setStatus] = useState('');
    const [trades, setTrades] = useState<{ type: string; stake: number; profit: number; won: boolean }[]>([]);
    const isBuying = useRef(false);

    const needsDigit = ['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF'].includes(ctType);
    const needsBarrier = ['CALL','PUT'].includes(ctType);

    const handleTrade = async () => {
        if (isBuying.current) return;
        isBuying.current = true;
        setStatus('⏳ Placing order…');
        try {
            const stakeNum = parseFloat(stake) || 1;
            const propReq: any = {
                proposal: 1,
                amount: stakeNum,
                basis: 'stake',
                contract_type: ctType,
                currency: 'USD',
                duration,
                duration_unit: 't',
                symbol,
            };
            if (needsDigit) propReq.barrier = String(barrier);
            const propRes = await api_base.api.send(propReq);
            if (propRes?.error) throw new Error(propRes.error.message);
            const propId = propRes?.proposal?.id;
            const askPrice = Number(propRes?.proposal?.ask_price ?? stakeNum);
            if (!propId) throw new Error('No proposal ID');

            const buyRes = await api_base.api.send({ buy: propId, price: askPrice });
            if (buyRes?.error) throw new Error(buyRes.error.message);
            const cId = buyRes?.buy?.contract_id;
            if (!cId) throw new Error('No contract ID');
            setStatus(`✅ In flight #${cId}`);

            // Poll for settlement
            const sub = api_base.api.subscribe({ proposal_open_contract: 1, contract_id: parseInt(cId, 10) });
            sub.subscribe((res: any) => {
                const poc = res?.proposal_open_contract;
                if (poc?.is_expired || poc?.is_settleable || poc?.status === 'sold') {
                    const profit = Number(poc.profit ?? 0);
                    const won = profit > 0;
                    setStatus(won ? `✅ Win! +$${profit.toFixed(2)}` : `❌ Loss $${profit.toFixed(2)}`);
                    setTrades(prev => [{ type: ctType, stake: stakeNum, profit, won }, ...prev.slice(0, 19)]);
                    try { sub.unsubscribe(); } catch {}
                    isBuying.current = false;
                }
            });
        } catch (e: any) {
            setStatus(`❌ ${e?.message || 'Error'}`);
            isBuying.current = false;
        }
    };

    const totalProfit = trades.reduce((s, t) => s + t.profit, 0);
    const wins = trades.filter(t => t.won).length;

    return (
        <div className='ts-quick-trade'>
            <div className='ts-quick-trade__title'>⚡ Quick Trade — {symbol}</div>
            <div className='ts-quick-trade__row'>
                <select className='ts-quick-trade__select' value={ctType}
                    onChange={e => setCtType(e.target.value as any)}>
                    <option value='CALL'>↑ Rise (Call)</option>
                    <option value='PUT'>↓ Fall (Put)</option>
                    <option value='DIGITOVER'>Over</option>
                    <option value='DIGITUNDER'>Under</option>
                    <option value='DIGITEVEN'>Even</option>
                    <option value='DIGITODD'>Odd</option>
                </select>
                <input className='ts-quick-trade__input' type='number' min='0.35' step='0.01'
                    value={stake} onChange={e => setStake(e.target.value)} placeholder='Stake' />
                <input className='ts-quick-trade__input ts-quick-trade__input--sm' type='number'
                    min='1' max='10' value={duration}
                    onChange={e => setDuration(Number(e.target.value))} placeholder='Ticks' />
            </div>
            {needsDigit && (
                <div className='ts-quick-trade__row'>
                    <span className='ts-quick-trade__lbl'>Digit:</span>
                    <div className='ts-quick-trade__digits'>
                        {[0,1,2,3,4,5,6,7,8,9].map(d => (
                            <button key={d}
                                className={`ts-quick-trade__d ${barrier === d ? 'active' : ''}`}
                                onClick={() => setBarrier(d)}>{d}</button>
                        ))}
                    </div>
                </div>
            )}
            <div className='ts-quick-trade__row'>
                <button className='ts-quick-trade__btn' style={{ background: CT_COLOR[ctType] || '#7b3fe4' }}
                    onClick={handleTrade}>
                    {ctType === 'CALL' ? '▲ RISE' : ctType === 'PUT' ? '▼ FALL' : ctType}
                </button>
            </div>
            {status && <div className='ts-quick-trade__status'>{status}</div>}
            {trades.length > 0 && (
                <div className='ts-quick-trade__log'>
                    <div className='ts-quick-trade__log-hdr'>
                        <span>{trades.length} trades</span>
                        <span>{wins}W/{trades.length - wins}L</span>
                        <span style={{ color: totalProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                            {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
                        </span>
                    </div>
                    {trades.slice(0, 8).map((t, i) => (
                        <div key={i} className={`ts-quick-trade__log-row ${t.won ? 'win' : 'loss'}`}>
                            <span>{t.type}</span>
                            <span>${t.stake.toFixed(2)}</span>
                            <span>{t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─── Main page ─────────────────────────────────────────────────────────────── */
const TradingSoftware: React.FC = () => {
    const [activeSymbol, setActiveSymbol] = useState('R_100');

    return (
        <div className='ts-page'>
            {/* Header */}
            <div className='ts-header'>
                <div className='ts-header__brand'>
                    <span className='ts-header__logo'>📊</span>
                    <span className='ts-header__title'>AHMED SYN TRADER — <span>Trading Software</span></span>
                </div>
                <div className='ts-header__market'>
                    <label>Market:</label>
                    <select value={activeSymbol} onChange={e => setActiveSymbol(e.target.value)}>
                        {MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
            </div>

            {/* 4-panel grid */}
            <div className='ts-grid'>
                {/* Panel 1: Live Ticker */}
                <div className='ts-panel ts-panel--ticker'>
                    <LiveTicker symbol={activeSymbol} />
                </div>

                {/* Panel 2: Digit Heatmap */}
                <div className='ts-panel ts-panel--heatmap'>
                    <DigitHeatmap symbol={activeSymbol} />
                </div>

                {/* Panel 3: Market Scanner */}
                <div className='ts-panel ts-panel--scanner'>
                    <MarketScanner onSelect={setActiveSymbol} />
                </div>

                {/* Panel 4: Quick Trade */}
                <div className='ts-panel ts-panel--trade'>
                    <QuickTrade symbol={activeSymbol} />
                </div>
            </div>
        </div>
    );
};

export default TradingSoftware;
