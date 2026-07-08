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
            ticks_history: symbol, count: 200, end: 'latest', style: 'ticks', subscribe: 1,
        }));
        ws.onmessage = e => {
            try {
                const d = JSON.parse(e.data);
                if (d.tick?.pip_size) pipSize = d.tick.pip_size;
                if (d.history?.prices) {
                    const ps = d.pip_size ?? pipSize;
                    digitsRef.current = d.history.prices.map((p: any) => extractDigit(p, ps));
                }
                if (d.tick?.quote) {
                    const ps = d.tick.pip_size ?? pipSize;
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
// Uses proposal→buy flow for reliable contract execution.
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

        // Step 1: Get a proposal to obtain a valid proposal_id
        const proposalReq: any = {
            proposal: 1,
            amount: stake,
            basis: 'stake',
            contract_type: contractType,
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol,
        };
        if (needsBarrier && barrier !== null) proposalReq.barrier = String(barrier);

        const propRes = await send(proposalReq);
        if (propRes?.error) throw new Error(propRes.error.message || 'Proposal failed');
        const proposalId = propRes?.proposal?.id;
        if (!proposalId) throw new Error('No proposal ID — API not ready');
        const askPrice = propRes?.proposal?.ask_price ?? stake;

        // Step 2: Buy using the proposal ID
        const buyRes = await send({ buy: proposalId, price: Number(askPrice) });
        if (buyRes?.error) throw new Error(buyRes.error.message || 'Buy failed');
        const contract_id = buyRes?.buy?.contract_id;
        if (!contract_id) throw new Error('Buy failed — no contract ID');

        // Step 3: Subscribe to proposal_open_contract to track settlement
        return new Promise<number>(resolve => {
            let sub: any;
            const bail = setTimeout(() => {
                try { sub?.unsubscribe?.(); } catch {}
                resolve(0);
            }, 20_000);

            try {
                sub = (api_base.api as any)?.onMessage?.()?.subscribe(({ data: d }: any) => {
                    if (!d?.proposal_open_contract) return;
                    const poc = d.proposal_open_contract;
                    if (Number(poc.contract_id) !== Number(contract_id)) return;
                    if (poc.is_sold === 1 || poc.status === 'won' || poc.status === 'lost') {
                        clearTimeout(bail);
                        try { sub?.unsubscribe?.(); } catch {}
                        resolve(parseFloat(poc.profit ?? '0'));
                    }
                });
            } catch {
                clearTimeout(bail);
                resolve(0);
                return;
            }

            send({ proposal_open_contract: 1, contract_id, subscribe: 1 })
                .catch(() => { clearTimeout(bail); try { sub?.unsubscribe?.(); } catch {} resolve(0); });
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
    pickTrade: (digits: number[], recoveryMode?: boolean) => { contract: string; barrier: number | null };
}

const AI_BOTS: AiBotDef[] = [
    {
        id: 'autodiffer',
        name: 'AutoDiffer',
        subtitle: 'Least-Frequent Digit Analysis',
        icon: '🎲',
        desc: 'Analyzes last 50 digits, picks DIGITDIFF on the least frequent digit for maximum win probability.',
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
        desc: 'Analyzes last 20 digits to identify over/under bias. Trades DIGITOVER 2 when over-bias, DIGITUNDER 7 otherwise.',
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
        desc: 'Compares Over 5 vs Under 4 frequency in last 20 digits and trades whichever has higher probability.',
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
        subtitle: 'Over 2 · Under 7 · Recovery Mode',
        icon: '🔄',
        desc: 'Trades Over 2 / Under 7 based on last 5 digit average. On loss, switches to recovery mode with Under 5.',
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

// ── Smart bot live digit state (for display) ──────────────────────────────────
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
                if (d.tick?.pip_size) pipSize = d.tick.pip_size;
                if (d.history?.prices) {
                    const ps = d.pip_size ?? pipSize;
                    setDigits(d.history.prices.map((p: any) => extractDigit(p, ps)));
                }
                if (d.tick?.quote) {
                    const ps = d.tick.pip_size ?? pipSize;
                    const digit = extractDigit(d.tick.quote, ps);
                    setDigits(prev => [...prev.slice(-499), digit]);
                }
            } catch {}
        };
        return () => ws.close();
    }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

    return digits;
}

// ── Individual AI bot runner ──────────────────────────────────────────────────
interface AiBotRunnerProps {
    bot: AiBotDef;
    globalStake: number;
    globalMartingale: number;
    session: BotSession;
    onSessionUpdate: (patch: Partial<BotSession>) => void;
    onLog: (msg: string) => void;
}

function AiBotCard({ bot, globalStake, globalMartingale, session, onSessionUpdate, onLog }: AiBotRunnerProps) {
    const digitsRef = useLiveDigitsRef(bot.symbol);
    const stopRef = useRef(false);
    const pausedStakeRef = useRef<number | null>(null); // for resume-with-martingale
    const buyAndWait = useBuyAndWait();

    const start = useCallback(async (resumeStake?: number) => {
        stopRef.current = false;
        let localWins = 0;
        let localLosses = 0;
        let localProfit = 0;
        onSessionUpdate({ active: true, wins: 0, losses: 0, profit: 0 });

        const tp = bot.defaultTakeProfit * Math.max(1, globalStake);
        const sl = bot.defaultStopLoss * Math.max(1, globalStake);
        let stk = resumeStake ?? globalStake; // resume with saved stake (martingale preserved)
        let recoveryMode = false;
        onLog(`🚀 ${bot.name} started | Stake: $${stk.toFixed(2)} | TP:${tp.toFixed(2)} SL:${sl.toFixed(2)}`);

        while (!stopRef.current) {
            try {
                const { contract, barrier } = bot.pickTrade(digitsRef.current, recoveryMode);
                const profit = await buyAndWait(bot.symbol, contract, barrier, stk);
                const won = profit > 0;
                localProfit = +(localProfit + profit).toFixed(2);
                if (won) localWins++; else localLosses++;

                onSessionUpdate({ wins: localWins, losses: localLosses, profit: localProfit });
                onLog(`${won ? '✅' : '❌'} ${contract}${barrier !== null ? '@' + barrier : ''} ${fmtProfit(profit)} | Total: ${fmtProfit(localProfit)}`);

                if (bot.id === 'auto-o2u7') recoveryMode = !won;
                if (won) {
                    stk = globalStake;
                    pausedStakeRef.current = null;
                } else {
                    stk = Math.max(0.35, +(stk * globalMartingale).toFixed(2));
                    pausedStakeRef.current = stk; // save for resume
                }

                if (localProfit >= tp) { onLog('🎯 Take profit hit'); break; }
                if (localProfit <= -sl) { onLog('🛑 Stop loss hit'); break; }
            } catch (err: any) {
                onLog(`⚠️ ${err?.message || 'Error'}`);
                await new Promise(r => setTimeout(r, 1500));
            }
        }

        stopRef.current = false;
        onSessionUpdate({ active: false });
        onLog(`⏹ Stopped. Session P/L: ${fmtProfit(localProfit)}`);
    }, [bot, globalStake, globalMartingale, digitsRef, buyAndWait, onLog, onSessionUpdate]);

    const toggle = useCallback(() => {
        if (session.active) {
            stopRef.current = true;
        } else {
            const resumeStake = pausedStakeRef.current;
            start(resumeStake ?? undefined);
        }
    }, [session.active, start]);

    const canResume = !session.active && pausedStakeRef.current !== null;

    return (
        <div className={`autotrades__botcard ${session.active ? 'active' : ''}`}>
            <div className='autotrades__botcard-top'>
                <span className='autotrades__botcard-icon'>{bot.icon}</span>
                <div className='autotrades__botcard-info'>
                    <strong>{bot.name}</strong>
                    <span>{bot.subtitle}</span>
                </div>
                <span className={`autotrades__botcard-status ${session.active ? 'on' : 'off'}`}>
                    {session.active ? 'ON' : canResume ? '⏸' : 'OFF'}
                </span>
            </div>
            <p className='autotrades__botcard-desc'>{bot.desc}</p>
            <div className='autotrades__botcard-market'>
                <span>📍 {bot.symbol}</span>
            </div>
            <div className='autotrades__botcard-stats'>
                <span className='wins'>✓ {session.wins}</span>
                <span className='losses'>✗ {session.losses}</span>
                <span className={`profit ${session.profit >= 0 ? 'pos' : 'neg'}`}>{fmtProfit(session.profit)}</span>
            </div>
            {canResume && pausedStakeRef.current && (
                <div className='autotrades__botcard-resume-info'>
                    ⏸ Will resume at stake: <strong>${pausedStakeRef.current.toFixed(2)}</strong>
                </div>
            )}
            {session.logs[0] && (
                <div className='autotrades__botcard-lastlog'>{session.logs[0]}</div>
            )}
            <button
                className={`autotrades__botcard-btn ${session.active ? 'deactivate' : canResume ? 'resume' : 'activate'}`}
                onClick={toggle}
            >
                {session.active ? '⏸ Pause' : canResume ? `▶ Resume ($${pausedStakeRef.current?.toFixed(2)})` : '▶ Activate'}
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
    const [smartPaused, setSmartPaused] = useState(false);
    const [smartStats, setSmartStats] = useState({ profit: 0, trades: 0, wins: 0 });
    const smartStopRef = useRef(false);
    const smartPausedStakeRef = useRef<number | null>(null);
    const smartDigits = useLiveDigitsState(smartSymbol);
    const smartDigitsRef = useRef(smartDigits);
    useEffect(() => { smartDigitsRef.current = smartDigits; }, [smartDigits]);
    const smartAnalysis = computeSmartAnalysis(smartDigits, smartDepth);
    const buyAndWait = useBuyAndWait();

    const runSmartBot = useCallback(async (resumeStake?: number) => {
        if (smartRunning) {
            smartStopRef.current = true;
            setSmartRunning(false);
            setSmartPaused(true);
            return;
        }
        smartStopRef.current = false;
        setSmartRunning(true);
        setSmartPaused(false);
        if (!resumeStake) {
            setSmartStats({ profit: 0, trades: 0, wins: 0 });
            smartPausedStakeRef.current = null;
        }
        let stk = resumeStake ?? smartStake;
        let sessionProfit = 0;

        while (!smartStopRef.current) {
            try {
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
                if (won) {
                    stk = smartStake;
                    smartPausedStakeRef.current = null;
                } else {
                    stk = Math.max(0.35, +(stk * smartMartingale).toFixed(2));
                    smartPausedStakeRef.current = stk;
                }
                if (sessionProfit >= smartTakeProfit) break;
                if (sessionProfit <= -smartStopLoss) break;
            } catch {
                await new Promise(r => setTimeout(r, 1500));
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
            <div className='autotrades__tabs'>
                <button className={`autotrades__tab ${activeTab === 'smart' ? 'active' : ''}`}
                    onClick={() => setActiveTab('smart')}>Smart Trading</button>
                <button className={`autotrades__tab ${activeTab === 'autobots' ? 'active' : ''}`}
                    onClick={() => setActiveTab('autobots')}>Auto Bots</button>
            </div>

            {/* ── Smart Trading Tab ── */}
            {activeTab === 'smart' && (
                <div className='autotrades__smart'>
                    <div className='autotrades__smart-header'>
                        <h2>💡 Money Laundering Bot</h2>
                        <p>AI-picks the least frequent digit for DIGITDIFF with martingale recovery</p>
                    </div>

                    <div className='autotrades__smart-settings'>
                        <div className='autotrades__smart-field'>
                            <label>Initial Stake ($)</label>
                            <input type='number' min='0.35' step='0.01' value={smartStake}
                                onChange={e => setSmartStake(+e.target.value)} disabled={smartRunning} />
                        </div>
                        <div className='autotrades__smart-field'>
                            <label>Martingale ×</label>
                            <input type='number' min='1' max='5' step='0.1' value={smartMartingale}
                                onChange={e => setSmartMartingale(+e.target.value)} disabled={smartRunning} />
                        </div>
                        <div className='autotrades__smart-field'>
                            <label>Take Profit ($)</label>
                            <input type='number' min='0.1' step='0.5' value={smartTakeProfit}
                                onChange={e => setSmartTakeProfit(+e.target.value)} disabled={smartRunning} />
                        </div>
                        <div className='autotrades__smart-field'>
                            <label>Stop Loss ($)</label>
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
                        {smartRunning ? (
                            <button className='autotrades__smart-run running' onClick={() => runSmartBot()}>
                                ⏸ Pause Trading
                            </button>
                        ) : smartPaused && smartPausedStakeRef.current ? (
                            <button className='autotrades__smart-run resume' onClick={() => runSmartBot(smartPausedStakeRef.current!)}>
                                ▶ Resume (stake: ${smartPausedStakeRef.current.toFixed(2)})
                            </button>
                        ) : (
                            <button className='autotrades__smart-run' onClick={() => runSmartBot()}>
                                ▶ Start Trading
                            </button>
                        )}
                        {smartPaused && (
                            <button className='autotrades__smart-reset' onClick={() => { setSmartPaused(false); smartPausedStakeRef.current = null; setSmartStats({ profit: 0, trades: 0, wins: 0 }); }}>
                                ↺ Reset Session
                            </button>
                        )}
                    </div>

                    <div className='autotrades__smart-panels'>
                        <div className='autotrades__smart-panel'>
                            <h3>Trading Status</h3>
                            <div className='autotrades__status-grid'>
                                <div><span className='lbl'>Symbol</span><span className='val'>{smartSymbol}</span></div>
                                <div><span className='lbl'>Contract</span><span className='val'>DIGITDIFF</span></div>
                                <div><span className='lbl'>Base Stake</span><span className='val'>${smartStake.toFixed(2)}</span></div>
                                <div><span className='lbl'>Status</span><span className='val'>{smartRunning ? '🟢 Running' : smartPaused ? '⏸ Paused' : '○ Idle'}</span></div>
                                <div><span className='lbl'>Trades</span><span className='val'>{smartStats.trades}</span></div>
                            </div>
                        </div>

                        <div className='autotrades__smart-panel'>
                            <h3>Smart Analysis</h3>
                            <div className='autotrades__analysis-status'>
                                <span className={`autotrades__status-dot ${smartDigits.length > 0 ? 'live' : 'loading'}`} />
                                {smartDigits.length > 0 ? `✓ Ready — ${smartDigits.length} ticks` : 'Loading...'}
                            </div>
                            <div className='autotrades__analysis-row'>
                                <span className='lbl'>Prediction (Differ)</span>
                                <span className='val pred'>{smartAnalysis.prediction}</span>
                            </div>
                            <div className='autotrades__analysis-row'>
                                <span className='lbl'>Analyzed</span>
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
                            <div className='autotrades__freq-row'>
                                {smartAnalysis.digitFreq.map((cnt, d) => (
                                    <span key={d} className={`autotrades__freq-item ${d === smartAnalysis.prediction ? 'pred' : ''}`}>
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
                                        {fmtProfit(smartStats.profit)}
                                    </span>
                                </div>
                                <div><span className='lbl'>Trades</span><span className='val big'>{smartStats.trades}</span></div>
                                <div><span className='lbl'>Wins</span><span className='val pos'>{smartStats.wins}</span></div>
                                <div><span className='lbl'>Losses</span><span className='val neg'>{smartStats.trades - smartStats.wins}</span></div>
                                <div>
                                    <span className='lbl'>Win Rate</span>
                                    <span className='val'>
                                        {smartStats.trades > 0 ? ((smartStats.wins / smartStats.trades) * 100).toFixed(1) : '0.0'}%
                                    </span>
                                </div>
                            </div>
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
                                <h2>Automated AI Bots</h2>
                                <p>Each bot uses its own live digit feed and independent stop control</p>
                            </div>
                        </div>
                        <div className='autotrades__autobots-status'>
                            <span className={`autotrades__market-dot ${anyActive ? 'live' : ''}`} />
                            {anyActive ? 'Bots Active' : 'Market Connected'}
                        </div>
                    </div>

                    <div className='autotrades__global-settings'>
                        <div className='autotrades__global-field'>
                            <label>BASE STAKE ($)</label>
                            <input type='number' min='0.35' step='0.01' value={globalStake}
                                onChange={e => setGlobalStake(+e.target.value)} />
                        </div>
                        <div className='autotrades__global-field'>
                            <label>MARTINGALE ×</label>
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

                    {/* Aggregated logs */}
                    <div className='autotrades__logs-section'>
                        <h3>📋 Recent Activity</h3>
                        <div className='autotrades__logs'>
                            {Object.entries(sessions)
                                .flatMap(([id, s]) => s.logs.slice(0, 3).map(l => ({ id, log: l })))
                                .sort((a, b) => b.log.localeCompare(a.log))
                                .slice(0, 20)
                                .map((item, i) => (
                                    <div key={i} className='autotrades__log-entry'>
                                        <span className='autotrades__log-bot'>{AI_BOTS.find(b => b.id === item.id)?.icon}</span>
                                        {item.log}
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AutoTrades;
