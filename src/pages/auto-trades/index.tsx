// @ts-nocheck
import React, { useState, useRef, useCallback } from 'react';
import { api_base } from '@/external/bot-skeleton';
import './auto-trades.scss';

const CONTRACT_MAP: Record<string, string> = {
    Rise: 'CALL', Fall: 'PUT',
    Even: 'DIGITEVEN', Odd: 'DIGITODD',
    Matches: 'DIGITMATCH', Differs: 'DIGITDIFF',
    Over1: 'DIGITOVER', Under8: 'DIGITUNDER',
};

const SYMBOL_LABELS: Record<string, string> = {
    R_100: 'V100 (ticks)',
    R_75:  'V75 (ticks)',
    R_50:  'V50 (ticks)',
    '1HZ100V': 'V100 1s',
    '1HZ75V':  'V75 1s',
    '1HZ50V':  'V50 1s',
    '1HZ25V':  'V25 1s',
    '1HZ10V':  'V10 1s',
};

interface Schedule {
    id: string;
    name: string;
    symbol: string;
    contract: string;
    stake: string;
    barrier: string;
    martingale: string;
    takeProfit: string;
    stopLoss: string;
    enabled: boolean;
    wins: number;
    losses: number;
    profit: number;
    lastRun: string;
}

const newSchedule = (): Schedule => ({
    id: Date.now().toString() + Math.random(),
    name: 'Bot ' + Math.floor(Math.random() * 900 + 100),
    symbol: '1HZ25V',
    contract: 'Over1',
    stake: '0.50',
    barrier: '2',
    martingale: '2.2',
    takeProfit: '3',
    stopLoss: '10',
    enabled: true,
    wins: 0,
    losses: 0,
    profit: 0,
    lastRun: '--',
});

function fmtProfit(v: number) {
    return (v >= 0 ? '+' : '') + v.toFixed(2);
}

