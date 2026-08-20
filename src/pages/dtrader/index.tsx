import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDerivTrade, type ContractType, type SettledContract, type TickData } from '@/hooks/useDerivTrade';
import './dtrader.scss';

const MARKUP_RATE = 0.03;
const SYMBOLS = [
    { value: '1HZ10V', label: 'Volatility 10 (1s) Index' },
    { value: '1HZ25V', label: 'Volatility 25 (1s) Index' },
    { value: '1HZ50V', label: 'Volatility 50 (1s) Index' },
    { value: '1HZ75V', label: 'Volatility 75 (1s) Index' },
    { value: '1HZ100V', label: 'Volatility 100 (1s) Index' },
    { value: 'R_50', label: 'Volatility 50 Index' },
    { value: 'BOOM500', label: 'Boom 500 Index' },
    { value: 'CRASH500', label: 'Crash 500 Index' },
];

type Side = 'over' | 'under';
type Quote = { id: string; payout: number; ask: number };
type OpenPosition = { id: number; side: Side; stake: number; started: number; status: 'open' | 'won' | 'lost'; profit?: number };

const digit = (quote: number, pipSize: number) => Number(quote.toFixed(pipSize).replace('.', '').slice(-1));
const formatMoney = (amount: number | null, currency = 'USD') => amount == null ? '—' : `${amount.toFixed(2)} ${currency}`;

