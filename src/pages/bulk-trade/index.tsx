import React, { useState } from 'react';
import './bulk-trade.scss';

interface TradeConfig {
    id: string;
    symbol: string;
    contract: string;
    stake: string;
    duration: string;
    status: 'idle' | 'running' | 'won' | 'lost';
    profit: number;
}

const SYMBOLS = ['R_100','R_75','R_50','R_25','R_10','1HZ100V','1HZ10V'];
const CONTRACTS = ['Rise','Fall','Matches','Differs','Over','Under','Even','Odd'];

const newConfig = (): TradeConfig => ({
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    symbol: 'R_100',
    contract: 'Rise',
    stake: '1.00',
    duration: '5',
    status: 'idle',
    profit: 0,
});

const BulkTrade: React.FC = () => {
    const [trades, setTrades] = useState<TradeConfig[]>([newConfig(), newConfig()]);
    const [globalRunning, setGlobalRunning] = useState(false);
    const [totalProfit, setTotalProfit] = useState(0);

    const addTrade = () => setTrades(prev => [...prev, newConfig()]);
    const removeTrade = (id: string) => setTrades(prev => prev.filter(t => t.id !== id));

    const updateTrade = (id: string, field: keyof TradeConfig, value: string) => {
        setTrades(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const runAll = () => {
        if (globalRunning) {
            setTrades(prev => prev.map(t => ({ ...t, status: 'idle' as const })));
            setGlobalRunning(false);
            return;
        }
        setGlobalRunning(true);
        setTrades(prev => prev.map(t => ({ ...t, status: 'running' as const, profit: 0 })));

        trades.forEach((trade, i) => {
            setTimeout(() => {
                const won = Math.random() > 0.45;
                const profit = won ? parseFloat(trade.stake) * 0.87 : -parseFloat(trade.stake);
                setTrades(prev => prev.map(t =>
                    t.id === trade.id
                        ? { ...t, status: won ? 'won' : 'lost', profit }
                        : t
                ));
                setTotalProfit(prev => prev + profit);
            }, (i + 1) * 800 + Math.random() * 400);
        });

        setTimeout(() => setGlobalRunning(false), trades.length * 1200 + 1000);
    };

    return (
        <div className='bulk-trade'>
            <div className='bulk-trade__header'>
                <div>
                    <h2 className='bulk-trade__title'>⚡ Bulk Trade</h2>
                    <p className='bulk-trade__sub'>Execute multiple contracts simultaneously</p>
                </div>
                <div className='bulk-trade__header-actions'>
                    <div className={`bulk-trade__profit-badge ${totalProfit >= 0 ? 'pos' : 'neg'}`}>
                        Total P&L: {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} USD
                    </div>
                    <button className='bulk-trade__add-btn' onClick={addTrade}>+ Add Contract</button>
                    <button className={`bulk-trade__run-btn ${globalRunning ? 'stop' : ''}`} onClick={runAll}>
                        {globalRunning ? '⏹ Stop All' : '▶ Run All'}
                    </button>
                </div>
            </div>

            <div className='bulk-trade__grid'>
                {trades.map((trade, idx) => (
                    <div key={trade.id} className={`bulk-trade__card bulk-trade__card--${trade.status}`}>
                        <div className='bulk-trade__card-header'>
                            <span className='bulk-trade__card-num'>#{idx + 1}</span>
                            <div className={`bulk-trade__status-dot bulk-trade__status-dot--${trade.status}`} />
                            <span className='bulk-trade__status-label'>{trade.status.toUpperCase()}</span>
                            <button className='bulk-trade__remove-btn' onClick={() => removeTrade(trade.id)}>✕</button>
                        </div>

                        <div className='bulk-trade__fields'>
                            <div className='bulk-trade__field'>
                                <label>Symbol</label>
                                <select value={trade.symbol} onChange={e => updateTrade(trade.id, 'symbol', e.target.value)}>
                                    {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className='bulk-trade__field'>
                                <label>Contract</label>
                                <select value={trade.contract} onChange={e => updateTrade(trade.id, 'contract', e.target.value)}>
                                    {CONTRACTS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className='bulk-trade__field'>
                                <label>Stake (USD)</label>
                                <input type='number' min='0.35' step='0.01' value={trade.stake} onChange={e => updateTrade(trade.id, 'stake', e.target.value)} />
                            </div>
                            <div className='bulk-trade__field'>
                                <label>Duration (ticks)</label>
                                <input type='number' min='1' max='10' value={trade.duration} onChange={e => updateTrade(trade.id, 'duration', e.target.value)} />
                            </div>
                        </div>

                        {(trade.status === 'won' || trade.status === 'lost') && (
                            <div className={`bulk-trade__result ${trade.status}`}>
                                {trade.status === 'won' ? '✓ WON' : '✗ LOST'} &nbsp;
                                <strong>{trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)} USD</strong>
                            </div>
                        )}

                        {trade.status === 'running' && (
                            <div className='bulk-trade__running-bar'>
                                <div className='bulk-trade__running-fill' />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BulkTrade;
