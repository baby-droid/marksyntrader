// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { api_base } from '@/external/bot-skeleton';
import {
    CONNECTION_STATUS,
    connectionStatus$,
} from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { isFastExecutionEnabled } from '@/utils/execution-speed';
import NumberField from '@/components/number-field';
import { setTradeContext } from '@/utils/trade-metadata';
import './auto-trades.scss';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtProfit(v: number) {
    return (v >= 0 ? '+' : '') + v.toFixed(2);
}

function extractDigit(quote: any, pipSize: number): number {
    return parseInt(Number(quote).toFixed(pipSize).slice(-1), 10);
}

// ── Authenticated per-symbol live digit hook ─────────────────────────────────
// Auto Trades must consume the same authorized API session as the rest of the
// app. A second public socket can show a different tick stream and cannot trade
// on the account the user selected.
function useAuthenticatedLiveDigits(symbol: string) {
    const [digits, setDigits] = useState<number[]>([]);
    const [livePrice, setLivePrice] = useState<number | null>(null);
    const [tickVersion, setTickVersion] = useState(0);
    const digitsRef = useRef<number[]>([]);
    const priceRef = useRef<number | null>(null);

    useEffect(() => {
        let alive = true;
        let rxSub: any = null;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let watchdog: ReturnType<typeof setTimeout> | null = null;
        let subscriptionId: string | null = null;
        let startInFlight = false;
        let streamGeneration = 0;
        let lastTickAt = 0;
        let historyLoaded = false;
        let historyPrices: number[] = [];
        let historyEpochs: number[] = [];
        let pipSize = 2;
        const seenEpochs = new Set<number>();
        let liveBuffer: Array<{ epoch: number; price: number }> = [];

        const publish = (next: number[]) => {
            const bounded = next.slice(-1000);
            digitsRef.current = bounded;
            if (alive) setDigits(bounded);
        };

        const clearWatchdog = () => {
            if (watchdog) clearTimeout(watchdog);
            watchdog = null;
        };

        const teardown = () => {
            clearWatchdog();
            try { rxSub?.unsubscribe?.(); } catch {}
            rxSub = null;
            // DerivAPIBasic sends the matching forget request when an
            // observable subscription is unsubscribed. Do not send a second
            // forget here: duplicate forgets are noisy and can hit rate limits.
            subscriptionId = null;
        };

        const scheduleStart = (delay = 350) => {
            if (!alive) return;
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
                retryTimer = null;
                void start();
            }, delay);
        };

        const rebuildDigits = () => {
            if (!historyLoaded) {
                publish(liveBuffer.map(item => extractDigit(item.price, pipSize)));
                return;
            }

            const historyDigits = historyPrices
                .filter((_, index) => !seenEpochs.has(Number(historyEpochs[index])))
                .map(price => extractDigit(price, pipSize));
            publish([
                ...historyDigits,
                ...liveBuffer.map(item => extractDigit(item.price, pipSize)),
            ]);
        };

        const armWatchdog = (generation: number) => {
            clearWatchdog();
            watchdog = setTimeout(() => {
                if (!alive || generation !== streamGeneration) return;
                const silenceMs = lastTickAt ? Date.now() - lastTickAt : 20000;
                if (silenceMs >= 20000) {
                    streamGeneration += 1;
                    teardown();
                    scheduleStart(1000);
                } else {
                    armWatchdog(generation);
                }
            }, Math.max(1000, 20000 - (lastTickAt ? Date.now() - lastTickAt : 0)));
        };

        const start = async () => {
            if (!alive || startInFlight) return;
            const api = (api_base as any).api;
            if (!api) { scheduleStart(); return; }

            startInFlight = true;
            const generation = ++streamGeneration;
            teardown();
            historyLoaded = false;
            historyPrices = [];
            historyEpochs = [];
            pipSize = 2;
            seenEpochs.clear();
            liveBuffer = [];
            lastTickAt = Date.now();

            const loadHistory = async () => {
                try {
                    const response = await api.send({
                        ticks_history: symbol,
                        count: 200,
                        end: 'latest',
                        style: 'ticks',
                    });
                    if (!alive || generation !== streamGeneration || response?.error) return;
                    historyPrices = (response?.history?.prices ?? []).map(Number);
                    historyEpochs = (response?.history?.times ?? []).map(Number);
                    rebuildDigits();
                } catch {
                    // Live ticks remain usable if the history request is delayed.
                } finally {
                    if (alive && generation === streamGeneration) {
                        historyLoaded = true;
                        rebuildDigits();
                    }
                }
            };

            const onTick = (tick: any) => {
                if (!alive || generation !== streamGeneration || !tick || tick.quote == null) return;
                const quote = Number(tick.quote);
                const epoch = Number(tick.epoch ?? 0);
                if (!Number.isFinite(quote)) return;
                if (tick.pip_size != null && Number.isFinite(Number(tick.pip_size))) {
                    // pip_size from a live tick is authoritative. History is
                    // kept as raw prices until this value is available.
                    pipSize = Number(tick.pip_size);
                }
                if (epoch && seenEpochs.has(epoch)) return;
                if (epoch) seenEpochs.add(epoch);

                lastTickAt = Date.now();
                priceRef.current = quote;
                setLivePrice(quote);
                if (alive) setTickVersion(version => version + 1);
                liveBuffer.push({ epoch, price: quote });
                rebuildDigits();
                if (!historyLoaded && liveBuffer.length === 1) void loadHistory();
                armWatchdog(generation);
            };

            try {
                const stream = api.subscribe({ ticks: symbol, subscribe: 1 });
                if (!stream?.subscribe) throw new Error('Deriv tick stream was not created');
                rxSub = stream?.subscribe?.({
                    next: (message: any) => {
                        if (generation !== streamGeneration) return;
                        if (message?.subscription?.id && !subscriptionId) {
                            subscriptionId = String(message.subscription.id);
                        }
                        onTick(message?.tick);
                    },
                    error: () => {
                        if (!alive || generation !== streamGeneration) return;
                        streamGeneration += 1;
                        teardown();
                        scheduleStart(1000);
                    },
                });
                // This remains active after history loads; a stream that
                // silently stalls must be restarted too.
                armWatchdog(generation);
            } catch {
                if (generation === streamGeneration) {
                    streamGeneration += 1;
                    teardown();
                }
                scheduleStart(1500);
            } finally {
                startInFlight = false;
            }
        };

        const handleConnectionStatus = (status: string) => {
            if (!alive) return;
            if (status === CONNECTION_STATUS.CLOSED) {
                streamGeneration += 1;
                teardown();
                if (retryTimer) {
                    clearTimeout(retryTimer);
                    retryTimer = null;
                }
                return;
            }

            if (status === CONNECTION_STATUS.OPENED) {
                // The API singleton may have been replaced while the old
                // RxJS subscription object remained truthy. Always recreate
                // the tick stream after the new socket opens.
                scheduleStart(250);
            }
        };

        let hasObservedConnectionStatus = false;
        const connectionSub = connectionStatus$.subscribe(status => {
            // BehaviorSubject immediately emits the current state. The
            // initial stream start below already handles that state; only
            // later close/open transitions should restart it.
            if (!hasObservedConnectionStatus) {
                hasObservedConnectionStatus = true;
                return;
            }
            handleConnectionStatus(status);
        });
        void start();
        const reconnect = () => {
            if (!alive) return;
            const readyState = (api_base as any).api?.connection?.readyState;
            const streamIsHealthy = rxSub
                && readyState === 1
                && lastTickAt
                && Date.now() - lastTickAt < 20000;
            if (streamIsHealthy) return;
            streamGeneration += 1;
            teardown();
            scheduleStart(250);
        };
        window.addEventListener('online', reconnect);
        window.addEventListener('focus', reconnect);

        return () => {
            alive = false;
            streamGeneration += 1;
            if (retryTimer) clearTimeout(retryTimer);
            connectionSub.unsubscribe();
            window.removeEventListener('online', reconnect);
            window.removeEventListener('focus', reconnect);
            teardown();
        };
    }, [symbol]);

    return { digits, digitsRef, livePrice, priceRef, tickVersion };
}

