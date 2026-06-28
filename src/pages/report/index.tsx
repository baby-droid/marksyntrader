import React, { useState } from 'react';
import './report.scss';

interface TradeRecord {
    id: number;
    date: string;
    symbol: string;
    contract: string;
    stake: number;
    profit: number;
    status: 'WON' | 'LOST';
    duration: number;
}

function generateRecords(n: number): TradeRecord[] {
    const symbols = ['R_100','R_75','R_50','1HZ100V'];
    const contracts = ['Rise','Fall','Matches','Differs','Even','Odd'];
    const now = Date.now();
    return Array.from({ length: n }, (_, i) => {
        const stake = +(0.35 + Math.random() * 5).toFixed(2);
        const won = Math.random() > 0.45;
        return {
            id: i + 1,
            date: new Date(now - (n - i) * 120000 - Math.random() * 60000).toLocaleString(),
            symbol: symbols[Math.floor(Math.random() * symbols.length)],
            contract: contracts[Math.floor(Math.random() * contracts.length)],
            stake,
            profit: won ? +(stake * 0.87).toFixed(2) : -stake,
            status: won ? 'WON' : 'LOST',
            duration: Math.floor(1 + Math.random() * 9),
        };
    });
}

const RECORDS = generateRecords(50);

const Report: React.FC = () => {
    const [filter, setFilter] = useState<'ALL' | 'WON' | 'LOST'>('ALL');
    const [search, setSearch] = useState('');

    const filtered = RECORDS.filter(r => {
        if (filter === 'WON' && r.status !== 'WON') return false;
        if (filter === 'LOST' && r.status !== 'LOST') return false;
        if (search && !r.symbol.toLowerCase().includes(search.toLowerCase()) && !r.contract.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const totalPnl = RECORDS.reduce((s, r) => s + r.profit, 0);
    const wins = RECORDS.filter(r => r.status === 'WON').length;
    const winRate = ((wins / RECORDS.length) * 100).toFixed(1);
    const totalStake = RECORDS.reduce((s, r) => s + r.stake, 0);

    return (
        <div className='report'>
            <div className='report__header'>
                <div>
                    <h2 className='report__title'>📊 Report</h2>
                    <p className='report__sub'>Full trade history and performance analysis</p>
                </div>
            </div>

            <div className='report__summary'>
                <div className='report__metric'><span>Total P&L</span><strong className={totalPnl >= 0 ? 'pos' : 'neg'}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USD</strong></div>
                <div className='report__metric'><span>Win Rate</span><strong style={{color:'#22c55e'}}>{winRate}%</strong></div>
                <div className='report__metric'><span>Total Trades</span><strong>{RECORDS.length}</strong></div>
                <div className='report__metric'><span>Wins / Losses</span><strong>{wins} / {RECORDS.length - wins}</strong></div>
                <div className='report__metric'><span>Total Staked</span><strong>{totalStake.toFixed(2)} USD</strong></div>
            </div>

            <div className='report__bar-chart'>
                {RECORDS.slice(-20).map(r => (
                    <div key={r.id} className='report__bar-col'>
                        <div
                            className={`report__bar ${r.status === 'WON' ? 'won' : 'lost'}`}
                            style={{ height: `${Math.min(Math.abs(r.profit) * 20, 80)}px` }}
                            title={`${r.status}: ${r.profit >= 0 ? '+' : ''}${r.profit}`}
                        />
                    </div>
                ))}
            </div>

            <div className='report__filters'>
                {(['ALL','WON','LOST'] as const).map(f => (
                    <button key={f} className={`report__filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
                ))}
                <input className='report__search' placeholder='Search symbol/contract…' value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className='report__table-wrap'>
                <table className='report__table'>
                    <thead>
                        <tr><th>#</th><th>Date</th><th>Symbol</th><th>Contract</th><th>Stake</th><th>Status</th><th>P&L</th><th>Duration</th></tr>
                    </thead>
                    <tbody>
                        {filtered.map(r => (
                            <tr key={r.id} className={r.status === 'WON' ? 'won' : 'lost'}>
                                <td>{r.id}</td>
                                <td>{r.date}</td>
                                <td>{r.symbol}</td>
                                <td>{r.contract}</td>
                                <td>{r.stake.toFixed(2)}</td>
                                <td><span className={`report__badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
                                <td className={r.profit >= 0 ? 'pos' : 'neg'}>{r.profit >= 0 ? '+' : ''}{r.profit.toFixed(2)}</td>
                                <td>{r.duration}t</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Report;
