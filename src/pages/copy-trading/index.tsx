import React, { useState } from 'react';
import './copy-trading.scss';

interface Trader {
    id: string;
    name: string;
    winRate: number;
    profit30d: number;
    trades: number;
    risk: 'Low' | 'Med' | 'High';
    copied: boolean;
    avatar: string;
}

const TRADERS: Trader[] = [
    { id: '1', name: 'AlphaTrader_X', winRate: 72.4, profit30d: 842.5, trades: 1204, risk: 'Low', copied: false, avatar: '🦁' },
    { id: '2', name: 'VegaScalper', winRate: 68.9, profit30d: 623.2, trades: 3421, risk: 'Med', copied: false, avatar: '⚡' },
    { id: '3', name: 'NightOwl_Pro', winRate: 81.2, profit30d: 1240.0, trades: 567, risk: 'Low', copied: false, avatar: '🦉' },
    { id: '4', name: 'DigitKing99', winRate: 65.3, profit30d: 1820.4, trades: 8832, risk: 'High', copied: false, avatar: '👑' },
    { id: '5', name: 'SteadyHands', winRate: 75.6, profit30d: 542.1, trades: 892, risk: 'Low', copied: false, avatar: '🎯' },
    { id: '6', name: 'TurboSpike_V2', winRate: 61.8, profit30d: 3100.0, trades: 15203, risk: 'High', copied: false, avatar: '🚀' },
];

const CopyTrading: React.FC = () => {
    const [traders, setTraders] = useState<Trader[]>(TRADERS);
    const [copiedLogs, setCopiedLogs] = useState<Array<{trader: string; profit: number; status: string}>>([]);
    const [allocate, setAllocate] = useState('10');

    const toggleCopy = (id: string) => {
        setTraders(p => p.map(t => t.id === id ? { ...t, copied: !t.copied } : t));
    };

    const simulate = () => {
        const copying = traders.filter(t => t.copied);
        if (copying.length === 0) return;
        copying.forEach(t => {
            const won = Math.random() < t.winRate / 100;
            const profit = won ? parseFloat(allocate) * 0.87 : -parseFloat(allocate);
            setCopiedLogs(p => [{ trader: t.name, profit, status: won ? 'WON' : 'LOST' }, ...p].slice(0, 30));
        });
    };

    const riskColor = (r: string) => ({ Low: '#22c55e', Med: '#f59e0b', High: '#ef4444' })[r] || '#94a3b8';

    return (
        <div className='copytrading'>
            <div className='copytrading__header'>
                <div>
                    <h2 className='copytrading__title'>📋 Copy Trading</h2>
                    <p className='copytrading__sub'>Copy top traders automatically</p>
                </div>
                <div className='copytrading__actions'>
                    <div className='copytrading__allocate'>
                        <label>Allocation/trade (USD)</label>
                        <input type='number' min='0.35' step='0.5' value={allocate} onChange={e => setAllocate(e.target.value)} />
                    </div>
                    <button className='copytrading__sim-btn' onClick={simulate}>▶ Simulate Cycle</button>
                </div>
            </div>

            <div className='copytrading__traders'>
                {traders.map(t => (
                    <div key={t.id} className={`copytrading__card ${t.copied ? 'copying' : ''}`}>
                        <div className='copytrading__card-left'>
                            <div className='copytrading__avatar'>{t.avatar}</div>
                            <div>
                                <div className='copytrading__name'>{t.name}</div>
                                <div className='copytrading__trades'>{t.trades.toLocaleString()} trades</div>
                            </div>
                        </div>
                        <div className='copytrading__card-stats'>
                            <div className='copytrading__metric'><span>Win Rate</span><strong style={{color:'#22c55e'}}>{t.winRate}%</strong></div>
                            <div className='copytrading__metric'><span>30d P&L</span><strong style={{color:'#06b6d4'}}>+{t.profit30d.toFixed(0)}</strong></div>
                            <div className='copytrading__metric'><span>Risk</span><strong style={{color: riskColor(t.risk)}}>{t.risk}</strong></div>
                        </div>
                        <button className={`copytrading__copy-btn ${t.copied ? 'active' : ''}`} onClick={() => toggleCopy(t.id)}>
                            {t.copied ? '✓ Copying' : '+ Copy'}
                        </button>
                    </div>
                ))}
            </div>

            {copiedLogs.length > 0 && (
                <div className='copytrading__log'>
                    <h3>Copy Log</h3>
                    {copiedLogs.map((l, i) => (
                        <div key={i} className={`copytrading__log-row ${l.status === 'WON' ? 'won' : 'lost'}`}>
                            <span>{l.trader}</span>
                            <span className={`copytrading__log-status ${l.status === 'WON' ? 'won' : 'lost'}`}>{l.status}</span>
                            <span className={l.profit >= 0 ? 'pos' : 'neg'}>{l.profit >= 0 ? '+' : ''}{l.profit.toFixed(2)} USD</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CopyTrading;