function useLiveDigitsRef(symbol: string): React.MutableRefObject<number[]> {
    const { digitsRef } = useAuthenticatedLiveDigits(symbol);
    return digitsRef;
}

function useLiveDigitsState(symbol: string): number[] {
    const { digits } = useAuthenticatedLiveDigits(symbol);
    return digits;
}

// ── Shared buy-and-wait via app's API connection ──────────────────────────────
// Uses proposal→buy flow for reliable contract execution.
function useBuyAndWait() {
    const { buyContract, authorized, connected, currency } = useDerivTrade();

    const buyAndWait = useCallback(async (
        symbol: string,
        contractType: string,
        barrier: number | null,
        stake: number,
        duration = 1,
        options: {
            settle?: boolean;
            onSettled?: (profit: number) => void;
            onBought?: (contractId: number) => void;
            metadata?: Record<string, unknown>;
            tradingParameters?: Record<string, unknown>;
        } = {},
    ): Promise<number> => {
        if (!connected) throw new Error('Deriv connection is not open');
        if (!authorized) throw new Error('Log in to a demo or real account before trading');

        // All Smart Trading buys use the same authenticated proposal → buy →
        // settlement path as Manual Trader. This keeps the selected demo/real
        // account and its currency attached to every request.
        if (options.settle === false) {
            const bought = await buyContract({
                symbol,
                contract_type: contractType,
                duration,
                duration_unit: 't',
                stake,
                ...(barrier !== null ? { barrier } : {}),
                currency,
                metadata: options.metadata,
            }, settlement => options.onSettled?.(Number(settlement?.profit ?? 0)));
            options.onBought?.(bought.contract_id);
            return 0;
        }

        return new Promise<number>(async (resolve, reject) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    resolve(0);
                }
            }, 20_000);
            try {
                const bought = await buyContract({
                    symbol,
                    contract_type: contractType,
                    duration,
                    duration_unit: 't',
                    stake,
                    ...(barrier !== null ? { barrier } : {}),
                    currency,
                    metadata: options.metadata,
                }, profit => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeout);
                    resolve(Number(profit?.profit ?? 0));
                });
                options.onBought?.(bought.contract_id);
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }, [buyContract, authorized, connected, currency]);

    return { buyAndWait, authorized, connected };
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

