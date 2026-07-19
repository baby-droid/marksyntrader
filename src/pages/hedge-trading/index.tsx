import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { applyCommission } from '@/utils/commission';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import './hedge-trading.scss';

const AccountBadge: React.FC = () => {
    const [isDemo, setIsDemo] = useState(false);
    useEffect(() => {
        const check = () => {
            const id = localStorage.getItem('active_loginid') || '';
            setIsDemo(id.startsWith('VRTC') || id.startsWith('VR'));
        };
        check();
        window.addEventListener('storage', check);
        return () => window.removeEventListener('storage', check);
    }, []);
    return (
        <span className={`hedge-acct-badge ${isDemo ? 'demo' : 'real'}`}>
            {isDemo ? '🔵 DEMO' : '🟢 REAL'}
        </span>
    );
};

function getLastDigitFromQuote(q: number): number {
    const s = q.toFixed(2).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

const MARKETS = [
    'V10','V25','V50','V75','V100',
    'V10 1s','V25 1s','V50 1s','V75 1s','V100 1s',
    'C300','C500','C1000','B300','B500','B1000',
    'Jump 10','Jump 25','Jump 50','Jump 75','Jump 100',
];

const MARKET_MAP: Record<string,string> = {
    'V10':'R_10','V25':'R_25','V50':'R_50','V75':'R_75','V100':'R_100',
    'V10 1s':'1HZ10V','V25 1s':'1HZ25V','V50 1s':'1HZ50V','V75 1s':'1HZ75V','V100 1s':'1HZ100V',
    'C300':'CRASH300N','C500':'CRASH500','C1000':'CRASH1000','B300':'BOOM300N','B500':'BOOM500','B1000':'BOOM1000',
    'Jump 10':'JD10','Jump 25':'JD25','Jump 50':'JD50','Jump 75':'JD75','Jump 100':'JD100',
};

const CONTRACT_TABS = ['Even / Odd','Rise / Fall','Only Up / Down','High / Low Tick','Over / Under','Match / Differ'];

const CONTRACT_MAP: Record<string, {a: string; b: string; aLabel: string; bLabel: string}> = {
    'Even / Odd': { a: 'DIGITEVEN', b: 'DIGITODD', aLabel: 'Even', bLabel: 'Odd' },
    'Rise / Fall': { a: 'CALL', b: 'PUT', aLabel: 'Rise', bLabel: 'Fall' },
    'Only Up / Down': { a: 'CALL', b: 'PUT', aLabel: 'Up', bLabel: 'Down' },
    'High / Low Tick': { a: 'CALL', b: 'PUT', aLabel: 'High', bLabel: 'Low' },
    'Over / Under': { a: 'DIGITOVER', b: 'DIGITUNDER', aLabel: 'Over', bLabel: 'Under' },
    'Match / Differ': { a: 'DIGITMATCH', b: 'DIGITDIFF', aLabel: 'Match', bLabel: 'Differ' },
};

const DURATIONS = ['1T','2T','3T','5T','10T'];
const STAKE_PRESETS = [0.5, 1, 2, 5];
const BARRIERS = [0,1,2,3,4,5,6,7,8,9];

interface LegState {
    contractIdx: number;
    barrier: number;
    durationIdx: number;
    stake: number;
    martingale: boolean;
    martingaleMulti: number;
}

interface TradeResult {
    id: number;
    legA: string;
    legB: string;
    stakeA: number;
    stakeB: number;
    status: 'running' | 'won-a' | 'won-b' | 'push';
    profitA: number;
    profitB: number;
    symbol: string;
    time: string;
}

function initLeg(): LegState {
    return { contractIdx: 0, barrier: 4, durationIdx: 3, stake: 1, martingale: false, martingaleMulti: 2.0 };
}

const HedgeTrading: React.FC = () => {
    const { buyContract, connected, balance, currency, subscribeTicks } = useDerivTrade();
    const [market, setMarket] = useState('V50');
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
    useEffect(() => { return subscribeCurrency(() => setDisplayCur(getDisplayCurrency())); }, []);
    const [contractTab, setContractTab] = useState(0);
    const [legA, setLegA] = useState<LegState>(initLeg());
    const [legB, setLegB] = useState<LegState>({ ...initLeg(), barrier: 5 });
    const [running, setRunning] = useState(false);
    const [autoHedge, setAutoHedge] = useState(false);
    const [results, setResults] = useState<TradeResult[]>([]);
    const [totalPnl, setPnl] = useState(0);
    const [tradeLimit, setTradeLimit] = useState(0);
    const [takeProfitVal, setTakeProfit] = useState(10);
    const [stopLossVal, setStopLoss] = useState(5);
    const [tpEnabled, setTpEnabled] = useState(true);
    const [slEnabled, setSlEnabled] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [lastDigit, setLastDigit] = useState<number | null>(null);
    const [currentPrice, setCurrentPrice] = useState<string | null>(null);
    const [digitFlash, setDigitFlash] = useState(false);
    const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const tradeCountRef = useRef(0);
    const prevDigitRef = useRef<number | null>(null);
    const pnlRef = useRef(0);  // safe ref for P/L — avoids stale closure in callbacks
    const autoHedgeRef = useRef(false);
    const executeHedgeRef = useRef<(() => void) | null>(null);
    // Refs tracking "effective" stakes — updated synchronously in finalize() for martingale,
    // bypassing React's async state updates so the next trade fires with the right stake.
    const effectiveStakeARef = useRef(legA.stake);
    const effectiveStakeBRef = useRef(legB.stake);
    useEffect(() => { effectiveStakeARef.current = legA.stake; }, [legA.stake]);
    useEffect(() => { effectiveStakeBRef.current = legB.stake; }, [legB.stake]);

    // Subscribe to live ticks for current digit display
    useEffect(() => {
        if (!connected) return;
        const sym = MARKET_MAP[market] || 'R_50';
        const unsub = subscribeTicks(sym, (tick) => {
            setLastDigit(tick.digit);
            setCurrentPrice(tick.quote.toFixed(2));
            if (tick.digit !== prevDigitRef.current) {
                prevDigitRef.current = tick.digit;
                setDigitFlash(true);
                setTimeout(() => setDigitFlash(false), 300);
            }
        });
        setLastDigit(null);
        setCurrentPrice(null);
        return unsub;
    }, [connected, market, subscribeTicks]);

    const updateLegA = (k: keyof LegState, v: any) => setLegA(p => ({ ...p, [k]: v }));
    const updateLegB = (k: keyof LegState, v: any) => setLegB(p => ({ ...p, [k]: v }));

    const contractTypes = CONTRACT_MAP[CONTRACT_TABS[contractTab]];
    const symbolKey = MARKET_MAP[market] || 'R_50';
    const is1s = market.includes('1s');
    const durTicks = [1,2,3,5,10];

    // Keep autoHedgeRef in sync so settlement callbacks can safely read it
    useEffect(() => { autoHedgeRef.current = autoHedge; }, [autoHedge]);

    const stopAll = useCallback(() => {
        setRunning(false);
        setAutoHedge(false);
        autoHedgeRef.current = false;
    }, []);

    const executeHedge = useCallback(async () => {
        if (running && !autoHedgeRef.current) { setRunning(false); return; }
        setRunning(true);
        tradeCountRef.current++;
        const id = tradeCountRef.current;

        const duration = durTicks[legA.durationIdx];
        const stakeA = effectiveStakeARef.current;
        const stakeB = effectiveStakeBRef.current;

        const entry: TradeResult = {
            id, legA: contractTypes.aLabel, legB: contractTypes.bLabel,
            stakeA, stakeB, status: 'running', profitA: 0, profitB: 0,
            symbol: market, time: new Date().toLocaleTimeString(),
        };
        setResults(p => [entry, ...p].slice(0, 30));

        const needsBarrier = ['Over / Under', 'Match / Differ'].includes(CONTRACT_TABS[contractTab]);
        const settled = { a: false, b: false, pa: 0, pb: 0 };

        const finalize = () => {
            if (!settled.a || !settled.b) return;
            const net = settled.pa + settled.pb;
            setResults(p => p.map(r => (r.id === id
                ? { ...r, status: settled.pa >= settled.pb ? 'won-a' : 'won-b', profitA: settled.pa, profitB: settled.pb }
                : r)));
            // Update P/L via ref (safe in async callbacks)
            pnlRef.current += net;
            setPnl(pnlRef.current);
            // TP/SL check — safe here since we're NOT inside a state setter
            if (tpEnabled && pnlRef.current >= takeProfitVal) { stopAll(); return; }
            if (slEnabled && pnlRef.current <= -stopLossVal)  { stopAll(); return; }
            // Apply martingale independently per leg based on each leg's own result
            // Leg A: lost → multiply; won → reset to base
            if (settled.pa < 0) {
                if (legA.martingale)
                    effectiveStakeARef.current = Math.max(0.35, +(effectiveStakeARef.current * legA.martingaleMulti).toFixed(2));
            } else {
                effectiveStakeARef.current = legA.stake;
            }
            // Leg B: lost → multiply; won → reset to base
            if (settled.pb < 0) {
                if (legB.martingale)
                    effectiveStakeBRef.current = Math.max(0.35, +(effectiveStakeBRef.current * legB.martingaleMulti).toFixed(2));
            } else {
                effectiveStakeBRef.current = legB.stake;
            }
            // Auto-hedge: re-fire immediately after settlement (not on a timer)
            if (autoHedgeRef.current) {
                executeHedgeRef.current?.();
            } else {
                setRunning(false);
            }
        };

        try {
            await Promise.all([
                buyContract(
                    {
                        symbol: symbolKey,
                        contract_type: contractTypes.a as any,
                        duration,
                        duration_unit: 't',
                        stake: stakeA,
                        barrier: needsBarrier ? legA.barrier : undefined,
                    },
                    c => { settled.a = true; settled.pa = applyCommission(c.profit); finalize(); }
                ),
                buyContract(
                    {
                        symbol: symbolKey,
                        contract_type: contractTypes.b as any,
                        duration,
                        duration_unit: 't',
                        stake: stakeB,
                        barrier: needsBarrier ? legB.barrier : undefined,
                    },
                    c => { settled.b = true; settled.pb = applyCommission(c.profit); finalize(); }
                ),
            ]);
        } catch {
            setResults(p => p.map(r => r.id === id ? { ...r, status: 'running' } : r));
            if (!autoHedgeRef.current) setRunning(false);
        }
    }, [buyContract, contractTab, contractTypes, legA, legB, market, symbolKey, running, takeProfitVal, stopLossVal, tpEnabled, slEnabled, stopAll]);

    // Keep ref updated so finalize callbacks always call the latest version
    useEffect(() => { executeHedgeRef.current = () => executeHedge(); }, [executeHedge]);

    const startAutoHedge = () => {
        if (autoHedge) { stopAll(); return; }
        pnlRef.current = totalPnl; // sync ref with current displayed P/L
        setAutoHedge(true);
        autoHedgeRef.current = true;
        // Fire immediately — next trade auto-fires inside finalize() after each settlement
        executeHedge();
    };

    return (
        <div className='hedge-pro'>
            {/* Current Digit Triangle Banner */}
            <div className='hedge-pro__digit-banner'>
                <div className={`hedge-pro__digit-tri-wrap ${digitFlash ? 'flash' : ''}`}>
                    <div className='hedge-pro__digit-tri'>▲</div>
                    <div className='hedge-pro__digit-val'>{lastDigit !== null ? lastDigit : '—'}</div>
                    <div className='hedge-pro__digit-label'>CURRENT DIGIT</div>
                </div>
                {currentPrice && (
                    <div className='hedge-pro__banner-price'>
                        <span>Live Price</span>
                        <strong>{currentPrice}</strong>
                    </div>
                )}
            </div>

            {/* Connection bar */}
            <div className='hedge-pro__topbar'>
                <div className='hedge-pro__market-row'>
                    {MARKETS.map(m => (
                        <button key={m} className={`hedge-pro__market-btn ${market === m ? 'active' : ''}`} onClick={() => setMarket(m)}>{m}</button>
                    ))}
                </div>
                <div className='hedge-pro__topbar-right'>
                    <AccountBadge />
                    <span className={`hedge-pro__conn ${connected ? 'on' : 'off'}`}>{connected ? '● LIVE' : '○ Offline'}</span>
                    {balance !== null && <span className='hedge-pro__balance'>{currency} {balance.toFixed(2)}</span>}
                    <button className='hedge-pro__multiscan-btn'>⊞ Multi Scan</button>
                </div>
            </div>

            {/* Contract type tabs */}
            <div className='hedge-pro__contract-tabs'>
                {CONTRACT_TABS.map((t, i) => (
                    <button key={t} className={`hedge-pro__contract-tab ${contractTab === i ? 'active' : ''}`} onClick={() => setContractTab(i)}>
                        {t}
                    </button>
                ))}
            </div>

            {/* Legs */}
            <div className='hedge-pro__legs'>
                <LegPanel
                    label='A' color='#f59e0b'
                    leg={legA} update={updateLegA}
                    contractTypes={contractTypes}
                    contractTab={CONTRACT_TABS[contractTab]}
                    durations={DURATIONS}
                    stakePresets={STAKE_PRESETS}
                    barriers={BARRIERS}
                />
                <div className='hedge-pro__vs'>VS</div>
                <LegPanel
                    label='B' color='#ec4899'
                    leg={legB} update={updateLegB}
                    contractTypes={contractTypes}
                    contractTab={CONTRACT_TABS[contractTab]}
                    durations={DURATIONS}
                    stakePresets={STAKE_PRESETS}
                    barriers={BARRIERS}
                />
            </div>

            {/* Settings */}
            <div className='hedge-pro__settings-bar'>
                <button className='hedge-pro__settings-toggle' onClick={() => setShowSettings(s => !s)}>
                    ⚙ Settings (TP / SL / Limit)
                </button>
            </div>

            {showSettings && (
                <div className='hedge-pro__settings-panel'>
                    <div className='hedge-pro__settings-field'>
                        <label>TRADE LIMIT</label>
                        <div className='hedge-pro__pill-row'>
                            {[0,10,20,50].map(v => <button key={v} className={`hedge-pro__pill ${tradeLimit === v ? 'active' : ''}`} onClick={() => setTradeLimit(v)}>{v === 0 ? '∞' : v}</button>)}
                        </div>
                    </div>
                    <div className='hedge-pro__settings-field hedge-pro__settings-field--tp'>
                        <label><span className='hedge-pro__toggle-switch on' onClick={() => setTpEnabled(p=>!p)}><div className='hedge-pro__toggle-knob' /></span> Take Profit</label>
                        <div className='hedge-pro__settings-input-row'>
                            <input type='number' value={takeProfitVal} onChange={e => setTakeProfit(+e.target.value)} />
                            <span>USD</span>
                        </div>
                    </div>
                    <div className='hedge-pro__settings-field hedge-pro__settings-field--sl'>
                        <label><span className={`hedge-pro__toggle-switch ${slEnabled ? 'on' : 'off'}`} onClick={() => setSlEnabled(p=>!p)}><div className='hedge-pro__toggle-knob' /></span> Stop Loss</label>
                        <div className='hedge-pro__settings-input-row'>
                            <input type='number' value={stopLossVal} onChange={e => setStopLoss(+e.target.value)} />
                            <span>USD</span>
                        </div>
                    </div>
                </div>
            )}

            {/* PnL */}
            {totalPnl !== 0 && (
                <div className={`hedge-pro__pnl ${totalPnl >= 0 ? 'pos' : 'neg'}`}>
                    P&L: {totalPnl >= 0 ? '+' : ''}{fromUsd(totalPnl).toFixed(2)} {displayCur}
                </div>
            )}

            {/* Execute buttons */}
            <div className='hedge-pro__execute-row'>
                <button className={`hedge-pro__execute-btn ${running && !autoHedge ? 'running' : ''}`} onClick={running && !autoHedge ? stopAll : executeHedge}>
                    {running && !autoHedge ? '⏳ Running…' : `▶ Execute Hedge · ${CONTRACT_TABS[contractTab]}`}
                </button>
                <button className={`hedge-pro__auto-btn ${autoHedge ? 'active' : ''}`} onClick={startAutoHedge}>
                    ⟳ Auto Hedge {autoHedge ? '(ON)' : ''}
                </button>
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div className='hedge-pro__results'>
                    <div className='hedge-pro__results-header'><span>History</span><button onClick={() => setResults([])}>Clear</button></div>
                    {results.map(r => (
                        <div key={r.id} className={`hedge-pro__result-row hedge-pro__result-row--${r.status}`}>
                            <span className='hedge-pro__result-time'>{r.time}</span>
                            <span className='hedge-pro__result-symbol'>{r.symbol}</span>
                            <span>{r.legA} vs {r.legB}</span>
                            {r.status === 'running' ? <span className='hedge-pro__result-running'>⟳</span> : (
                                <>
                                    <span className={r.profitA >= 0 ? 'pos' : 'neg'}>{r.legA}: {r.profitA >= 0 ? '+' : ''}{fromUsd(r.profitA).toFixed(2)} {displayCur}</span>
                                    <span className={r.profitB >= 0 ? 'pos' : 'neg'}>{r.legB}: {r.profitB >= 0 ? '+' : ''}{fromUsd(r.profitB).toFixed(2)} {displayCur}</span>
                                    <span className={(r.profitA + r.profitB) >= 0 ? 'pos' : 'neg'}>Net: {(r.profitA + r.profitB) >= 0 ? '+' : ''}{fromUsd(r.profitA + r.profitB).toFixed(2)} {displayCur}</span>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface LegPanelProps {
    label: string;
    color: string;
    leg: LegState;
    update: (k: keyof LegState, v: any) => void;
    contractTypes: { a: string; b: string; aLabel: string; bLabel: string };
    contractTab: string;
    durations: string[];
    stakePresets: number[];
    barriers: number[];
}

const LegPanel: React.FC<LegPanelProps> = ({ label, color, leg, update, contractTypes, contractTab, durations, stakePresets, barriers }) => {
    const showBarrier = contractTab === 'Over / Under' || contractTab === 'Match / Differ';
    const isA = label === 'A';
    const choiceA = isA ? 0 : 1;
    const choiceB = isA ? 1 : 0;
    const [selected, setSelected] = useState(0);

    return (
        <div className='hedge-pro__leg' style={{ borderColor: color }}>
            <div className='hedge-pro__leg-header'>
                <span className='hedge-pro__leg-dot' style={{ background: color }} />
                <span className='hedge-pro__leg-label'>LEG {label}</span>
            </div>

            <div className='hedge-pro__leg-section-label'>CONTRACT TYPE</div>
            <div className='hedge-pro__leg-row'>
                {[contractTypes.aLabel, contractTypes.bLabel].map((c, i) => (
                    <button key={c} className={`hedge-pro__contract-choice ${selected === i ? 'active' : ''}`}
                        style={selected === i ? { background: color, borderColor: color, color: '#000' } : {}}
                        onClick={() => { setSelected(i); update('contractIdx', i); }}>
                        {c}
                    </button>
                ))}
            </div>

            {showBarrier && (
                <>
                    <div className='hedge-pro__leg-section-label'>BARRIER · {leg.barrier}</div>
                    <div className='hedge-pro__leg-row hedge-pro__leg-row--wrap'>
                        {barriers.map(b => (
                            <button key={b} className={`hedge-pro__barrier-btn ${leg.barrier === b ? 'active' : ''}`}
                                style={leg.barrier === b ? { background: color, borderColor: color, color: '#000' } : {}}
                                onClick={() => update('barrier', b)}>
                                {b}
                            </button>
                        ))}
                    </div>
                </>
            )}

            <div className='hedge-pro__leg-section-label'>DURATION · {durations[leg.durationIdx]}</div>
            <div className='hedge-pro__leg-row'>
                {durations.map((d, i) => (
                    <button key={d} className={`hedge-pro__dur-btn ${leg.durationIdx === i ? 'active' : ''}`}
                        style={leg.durationIdx === i ? { background: color, borderColor: color, color: '#000' } : {}}
                        onClick={() => update('durationIdx', i)}>
                        {d}
                    </button>
                ))}
            </div>

            <div className='hedge-pro__leg-section-label'>STAKE · ${leg.stake.toFixed(2)}</div>
            <div className='hedge-pro__leg-row'>
                {stakePresets.map(s => (
                    <button key={s} className={`hedge-pro__stake-btn ${leg.stake === s ? 'active' : ''}`}
                        style={leg.stake === s ? { background: color, borderColor: color, color: '#000' } : {}}
                        onClick={() => update('stake', s)}>
                        ${s}
                    </button>
                ))}
                <input type='number' min='0.35' step='0.01' value={leg.stake}
                    onChange={e => update('stake', parseFloat(e.target.value) || 0.35)}
                    className='hedge-pro__stake-input' />
            </div>

            <div className='hedge-pro__martingale-row'>
                <div className={`hedge-pro__toggle-switch ${leg.martingale ? 'on' : 'off'}`} onClick={() => update('martingale', !leg.martingale)}>
                    <div className='hedge-pro__toggle-knob' />
                </div>
                <span className='hedge-pro__martingale-label'>Martingale {leg.martingale ? 'ON' : 'OFF'}</span>
                {leg.martingale && (
                    <>
                        <input type='range' min={1.1} max={4} step={0.1} value={leg.martingaleMulti}
                            onChange={e => update('martingaleMulti', +e.target.value)}
                            className='hedge-pro__martingale-slider' style={{ '--slider-color': color } as any} />
                        <span className='hedge-pro__martingale-val' style={{ color }}>{leg.martingaleMulti.toFixed(1)}x</span>
                    </>
                )}
            </div>
        </div>
    );
};

export default HedgeTrading;