const AutoTrades: React.FC = () => {
    const [schedules, setSchedules] = useState<Schedule[]>([newSchedule()]);
    const [running, setRunning] = useState<Record<string, boolean>>({});
    const [logs, setLogs] = useState<Record<string, string[]>>({});
    const stopRefs = useRef<Record<string, boolean>>({});

    const addLog = useCallback((id: string, msg: string) => {
        const ts = new Date().toLocaleTimeString('en', { hour12: false });
        setLogs(prev => ({ ...prev, [id]: [`[${ts}] ${msg}`, ...(prev[id] || [])].slice(0, 40) }));
    }, []);

    const send = useCallback((msg: object): Promise<any> => {
        if (!api_base.api) return Promise.reject(new Error('Not connected'));
        return (api_base.api.send as unknown as (d: unknown) => Promise<any>)(msg);
    }, []);

    const runBot = useCallback(async (sched: Schedule) => {
        const id = sched.id;
        if (running[id]) return;
        stopRefs.current[id] = false;
        setRunning(prev => ({ ...prev, [id]: true }));
        addLog(id, `🚀 Starting ${sched.contract} on ${SYMBOL_LABELS[sched.symbol] || sched.symbol}`);

        const contractType = CONTRACT_MAP[sched.contract] || 'CALL';
        const needsBarrier = ['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF'].includes(contractType);
        let stake = parseFloat(sched.stake) || 0.5;
        const martingale = parseFloat(sched.martingale) || 2.2;
        const takeProfit = parseFloat(sched.takeProfit) || 3;
        const stopLoss = parseFloat(sched.stopLoss) || 10;
        let sessionProfit = 0;
        const barrier = parseInt(sched.barrier, 10);

        const buyParams: any = {
            buy: '1',
            price: stake,
            parameters: {
                amount: stake,
                basis: 'stake',
                contract_type: contractType,
                currency: 'USD',
                duration: 1,
                duration_unit: 't',
                symbol: sched.symbol,
            },
        };
        if (needsBarrier && !isNaN(barrier)) {
            buyParams.parameters.barrier = String(barrier);
        }

        while (!stopRefs.current[id]) {
            try {
                buyParams.price = stake;
                buyParams.parameters.amount = stake;
                const res = await send(buyParams);
                const contract_id = res?.buy?.contract_id;
                if (!contract_id) {
                    const errMsg = res?.error?.message || 'Buy failed';
                    addLog(id, `⚠️ ${errMsg}`);
                    await new Promise(r => setTimeout(r, 500));
                    continue;
                }

                // Subscribe to contract settlement
                const profit = await new Promise<number>(resolve => {
                    const bail = setTimeout(() => resolve(0), 15000);
                    const sub = (api_base.api as any)?.onMessage?.()?.subscribe(({ data: d }: any) => {
                        if (!d?.proposal_open_contract) return;
                        const poc = d.proposal_open_contract;
                        if (Number(poc.contract_id) !== Number(contract_id)) return;
                        if (poc.is_sold || poc.status === 'won' || poc.status === 'lost') {
                            clearTimeout(bail);
                            sub?.unsubscribe?.();
                            resolve(parseFloat(poc.profit ?? '0'));
                        }
                    });
                    send({ proposal_open_contract: 1, contract_id, subscribe: 1 }).catch(() => { clearTimeout(bail); sub?.unsubscribe?.(); resolve(0); });
                });

                sessionProfit += profit;
                const won = profit > 0;
                addLog(id, `${won ? '✅' : '❌'} ${won ? 'WIN' : 'LOSS'} ${fmtProfit(profit)} | Session: ${fmtProfit(sessionProfit)}`);

                setSchedules(prev => prev.map(s => s.id === id ? {
                    ...s,
                    wins: s.wins + (won ? 1 : 0),
                    losses: s.losses + (won ? 0 : 1),
                    profit: +(s.profit + profit).toFixed(2),
                    lastRun: new Date().toLocaleTimeString(),
                } : s));

                if (sessionProfit >= takeProfit) {
                    addLog(id, `🎯 Take profit reached: ${fmtProfit(sessionProfit)} ≥ ${takeProfit}`);
                    break;
                }
                if (sessionProfit <= -stopLoss) {
                    addLog(id, `🛑 Stop loss reached: ${fmtProfit(sessionProfit)}`);
                    break;
                }

                stake = won ? parseFloat(sched.stake) || 0.5 : Math.max(0.35, +(stake * martingale).toFixed(2));
            } catch (err: any) {
                const msg = err?.error?.message || err?.message || 'Error';
                addLog(id, `⚠️ ${msg}`);
                await new Promise(r => setTimeout(r, 800));
            }
        }

        stopRefs.current[id] = false;
        setRunning(prev => ({ ...prev, [id]: false }));
        addLog(id, `⏹ Bot stopped. Session P/L: ${fmtProfit(sessionProfit)}`);
    }, [running, send, addLog]);

    const stopBot = useCallback((id: string) => {
        stopRefs.current[id] = true;
        addLog(id, '⏸ Stop requested...');
    }, [addLog]);

    const update = (id: string, field: keyof Schedule, value: any) =>
        setSchedules(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));

    return (
        <div className='autotrades'>
            <div className='autotrades__header'>
                <div>
                    <h2 className='autotrades__title'>🕐 AutoTrades</h2>
                    <p className='autotrades__sub'>Run independent bots with martingale, TP & SL</p>
                </div>
                <button className='autotrades__add-btn' onClick={() => setSchedules(p => [...p, newSchedule()])}>+ Add Bot</button>
            </div>

            <div className='autotrades__list'>
                {schedules.map(s => {
                    const isRunning = !!running[s.id];
                    const botLogs = logs[s.id] || [];
                    return (
                        <div key={s.id} className={`autotrades__card ${s.enabled ? 'enabled' : 'disabled'}`}>
                            <div className='autotrades__card-top'>
                                <div className='autotrades__card-name'>
                                    <div className={`autotrades__toggle ${s.enabled ? 'on' : 'off'}`} onClick={() => !isRunning && update(s.id, 'enabled', !s.enabled)}>
                                        <div className='autotrades__toggle-knob' />
                                    </div>
                                    <span>{s.name}</span>
                                    {isRunning && <span className='autotrades__live-badge'>● LIVE</span>}
                                </div>
                                <div className='autotrades__card-stats'>
                                    <span className='autotrades__wins'>✓ {s.wins}</span>
                                    <span className='autotrades__losses'>✗ {s.losses}</span>
                                    <span className={`autotrades__profit ${s.profit >= 0 ? 'pos' : 'neg'}`}>{fmtProfit(s.profit)}</span>
                                </div>
                                <div className='autotrades__card-actions'>
                                    {!isRunning ? (
                                        <button className='autotrades__run-btn' onClick={() => runBot(s)} disabled={!s.enabled}>▶ Run</button>
                                    ) : (
                                        <button className='autotrades__stop-btn' onClick={() => stopBot(s.id)}>⏹ Stop</button>
                                    )}
                                    <button className='autotrades__del-btn' onClick={() => { stopRefs.current[s.id] = true; setSchedules(p => p.filter(x => x.id !== s.id)); }}>✕</button>
                                </div>
                            </div>
                            <div className='autotrades__card-fields'>
                                <div className='autotrades__field'><label>Market</label>
                                    <select disabled={isRunning} value={s.symbol} onChange={e => update(s.id, 'symbol', e.target.value)}>
                                        {Object.entries(SYMBOL_LABELS).map(([sym, lbl]) => <option key={sym} value={sym}>{lbl}</option>)}
                                    </select>
                                </div>
                                <div className='autotrades__field'><label>Contract</label>
                                    <select disabled={isRunning} value={s.contract} onChange={e => update(s.id, 'contract', e.target.value)}>
                                        {Object.keys(CONTRACT_MAP).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className='autotrades__field'><label>Barrier</label>
                                    <input type='number' min='0' max='9' step='1' disabled={isRunning} value={s.barrier} onChange={e => update(s.id, 'barrier', e.target.value)} />
                                </div>
                                <div className='autotrades__field'><label>Stake $</label>
                                    <input type='number' min='0.35' step='0.01' disabled={isRunning} value={s.stake} onChange={e => update(s.id, 'stake', e.target.value)} />
                                </div>
                                <div className='autotrades__field'><label>Martingale</label>
                                    <input type='number' min='1' max='5' step='0.1' disabled={isRunning} value={s.martingale} onChange={e => update(s.id, 'martingale', e.target.value)} />
                                </div>
                                <div className='autotrades__field'><label>TP $</label>
                                    <input type='number' min='0.1' step='0.5' disabled={isRunning} value={s.takeProfit} onChange={e => update(s.id, 'takeProfit', e.target.value)} />
                                </div>
                                <div className='autotrades__field'><label>SL $</label>
                                    <input type='number' min='0.1' step='0.5' disabled={isRunning} value={s.stopLoss} onChange={e => update(s.id, 'stopLoss', e.target.value)} />
                                </div>
                            </div>
                            {botLogs.length > 0 && (
                                <div className='autotrades__log'>
                                    {botLogs.map((line, i) => <div key={i} className='autotrades__log-line'>{line}</div>)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AutoTrades;
