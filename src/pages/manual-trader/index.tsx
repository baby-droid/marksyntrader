import React, { useEffect, useRef, useState } from 'react';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { applyCommission } from '@/utils/commission';
import './manual-trader.scss';

function getLastDigit(quote: number): number {
    const s = quote.toFixed(2).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

const DIGIT_BG: Record<number,string> = {
    0:'#fff',1:'#fff',2:'#fff',3:'#D88B1F',4:'#fff',5:'#fff',
    6:'#42B883',7:'#E24A43',8:'#42B883',9:'#4E7CF5',
};
const DIGIT_COLOR: Record<number,string> = {
    3:'#fff',6:'#fff',7:'#fff',8:'#fff',9:'#fff',
};
const DIGIT_BORDER: Record<number,string> = {
    0:'#D9D9D9',1:'#D9D9D9',2:'#D9D9D9',3:'#D88B1F',4:'#D9D9D9',5:'#D9D9D9',
    6:'#42B883',7:'#E24A43',8:'#42B883',9:'#4E7CF5',
};

const SYMBOLS = [
    {label:'V10',value:'R_10'},{label:'V25',value:'R_25'},{label:'V50',value:'R_50'},
    {label:'V75',value:'R_75'},{label:'V100',value:'R_100'},
    {label:'V10 1s',value:'1HZ10V'},{label:'V25 1s',value:'1HZ25V'},
    {label:'V50 1s',value:'1HZ50V'},{label:'V75 1s',value:'1HZ75V'},
    {label:'V100 1s',value:'1HZ100V'},
];

interface Position {
    id: number;
    symbol: string;
    contract: string;
    contractType: string;
    stake: number;
    status: 'open' | 'won' | 'lost';
    profit: number;
    tick: number;
    duration: number;
    entry?: number;
    exit?: number;
}

const ManualTrader: React.FC = () => {
    const { buyContract, subscribeTicks, connected, balance, currency } = useDerivTrade();
    const [symbolIdx, setSymbolIdx] = useState(4);
    const [stake, setStake] = useState('1.00');
    const [duration, setDuration] = useState(5);
    const [positions, setPositions] = useState<Position[]>([]);
    const [pnl, setPnl] = useState(0);
    const [currentDigit, setCurrentDigit] = useState<number | null>(null);
    const [digitStats, setDigitStats] = useState<number[]>(new Array(10).fill(0));
    const [totalTicks, setTotalTicks] = useState(0);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const idRef = useRef(0);

    const symbol = SYMBOLS[symbolIdx];

    const onMouseMove = (e: React.MouseEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    useEffect(() => {
        const unsub = subscribeTicks(symbol.value, (tick) => {
            setCurrentDigit(tick.digit);
            setDigitStats(prev => {
                const next = [...prev];
                next[tick.digit]++;
                return next;
            });
            setTotalTicks(p => p + 1);
        });
        setDigitStats(new Array(10).fill(0));
        setTotalTicks(0);
        setCurrentDigit(null);
        return unsub;
    }, [symbol.value]);

    const pcts = digitStats.map(c => totalTicks > 0 ? (c / totalTicks) * 100 : 0);
    const maxPct = Math.max(...pcts);
    const minPct = Math.min(...pcts.filter((_, i) => digitStats[i] > 0));

    const buy = async (contractLabel: string, contractType: string, barrier?: number) => {
        const s = parseFloat(stake);
        const pos: Position = {
            id: idRef.current++, symbol: symbol.label, contract: contractLabel,
            contractType, stake: s, status: 'open', profit: 0, tick: 0, duration,
        };
        setPositions(p => [pos, ...p]);

        try {
            let t = 0;
            const iv = setInterval(() => {
                t++;
                setPositions(p => p.map(x => (x.id === pos.id && x.status === 'open' ? { ...x, tick: Math.min(t, duration) } : x)));
                if (t >= duration) clearInterval(iv);
            }, 1000);

            await buyContract(
                {
                    symbol: symbol.value,
                    contract_type: contractType as any,
                    duration,
                    duration_unit: 't',
                    stake: s,
                    barrier,
                },
                c => {
                    clearInterval(iv);
                    const profit = applyCommission(c.profit);
                    setPositions(p => p.map(x => (x.id === pos.id
                        ? { ...x, status: c.status, profit, entry: c.entry_spot, exit: c.exit_spot }
                        : x)));
                    setPnl(prev => prev + profit);
                }
            );
        } catch {
            setPositions(p => p.filter(x => x.id !== pos.id));
        }
    };

    return (
        <div className='manual-trader' ref={containerRef} onMouseMove={onMouseMove}>
            {/* Red triangle cursor */}
            <svg className='manual-trader__cursor'
                style={{ left: mousePos.x, top: mousePos.y }}
                width='20' height='20' viewBox='0 0 20 20'>
                <polygon points='0,0 20,10 0,20 4,10' fill='#ef4444' opacity='0.9' />
            </svg>

            <div className='manual-trader__header'>
                <div>
                    <h2 className='manual-trader__title'>🎮 Manual Trader</h2>
                    <p className='manual-trader__sub'>One-click contract execution with live digit analysis</p>
                </div>
                <div className='manual-trader__header-right'>
                    <span className={`manual-trader__conn ${connected ? 'on' : 'off'}`}>{connected ? '● LIVE' : '○ Offline'}</span>
                    {balance !== null && <span className='manual-trader__balance'>{currency} {balance.toFixed(2)}</span>}
                    <div className={`manual-trader__pnl ${pnl >= 0 ? 'pos' : 'neg'}`}>
                        P&L: {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} {currency}
                    </div>
                </div>
            </div>

            {/* Symbol selector */}
            <div className='manual-trader__symbols'>
                {SYMBOLS.map((s, i) => (
                    <button key={s.value}
                        className={`manual-trader__symbol-btn ${symbolIdx === i ? 'active' : ''}`}
                        onClick={() => setSymbolIdx(i)}>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Digit circles per spec */}
            <div className='manual-trader__circles-section'>
                <div className='manual-trader__circles-row'>
                    {Array.from({length: 10}, (_, d) => {
                        const isCurrent = currentDigit === d;
                        const pct = pcts[d];
                        const isHighest = pct === maxPct && totalTicks > 0;
                        const isLowest = pct === minPct && digitStats[d] > 0 && totalTicks > 20;

                        return (
                            <div key={d} className='manual-trader__circle-cell'>
                                <div className={`manual-trader__circle-wrap ${isCurrent ? 'current' : ''}`}>
                                    <div
                                        className='manual-trader__digit-circle'
                                        style={{
                                            width: isCurrent ? 84 : 72,
                                            height: isCurrent ? 84 : 72,
                                            background: DIGIT_BG[d],
                                            border: isCurrent ? `3px solid #4C7DFF` : `2px solid ${DIGIT_BORDER[d]}`,
                                            boxShadow: isCurrent
                                                ? '0 0 0 3px rgba(76,125,255,0.2), 0 2px 6px rgba(0,0,0,0.15)'
                                                : '0 2px 6px rgba(0,0,0,0.1)',
                                        }}
                                    >
                                        <span className='manual-trader__circle-digit' style={{ color: DIGIT_COLOR[d] || '#1F2937' }}>{d}</span>
                                        <span className='manual-trader__circle-pct' style={{ color: DIGIT_COLOR[d] ? 'rgba(255,255,255,0.8)' : '#555' }}>
                                            {pct.toFixed(1)}%
                                        </span>
                                    </div>
                                    {isHighest && <div className='manual-trader__circle-bar manual-trader__circle-bar--green' />}
                                    {isLowest && <div className='manual-trader__circle-bar manual-trader__circle-bar--red' />}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Controls */}
            <div className='manual-trader__panel'>
                <div className='manual-trader__settings'>
                    <div className='manual-trader__field'>
                        <label>Stake (USD)</label>
                        <div className='manual-trader__stake-row'>
                            {[0.5,1,2,5].map(v => (
                                <button key={v}
                                    className={`manual-trader__stake-preset ${parseFloat(stake) === v ? 'active' : ''}`}
                                    onClick={() => setStake(v.toFixed(2))}>
                                    ${v}
                                </button>
                            ))}
                            <input type='number' min='0.35' step='0.01' value={stake} onChange={e => setStake(e.target.value)} />
                        </div>
                    </div>
                    <div className='manual-trader__field'>
                        <label>Duration (ticks): {duration}T</label>
                        <div className='manual-trader__dur-row'>
                            {[1,2,3,5,10].map(v => (
                                <button key={v}
                                    className={`manual-trader__dur-btn ${duration === v ? 'active' : ''}`}
                                    onClick={() => setDuration(v)}>
                                    {v}T
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className='manual-trader__buttons'>
                    <button className='manual-trader__btn manual-trader__btn--rise' onClick={() => buy('Rise','CALL')}>↑ RISE</button>
                    <button className='manual-trader__btn manual-trader__btn--fall' onClick={() => buy('Fall','PUT')}>↓ FALL</button>
                    <button className='manual-trader__btn manual-trader__btn--even' onClick={() => buy('Even','DIGITEVEN')}>EVEN</button>
                    <button className='manual-trader__btn manual-trader__btn--odd' onClick={() => buy('Odd','DIGITODD')}>ODD</button>
                    <button className='manual-trader__btn manual-trader__btn--over' onClick={() => buy('Over 4','DIGITOVER',4)}>OVER 4</button>
                    <button className='manual-trader__btn manual-trader__btn--under' onClick={() => buy('Under 5','DIGITUNDER',5)}>UNDER 5</button>
                </div>
            </div>

            {/* Open positions */}
            {positions.filter(p => p.status === 'open').length > 0 && (
                <div className='manual-trader__section'>
                    <h3>Open ({positions.filter(p => p.status === 'open').length})</h3>
                    {positions.filter(p => p.status === 'open').map(p => (
                        <div key={p.id} className='manual-trader__position open'>
                            <span>{p.symbol}</span><span>{p.contract}</span>
                            <span>{p.stake.toFixed(2)}</span>
                            <div className='manual-trader__pos-progress'>
                                <div className='manual-trader__pos-bar' style={{ width: `${(p.tick / p.duration) * 100}%` }} />
                            </div>
                            <span className='manual-trader__pos-tick'>{p.tick}/{p.duration}T</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Closed positions */}
            {positions.filter(p => p.status !== 'open').length > 0 && (
                <div className='manual-trader__section'>
                    <div className='manual-trader__section-header'>
                        <h3>Closed ({positions.filter(p => p.status !== 'open').length})</h3>
                        <button onClick={() => setPositions(p => p.filter(x => x.status === 'open'))}>Clear</button>
                    </div>
                    {positions.filter(p => p.status !== 'open').slice(0, 20).map(p => (
                        <div key={p.id} className={`manual-trader__position ${p.status}`}>
                            <span>{p.symbol}</span><span>{p.contract}</span>
                            <span>{p.stake.toFixed(2)}</span>
                            <span className={`manual-trader__badge ${p.status}`}>{p.status.toUpperCase()}</span>
                            <span className={p.profit >= 0 ? 'pos' : 'neg'}>{p.profit >= 0 ? '+' : ''}{p.profit.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ManualTrader;
