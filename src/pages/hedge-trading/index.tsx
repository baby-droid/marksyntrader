import React, { useState } from 'react';
import './hedge-trading.scss';

const SYMBOLS = ['R_100','R_75','R_50','R_25','R_10','1HZ100V','1HZ10V'];

const HedgeTrading: React.FC = () => {
    const [symbol, setSymbol] = useState('R_100');
    const [stake, setStake] = useState('1.00');
    const [duration, setDuration] = useState('5');
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState<Array<{id:number; dir: string; status: string; profit: number}>>([]);
    const [totalPnl, setTotalPnl] = useState(0);

    const runHedge = () => {
        if (running) { setRunning(false); return; }
        setRunning(true);
        const id = Date.now();
        const s = parseFloat(stake);

        setTimeout(() => {
            const riseWon = Math.random() > 0.45;
            const fallWon = !riseWon || Math.random() > 0.7;
            const riseProfit = riseWon ? s * 0.87 : -s;
            const fallProfit = fallWon ? s * 0.87 : -s;
            const total = riseProfit + fallProfit;

            setResults(prev => [{
                id, dir: 'RISE', status: riseWon ? 'WON' : 'LOST', profit: riseProfit
            }, {
                id: id + 1, dir: 'FALL', status: fallWon ? 'WON' : 'LOST', profit: fallProfit
            }, ...prev].slice(0, 40));

            setTotalPnl(prev => prev + total);
            setRunning(false);
        }, 2000 + Math.random() * 1000);
    };

    return (
        <div className='hedge'>
            <div className='hedge__header'>
                <div>
                    <h2 className='hedge__title'>⚖ Hedge Trading</h2>
                    <p className='hedge__sub'>Trade RISE and FALL simultaneously to hedge risk</p>
                </div>
                <div className={`hedge__pnl ${totalPnl >= 0 ? 'pos' : 'neg'}`}>
                    P&L: {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USD
                </div>
            </div>

            <div className='hedge__setup'>
                <div className='hedge__field'>
                    <label>Symbol</label>
                    <select value={symbol} onChange={e => setSymbol(e.target.value)}>
                        {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className='hedge__field'>
                    <label>Stake per side (USD)</label>
                    <input type='number' min='0.35' step='0.01' value={stake} onChange={e => setStake(e.target.value)} />
                </div>
                <div className='hedge__field'>
                    <label>Duration (ticks)</label>
                    <input type='number' min='1' max='10' value={duration} onChange={e => setDuration(e.target.value)} />
                </div>
                <button className={`hedge__run-btn ${running ? 'stop' : ''}`} onClick={runHedge}>
                    {running ? '⏳ Waiting…' : '⚖ Execute Hedge'}
                </button>
            </div>

            <div className='hedge__lanes'>
                <div className='hedge__lane hedge__lane--rise'>
                    <div className='hedge__lane-header'>↑ RISE</div>
                    <div className='hedge__lane-stake'>{stake} USD</div>
                    <div className='hedge__lane-symbol'>{symbol}</div>
                    {running && <div className='hedge__pulse' />}
                </div>
                <div className='hedge__vs'>VS</div>
                <div className='hedge__lane hedge__lane--fall'>
                    <div className='hedge__lane-header'>↓ FALL</div>
                    <div className='hedge__lane-stake'>{stake} USD</div>
                    <div className='hedge__lane-symbol'>{symbol}</div>
                    {running && <div className='hedge__pulse' />}
                </div>
            </div>

            {results.length > 0 && (
                <div className='hedge__history'>
                    <h3 className='hedge__history-title'>Trade History</h3>
                    <table className='hedge__table'>
                        <thead>
                            <tr><th>#</th><th>Direction</th><th>Status</th><th>P&L</th></tr>
                        </thead>
                        <tbody>
                            {results.map((r, i) => (
                                <tr key={r.id} className={r.status === 'WON' ? 'won' : 'lost'}>
                                    <td>{Math.floor(i / 2) + 1}</td>
                                    <td>{r.dir}</td>
                                    <td><span className={`hedge__badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
                                    <td className={r.profit >= 0 ? 'pos' : 'neg'}>{r.profit >= 0 ? '+' : ''}{r.profit.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default HedgeTrading;
