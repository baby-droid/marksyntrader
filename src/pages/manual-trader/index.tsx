import React, { useState } from 'react';
import './manual-trader.scss';

const SYMBOLS = ['R_100','R_75','R_50','R_25','R_10','1HZ100V','1HZ75V','1HZ10V'];

interface Position {
    id: number;
    symbol: string;
    contract: string;
    stake: number;
    status: 'open' | 'won' | 'lost';
    entry: number;
    profit: number;
    tick: number;
}

const ManualTrader: React.FC = () => {
    const [symbol, setSymbol] = useState('R_100');
    const [stake, setStake] = useState('1.00');
    const [duration, setDuration] = useState('5');
    const [positions, setPositions] = useState<Position[]>([]);
    const [pnl, setPnl] = useState(0);
    const idRef = React.useRef(0);

    const buy = (contract: string) => {
        const s = parseFloat(stake);
        const entry = parseFloat((99 + Math.random() * 2).toFixed(4));
        const pos: Position = { id: idRef.current++, symbol, contract, stake: s, status: 'open', entry, profit: 0, tick: 0 };
        setPositions(p => [pos, ...p]);

        const ticks = parseInt(duration);
        let t = 0;
        const iv = setInterval(() => {
            t++;
            setPositions(p => p.map(x => x.id === pos.id ? { ...x, tick: t } : x));
            if (t >= ticks) {
                clearInterval(iv);
                const won = Math.random() > 0.45;
                const profit = won ? s * 0.87 : -s;
                setPositions(p => p.map(x => x.id === pos.id ? { ...x, status: won ? 'won' : 'lost', profit } : x));
                setPnl(prev => prev + profit);
            }
        }, 1000);
    };

    const closeAll = () => {
        setPositions([]);
        setPnl(0);
    };

    const openPositions = positions.filter(p => p.status === 'open');
    const closedPositions = positions.filter(p => p.status !== 'open');

    return (
        <div className='manual-trader'>
            <div className='manual-trader__header'>
                <div>
                    <h2 className='manual-trader__title'>🎮 Manual Trader</h2>
                    <p className='manual-trader__sub'>Buy contracts with one click</p>
                </div>
                <div className={`manual-trader__pnl ${pnl >= 0 ? 'pos' : 'neg'}`}>
                    P&L: {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USD
                </div>
            </div>

            <div className='manual-trader__panel'>
                <div className='manual-trader__settings'>
                    <div className='manual-trader__field'>
                        <label>Symbol</label>
                        <select value={symbol} onChange={e => setSymbol(e.target.value)}>
                            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className='manual-trader__field'>
                        <label>Stake (USD)</label>
                        <input type='number' min='0.35' step='0.01' value={stake} onChange={e => setStake(e.target.value)} />
                    </div>
                    <div className='manual-trader__field'>
                        <label>Duration (ticks)</label>
                        <input type='number' min='1' max='10' value={duration} onChange={e => setDuration(e.target.value)} />
                    </div>
                </div>

                <div className='manual-trader__buttons'>
                    <button className='manual-trader__btn manual-trader__btn--rise' onClick={() => buy('Rise')}>↑ RISE</button>
                    <button className='manual-trader__btn manual-trader__btn--fall' onClick={() => buy('Fall')}>↓ FALL</button>
                    <button className='manual-trader__btn manual-trader__btn--even' onClick={() => buy('Even')}>EVEN</button>
                    <button className='manual-trader__btn manual-trader__btn--odd' onClick={() => buy('Odd')}>ODD</button>
                    <button className='manual-trader__btn manual-trader__btn--over' onClick={() => buy('Over 4')}>OVER 4</button>
                    <button className='manual-trader__btn manual-trader__btn--under' onClick={() => buy('Under 5')}>UNDER 5</button>
                </div>
            </div>

            {openPositions.length > 0 && (
                <div className='manual-trader__section'>
                    <div className='manual-trader__section-header'>
                        <h3>Open Positions ({openPositions.length})</h3>
                    </div>
                    <div className='manual-trader__positions'>
                        {openPositions.map(p => (
                            <div key={p.id} className='manual-trader__position open'>
                                <span className='manual-trader__pos-symbol'>{p.symbol}</span>
                                <span className='manual-trader__pos-contract'>{p.contract}</span>
                                <span className='manual-trader__pos-stake'>{p.stake.toFixed(2)} USD</span>
                                <div className='manual-trader__pos-progress'>
                                    <div className='manual-trader__pos-bar' style={{ width: `${(p.tick / parseInt(duration)) * 100}%` }} />
                                </div>
                                <span className='manual-trader__pos-tick'>Tick {p.tick}/{duration}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {closedPositions.length > 0 && (
                <div className='manual-trader__section'>
                    <div className='manual-trader__section-header'>
                        <h3>Closed ({closedPositions.length})</h3>
                        <button className='manual-trader__clear-btn' onClick={closeAll}>Clear</button>
                    </div>
                    <div className='manual-trader__positions'>
                        {closedPositions.slice(0, 20).map(p => (
                            <div key={p.id} className={`manual-trader__position ${p.status}`}>
                                <span className='manual-trader__pos-symbol'>{p.symbol}</span>
                                <span className='manual-trader__pos-contract'>{p.contract}</span>
                                <span className='manual-trader__pos-stake'>{p.stake.toFixed(2)}</span>
                                <span className={`manual-trader__pos-badge ${p.status}`}>{p.status.toUpperCase()}</span>
                                <span className={`manual-trader__pos-profit ${p.profit >= 0 ? 'pos' : 'neg'}`}>{p.profit >= 0 ? '+' : ''}{p.profit.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManualTrader;
