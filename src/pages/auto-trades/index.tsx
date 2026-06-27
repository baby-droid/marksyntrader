import React, { useState } from 'react';
import './auto-trades.scss';

interface Schedule {
    id: string;
    name: string;
    symbol: string;
    contract: string;
    stake: string;
    time: string;
    enabled: boolean;
    lastRun: string;
    wins: number;
    losses: number;
}

const newSchedule = (): Schedule => ({
    id: Date.now().toString(),
    name: 'Schedule ' + Math.floor(Math.random() * 900 + 100),
    symbol: 'R_100',
    contract: 'Rise',
    stake: '1.00',
    time: '09:00',
    enabled: true,
    lastRun: '--',
    wins: 0,
    losses: 0,
});

const AutoTrades: React.FC = () => {
    const [schedules, setSchedules] = useState<Schedule[]>([newSchedule()]);
    const [running, setRunning] = useState<string[]>([]);

    const add = () => setSchedules(p => [...p, newSchedule()]);
    const toggle = (id: string, field: 'enabled', value: boolean) => {
        setSchedules(p => p.map(s => s.id === id ? { ...s, [field]: value } : s));
    };
    const remove = (id: string) => setSchedules(p => p.filter(s => s.id !== id));

    const execute = (id: string) => {
        if (running.includes(id)) return;
        setRunning(p => [...p, id]);
        setTimeout(() => {
            const won = Math.random() > 0.45;
            setSchedules(p => p.map(s => s.id === id ? {
                ...s,
                wins: s.wins + (won ? 1 : 0),
                losses: s.losses + (won ? 0 : 1),
                lastRun: new Date().toLocaleTimeString(),
            } : s));
            setRunning(p => p.filter(x => x !== id));
        }, 1500 + Math.random() * 1000);
    };

    return (
        <div className='autotrades'>
            <div className='autotrades__header'>
                <div>
                    <h2 className='autotrades__title'>🕐 AutoTrades</h2>
                    <p className='autotrades__sub'>Schedule automated trades on a timetable</p>
                </div>
                <button className='autotrades__add-btn' onClick={add}>+ Add Schedule</button>
            </div>

            <div className='autotrades__list'>
                {schedules.map(s => (
                    <div key={s.id} className={`autotrades__card ${s.enabled ? 'enabled' : 'disabled'}`}>
                        <div className='autotrades__card-top'>
                            <div className='autotrades__card-name'>
                                <div className={`autotrades__toggle ${s.enabled ? 'on' : 'off'}`} onClick={() => toggle(s.id, 'enabled', !s.enabled)}>
                                    <div className='autotrades__toggle-knob' />
                                </div>
                                <span>{s.name}</span>
                            </div>
                            <div className='autotrades__card-stats'>
                                <span className='autotrades__wins'>✓ {s.wins}</span>
                                <span className='autotrades__losses'>✗ {s.losses}</span>
                                <span className='autotrades__last'>Last: {s.lastRun}</span>
                            </div>
                            <div className='autotrades__card-actions'>
                                <button className={`autotrades__run-btn ${running.includes(s.id) ? 'running' : ''}`} onClick={() => execute(s.id)} disabled={running.includes(s.id)}>
                                    {running.includes(s.id) ? '⏳' : '▶ Run Now'}
                                </button>
                                <button className='autotrades__del-btn' onClick={() => remove(s.id)}>✕</button>
                            </div>
                        </div>
                        <div className='autotrades__card-fields'>
                            <div className='autotrades__field'><label>Symbol</label>
                                <select value={s.symbol} onChange={e => setSchedules(p => p.map(x => x.id === s.id ? { ...x, symbol: e.target.value } : x))}>
                                    {['R_100','R_75','R_50','1HZ100V','1HZ10V'].map(sym => <option key={sym} value={sym}>{sym}</option>)}
                                </select>
                            </div>
                            <div className='autotrades__field'><label>Contract</label>
                                <select value={s.contract} onChange={e => setSchedules(p => p.map(x => x.id === s.id ? { ...x, contract: e.target.value } : x))}>
                                    {['Rise','Fall','Even','Odd','Matches','Differs'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className='autotrades__field'><label>Stake</label>
                                <input type='number' min='0.35' step='0.01' value={s.stake} onChange={e => setSchedules(p => p.map(x => x.id === s.id ? { ...x, stake: e.target.value } : x))} />
                            </div>
                            <div className='autotrades__field'><label>Time</label>
                                <input type='time' value={s.time} onChange={e => setSchedules(p => p.map(x => x.id === s.id ? { ...x, time: e.target.value } : x))} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AutoTrades;