const DTrader: React.FC = () => {
    const { connected, authorized, balance, currency, send, subscribeTicks, buyContract } = useDerivTrade();
    const [symbol, setSymbol] = useState(SYMBOLS[0].value);
    const [contractFamily, setContractFamily] = useState<'digits' | 'accumulators'>('digits');
    const [side, setSide] = useState<Side>('over');
    const [barrier, setBarrier] = useState(5);
    const [duration, setDuration] = useState(2);
    const [stake, setStake] = useState(10);
    const [growthRate, setGrowthRate] = useState(3);
    const [takeProfit, setTakeProfit] = useState(false);
    const [ticks, setTicks] = useState<TickData[]>([]);
    const [quotes, setQuotes] = useState<Record<Side, Quote | null>>({ over: null, under: null });
    const [positions, setPositions] = useState<OpenPosition[]>([]);
    const [message, setMessage] = useState('');
    const latestPrice = ticks[ticks.length - 1]?.quote ?? null;
    const currentDigit = latestPrice == null ? null : digit(latestPrice, ticks[ticks.length - 1]?.pip_size ?? 2);
    const digitDistribution = useMemo(() => {
        const counts = Array.from({ length: 10 }, () => 0);
        ticks.forEach(tick => {
            const value = digit(tick.quote, tick.pip_size ?? 2);
            if (value >= 0 && value <= 9) counts[value] += 1;
        });
        const total = Math.max(1, ticks.length);
        return counts.map(count => +(count / total * 100).toFixed(1));
    }, [ticks]);
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setTicks([]);
        return subscribeTicks(symbol, tick => {
            setTicks(prev => [...prev.slice(-119), tick]);
        });
    }, [symbol, subscribeTicks]);

    const effectiveStake = +(stake * (1 + MARKUP_RATE)).toFixed(2);

    const refreshQuotes = useCallback(async () => {
        if (!authorized || !connected || contractFamily !== 'digits') return;
        try {
            const next: Record<Side, Quote | null> = { over: null, under: null };
            for (const currentSide of ['over', 'under'] as Side[]) {
                const res = await send({
                    proposal: 1,
                    amount: effectiveStake,
                    basis: 'stake',
                    contract_type: currentSide === 'over' ? 'DIGITOVER' : 'DIGITUNDER',
                    currency: currency || 'USD',
                    duration,
                    duration_unit: 't',
                    underlying_symbol: symbol,
                    barrier: String(barrier),
                });
                if (res?.proposal?.id) {
                    next[currentSide] = {
                        id: String(res.proposal.id),
                        payout: Number(res.proposal.payout ?? 0),
                        ask: Number(res.proposal.ask_price ?? effectiveStake),
                    };
                }
            }
            setQuotes(next);
        } catch {
            setMessage('Payout quotes are temporarily unavailable.');
        }
    }, [authorized, connected, contractFamily, currency, duration, effectiveStake, barrier, send, symbol]);

    useEffect(() => {
        const timer = window.setTimeout(refreshQuotes, 250);
        return () => window.clearTimeout(timer);
    }, [refreshQuotes]);

    const settlePosition = useCallback((result: SettledContract) => {
        setPositions(prev => prev.map(p => p.id === result.contract_id
            ? { ...p, status: result.status, profit: result.profit }
            : p
        ));
        setMessage(result.status === 'won' ? 'Contract won.' : 'Contract settled at a loss.');
        window.setTimeout(() => setPositions(prev => prev.filter(p => p.id !== result.contract_id)), 3500);
    }, []);

    const buy = useCallback(async (requestedSide: Side) => {
        if (!authorized) {
            setMessage('Log in to trade on your demo or real account.');
            return;
        }
        setMessage('');
        try {
            const isAccumulator = contractFamily === 'accumulators';
            const result = await buyContract({
                symbol,
                contract_type: (isAccumulator ? 'ACCU' : requestedSide === 'over' ? 'DIGITOVER' : 'DIGITUNDER') as ContractType,
                duration: isAccumulator ? 1 : duration,
                duration_unit: 't',
                stake: effectiveStake,
                barrier: isAccumulator ? growthRate : barrier,
                currency,
            }, settlePosition);
            setPositions(prev => [...prev, {
                id: result.contract_id,
                side: requestedSide,
                stake: effectiveStake,
                started: Date.now(),
                status: 'open',
            }]);
            setMessage(`Contract ${result.contract_id} opened.`);
        } catch (error: any) {
            setMessage(error?.message || 'Trade could not be opened.');
        }
    }, [authorized, barrier, buyContract, contractFamily, currency, duration, effectiveStake, growthRate, settlePosition, symbol]);

    const chartPath = useMemo(() => {
        if (!ticks.length) return '';
        const values = ticks.map(t => t.quote);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = Math.max(max - min, 0.00001);
        return values.map((value, index) => {
            const x = (index / Math.max(1, values.length - 1)) * 100;
            const y = 91 - ((value - min) / range) * 74;
            return `${index ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(' ');
    }, [ticks]);

    const totalProfit = positions.reduce((sum, p) => sum + (p.profit || 0), 0);
    const selectedQuote = quotes[side];

    return (
        <div className='dtrader'>
            <header className='dtrader__header'>
                <div>
                    <span className='dtrader__eyebrow'>D-TRADER</span>
                    <h1>Trade the market, your way</h1>
                </div>
                <div className='dtrader__account'>
                    <span className={`dtrader__status ${authorized ? 'is-on' : ''}`} />
                    {authorized ? `${currency} ${formatMoney(balance, currency)}` : 'Account not connected'}
                </div>
            </header>

            <main className='dtrader__workspace'>
                <aside className='dtrader__positions'>
                    <div className='dtrader__panel-title'><span>Open positions</span><span>{positions.filter(p => p.status === 'open').length}</span></div>
                    {positions.length === 0 ? (
                        <div className='dtrader__empty'>
                            <span className='dtrader__empty-icon'>⌁</span>
                            <strong>You have no open positions.</strong>
                            <span>Choose a contract on the right to start trading.</span>
                        </div>
                    ) : positions.map(position => (
                        <div className={`dtrader__position dtrader__position--${position.status}`} key={position.id}>
                            <div><strong>{SYMBOLS.find(s => s.value === symbol)?.label}</strong><span>{position.side === 'over' ? '↗ Over' : '↘ Under'}</span></div>
                            <div className='dtrader__position-meta'><span>Stake</span><b>{formatMoney(position.stake, currency)}</b><span>Status</span><b>{position.status}</b></div>
                            {position.profit != null && <div className={position.profit >= 0 ? 'positive' : 'negative'}>{position.profit >= 0 ? '+' : ''}{formatMoney(position.profit, currency)}</div>}
                        </div>
                    ))}
                    <div className='dtrader__total'><span>Total P/L</span><strong className={totalProfit >= 0 ? 'positive' : 'negative'}>{totalProfit >= 0 ? '+' : ''}{formatMoney(totalProfit, currency)}</strong></div>
                </aside>

                <section className='dtrader__chart-shell'>
                    <div className='dtrader__market-select'>
                        <span className='dtrader__market-dot' />
                        <select value={symbol} onChange={e => setSymbol(e.target.value)}>
                            {SYMBOLS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                        <span className='dtrader__price'>{latestPrice?.toFixed(3) ?? '—'}</span>
                    </div>
                    <div className='dtrader__chart' ref={chartRef}>
                        <div className='dtrader__grid' />
                        <svg viewBox='0 0 100 100' preserveAspectRatio='none' aria-label='Live market chart'>
                            <defs><linearGradient id='dtrader-fill' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stopColor='#6ee7b7' stopOpacity='.34' /><stop offset='100%' stopColor='#6ee7b7' stopOpacity='.02' /></linearGradient></defs>
                            {chartPath && <><path d={`${chartPath} L 100 100 L 0 100 Z`} fill='url(#dtrader-fill)' /><path d={chartPath} fill='none' stroke='#1f2937' strokeWidth='.35' vectorEffect='non-scaling-stroke' /></>}
                        </svg>
                        <div className='dtrader__chart-axis'><span>{latestPrice ? (latestPrice + 2).toFixed(2) : '—'}</span><span>{latestPrice ? latestPrice.toFixed(2) : '—'}</span><span>{latestPrice ? (latestPrice - 2).toFixed(2) : '—'}</span></div>
                        {!ticks.length && <div className='dtrader__chart-loading'>Waiting for live market data…</div>}
                    </div>
                    <div className='dtrader__digit-overlay' aria-label='Live digit distribution'>
                        <div className='dtrader__triangle-track'>
                            {currentDigit != null && (
                                <span
                                    className='dtrader__moving-triangle'
                                    style={{ left: `${currentDigit * 10 + 5}%` }}
                                    aria-label={`Current digit ${currentDigit}`}
                                />
                            )}
                        </div>
                        <div className='dtrader__digit-row'>
                            {digitDistribution.map((percentage, value) => (
                                <button
                                    key={value}
                                    className={`dtrader__digit-circle${currentDigit === value ? ' active' : ''}${barrier === value ? ' selected' : ''}`}
                                    onClick={() => setBarrier(value)}
                                    aria-label={`Digit ${value}, ${percentage}%`}
                                >
                                    <strong>{value}</strong>
                                    <small>{percentage}%</small>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <aside className='dtrader__trade-panel'>
                    <div className='dtrader__learn'>Learn about this trade type <span>ⓘ</span></div>
                    <div className='dtrader__contract-tabs'>
                        <button className={contractFamily === 'digits' ? 'active' : ''} onClick={() => setContractFamily('digits')}>↗ Over/Under</button>
                        <button className={contractFamily === 'accumulators' ? 'active' : ''} onClick={() => setContractFamily('accumulators')}>⌁ Accumulators</button>
                    </div>
                    {contractFamily === 'digits' ? (
                        <>
                            <label className='dtrader__field-label'>Ticks <strong>{duration}</strong></label>
                            <input className='dtrader__range' type='range' min='1' max='10' value={duration} onChange={e => setDuration(+e.target.value)} />
                            <label className='dtrader__field-label'>Last Digit Prediction</label>
                            <div className='dtrader__digit-grid'>{Array.from({ length: 10 }, (_, value) => <button key={value} className={barrier === value ? 'active' : ''} onClick={() => setBarrier(value)}>{value}</button>)}</div>
                        </>
                    ) : (
                        <>
                            <label className='dtrader__field-label'>Growth rate</label>
                            <div className='dtrader__segmented'>{[1, 2, 3, 4, 5].map(value => <button key={value} className={growthRate === value ? 'active' : ''} onClick={() => setGrowthRate(value)}>{value}%</button>)}</div>
                            <label className='dtrader__check'><input type='checkbox' checked={takeProfit} onChange={e => setTakeProfit(e.target.checked)} /> Take profit</label>
                        </>
                    )}
                    <div className='dtrader__stake-control'><button onClick={() => setStake(Math.max(0.35, +(stake - 1).toFixed(2)))}>−</button><span>{stake.toFixed(2)} <small>{currency}</small></span><button onClick={() => setStake(+(stake + 1).toFixed(2))}>+</button></div>
                    <div className='dtrader__commission'>Trading stake {stake.toFixed(2)} + 3% markup {((effectiveStake - stake)).toFixed(2)} = <strong>{effectiveStake.toFixed(2)} {currency}</strong></div>
                    {contractFamily === 'digits' ? (
                        <div className='dtrader__quotes'>
                            {(['over', 'under'] as Side[]).map(currentSide => {
                                const quote = quotes[currentSide];
                                const payout = quote?.payout ?? 0;
                                const percent = effectiveStake > 0 ? Math.max(0, ((payout - effectiveStake) / effectiveStake) * 100) : 0;
                                return <button key={currentSide} className={`dtrader__buy dtrader__buy--${currentSide}`} disabled={!quote || !authorized} onClick={() => buy(currentSide)}>
                                    <span>{currentSide === 'over' ? '↗ Over' : '↘ Under'}</span><b>{quote ? `${percent.toFixed(2)}%` : '—'}</b><small>Payout {quote ? formatMoney(payout, currency) : 'Loading…'}</small>
                                </button>;
                            })}
                        </div>
                    ) : <button className='dtrader__buy dtrader__buy--buy' disabled={!authorized} onClick={() => buy('over')}><span>⌁ Buy Accumulator</span><b>{growthRate}%</b><small>Max ticks controlled by the contract</small></button>}
                    {message && <div className='dtrader__message'>{message}</div>}
                    {!authorized && <div className='dtrader__login-note'>Connect a demo or real account to request live payouts and place trades.</div>}
                </aside>
            </main>
        </div>
    );
};

export default DTrader;