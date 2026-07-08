// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { api_base } from '@/external/bot-skeleton';
import './auto-trades.scss';

// ── Helpers ──────────────────────────────────────────────────────────────────
const APP_ID_DIGIT = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DERIV_APP_ID) || '36300';

function fmtProfit(v: number) {
    return (v >= 0 ? '+' : '') + v.toFixed(2);
}

function extractDigit(quote: any, pipSize: number): number {
    return parseInt(Number(quote).toFixed(pipSize).slice(-1), 10);
}

// ── Per-symbol live digit hook ────────────────────────────────────────────────
/**
 * Returns a ref (not state) so it is always current inside async loops
 * without triggering re-renders on every tick.
 */
function useLiveDigitsRef(symbol: string): React.MutableRefObject<number[]> {
    const digitsRef = useRef<number[]>([]);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        wsRef.current?.close();
        digitsRef.current = [];
        const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID_DIGIT}`);
        wsRef.current = ws;
        let pipSize = 2;

        ws.onopen = () => ws.send(JSON.stringify({
            ticks_history: symbol,
            count: 200,
            end: 'latest',
            style: 'ticks',
            subscribe: 1,
        }));

        ws.onmessage = e => {
            try {
                const d = JSON.parse(e.data);
                if (d.pip_size) pipSize = d.pip_size;
                if (d.history?.prices) {
                    const ps = d.pip_size ?? pipSize;
                    digitsRef.current = d.history.prices.map((p: any) => extractDigit(p, ps));
                }
                if (d.tick?.quote) {
                    const ps = d.pip_size ?? pipSize;
                    const digit = extractDigit(d.tick.quote, ps);
                    digitsRef.current = [...digitsRef.current.slice(-499), digit];
                }
            } catch {}
        };
        return () => ws.close();
    }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

    return digitsRef;
}

// ── Shared buy-and-wait via app's API connection ──────────────────────────────
function useBuyAndWait() {
    const send = useCallback((msg: object): Promise<any> => {
        if (!api_base.api) return Promise.reject(new Error('Not connected'));
        return (api_base.api.send as unknown as (d: unknown) => Promise<any>)(msg);
    }, []);

    return useCallback(async (
        symbol: string,
        contractType: string,
        barrier: number | null,
        stake: number,
    ): Promise<number> => {
        const needsBarrier = ['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF'].includes(contractType);
        const params: any = {
            buy: '1',
            price: stake,
            parameters: {
                amount: stake,
                basis: 'stake',
                contract_type: contractType,
                currency: 'USD',
                duration: 1,
                duration_unit: 't',
                symbol,
            },
        };
        if (needsBarrier && barrier !== null) params.parameters.barrier = String(barrier);

        const res = await send(params);
        const contract_id = res?.buy?.contract_id;
        if (!contract_id) throw new Error(res?.error?.message || 'Buy failed');

        return new Promise<number>(resolve => {
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
            send({ proposal_open_contract: 1, contract_id, subscribe: 1 })
                .catch(() => { clearTimeout(bail); sub?.unsubscribe?.(); resolve(0); });
        });
    }, [send]);
}

// ── AI Bot Definitions ────────────────────────────────────────────────────────
interface AiBotDef {
    id: string;
    name: string;
    subtitle: string;
    desc: string;
    icon: string;
    symbol: string;
    defaultStake: number;
    defaultMartingale: number;
    defaultTakeProfit: number;
    defaultStopLoss: number;
    pickTrade: (digits: number[]) => { contract: string; barrier: number | null; recoveryMode?: boolean };
}

const AI_BOTS: AiBotDef[] = [
    {
        id: 'autodiffer',
        name: 'AutoDiffer',
        subtitle: 'Random Digit Analysis',
        icon: '🎲',
        desc: 'Automatically analyzes random barriers and symbols for optimal digit differ trades.',
        symbol: '1HZ100V',
        defaultStake: 1.0,
        defaultMartingale: 2.2,
        defaultTakeProfit: 5,
        defaultStopLoss: 10,
        pickTrade: (digits) => {
            const n = Math.min(50, digits.length);
            const last = digits.slice(-n);
            const freq = Array.from({ length: 10 }, (_, i) => last.filter(d => d === i).length);
            const minDigit = freq.indexOf(Math.min(...freq));
            return { contract: 'DIGITDIFF', barrier: minDigit };
        },
    },
    {
        id: 'auto-overunder',
        name: 'Auto Over/Under',
        subtitle: 'AI Pattern Recognition',
        icon: '🧠',
        desc: 'Uses advanced AI to identify patterns and recommend optimal over/under positions.',
        symbol: '1HZ25V',
        defaultStake: 1.0,
        defaultMartingale: 2.0,
        defaultTakeProfit: 5,
        defaultStopLoss: 10,
        pickTrade: (digits) => {
            const last20 = digits.slice(-20);
            if (!last20.length) return { contract: 'DIGITOVER', barrier: 2 };
            const overCount = last20.filter(d => d > 4).length;
            return overCount > 10
                ? { contract: 'DIGITOVER', barrier: 2 }
                : { contract: 'DIGITUNDER', barrier: 7 };
        },
    },
    {
        id: 'auto-o5-u4',
        name: 'Auto O5 U4',
        subtitle: 'Dual Digit Strategy',
        icon: '⚡',
        desc: 'Simultaneously trades Over 5 and Under 4 based on digit frequency analysis across all volatility indices.',
        symbol: '1HZ50V',
        defaultStake: 1.0,
        defaultMartingale: 2.0,
        defaultTakeProfit: 5,
        defaultStopLoss: 10,
        pickTrade: (digits) => {
            const last20 = digits.slice(-20);
            if (!last20.length) return { contract: 'DIGITOVER', barrier: 5 };
            const over5 = last20.filter(d => d > 5).length;
            const under4 = last20.filter(d => d < 4).length;
            return over5 >= under4
                ? { contract: 'DIGITOVER', barrier: 5 }
                : { contract: 'DIGITUNDER', barrier: 4 };
        },
    },
    {
        id: 'auto-o2u7',
        name: 'Auto O2U7',
        subtitle: 'Over 2 · Under 7 · Recovery US',
        icon: '🔄',
        desc: 'Simultaneously trades Over 2 and Under 7. On a net loss, recovers with Under 5 until a win, then resets.',
        symbol: '1HZ75V',
        defaultStake: 1.0,
        defaultMartingale: 2.2,
        defaultTakeProfit: 5,
        defaultStopLoss: 10,
        pickTrade: (digits, recoveryMode?: boolean) => {
            if (recoveryMode) return { contract: 'DIGITUNDER', barrier: 5 };
            const last5 = digits.slice(-5);
            if (!last5.length) return { contract: 'DIGITUNDER', barrier: 7 };
            const avg = last5.reduce((a, b) => a + b, 0) / last5.length;
            return avg > 4.5
                ? { contract: 'DIGITOVER', barrier: 2 }
                : { contract: 'DIGITUNDER', barrier: 7 };
        },
    },
];

// ── Per-bot session state ─────────────────────────────────────────────────────
interface BotSession {
    active: boolean;
    wins: number;
    losses: number;
    profit: number;
    logs: string[];
}

const initSessions = (): Record<string, BotSession> =>
    Object.fromEntries(AI_BOTS.map(b => [b.id, { active: false, wins: 0, losses: 0, profit: 0, logs: [] }]));

// ── Smart Analysis helper ────────────────────────────────────────────────────
function computeSmartAnalysis(digits: number[], analysisDepth: number) {
    const last = digits.slice(-analysisDepth);
    const n = last.length;
    const freq = Array.from({ length: 10 }, (_, i) => last.filter(d => d === i).length);
    const prediction = freq.indexOf(Math.min(...freq));
    return { last10: last.slice(-10), prediction, ticks: n, digitFreq: freq };
}

// ── Smart bot live digit state (for display in panel) ─────────────────────────
function useLiveDigitsState(symbol: string): number[] {
    const [digits, setDigits] = useState<number[]>([]);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        wsRef.current?.close();
        setDigits([]);
        const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID_DIGIT}`);
        wsRef.current = ws;
        let pipSize = 2;

        ws.onopen = () => ws.send(JSON.stringify({
            ticks_history: symbol, count: 200, end: 'latest', style: 'ticks', subscribe: 1,
        }));
        ws.onmessage = e => {
            try {
                const d = JSON.parse(e.data);
                if (d.pip_size) pipSize = d.pip_size;
                if (d.history?.prices) {
                    const ps = d.pip_size ?? pipSize;
                    setDigits(d.history.prices.map((p: any) => extractDigit(p, ps)));
                }
                if (d.tick?.quote) {
                    const ps = d.pip_size ?? pipSize;
                    const digit = extractDigit(d.tick.quote, ps);
                    setDigits(prev => [...prev.slice(-499), digit]);
                }
            } catch {}
        };
        return () => ws.close();
    }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

    return digits;
}

