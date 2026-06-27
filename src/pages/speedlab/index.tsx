import React, { useRef, useState, useCallback } from 'react';
import './speedlab.scss';

const SYMBOLS = ['R_100','R_75','R_50','R_25','R_10','1HZ100V','1HZ10V'];
const CONTRACTS = ['Rise','Fall','Matches','Differs','Even','Odd'];

interface TradeLog {
    id: number;
    contract: string;
    stake: number;
    status: 'WON' | 'LOST';
    profit: number;
    ms: number;
}

const SpeedLab: React.FC = () => {
    const [symbol, setSymbol] = useState('1HZ100V');
    const [contract, setContract] = useState('Rise');
    const [stake, setStake] = useState('0.35');
    const [running, setRunning] = useState(false);
    const [logs, setLogs] = useState<TradeLog[]>([]);
    const [totalPnl, setTotalPnl] = useState(0);
    const [tradeCount, setTradeCount] = useState(0);
    const [speed, setSpeed] = useState(500);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const idRef = useRef(0);

    const executeTrade = useCallback(() => {
        const start = performance.now();
        const s = parseFloat(stake);
        setTimeout(() => {
            const won = Math.random() > 0.45;
            const profit = won ? s * 0.87 : -s;
            const ms = performance.now() - start;
            const entry: TradeLog = { id: idRef.current++, contract, stake: s, status: won ? 'WON' : 'LOST', profit, ms: Math.round(ms) };
            setLogs(prev => [entry, ...prev].slice(0, 50));
            setTotalPnl(prev => prev + profit);
            setTradeCount(prev => prev + 1);
        }, 50 + Math.random() * 80);
    }, [contract, stake]);

    const toggleRun = () => {
        if (running) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setRunning(false);
        } else {
            setRunning(true);
            intervalRef.current = setInterval(executeTrade, speed);
        }
    };

    const clearLogs = () => { setLogs([]); setTotalPnl(0); setTradeCount(0); };

    const winRate = tradeCount > 0 ? ((logs.filter(l => l.status === 'WON').length / Math.min(logs.length, tradeCount)) * 100).toFixed(1) : '0.0';

    return (
        <div className='speedlab'>
            <div className='speedlab__header'>
                <div>
                    <h2 className='speedlab__title'>🔬 SpeedLab</h2>
                    <p className='speedlab__sub'>Ultra-fast automated trading laboratory</p>
                </div>
                <div className='speedlab__stats-strip'>
                    <div className='speedlab__stat'><span>Trades</span><strong>{tradeCount}</strong></div>
                    <div className='speedlab__stat'><span>Win Rate</span><strong style={{color:'#22c55e'}}>{winRate}%</strong></div>
                    <div className='speedlab__stat'><span>P&L</span><strong className={totalPnl >= 0 ? 'pos' : 'neg'}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}</strong></div>
                </div>
            </div>

            <div className='speedlab__controls'>
                <div className='speedlab__field'>
                    <label>Symbol</label>
                    <select value={symbol} onChange={e => setSymbol(e.target.value)}>
                        {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className='speedlab__field'>
                    <label>Contract</label>
                    <select value={contract} onChange={e => setContract(e.target.value)}>
                        {CONTRACTS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className='speedlab__field'>
                    <label>Stake (USD)</label>
                    <input type='number' min='0.35' step='0.01' value={stake} onChange={e => setStake(e.target.value)} />
                </div>
                <div className='speedlab__field'>
                    <label>Interval (ms): {speed}</label>
                    <input type='range' min={200} max={3000} step={100} value={speed} onChange={e => { setSpeed(+e.target.value); if (running && intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = setInterval(executeTrade, +e.target.value); } }} />
                </div>
                <button className={`speedlab__run-btn ${running ? 'stop' : ''}`} onClick={toggleRun}>
                    {running ? '⏹ STOP' : '⚡ START'}
                </button>
                <button className='speedlab__clear-btn' onClick={clearLogs}>↺ Clear</button>
            </div>

            <div className='speedlab__log'>
                <div className='speedlab__log-header'>
                    <span>Trade Log</span>
                    <span className={`speedlab__live-dot ${running ? 'on' : ''}`}>{running ? '● LIVE' : '○ Idle'}</span>
                </div>
                <div className='speedlab__log-body'>
                    {logs.map(log => (
                        <div key={log.id} className={`speedlab__log-row ${log.status.toLowerCase()}`}>
                            <span className='speedlab__log-id'>#{log.id}</span>
                            <span className='speedlab__log-contract'>{log.contract}</span>
                            <span className='speedlab__log-stake'>{log.stake.toFixed(2)}</span>
                            <span className={`speedlab__log-status ${log.status.toLowerCase()}`}>{log.status}</span>
                            <span className={`speedlab__log-profit ${log.profit >= 0 ? 'pos' : 'neg'}`}>{log.profit >= 0 ? '+' : ''}{log.profit.toFixed(2)}</span>
                            <span className='speedlab__log-ms'>{log.ms}ms</span>
                        </div>
                    ))}
                    {logs.length === 0 && <div className='speedlab__log-empty'>No trades yet. Click START to begin.</div>}
                </div>
            </div>
        </div>
    );
};

export default SpeedLab;