const AI_RUNS_PER_SCAN = 6;

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
    const { buyAndWait } = useBuyAndWait();

    const start = useCallback(async (resumeStake?: number) => {
        setTradeContext({ page: 'Auto Trades', bot: bot.name });
        stopRef.current = false;
        let localWins = 0;
        let localLosses = 0;
        let localProfit = 0;
        onSessionUpdate({ active: true, wins: 0, losses: 0, profit: 0 });

        const tp = bot.defaultTakeProfit * Math.max(1, globalStake);
        const sl = bot.defaultStopLoss * Math.max(1, globalStake);
        let stk = resumeStake ?? globalStake; // resume with saved stake (martingale preserved)
        let recoveryMode = false;
        let lastScanKey = '';
        onLog(`🚀 ${bot.name} started | Stake: $${stk.toFixed(2)} | TP:${tp.toFixed(2)} SL:${sl.toFixed(2)}`);

        while (!stopRef.current) {
            try {
                // A scan is anchored to a new digit window. One valid entry
                // starts exactly six sequential contracts; settlement gates
                // every next buy so fast execution never races the account's
                // contract state or reuses the same tick indefinitely.
                let scanDigits = digitsRef.current.slice();
                while (!stopRef.current && (
                    !scanDigits.length ||
                    scanDigits.slice(-10).join(',') === lastScanKey
                )) {
                    await new Promise(r => setTimeout(r, isFastExecutionEnabled() ? 0 : 80));
                    scanDigits = digitsRef.current.slice();
                }
                if (stopRef.current) break;
                lastScanKey = scanDigits.slice(-10).join(',');

                const entry = bot.pickTrade(scanDigits, recoveryMode);
                if (!entry || scanDigits.length < 3) continue;

                for (let run = 0; run < AI_RUNS_PER_SCAN && !stopRef.current; run++) {
                    const { contract, barrier } = bot.pickTrade(scanDigits, recoveryMode);
                    const profit = await buyAndWait(bot.symbol, contract, barrier, stk);
                    const won = profit > 0;
                    localProfit = +(localProfit + profit).toFixed(2);
                    if (won) localWins++; else localLosses++;

                    onSessionUpdate({ wins: localWins, losses: localLosses, profit: localProfit });
                    onLog(`${won ? '✅' : '❌'} AI scan ${run + 1}/${AI_RUNS_PER_SCAN}: ${contract}${barrier !== null ? '@' + barrier : ''} ${fmtProfit(profit)} | Total: ${fmtProfit(localProfit)}`);

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
                }

                if (localProfit >= tp || localProfit <= -sl) break;
            } catch (err: any) {
                onLog(`⚠️ ${err?.message || 'Error'}`);
                await new Promise(r => setTimeout(r, isFastExecutionEnabled() ? 0 : 1500));
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
    const [activeTab, setActiveTab] = useState<'smart' | 'autobots' | 'speedbot' | 'printer'>('smart');
    // Summary panel state
    const [summaryTab, setSummaryTab] = useState<'summary' | 'transactions' | 'journal'>('summary');
    const [summaryStats, setSummaryStats] = useState({ stake: 0, payout: 0, runs: 0, won: 0, lost: 0, profit: 0 });
    const [journal, setJournal] = useState<string[]>([]);
    const [transactions, setTransactions] = useState<Array<{
        id: string; time: string; contract: string; profit: number | null; symbol: string;
        stake?: number; status?: 'open' | 'won' | 'lost';
        batchId?: string; batchIndex?: number; batchTotal?: number;
    }>>([]);

    // ── Smart Trader (multi-card) state ──────────────────────────────────────────
    type SmartCardId = 'risefall' | 'evenodd' | 'overunder' | 'matchdiffer';
    const SMART_CARD_IDS: SmartCardId[] = ['risefall', 'evenodd', 'overunder', 'matchdiffer'];
    const CONDITION_OPTIONS: Record<SmartCardId, string[]> = {
        risefall: ['Rise', 'Fall'],
        evenodd: ['Even', 'Odd'],
        overunder: ['Over', 'Under'],
        matchdiffer: ['Matches', 'Differs'],
    };
    const ACTION_OPTIONS: Record<SmartCardId, string[]> = {
        risefall: ['Buy Rise', 'Buy Fall'],
        evenodd: ['Buy Even', 'Buy Odd'],
        overunder: ['Buy Over', 'Buy Under'],
        matchdiffer: ['Buy Matches', 'Buy Differs'],
    };

    const [smartSharedSymbol, setSmartSharedSymbol] = useState('1HZ10V');
    const [smartSharedDepth, setSmartSharedDepth] = useState(100);
    const smartSharedSymbolRef = useRef('1HZ10V');
    const smartSharedDepthRef = useRef(100);
    useEffect(() => { smartSharedSymbolRef.current = smartSharedSymbol; }, [smartSharedSymbol]);
    useEffect(() => { smartSharedDepthRef.current = smartSharedDepth; }, [smartSharedDepth]);

    const smartFeed = useAuthenticatedLiveDigits(smartSharedSymbol);
    const smartDigits = smartFeed.digits;
    const smartDigitsRef = useRef(smartDigits);
    useEffect(() => { smartDigitsRef.current = smartDigits; }, [smartDigits]);
    const smartTickVersionRef = useRef(smartFeed.tickVersion);
    useEffect(() => { smartTickVersionRef.current = smartFeed.tickVersion; }, [smartFeed.tickVersion]);

    // The header price is from the same authorized stream as the digit history.
    const smartLivePrice = smartFeed.livePrice;

    const { buyAndWait, authorized, connected } = useBuyAndWait();
    type SmartExecutionMode = 'normal' | 'eachTick' | 'superSpeed';
    const [smartExecutionMode, setSmartExecutionMode] = useState<SmartExecutionMode>('normal');
    const smartExecutionModeRef = useRef<SmartExecutionMode>('normal');
    useEffect(() => { smartExecutionModeRef.current = smartExecutionMode; }, [smartExecutionMode]);

    // Per-card config (editable params)
    const [smartCardCfg, setSmartCardCfg] = useState<Record<SmartCardId, {
        stake: number; ticks: number; martingale: number; barrier: number;
        lookback: number; ifValue: string; thenAction: string;
        bulkEnabled: boolean; bulkCount: number;
    }>>({
        risefall:    { stake: 5, ticks: 1, martingale: 1, barrier: 5, lookback: 3, ifValue: 'Rise', thenAction: 'Buy Rise', bulkEnabled: false, bulkCount: 10 },
        evenodd:     { stake: 5, ticks: 1, martingale: 1, barrier: 5, lookback: 3, ifValue: 'Even', thenAction: 'Buy Even', bulkEnabled: false, bulkCount: 10 },
        overunder:   { stake: 5, ticks: 1, martingale: 1, barrier: 5, lookback: 3, ifValue: 'Over', thenAction: 'Buy Over', bulkEnabled: false, bulkCount: 10 },
        matchdiffer: { stake: 5, ticks: 1, martingale: 1, barrier: 5, lookback: 3, ifValue: 'Matches', thenAction: 'Buy Matches', bulkEnabled: false, bulkCount: 10 },
    });
    const batchTradingEnabled = Object.values(smartCardCfg).some(cfg => cfg.bulkEnabled);
    const smartCardCfgRef = useRef(smartCardCfg);
    useEffect(() => { smartCardCfgRef.current = smartCardCfg; }, [smartCardCfg]);

    const updateCardCfg = useCallback((id: SmartCardId, patch: Partial<typeof smartCardCfg['risefall']>) => {
        setSmartCardCfg(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    }, []);

    // Per-card session (runtime state)
    const [smartCardSess, setSmartCardSess] = useState<Record<SmartCardId, {
        running: boolean; wins: number; losses: number; profit: number; lastLog: string;
    }>>({
        risefall:    { running: false, wins: 0, losses: 0, profit: 0, lastLog: '' },
        evenodd:     { running: false, wins: 0, losses: 0, profit: 0, lastLog: '' },
        overunder:   { running: false, wins: 0, losses: 0, profit: 0, lastLog: '' },
        matchdiffer: { running: false, wins: 0, losses: 0, profit: 0, lastLog: '' },
    });
    const smartStopFlags = useRef<Record<string, boolean>>({
        risefall: false, evenodd: false, overunder: false, matchdiffer: false,
    });
    const smartCurrentStakes = useRef<Record<string, number>>({
        risefall: 5, evenodd: 5, overunder: 5, matchdiffer: 5,
    });

    const updateSess = useCallback((id: SmartCardId, patch: Partial<typeof smartCardSess['risefall']>) => {
        setSmartCardSess(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    }, []);

    // Pick the trade for each card type using live digits
    const pickSmartTrade = useCallback((id: SmartCardId) => {
        const digits = smartDigitsRef.current;
        const cfg = smartCardCfgRef.current[id];
        const depth = Math.min(smartSharedDepthRef.current, digits.length);
        const last = digits.slice(-Math.max(depth, 20));
        const sample = last.slice(-Math.max(1, Math.min(10, cfg.lookback || 3)));
        const matchesAction = (name: string) => cfg.thenAction === name;

        if (id === 'risefall') {
            const rising = sample.length < 2 || sample.slice(1).every((d, i) => d > sample[i]);
            const falling = sample.length < 2 || sample.slice(1).every((d, i) => d < sample[i]);
            const meetsCondition = cfg.ifValue === 'Rise' ? rising : falling;
            return {
                contract: matchesAction('Buy Rise') ? 'CALL' : 'PUT',
                barrier: null,
                meetsCondition,
                riseProb: rising ? 100 : 0,
            };
        }
        if (id === 'evenodd') {
            // The Even/Odd card is deliberately streak-based: the latest N
            // digits must all have the selected parity before an entry is
            // allowed. This keeps the UI condition and execution gate
            // identical.
            const requiredDigits = Math.max(1, Math.min(10, cfg.lookback || 3));
            const paritySample = digits.slice(-requiredDigits);
            const meetsCondition = paritySample.length === requiredDigits
                && paritySample.every(d => (d % 2 === 0) === (cfg.ifValue === 'Even'));
            return {
                contract: matchesAction('Buy Even') ? 'DIGITEVEN' : 'DIGITODD',
                barrier: null,
                meetsCondition,
                evenProb: paritySample.filter(d => d % 2 === 0).length / Math.max(1, paritySample.length) * 100,
            };
        }
        if (id === 'overunder') {
            const isOver = sample.length > 0 && sample.every(d => d > cfg.barrier);
            const isUnder = sample.length > 0 && sample.every(d => d < cfg.barrier);
            return {
                contract: matchesAction('Buy Over') ? 'DIGITOVER' : 'DIGITUNDER',
                barrier: cfg.barrier,
                meetsCondition: cfg.ifValue === 'Over' ? isOver : isUnder,
                overProb: sample.filter(d => d > cfg.barrier).length / Math.max(1, sample.length) * 100,
            };
        }
        // Matches means the recent digits are identical; Differs means at least
        // two different digits appeared in the selected window.
        const freq = Array.from({ length: 10 }, (_, i) => last.filter(d => d === i).length);
        const minDigit = freq.indexOf(Math.min(...freq));
        const isMatch = sample.length > 0 && sample.every(d => d === sample[0]);
        return {
            contract: matchesAction('Buy Matches') ? 'DIGITMATCH' : 'DIGITDIFF',
            barrier: matchesAction('Buy Matches') ? sample[0] : minDigit,
            meetsCondition: cfg.ifValue === 'Matches' ? isMatch : new Set(sample).size > 1,
            freq,
        };
    }, []);

    // Start/stop a smart card bot
    const toggleSmartCard = useCallback((id: SmartCardId, configOverride?: typeof smartCardCfg['risefall']) => {
        if (smartCardSess[id].running) {
            smartStopFlags.current[id] = true;
            return;
        }

        // Init run
        smartStopFlags.current[id] = false;
        // Use the config from the rendered card when available. This avoids a
        // one-render race where the Bulk toggle is visibly ON but the ref
        // effect has not copied that edit before Start is clicked.
        const cfg = configOverride || smartCardCfgRef.current[id];
        setTradeContext({ page: 'Auto Trades', bot: `${id} Smart Trading` });
        smartCurrentStakes.current[id] = cfg.stake;
        updateSess(id, { running: true, wins: 0, losses: 0, profit: 0, lastLog: 'Starting…' });

        let wins = 0, losses = 0, sessionProfit = 0;
        let evaluatedTick = smartTickVersionRef.current - 1;
        let waitUntilTick = 0;

        const loop = async () => {
            while (!smartStopFlags.current[id]) {
                let pendingTransactionIds: string[] = [];
                try {
                    const mode = smartExecutionModeRef.current;
                    // Every card evaluates once per new authenticated tick.
                    // Without this gate Normal mode can buy repeatedly from
                    // the same already-matching digit window after settlement.
                    while (!smartStopFlags.current[id] && smartTickVersionRef.current <= Math.max(evaluatedTick, waitUntilTick)) {
                        await new Promise(r => setTimeout(r, 40));
                    }
                    if (smartStopFlags.current[id]) break;
                    evaluatedTick = smartTickVersionRef.current;

                    const trade = pickSmartTrade(id);
                    if (!trade.meetsCondition) {
                        // Conditions are tick-gated. Do not repeatedly buy while
                        // the same non-matching window is on screen.
                        continue;
                    }
                    const { contract, barrier } = trade;
                    const currentCfg = smartCardCfgRef.current[id];
                    const stk = smartCurrentStakes.current[id];
                    const sym = smartSharedSymbolRef.current;
                    const batchEnabled = Boolean(currentCfg.bulkEnabled);
                    // Snapshot the edited count for this signal. Changes made
                    // while this batch is settling apply only to the next
                    // batch, never halfway through the current one.
                    const batchCount = Math.max(1, Math.min(100, Math.floor(currentCfg.bulkCount || 10)));

                    const batchId = `BATCH-${id}-${Date.now()}-${wins + losses}`;
                    const transactionId = `${batchId}-ORDER-1`;
                    const transactionTime = new Date().toLocaleTimeString('en', { hour12: false });
                    const batchTransactionIds = Array.from({ length: batchCount }, (_, index) =>
                        `${batchId}-ORDER-${index + 1}`
                    );
                    pendingTransactionIds = batchEnabled ? batchTransactionIds : [transactionId];
                    setTransactions(prev => [
                        ...prev.slice(-(batchEnabled ? Math.max(99, batchCount * 2) : 99)),
                        ...(batchEnabled
                            ? batchTransactionIds.map((id, index) => ({
                                id,
                                time: transactionTime,
                                contract: `${contract}${barrier !== null ? '@' + barrier : ''} #${index + 1}/${batchCount}`,
                                profit: null,
                                symbol: sym,
                                stake: stk,
                                status: 'open',
                                batchId,
                            }))
                            : [{
                                id: transactionId,
                                time: transactionTime,
                                contract: `${contract}${barrier !== null ? '@' + barrier : ''}`,
                                profit: null,
                                symbol: sym,
                                stake: stk,
                                status: 'open',
                                batchId,
                            }]),
                    ]);

                    const recordResult = (
                        profit: number,
                        resultTransactionId = transactionId,
                        advanceStake = true,
                        contractId?: number,
                    ) => {
                        const won = profit > 0;
                        sessionProfit = +(sessionProfit + profit).toFixed(2);
                        if (won) wins++; else losses++;

                        const ts = new Date().toLocaleTimeString('en', { hour12: false });
                        const logMsg = `${won ? '✅' : '❌'} ${contract}${barrier !== null ? '@' + barrier : ''} ${fmtProfit(profit)}`;
                        updateSess(id, { wins, losses, profit: sessionProfit, lastLog: logMsg });

                        setSummaryStats(prev => ({
                            stake: +(prev.stake + stk).toFixed(2),
                            payout: +(prev.payout + (won ? stk + profit : 0)).toFixed(2),
                            runs: prev.runs + 1,
                            won: prev.won + (won ? 1 : 0),
                            lost: prev.lost + (won ? 0 : 1),
                            profit: +(prev.profit + profit).toFixed(2),
                        }));
                        setTransactions(prev => prev.map(transaction => transaction.id === resultTransactionId
                            ? {
                                ...transaction,
                                time: ts,
                                profit: +profit.toFixed(2),
                                status: won ? 'won' : 'lost',
                                ...(contractId ? { contractId } : {}),
                            }
                            : transaction
                        ));
                        setJournal(prev => [`[${ts}] [${id}] ${logMsg}`, ...prev].slice(0, 50));

                        if (advanceStake) {
                            smartCurrentStakes.current[id] = won
                                ? currentCfg.stake
                                : Math.max(0.35, +(stk * currentCfg.martingale).toFixed(2));
                        }
                    };

                    if (batchEnabled) {
                        // Dispatch all identical orders from the same signal
                        // signal without awaiting one before starting the
                        // next. Each buy has its own proposal and settlement
                        // subscription, but shares the same symbol, contract,
                        // barrier, stake, duration, and entry tick.
                        setJournal(prev => [
                            `[${transactionTime}] [${id}] ${batchId}: dispatching all ${batchCount} executions from one entry signal`,
                            ...prev,
                        ].slice(0, 50));
                        const boughtContractIds = new Map<string, number>();
                        const batchResults = await Promise.allSettled(
                            batchTransactionIds.map((orderId, batchIndex) =>
                                buyAndWait(sym, contract, barrier, stk, currentCfg.ticks, {
                                    metadata: {
                                        source: 'auto-trades',
                                        execution_mode: 'parallel',
                                        batch_id: batchId,
                                        batch_index: batchIndex + 1,
                                        batch_size: batchCount,
                                    },
                                    onBought: contractId => {
                                        boughtContractIds.set(orderId, contractId);
                                        setTransactions(prev => prev.map(transaction =>
                                            transaction.id === orderId
                                                ? { ...transaction, status: 'open', contractId }
                                                : transaction
                                        ));
                                    },
                                })
                            )
                        );
                        let batchWins = 0;
                        let batchLosses = 0;
                        let batchProfit = 0;
                        let failedOrders = 0;
                        batchResults.forEach((result, index) => {
                            const orderId = batchTransactionIds[index];
                            const contractId = boughtContractIds.get(orderId);
                            if (result.status === 'fulfilled') {
                                const profit = Number(result.value) || 0;
                                batchProfit = +(batchProfit + profit).toFixed(2);
                                if (profit > 0) batchWins++; else batchLosses++;
                                recordResult(profit, orderId, false, contractId);
                            } else {
                                failedOrders++;
                                setTransactions(prev => prev.map(transaction =>
                                    transaction.id === orderId
                                        ? { ...transaction, status: 'error', profit: null }
                                        : transaction
                                ));
                            }
                        });
                        const settledCount = batchWins + batchLosses;
                        const batchOutcome = settledCount < batchCount
                            ? 'PENDING/INCOMPLETE'
                            : batchWins === batchCount
                                ? 'ALL WON'
                                : batchLosses === batchCount
                                    ? 'ALL LOST'
                                    : 'MIXED SETTLEMENTS';
                        setJournal(prev => [
                            `[${new Date().toLocaleTimeString('en', { hour12: false })}] [${id}] ${batchId}: ${settledCount}/${batchCount} executions settled · ${batchOutcome} · ${batchWins} won · ${batchLosses} lost · P/L ${fmtProfit(batchProfit)}${failedOrders ? ` · ${failedOrders} failed` : ''}`,
                            ...prev,
                        ].slice(0, 50));
                        smartCurrentStakes.current[id] = batchProfit <= 0
                            ? Math.max(0.35, +(stk * currentCfg.martingale).toFixed(2))
                            : currentCfg.stake;
                    } else if (mode === 'normal') {
                        const profit = await buyAndWait(sym, contract, barrier, stk, currentCfg.ticks, {
                            metadata: {
                                source: 'auto-trades',
                                execution_mode: 'single',
                                batch_id: batchId,
                                batch_index: 1,
                                batch_size: 1,
                            },
                        });
                        if (smartStopFlags.current[id]) break;
                        recordResult(profit);
                    } else {
                        // Each Tick and Super Speed both place a separate
                        // one-tick contract for every newly received tick.
                        // They deliberately do not wait for settlement.
                        const settle = (profit: number) => recordResult(profit);
                        const request = buyAndWait(
                            sym, contract, barrier, stk, 1,
                            { settle: false, onSettled: settle },
                        );
                        if (mode === 'eachTick') {
                            await request;
                        } else {
                            // Super Speed intentionally does not wait for the
                            // buy acknowledgement; the authenticated API
                            // still performs proposal → buy for each contract.
                            void request.catch(() => {});
                        }
                    }
                    // Require a completely new lookback window before this
                    // card can enter again. For example, after "3 Even →
                    // Buy Odd", the next entry waits for three new ticks.
                    waitUntilTick = evaluatedTick + Math.max(1, Math.min(10, currentCfg.lookback || 3));
                } catch {
                    // A proposal/buy failure is not a taken trade. Remove its
                    // optimistic OPEN row instead of leaving a phantom
                    // transaction in the Bot Builder-style history.
                    if (pendingTransactionIds.length) {
                        setTransactions(prev => prev.filter(transaction => !pendingTransactionIds.includes(transaction.id)));
                    }
                    await new Promise(r => setTimeout(r, isFastExecutionEnabled() ? 0 : 1500));
                }
            }
            smartStopFlags.current[id] = false;
            setSmartCardSess(prev => ({
                ...prev,
                [id]: { ...prev[id], running: false, lastLog: `Stopped. P/L: ${fmtProfit(sessionProfit)}` },
            }));
        };

        loop(); // fire-and-forget async loop
    }, [smartCardSess, buyAndWait, pickSmartTrade, updateSess]);

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
        // Volatility 1s
        { label: 'V10 (1s)', value: '1HZ10V' }, { label: 'V25 (1s)', value: '1HZ25V' },
        { label: 'V50 (1s)', value: '1HZ50V' }, { label: 'V75 (1s)', value: '1HZ75V' },
        { label: 'V100 (1s)', value: '1HZ100V' },
        // Volatility
        { label: 'V10', value: 'R_10' }, { label: 'V25', value: 'R_25' },
        { label: 'V50', value: 'R_50' }, { label: 'V75', value: 'R_75' }, { label: 'V100', value: 'R_100' },
        // Jump
        { label: 'Jump 10', value: 'JD10' }, { label: 'Jump 25', value: 'JD25' },
        { label: 'Jump 50', value: 'JD50' }, { label: 'Jump 75', value: 'JD75' }, { label: 'Jump 100', value: 'JD100' },
        // Boom
        { label: 'Boom 300', value: 'BOOM300N' }, { label: 'Boom 500', value: 'BOOM500' }, { label: 'Boom 1000', value: 'BOOM1000' },
        // Crash
        { label: 'Crash 300', value: 'CRASH300N' }, { label: 'Crash 500', value: 'CRASH500' }, { label: 'Crash 1000', value: 'CRASH1000' },
        // Step
        { label: 'Step Index', value: 'STPX' },
        // Daily Reset (Bear & Bull)
        { label: 'Bear Market', value: 'RDBEAR' }, { label: 'Bull Market', value: 'RDBULL' },
    ];

    /* ── Account type indicator ── */
    const [isDemo, setIsDemo] = React.useState(() => {
        const id = localStorage.getItem('active_loginid') || '';
        return id.startsWith('VRTC') || id.startsWith('VR');
    });
    React.useEffect(() => {
        const handler = () => {
            const id = localStorage.getItem('active_loginid') || '';
            setIsDemo(id.startsWith('VRTC') || id.startsWith('VR'));
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, []);

    return (
        <div className='autotrades'>
            <div className='autotrades__topbar'>
                <div className='autotrades__tabs'>
                    <button className={`autotrades__tab ${activeTab === 'smart' ? 'active' : ''}`}
                        onClick={() => setActiveTab('smart')}>Smart Trading</button>
                    <button className={`autotrades__tab ${activeTab === 'autobots' ? 'active' : ''}`}
                        onClick={() => setActiveTab('autobots')}>Auto Bots</button>
                    <button className={`autotrades__tab ${activeTab === 'speedbot' ? 'active' : ''}`}
                        onClick={() => setActiveTab('speedbot')}>Speed Bot</button>
                    <button className={`autotrades__tab ${activeTab === 'printer' ? 'active' : ''}`}
                        onClick={() => setActiveTab('printer')}>Printer</button>
                </div>
                <span className={`autotrades__acct-badge ${isDemo ? 'demo' : 'real'}`}>
                    {isDemo ? '🔵 DEMO ACCOUNT' : '🟢 REAL ACCOUNT'}
                </span>
                <span className='autotrades__acct-note'>
                    {isDemo ? 'Bots trade on demo funds' : 'Bots trade with real money'}
                </span>
            </div>
            {/* ── Two-column layout: content left + summary panel right ── */}
            <div className='autotrades__layout'>
            <div className='autotrades__main-col'>

            {/* ── Smart Trading Tab ── */}
            {activeTab === 'smart' && (() => {
                // Compute live stats for all cards from shared digits
                const depth = Math.min(smartSharedDepth, smartDigits.length);
                const last = smartDigits.slice(-Math.max(depth, 20));
                const n = last.length;

                // Rise/Fall
                const riseCount = last.slice(1).filter((d, i) => d > last[i]).length;
                const riseProb = n > 1 ? (riseCount / (n - 1)) * 100 : 50;
                const fallProb = 100 - riseProb;

                // Even/Odd
                const evenCount = last.filter(d => d % 2 === 0).length;
                const evenProb = n > 0 ? (evenCount / n) * 100 : 50;
                const oddProb = 100 - evenProb;

                // Over/Under (using each card's barrier)
                const ouBarrier = smartCardCfg.overunder.barrier;
                const overCount = last.filter(d => d > ouBarrier).length;
                const overProb = n > 0 ? (overCount / n) * 100 : 50;
                const underProb = 100 - overProb;

                // Matches/Differs
                const freq = Array.from({ length: 10 }, (_, i) => last.filter(d => d === i).length);
                const maxFreq = Math.max(...freq);
                const mostFreqDigit = freq.indexOf(maxFreq);
                const minFreq = Math.min(...freq);
                const leastFreqDigit = freq.indexOf(minFreq);
                const matchProb = n > 0 ? (freq[mostFreqDigit] / n) * 100 : 10;
                const differProb = 100 - (n > 0 ? (freq[leastFreqDigit] / n) * 100 : 10);
                const last10 = smartDigits.slice(-10);
                 const evenOddPattern = last10.map(d => d % 2 === 0 ? 'E' : 'O');
                 const evenOddStreak = (() => {
                     if (!last10.length) return 0;
                     const parity = last10[last10.length - 1] % 2;
                     let count = 0;
                     for (let i = last10.length - 1; i >= 0 && last10[i] % 2 === parity; i--) count++;
                     return count;
                 })();

                const CARD_DEFS = [
                    { id: 'risefall' as SmartCardId,    title: 'Rise/Fall',         icon: '📈' },
                    { id: 'evenodd' as SmartCardId,     title: 'Even/Odd',          icon: '⚖️'  },
                    { id: 'overunder' as SmartCardId,   title: 'Over/Under',        icon: '🎯' },
                    { id: 'matchdiffer' as SmartCardId, title: 'Matches/Differs',   icon: '🔢' },
                ];

                return (
                <div className='st'>
                    {/* Header bar */}
                    <div className='st__header'>
                        <span className='st__title'>Smart Trading</span>
                        <div className='st__header-row'>
                            <div className='st__hfield'>
                                <label>Symbol</label>
                                <select value={smartSharedSymbol} onChange={e => setSmartSharedSymbol(e.target.value)}>
                                    {ALL_SYMBOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                            <div className='st__hfield'>
                                <label>Analysis Ticks</label>
                                <select value={smartSharedDepth} onChange={e => setSmartSharedDepth(+e.target.value)}>
                                    {[100,200,300,500,750,1000].map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                            <div className='st__price-badge'>
                                Price: <strong>{smartLivePrice != null ? smartLivePrice.toFixed(3) : '—'}</strong>
                            </div>
                        </div>
                        <div className='st__data-status'>
                            <span className={`st__dot ${smartDigits.length > 0 ? 'live' : ''}`} />
                            {smartDigits.length > 0 ? `${smartDigits.length} ticks loaded` : 'Loading market data…'}
                        </div>
                        <div className='st__data-status'>
                            <span className={`st__dot ${connected && authorized ? 'live' : ''}`} />
                            {connected && authorized
                                ? 'Authenticated trading ready'
                                : 'Log in to a demo or real account to trade'}
                        </div>
                        <div className='st__execution'>
                            <span className='st__execution-label'>Execution</span>
                            <div className='st__execution-buttons'>
                                <button
                                    className={smartExecutionMode === 'normal' ? 'active' : ''}
                                    disabled={batchTradingEnabled}
                                    onClick={() => setSmartExecutionMode('normal')}
                                    title='Buy a contract, then wait for Deriv to settle it before the next trade'
                                >
                                        Single Trade
                                </button>
                                <button
                                    className={smartExecutionMode === 'eachTick' ? 'active' : ''}
                                    disabled={batchTradingEnabled}
                                    onClick={() => setSmartExecutionMode('eachTick')}
                                    title='Buy one separate one-tick contract for every authenticated market tick'
                                >
                                    Each Tick
                                </button>
                                <button
                                    className={smartExecutionMode === 'superSpeed' ? 'active super' : 'super'}
                                    disabled={batchTradingEnabled}
                                    onClick={() => setSmartExecutionMode('superSpeed')}
                                    title='Buy each individual tick contract without waiting for buy or settlement acknowledgement'
                                >
                                    Super Speed
                                </button>
                            </div>
                            <span className='st__execution-help'>
                                {smartExecutionMode === 'normal'
                                    ? 'Default: one trade at a time from each entry signal'
                                    : smartExecutionMode === 'eachTick'
                                        ? 'One individual 1-tick contract per live digit'
                                         : 'Individual contracts sent at maximum API speed'}
                            </span>
                        </div>
                    </div>

                    {/* Bot cards grid */}
                    <div className='st__cards'>
                        {CARD_DEFS.map(card => {
                            const sess = smartCardSess[card.id];
                            const cfg = smartCardCfg[card.id];
                            const isRunning = sess.running;
                            const totalTrades = sess.wins + sess.losses;
                            const winRate = totalTrades > 0 ? ((sess.wins / totalTrades) * 100).toFixed(1) : '0.0';

                            let statA: string, statB: string, labelA: string, labelB: string;
                            let probA: number, probB: number;
                            if (card.id === 'risefall') {
                                labelA = 'Rise'; labelB = 'Fall';
                                probA = riseProb; probB = fallProb;
                                statA = riseProb.toFixed(2) + '%'; statB = fallProb.toFixed(2) + '%';
                            } else if (card.id === 'evenodd') {
                                labelA = 'Even'; labelB = 'Odd';
                                probA = evenProb; probB = oddProb;
                                statA = evenProb.toFixed(2) + '%'; statB = oddProb.toFixed(2) + '%';
                            } else if (card.id === 'overunder') {
                                labelA = `Over`; labelB = `Under`;
                                probA = overProb; probB = underProb;
                                statA = overProb.toFixed(2) + '%'; statB = underProb.toFixed(2) + '%';
                            } else {
                                labelA = 'Matches'; labelB = 'Differs';
                                probA = matchProb; probB = differProb;
                                statA = matchProb.toFixed(2) + '%'; statB = differProb.toFixed(2) + '%';
                            }

                            return (
                                <div key={card.id} className={`st__card ${isRunning ? 'running' : ''}`}>
                                    <div className='st__card-top'>
                                        <span className='st__card-icon'>{card.icon}</span>
                                        <strong className='st__card-title'>{card.title}</strong>
                                        {isRunning && <span className='st__running-dot'>●</span>}
                                    </div>

                                    {/* Live stat bars */}
                                    <div className='st__bars'>
                                        <div className='st__bar-row'>
                                            <span className='st__bar-label'>{labelA}</span>
                                            <div className='st__bar-track'>
                                                <div className='st__bar-fill green' style={{ width: `${probA.toFixed(1)}%` }} />
                                            </div>
                                            <span className='st__bar-pct green'>{statA}</span>
                                        </div>
                                        <div className='st__bar-row'>
                                            <span className='st__bar-label'>{labelB}</span>
                                            <div className='st__bar-track'>
                                                <div className='st__bar-fill red' style={{ width: `${probB.toFixed(1)}%` }} />
                                            </div>
                                            <span className='st__bar-pct red'>{statB}</span>
                                        </div>
                                    </div>

                                    {/* Last Digits Pattern */}
                                    {(card.id === 'evenodd' || card.id === 'overunder' || card.id === 'matchdiffer') && (
                                        <div className='st__digit-pattern'>
                                            <div className='st__pattern-label'>Last Digits Pattern</div>
                                            <div className='st__pattern-dots'>
                                                {last10.map((d, i) => (
                                                    <span key={i} className={`st__pdot ${(card.id === 'evenodd' || card.id === 'overunder') ? (d % 2 === 0 ? 'even' : 'odd') : `d${d % 5}`}`}>
                                                        {card.id === 'evenodd' ? evenOddPattern[i] : d}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className='st__pattern-note'>
                                                {card.id === 'evenodd'
                                                    ? `${last10.length ? evenOddPattern.join(' · ') : 'Waiting for ticks'}`
                                                    : card.id === 'overunder'
                                                    ? `O=Over (>${ouBarrier}), E=Equal (=${ouBarrier}), U=Under (<${ouBarrier})`
                                                    : `Most frequent: ${mostFreqDigit} (${matchProb.toFixed(2)}%)`}
                                            </div>
                                            {card.id === 'evenodd' && (
                                                <div className='st__streak-note'>
                                                    Current streak: <strong>{last10.length ? `${evenOddStreak} ${last10[last10.length - 1] % 2 === 0 ? 'Even' : 'Odd'}` : '—'}</strong>
                                                </div>
                                            )}
                                            {card.id === 'matchdiffer' && (
                                                <div className='st__freq-dist'>
                                                    <div className='st__freq-label'>Digit Frequency Distribution</div>
                                                    <div className='st__freq-bars'>
                                                        {freq.map((cnt, d) => {
                                                            const pct = n > 0 ? (cnt / n) * 100 : 10;
                                                            return (
                                                                <div key={d} className='st__freq-col'>
                                                                    <div className='st__freq-bar-wrap'>
                                                                        <div className={`st__freq-bar ${d === leastFreqDigit ? 'pred' : ''}`}
                                                                            style={{ height: `${Math.max(4, pct * 2)}px` }} />
                                                                    </div>
                                                                    <span className='st__freq-d'>{d}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Trading Condition */}
                                    <div className='st__condition'>
                                        <div className='st__condition-title'>Trading Condition</div>
                                         <div className='st__condition-row st__condition-row--interactive'>
                                             <span className='st__cond-lbl'>If</span>
                                             <span className='st__cond-text'>the last</span>
                                             <select
                                                 className='st__cond-select st__cond-select--number'
                                                 value={cfg.lookback}
                                                 disabled={isRunning}
                                                 aria-label={`${card.title} lookback digits`}
                                                 onChange={e => updateCardCfg(card.id, { lookback: Math.max(1, Math.min(10, +e.target.value)) })}
                                             >
                                                 {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => <option key={v} value={v}>{v}</option>)}
                                             </select>
                                             <span className='st__cond-text'>
                                                 {card.id === 'risefall' ? 'digits move' : 'digits are'}
                                             </span>
                                             <select
                                                 className='st__cond-select'
                                                 value={cfg.ifValue}
                                                 disabled={isRunning}
                                                 aria-label={`${card.title} entry condition`}
                                                 onChange={e => updateCardCfg(card.id, { ifValue: e.target.value })}
                                             >
                                                 {CONDITION_OPTIONS[card.id].map(value => <option key={value} value={value}>{value}</option>)}
                                             </select>
                                             {card.id === 'overunder' && <span className='st__cond-text'>digit {ouBarrier}</span>}
                                        </div>
                                          <div className='st__condition-row st__condition-row--interactive'>
                                            <span className='st__cond-lbl'>Then</span>
                                              <select
                                                  className='st__cond-select st__cond-action-select'
                                                  value={cfg.thenAction}
                                                  disabled={isRunning}
                                                  aria-label={`${card.title} trade action`}
                                                  onChange={e => updateCardCfg(card.id, { thenAction: e.target.value })}
                                              >
                                                  {ACTION_OPTIONS[card.id].map(value => <option key={value} value={value}>{value}</option>)}
                                              </select>
                                              {card.id === 'overunder' && <span className='st__cond-text'>digit {ouBarrier}</span>}
                                        </div>
                                        {card.id === 'overunder' && (
                                            <div className='st__condition-row'>
                                                <span className='st__cond-lbl'>Barrier</span>
                                                <input type='number' min='0' max='9' step='1'
                                                    className='st__cond-input'
                                                    value={cfg.barrier}
                                                    disabled={isRunning}
                                                    onChange={e => updateCardCfg(card.id, { barrier: +e.target.value })} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Per-card params */}
                                    <div className='st__params'>
                                        <div className='st__param'>
                                            <label>Stake</label>
                                            <input type='number' min='0.35' step='0.5' value={cfg.stake}
                                                disabled={isRunning}
                                                onChange={e => updateCardCfg(card.id, { stake: +e.target.value })} />
                                        </div>

                                        <div className='st__param'>
                                            <label>Ticks</label>
                                            <input type='number' min='1' max='10' step='1' value={cfg.ticks}
                                                disabled={isRunning}
                                                onChange={e => updateCardCfg(card.id, { ticks: +e.target.value })} />
                                        </div>
                                        <div className='st__param'>
                                            <label>Martingale</label>
                                            <input type='number' min='1' max='5' step='0.1' value={cfg.martingale}
                                                disabled={isRunning}
                                                onChange={e => updateCardCfg(card.id, { martingale: +e.target.value })} />
                                        </div>
                                    </div>

                                    {/* Per-card batch controls */}
                                    <div className={`st__batch-panel ${cfg.bulkEnabled ? 'active' : ''}`}>
                                        <div className='st__batch-header'>
                                            <div>
                                                        <strong>Bulk trade</strong>
                                                        <span>Open matching executions from one entry signal</span>
                                            </div>
                                            <button
                                                type='button'
                                                className={`st__batch-toggle ${cfg.bulkEnabled ? 'on' : ''}`}
                                                disabled={isRunning}
                                                aria-pressed={cfg.bulkEnabled}
                                                onClick={() => updateCardCfg(card.id, { bulkEnabled: !cfg.bulkEnabled })}
                                            >
                                                {cfg.bulkEnabled ? 'ON' : 'OFF'}
                                            </button>
                                        </div>
                                        {cfg.bulkEnabled && (
                                            <>
                                                <div className='st__batch-fields'>
                                                    <label>
                                                            Runs (editable)
                                                        <NumberField
                                                            value={cfg.bulkCount}
                                                            min={1}
                                                            max={100}
                                                            onCommit={n => updateCardCfg(card.id, { bulkCount: n })}
                                                            className='st__batch-count'
                                                        />
                                                    </label>
                                                    <div className='st__batch-total'>
                                                        <span>Total stake</span>
                                                        <strong>${(cfg.stake * Math.max(1, Math.min(100, Math.floor(cfg.bulkCount || 10)))).toFixed(2)}</strong>
                                                    </div>
                                                </div>
                                                <p className='st__batch-note'>
                                                    {Math.max(1, Math.min(100, Math.floor(cfg.bulkCount || 10)))} executions · ${cfg.stake.toFixed(2)} each · {cfg.ticks} tick{cfg.ticks === 1 ? '' : 's'}.
                                                    One signal sends all executions together with the same symbol, contract, barrier and exit duration. Total exposure is stake × runs.
                                                </p>
                                            </>
                                        )}
                                    </div>

                                    {/* Session stats */}
                                    {totalTrades > 0 && (
                                        <div className='st__sess-stats'>
                                            <span className='pos'>✓ {sess.wins}</span>
                                            <span className='neg'>✗ {sess.losses}</span>
                                            <span className={sess.profit >= 0 ? 'pos' : 'neg'}>{fmtProfit(sess.profit)}</span>
                                            <span className='rate'>{winRate}%</span>
                                        </div>
                                    )}

                                    {sess.lastLog && <div className='st__lastlog'>{sess.lastLog}</div>}

                                    {/* Run button */}
                                    <button
                                        className={`st__run-btn ${isRunning ? 'stop' : ''}`}
                                        disabled={!isRunning && (!connected || !authorized)}
                                        title={!connected || !authorized
                                            ? 'Log in to a demo or real account before starting'
                                            : undefined}
                                        onClick={() => toggleSmartCard(card.id, cfg)}
                                    >
                                        {isRunning ? '⏹ Stop Auto Trading' : '▶ Start Auto Trading'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Status bar */}
                    <div className='st__status-bar'>
                        {SMART_CARD_IDS.some(id => smartCardSess[id].running)
                            ? '● Bot is running…'
                            : '○ Bot is not running'}
                    </div>
                </div>
                );
            })()}

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

            {/* ── Speed Bot Tab ── */}
            {activeTab === 'speedbot' && (
                <div className='autotrades__speedbot'>
                    <div className='autotrades__speedbot-header'>
                        <span className='autotrades__speedbot-icon'>⚡</span>
                        <div>
                            <h2>Speed Bot</h2>
                            <p>Ultra-fast tick-based entry detection. Contrarian streaks, instant execution.</p>
                        </div>
                    </div>
                    <div className='autotrades__speedbot-info'>
                        <div className='autotrades__speedbot-card'>
                            <div className='autotrades__speedbot-card-icon'>🚀</div>
                            <strong>Turbo Mode</strong>
                            <span>Fire-and-forget zero-delay contracts on every detected streak entry.</span>
                        </div>
                        <div className='autotrades__speedbot-card'>
                            <div className='autotrades__speedbot-card-icon'>🎯</div>
                            <strong>Contrarian Entry</strong>
                            <span>Detects 3+ consecutive streak in one digit, trades the reversal.</span>
                        </div>
                        <div className='autotrades__speedbot-card'>
                            <div className='autotrades__speedbot-card-icon'>⚙️</div>
                            <strong>Scalper Engine</strong>
                            <span>Uses the full Scalper Bot engine — navigate to Speed Lab for full controls.</span>
                        </div>
                    </div>
                    <div className='autotrades__speedbot-cta'>
                        <p>For full Speed Bot controls including market selection, martingale, VPS mode, and take profit/stop loss — use the Speed Lab tab.</p>
                        <button className='autotrades__speedbot-btn'
                            onClick={() => {
                                // Navigate to the Speed Lab tab (DBOT_TABS.SPEEDLAB)
                                const store = (window as any).__store__;
                                store?.dashboard?.setActiveTab?.(4);
                            }}>
                            ⚡ Open Speed Lab
                        </button>
                    </div>
                </div>
            )}

            {/* ── Printer Tab ── */}
            {activeTab === 'printer' && (
                <div className='autotrades__printer'>
                    <div className='autotrades__printer-header'>
                        <span>🖨️</span>
                        <div>
                            <h2>Trade Printer</h2>
                            <p>Live trade log — print and export your trading session.</p>
                        </div>
                    </div>
                    <div className='autotrades__printer-stats'>
                        <div className='autotrades__printer-stat'>
                            <span>Total Stake</span>
                            <strong>${summaryStats.stake.toFixed(2)}</strong>
                        </div>
                        <div className='autotrades__printer-stat'>
                            <span>Total Payout</span>
                            <strong>${summaryStats.payout.toFixed(2)}</strong>
                        </div>
                        <div className='autotrades__printer-stat'>
                            <span>Contracts Won</span>
                            <strong className='pos'>{summaryStats.won}</strong>
                        </div>
                        <div className='autotrades__printer-stat'>
                            <span>Contracts Lost</span>
                            <strong className='neg'>{summaryStats.lost}</strong>
                        </div>
                        <div className='autotrades__printer-stat'>
                            <span>Total P/L</span>
                            <strong className={summaryStats.profit >= 0 ? 'pos' : 'neg'}>
                                {summaryStats.profit >= 0 ? '+' : ''}{summaryStats.profit.toFixed(2)}
                            </strong>
                        </div>
                        <div className='autotrades__printer-stat'>
                            <span>No. of Runs</span>
                            <strong>{summaryStats.runs}</strong>
                        </div>
                    </div>
                    <div className='autotrades__printer-log-wrap'>
                        <div className='autotrades__printer-log-hdr'>
                            <span>Trade Log</span>
                            <button onClick={() => {
                                setTransactions([]);
                                setJournal([]);
                                setSummaryStats({ stake: 0, payout: 0, runs: 0, won: 0, lost: 0, profit: 0 });
                            }} className='autotrades__printer-clear'>🗑 Clear</button>
                            <button onClick={() => {
                                const lines = transactions.map(t =>
                                     `${t.time}\t${t.symbol}\t${t.contract}\t${t.profit == null ? 'OPEN' : `${t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}`
                                     }`
                                ).join('\n');
                                const blob = new Blob([`Time\tSymbol\tContract\tP/L\n${lines}`], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a'); a.href = url; a.download = 'trades.txt'; a.click();
                            }} className='autotrades__printer-export'>⬇ Export</button>
                        </div>
                        <div className='autotrades__printer-log'>
                            {transactions.length === 0
                                ? <div className='autotrades__printer-empty'>No trades yet. Start a bot to see the log here.</div>
                                : transactions.slice(-50).reverse().map((t, i) => (
                                    <div key={i} className={`autotrades__printer-row ${t.profit >= 0 ? 'won' : 'lost'}`}>
                                        <span className='time'>{t.time}</span>
                                        <span className='sym'>{t.symbol}</span>
                                        <span className='ctype'>{t.contract}</span>
                                         <span className='pl'>{t.profit == null ? 'OPEN' : `${t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}`}</span>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            )}

            </div>{/* end .autotrades__main-col */}

            {/* ── Right summary panel (visible for Smart + AutoBots tabs) ── */}
            {(activeTab === 'smart' || activeTab === 'autobots') && (
                <div className='autotrades__summary-panel'>
                    <div className='autotrades__summary-tabs'>
                        {(['summary', 'transactions', 'journal'] as const).map(t => (
                            <button key={t}
                                className={`autotrades__summary-tab ${summaryTab === t ? 'active' : ''}`}
                                onClick={() => setSummaryTab(t)}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>

                    {summaryTab === 'summary' && (
                        <div className='autotrades__summary-body'>
                            {summaryStats.runs === 0 ? (
                                <div className='autotrades__summary-idle'>
                                    <div className='autotrades__summary-idle-icon'>📊</div>
                                    <p>When you're ready to trade, hit <strong>Run</strong>.</p>
                                    <p>You'll be able to track your bot's performance here.</p>
                                </div>
                            ) : (
                                <div className='autotrades__summary-stats'>
                                    <div className='autotrades__summary-stat'>
                                        <span>Total stake</span>
                                        <strong>${summaryStats.stake.toFixed(2)}</strong>
                                    </div>
                                    <div className='autotrades__summary-stat'>
                                        <span>Total payout</span>
                                        <strong>${summaryStats.payout.toFixed(2)}</strong>
                                    </div>
                                    <div className='autotrades__summary-stat'>
                                        <span>No. of runs</span>
                                        <strong>{summaryStats.runs}</strong>
                                    </div>
                                    <div className='autotrades__summary-stat'>
                                        <span>Contracts lost</span>
                                        <strong className='neg'>{summaryStats.lost}</strong>
                                    </div>
                                    <div className='autotrades__summary-stat'>
                                        <span>Contracts won</span>
                                        <strong className='pos'>{summaryStats.won}</strong>
                                    </div>
                                    <div className='autotrades__summary-stat'>
                                        <span>Total profit/loss</span>
                                        <strong className={summaryStats.profit >= 0 ? 'pos' : 'neg'}>
                                            {summaryStats.profit >= 0 ? '+' : ''}{summaryStats.profit.toFixed(2)} USD
                                        </strong>
                                    </div>
                                    <button className='autotrades__summary-reset'
                                        onClick={() => setSummaryStats({ stake: 0, payout: 0, runs: 0, won: 0, lost: 0, profit: 0 })}>
                                        ↺ Reset
                                    </button>
                                </div>
                            )}
                            <div className='autotrades__summary-whats'>
                                <button className='autotrades__summary-whats-btn'>What's this?</button>
                            </div>
                        </div>
                    )}

                    {summaryTab === 'transactions' && (
                        <div className='autotrades__summary-body'>
                            {transactions.length === 0 ? (
                                <div className='autotrades__summary-idle'>
                                    <div className='autotrades__summary-idle-icon'>📋</div>
                                    <p>No transactions yet.</p>
                                </div>
                            ) : (
                                <div className='autotrades__txn-list'>
                                    {transactions.slice(-30).reverse().map((t, i) => (
                                        <div key={i} className={`autotrades__txn-row ${t.profit >= 0 ? 'won' : 'lost'}`}>
                                            <div className='autotrades__txn-left'>
                                                <span className='autotrades__txn-sym'>{t.symbol}</span>
                                                <span className='autotrades__txn-type'>{t.contract}</span>
                                            </div>
                                            <div className='autotrades__txn-right'>
                                             <span className={`autotrades__txn-pl ${t.profit == null ? 'pending' : t.profit >= 0 ? 'pos' : 'neg'}`}>
                                                     {t.profit == null ? 'OPEN' : `${t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}`}
                                                </span>
                                                <span className='autotrades__txn-time'>{t.time}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {summaryTab === 'journal' && (
                        <div className='autotrades__summary-body'>
                            {journal.length === 0 ? (
                                <div className='autotrades__summary-idle'>
                                    <div className='autotrades__summary-idle-icon'>📓</div>
                                    <p>Journal is empty. Start trading to see logs.</p>
                                </div>
                            ) : (
                                <div className='autotrades__journal-list'>
                                    {journal.slice(-50).reverse().map((entry, i) => (
                                        <div key={i} className='autotrades__journal-entry'>{entry}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            </div>{/* end .autotrades__layout */}
        </div>
    );
};

export default AutoTrades;