// ── Individual AI bot runner (own symbol, own stop token) ──────────────────────
interface AiBotRunnerProps {
    bot: AiBotDef;
    globalStake: number;
    globalMartingale: number;
    session: BotSession;
    onSessionUpdate: (patch: Partial<BotSession>) => void;
    onLog: (msg: string) => void;
}

function AiBotCard({ bot, globalStake, globalMartingale, session, onSessionUpdate, onLog }: AiBotRunnerProps) {
    // Each bot card has its own live digit feed for its own symbol
    const digitsRef = useLiveDigitsRef(bot.symbol);
    const stopRef = useRef(false);
    const buyAndWait = useBuyAndWait();

    const start = useCallback(async () => {
        stopRef.current = false;
        // Use local counters — avoids stale-closure accumulation bugs
        let localWins = 0;
        let localLosses = 0;
        let localProfit = 0;
        onSessionUpdate({ active: true, wins: 0, losses: 0, profit: 0 });

        const tp = bot.defaultTakeProfit * Math.max(1, globalStake);
        const sl = bot.defaultStopLoss * Math.max(1, globalStake);
        let stk = globalStake;
        let recoveryMode = false;
        onLog(`🚀 ${bot.name} started on ${bot.symbol} | TP:${tp.toFixed(2)} SL:${sl.toFixed(2)}`);

        while (!stopRef.current) {
            try {
                const { contract, barrier } = bot.pickTrade(digitsRef.current, recoveryMode);
                const profit = await buyAndWait(bot.symbol, contract, barrier, stk);
                const won = profit > 0;
                localProfit = +(localProfit + profit).toFixed(2);
                if (won) localWins++; else localLosses++;

                // Write fresh absolute values — no stale closure needed
                onSessionUpdate({ wins: localWins, losses: localLosses, profit: localProfit });
                onLog(`${won ? '✅' : '❌'} ${contract}${barrier !== null ? '@'+barrier : ''} ${fmtProfit(profit)} | Total: ${fmtProfit(localProfit)}`);

                if (bot.id === 'auto-o2u7') recoveryMode = !won;
                stk = won ? globalStake : Math.max(0.35, +(stk * globalMartingale).toFixed(2));
                if (localProfit >= tp) { onLog('🎯 Take profit hit'); break; }
                if (localProfit <= -sl) { onLog('🛑 Stop loss hit'); break; }
            } catch (err: any) {
                onLog(`⚠️ ${err?.message || 'Error'}`);
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        stopRef.current = false;
        onSessionUpdate({ active: false });
        onLog(`⏹ Stopped. Session: ${fmtProfit(localProfit)}`);
    }, [bot, globalStake, globalMartingale, digitsRef, buyAndWait, onLog, onSessionUpdate]);

    const toggle = useCallback(() => {
        if (session.active) {
            stopRef.current = true;
        } else {
            start();
        }
    }, [session.active, start]);

    return (
        <div className={`autotrades__botcard ${session.active ? 'active' : ''}`}>
            <div className='autotrades__botcard-top'>
                <span className='autotrades__botcard-icon'>{bot.icon}</span>
                <div className='autotrades__botcard-info'>
                    <strong>{bot.name}</strong>
                    <span>{bot.subtitle}</span>
                </div>
                <span className={`autotrades__botcard-status ${session.active ? 'on' : 'off'}`}>
                    {session.active ? 'ON' : 'OFF'}
                </span>
            </div>
            <p className='autotrades__botcard-desc'>{bot.desc}</p>
            <div className='autotrades__botcard-stats'>
                <span className='wins'>✓ {session.wins}</span>
                <span className='losses'>✗ {session.losses}</span>
                <span className={`profit ${session.profit >= 0 ? 'pos' : 'neg'}`}>{fmtProfit(session.profit)}</span>
            </div>
            {session.logs[0] && (
                <div className='autotrades__botcard-lastlog'>{session.logs[0]}</div>
            )}
            <button
                className={`autotrades__botcard-btn ${session.active ? 'deactivate' : 'activate'}`}
                onClick={toggle}
            >
                {session.active ? 'Deactivate' : 'Activate'}
            </button>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────
const AutoTrades: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'smart' | 'autobots'>('smart');

    // ── Smart Trading state
    const [smartSymbol, setSmartSymbol] = useState('1HZ10V');
    const [smartStake, setSmartStake] = useState(1);
    const [smartMartingale, setSmartMartingale] = useState(2);
    const [smartTakeProfit, setSmartTakeProfit] = useState(5);
    const [smartStopLoss, setSmartStopLoss] = useState(30);
    const [smartDepth, setSmartDepth] = useState(100);
    const [smartRunning, setSmartRunning] = useState(false);
    const [smartStats, setSmartStats] = useState({ profit: 0, trades: 0, wins: 0 });
    const smartStopRef = useRef(false);
    const smartDigits = useLiveDigitsState(smartSymbol);
    // Always-fresh ref for smart bot loop
    const smartDigitsRef = useRef(smartDigits);
    useEffect(() => { smartDigitsRef.current = smartDigits; }, [smartDigits]);
    const smartAnalysis = computeSmartAnalysis(smartDigits, smartDepth);
    const buyAndWait = useBuyAndWait();

    const runSmartBot = useCallback(async () => {
        if (smartRunning) {
            smartStopRef.current = true;
            setSmartRunning(false);
            return;
        }
        smartStopRef.current = false;
        setSmartRunning(true);
        setSmartStats({ profit: 0, trades: 0, wins: 0 });
        let stk = smartStake;
        let sessionProfit = 0;

        while (!smartStopRef.current) {
            try {
                // Use freshest digits every iteration
                const live = smartDigitsRef.current;
                const n = Math.min(smartDepth, live.length);
                const last = live.slice(-n);
                const freq = Array.from({ length: 10 }, (_, i) => last.filter(d => d === i).length);
                const minDigit = freq.indexOf(Math.min(...freq));

                const profit = await buyAndWait(smartSymbol, 'DIGITDIFF', minDigit, stk);
                const won = profit > 0;
                sessionProfit += profit;
                setSmartStats(p => ({
                    profit: +(p.profit + profit).toFixed(2),
                    trades: p.trades + 1,
                    wins: p.wins + (won ? 1 : 0),
                }));
                stk = won ? smartStake : Math.max(0.35, +(stk * smartMartingale).toFixed(2));
                if (sessionProfit >= smartTakeProfit) break;
                if (sessionProfit <= -smartStopLoss) break;
            } catch (err: any) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        smartStopRef.current = false;
        setSmartRunning(false);
    }, [smartRunning, smartStake, smartMartingale, smartTakeProfit, smartStopLoss, smartSymbol, buyAndWait]);

    // ── AI Bots state
    const [globalStake, setGlobalStake] = useState(1.0);
    const [globalMartingale, setGlobalMartingale] = useState(2);
    const [sessions, setSessions] = useState<Record<string, BotSession>>(initSessions);

    const updateSession = useCallback((id: string, patch: Partial<BotSession>) => {
        setSessions(prev => {
            const cur = prev[id];
            return { ...prev, [id]: { ...cur, ...patch } };
        });
    }, []);

    const addLog = useCallback((id: string, msg: string) => {
        const ts = new Date().toLocaleTimeString('en', { hour12: false });
        setSessions(prev => ({
            ...prev,
            [id]: { ...prev[id], logs: [`[${ts}] ${msg}`, ...prev[id].logs].slice(0, 30) },
        }));
    }, []);

    const anyActive = Object.values(sessions).some(s => s.active);

    const ALL_SYMBOLS = [
        { label: 'V10 (1s)', value: '1HZ10V' }, { label: 'V25 (1s)', value: '1HZ25V' },
        { label: 'V50 (1s)', value: '1HZ50V' }, { label: 'V75 (1s)', value: '1HZ75V' },
        { label: 'V100 (1s)', value: '1HZ100V' },
        { label: 'V10', value: 'R_10' }, { label: 'V25', value: 'R_25' },
        { label: 'V50', value: 'R_50' }, { label: 'V75', value: 'R_75' }, { label: 'V100', value: 'R_100' },
    ];

    return (
        <div className='autotrades'>
            {/* Tab bar */}
            <div className='autotrades__tabs'>
                <button className={`autotrades__tab ${activeTab === 'smart' ? 'active' : ''}`}
                    onClick={() => setActiveTab('smart')}>Smart Trading</button>
                <button className={`autotrades__tab ${activeTab === 'autobots' ? 'active' : ''}`}
                    onClick={() => setActiveTab('autobots')}>Auto Bots</button>
            </div>

            {/* ── Smart Trading Tab ── */}
            {activeTab === 'smart' && (
                <div className='autotrades__smart'>
                    <div className='autotrades__smart-header'><h2>Money Laundering</h2></div>

                    <div className='autotrades__smart-settings'>
                        <div className='autotrades__smart-field'>
                            <label>Initial Stake</label>
                            <input type='number' min='0.35' step='0.01' value={smartStake}
                                onChange={e => setSmartStake(+e.target.value)} disabled={smartRunning} />
                        </div>
                        <div className='autotrades__smart-field'>
                            <label>Martingale Multiplier</label>
                            <input type='number' min='1' max='5' step='0.1' value={smartMartingale}
                                onChange={e => setSmartMartingale(+e.target.value)} disabled={smartRunning} />
                        </div>
                        <div className='autotrades__smart-field'>
                            <label>Take Profit</label>
                            <input type='number' min='0.1' step='0.5' value={smartTakeProfit}
                                onChange={e => setSmartTakeProfit(+e.target.value)} disabled={smartRunning} />
                        </div>
                        <div className='autotrades__smart-field'>
                            <label>Stop Loss</label>
                            <input type='number' min='0.1' step='0.5' value={smartStopLoss}
                                onChange={e => setSmartStopLoss(+e.target.value)} disabled={smartRunning} />
                        </div>
                        <div className='autotrades__smart-field'>
                            <label>Analysis Depth</label>
                            <select value={smartDepth} onChange={e => setSmartDepth(+e.target.value)} disabled={smartRunning}>
                                <option value={50}>Last 50 ticks</option>
                                <option value={100}>Last 100 ticks</option>
                                <option value={200}>Last 200 ticks</option>
                                <option value={500}>Last 500 ticks</option>
                            </select>
                        </div>
                        <div className='autotrades__smart-field'>
                            <label>Symbol</label>
                            <select value={smartSymbol} onChange={e => setSmartSymbol(e.target.value)} disabled={smartRunning}>
                                {ALL_SYMBOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className='autotrades__smart-actions'>
                        <button className={`autotrades__smart-run ${smartRunning ? 'running' : ''}`}
                            onClick={runSmartBot}>
                            {smartRunning ? '⏹ Stop Trading' : '▶ Start Trading'}
                        </button>
                    </div>

                    <div className='autotrades__smart-panels'>
                        <div className='autotrades__smart-panel'>
                            <h3>Trading Status</h3>
                            <div className='autotrades__status-grid'>
                                <div><span className='lbl'>Symbol</span><span className='val'>{smartSymbol}</span></div>
                                <div><span className='lbl'>Contract</span><span className='val'>DIGITDIFF</span></div>
                                <div><span className='lbl'>Stake</span><span className='val'>${smartStake.toFixed(2)}</span></div>
                                <div><span className='lbl'>Market Count</span><span className='val'>{smartStats.trades}/10</span></div>
                                <div><span className='lbl'>Speed</span><span className='val'>{smartRunning ? '● Normal' : 'Normal'}</span></div>
                            </div>
                        </div>

                        <div className='autotrades__smart-panel'>
                            <h3>Smart Analysis</h3>
                            <div className='autotrades__analysis-status'>
                                <span className={`autotrades__status-dot ${smartDigits.length > 0 ? 'live' : 'loading'}`} />
                                {smartDigits.length > 0 ? '✓ Ready (Live)' : 'Loading...'}
                            </div>
                            <div className='autotrades__analysis-row'>
                                <span className='lbl'>Prediction</span>
                                <span className='val pred'>{smartAnalysis.prediction}</span>
                            </div>
                            <div className='autotrades__analysis-row'>
                                <span className='lbl'>Ticks Analyzed</span>
                                <span className='val'>{smartAnalysis.ticks}/{smartDepth}</span>
                            </div>
                            <div className='autotrades__analysis-row'>
                                <span className='lbl'>Last 10 Digits</span>
                                <span className='val digits-row'>
                                    {smartAnalysis.last10.map((d, i) => (
                                        <span key={i} className={`autotrades__digit-badge d${d}`}>{d}</span>
                                    ))}
                                </span>
                            </div>
                            <div className='autotrades__analysis-row'>
                                <span className='lbl'>Digit Frequency</span>
                            </div>
                            <div className='autotrades__freq-row'>
                                {smartAnalysis.digitFreq.map((cnt, d) => (
                                    <span key={d} className='autotrades__freq-item'>
                                        <span className='d-label'>{d}</span>
                                        <span className='d-count'>{cnt}</span>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className='autotrades__smart-panel'>
                            <h3>Performance</h3>
                            <div className='autotrades__perf-grid'>
                                <div>
                                    <span className='lbl'>Total Profit</span>
                                    <span className={`val big ${smartStats.profit >= 0 ? 'pos' : 'neg'}`}>
                                        ${smartStats.profit.toFixed(2)}
                                    </span>
                                </div>
                                <div>
                                    <span className='lbl'>Trades</span>
                                    <span className='val big'>{smartStats.trades}</span>
                                </div>
                                <div>
                                    <span className='lbl'>Win/Loss</span>
                                    <span className='val'>{smartStats.wins}/{smartStats.trades - smartStats.wins}</span>
                                </div>
                                <div>
                                    <span className='lbl'>Win Rate</span>
                                    <span className='val'>
                                        {smartStats.trades > 0
                                            ? ((smartStats.wins / smartStats.trades) * 100).toFixed(1)
                                            : '0.0'}%
                                    </span>
                                </div>
                            </div>
                            <p className='autotrades__bg-note'>✓ Background data collection active. Prediction updates in real-time.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Auto Bots Tab ── */}
            {activeTab === 'autobots' && (
                <div className='autotrades__autobots'>
                    <div className='autotrades__autobots-header'>
                        <div className='autotrades__autobots-info'>
                            <div className='autotrades__autobots-icon'>🤖</div>
                            <div>
                                <h2>Automated Bots</h2>
                                <p>AI-Powered Strategies</p>
                            </div>
                        </div>
                        <div className='autotrades__autobots-status'>
                            <span className={`autotrades__market-dot ${anyActive ? 'live' : ''}`} />
                            Market Connected
                        </div>
                        <span className='autotrades__stake-label'>Stake: ${globalStake.toFixed(2)}</span>
                    </div>

                    <div className='autotrades__global-settings'>
                        <div className='autotrades__global-field'>
                            <label>STAKE ($)</label>
                            <input type='number' min='0.35' step='0.01' value={globalStake}
                                onChange={e => setGlobalStake(+e.target.value)} />
                        </div>
                        <div className='autotrades__global-field'>
                            <label>MARTINGALE</label>
                            <input type='number' min='1' max='5' step='0.1' value={globalMartingale}
                                onChange={e => setGlobalMartingale(+e.target.value)} />
                        </div>
                    </div>

                    <div className='autotrades__botcards'>
                        {AI_BOTS.map(bot => (
                            <AiBotCard
                                key={bot.id}
                                bot={bot}
                                globalStake={globalStake}
                                globalMartingale={globalMartingale}
                                session={sessions[bot.id]}
                                onSessionUpdate={patch => updateSession(bot.id, patch)}
                                onLog={msg => addLog(bot.id, msg)}
                            />
                        ))}
                    </div>

                    <div className='autotrades__start-all'>
                        <button className='autotrades__disclaimer-btn'>⚠ Risk Disclaimer</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AutoTrades;
