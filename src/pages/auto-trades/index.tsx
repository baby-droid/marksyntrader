// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { api_base } from '@/external/bot-skeleton';
import {
    CONNECTION_STATUS,
    connectionStatus$,
} from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { isFastExecutionEnabled } from '@/utils/execution-speed';
import NumberField from '@/components/number-field';
import { setTradeContext } from '@/utils/trade-metadata';
import {
    beginSmartRun,
    invalidateSmartRun,
    isSmartRunActive,
    isSmartRunCurrent,
    normalizeSmartBarrier,
    pickSmartTradeDecision,
    type SmartCardConfig,
    type SmartCardId,
} from './smart-trading-guards';
import {
    AUTO_BOT_MARKETS,
    AUTO_BOT_TICK_DURATION,
    getFreshAutoBotMarkets,
    isAutoBotMarketStopped,
    scanAutoBotMarkets,
    selectAutoBotMarketsForExecution,
    useAuthenticatedAutoBotScanner,
    type AutoBotMarketCandidate,
    type AutoBotMarketSnapshot,
} from './auto-bot-scanner';
import './auto-trades.scss';

// ── Helpers ──────────────────────────────────────────────────────────────────
const SCANNER_SMART_CARD_IDS = new Set<SmartCardId>([
    'rise',
    'fall',
    'risefallbias',
    'oddbias',
    'evenbias',
]);

function scanSmartCardMarkets(
    id: SmartCardId,
    snapshots: Record<string, AutoBotMarketSnapshot>,
    cfg: SmartCardConfig,
    depth: number,
): AutoBotMarketCandidate[] {
    return Object.values(snapshots)
        .filter(snapshot => snapshot.ready && snapshot.digits.length >= 20)
        .map(snapshot => {
            const decision = pickSmartTradeDecision(id, snapshot.digits, cfg, depth);
            const score = Math.max(0, Math.min(100, Number(decision.score ?? 0)));
            return {
                symbol: snapshot.symbol,
                label: snapshot.label,
                digits: snapshot.digits,
                trade: {
                    contract: decision.contract,
                    barrier: decision.barrier,
                    shouldTrade: decision.meetsCondition,
                    signal: decision.meetsCondition ? 'strong' as const : undefined,
                },
                score,
                qualifies: decision.meetsCondition,
                tickVersion: snapshot.tickVersion,
                livePrice: snapshot.livePrice,
                ticks: AUTO_BOT_TICK_DURATION,
            };
        })
        .sort((left, right) => right.score - left.score);
}

function fmtProfit(v: number) {
    return (v >= 0 ? '+' : '') + v.toFixed(2);
}

function extractDigit(quote: any, pipSize: number): number {
    return parseInt(Number(quote).toFixed(pipSize).slice(-1), 10);
}
function describeTradeError(error: unknown): string {
    if (!error) return 'Trade request failed';
    if (typeof error === 'string') return error;
    const candidate = error as { message?: unknown; code?: unknown };
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    const code = typeof candidate.code === 'string' ? candidate.code : '';
    return [code, message].filter(Boolean).join(': ') || 'Trade request failed';
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
                    // A missing settlement update is not a loss. The native
                    // transaction bridge continues listening and will update
                    // the Bot Builder row when Deriv settles the contract.
                    resolve(Number.NaN);
                }
            }, 30_000);
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
type CycleParity = 'odd' | 'even';

interface CycleBotConfig {
    weakEntry: number;
    strongEntry: number;
    martingale: number;
    takeProfit: number;
    stopLoss: number;
    ticks: 1 | 2 | 3 | 4;
}

interface CycleBotDef {
    targetParity: CycleParity;
    defaultWeakEntry: number;
    defaultStrongEntry: number;
}

interface AiTrade {
    contract: string;
    barrier: number | null;
    shouldTrade?: boolean;
    signal?: 'weak' | 'strong';
}

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
    cycle?: CycleBotDef;
    pickTrade: (digits: number[], recoveryMode?: boolean, cycleConfig?: CycleBotConfig) => AiTrade;
}

function normalizeCycleEntry(value: unknown, parity: CycleParity, fallback: number): number {
    const parsed = Number(value);
    const safe = Number.isFinite(parsed) ? Math.max(0, Math.min(9, Math.floor(parsed))) : fallback;
    if (safe % 2 === (parity === 'even' ? 0 : 1)) return safe;
    return Math.max(0, Math.min(9, safe + (safe < 9 ? 1 : -1)));
}

function pickParityCycleTrade(
    digits: number[],
    targetParity: CycleParity,
    config: CycleBotConfig,
): AiTrade {
    const targetIsEven = targetParity === 'even';
    const weakEntry = normalizeCycleEntry(config.weakEntry, targetIsEven ? 'odd' : 'even', targetIsEven ? 1 : 0);
    const strongEntry = normalizeCycleEntry(config.strongEntry, targetIsEven ? 'odd' : 'even', targetIsEven ? 3 : 2);
    const last = digits[digits.length - 1];
    const strongPattern = digits.length >= 3
        && digits[digits.length - 3] === strongEntry
        && digits[digits.length - 2] === strongEntry
        && ((last % 2 === 0) === targetIsEven);
    const weakPattern = last === weakEntry;

    return {
        contract: targetIsEven ? 'DIGITEVEN' : 'DIGITODD',
        barrier: null,
        shouldTrade: strongPattern || weakPattern,
        signal: strongPattern ? 'strong' : weakPattern ? 'weak' : undefined,
    };
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
    {
        id: 'odd-auto-cycle',
        name: 'ODD AUTO CYCLE',
        subtitle: 'Weak Even → Odd · Strong Even ×2 → Odd',
        icon: '🔴',
        desc: 'Buys Odd after the selected weak Even digit, or after two selected Strong Even digits followed by an Odd digit.',
        symbol: '1HZ10V',
        defaultStake: 1.0,
        defaultMartingale: 2.0,
        defaultTakeProfit: 5,
        defaultStopLoss: 10,
        cycle: { targetParity: 'odd', defaultWeakEntry: 0, defaultStrongEntry: 2 },
        pickTrade: (digits, _recoveryMode, config) =>
            pickParityCycleTrade(digits, 'odd', config || {
                weakEntry: 0, strongEntry: 2, martingale: 2, takeProfit: 5, stopLoss: 10,
            }),
    },
    {
        id: 'even-auto-cycle',
        name: 'EVEN AUTO CYCLE',
        subtitle: 'Weak Odd → Even · Strong Odd ×2 → Even',
        icon: '🔵',
        desc: 'Buys Even after the selected weak Odd digit, or after two selected Strong Odd digits followed by an Even digit.',
        symbol: '1HZ10V',
        defaultStake: 1.0,
        defaultMartingale: 2.0,
        defaultTakeProfit: 5,
        defaultStopLoss: 10,
        cycle: { targetParity: 'even', defaultWeakEntry: 1, defaultStrongEntry: 3 },
        pickTrade: (digits, _recoveryMode, config) =>
            pickParityCycleTrade(digits, 'even', config || {
                weakEntry: 1, strongEntry: 3, martingale: 2, takeProfit: 5, stopLoss: 10,
            }),
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
    scannerSnapshots: Record<string, AutoBotMarketSnapshot>;
    scannerTickVersion: number;
    onSessionUpdate: (patch: Partial<BotSession>) => void;
    onLog: (msg: string) => void;
}

interface MarketRiskConfig {
    takeProfit: number;
    stopLoss: number;
}

interface MarketRiskStatus {
    wins: number;
    losses: number;
    profit: number;
    stopped: boolean;
}

function AiBotCard({
    bot,
    globalStake,
    globalMartingale,
    session,
    scannerSnapshots,
    scannerTickVersion,
    onSessionUpdate,
    onLog,
}: AiBotRunnerProps) {
    const isCycleBot = Boolean(bot.cycle);
    const marketCandidatesRef = useRef<AutoBotMarketCandidate[]>([]);
    const scannerTickVersionRef = useRef(scannerTickVersion);
    const runVersionRef = useRef(0);
    useEffect(() => { scannerTickVersionRef.current = scannerTickVersion; }, [scannerTickVersion]);
    const stopRef = useRef(false);
    const pausedStakeRef = useRef<number | null>(null); // for resume-with-martingale
    const { buyAndWait } = useBuyAndWait();
    const [marketRiskConfig, setMarketRiskConfig] = useState<Record<string, MarketRiskConfig>>({});
    const [marketRiskStatus, setMarketRiskStatus] = useState<Record<string, MarketRiskStatus>>({});
    const marketRiskConfigRef = useRef<Record<string, MarketRiskConfig>>({});
    const [cycleConfig, setCycleConfig] = useState<CycleBotConfig>(() => ({
        weakEntry: bot.cycle?.defaultWeakEntry ?? 0,
        strongEntry: bot.cycle?.defaultStrongEntry ?? 2,
        martingale: bot.defaultMartingale,
        takeProfit: bot.defaultTakeProfit,
        stopLoss: bot.defaultStopLoss,
        ticks: 1,
    }));
    const [riskConfig, setRiskConfig] = useState({
        takeProfit: bot.defaultTakeProfit,
        stopLoss: bot.defaultStopLoss,
        ticks: 1 as 1 | 2 | 3 | 4,
    });
    useEffect(() => {
        marketRiskConfigRef.current = marketRiskConfig;
    }, [marketRiskConfig]);
    const marketCandidates = useMemo(
        () => scanAutoBotMarkets(
            bot,
            scannerSnapshots,
            false,
            isCycleBot ? cycleConfig : undefined,
        ),
        [bot, scannerSnapshots, isCycleBot, cycleConfig],
    );
    const visibleMarketCandidates = marketCandidates.slice(0, 4);
    const qualifyingMarketCount = marketCandidates.filter(candidate => candidate.qualifies).length;
    useEffect(() => { marketCandidatesRef.current = marketCandidates; }, [marketCandidates]);
    const defaultMarketRisk: MarketRiskConfig = {
        takeProfit: isCycleBot ? cycleConfig.takeProfit : riskConfig.takeProfit,
        stopLoss: isCycleBot ? cycleConfig.stopLoss : riskConfig.stopLoss,
    };
    const getMarketRisk = useCallback((symbol: string): MarketRiskConfig =>
        marketRiskConfig[symbol] ?? defaultMarketRisk, [marketRiskConfig, defaultMarketRisk.takeProfit, defaultMarketRisk.stopLoss]);
    const updateMarketRisk = useCallback((symbol: string, patch: Partial<MarketRiskConfig>) => {
        setMarketRiskConfig(previous => ({
            ...previous,
            [symbol]: {
                ...(previous[symbol] ?? defaultMarketRisk),
                ...patch,
            },
        }));
    }, [defaultMarketRisk.takeProfit, defaultMarketRisk.stopLoss]);
    const updateCycleConfig = useCallback((patch: Partial<CycleBotConfig>) => {
        setCycleConfig(previous => {
            const next = { ...previous, ...patch };
            const entryParity = bot.cycle?.targetParity === 'odd' ? 'even' : 'odd';
            return {
                ...next,
                weakEntry: normalizeCycleEntry(next.weakEntry, entryParity, previous.weakEntry),
                strongEntry: normalizeCycleEntry(next.strongEntry, entryParity, previous.strongEntry),
                martingale: Number.isFinite(Number(next.martingale))
                    ? Math.max(1, Math.min(5, Number(next.martingale)))
                    : previous.martingale,
                takeProfit: Number.isFinite(Number(next.takeProfit))
                    ? Math.max(0.01, Math.min(100000, Number(next.takeProfit)))
                    : previous.takeProfit,
                stopLoss: Number.isFinite(Number(next.stopLoss))
                    ? Math.max(0.01, Math.min(100000, Number(next.stopLoss)))
                    : previous.stopLoss,
                ticks: 1,
            };
        });
    }, [bot.cycle?.targetParity]);

    const start = useCallback(async (resumeStake?: number) => {
        setTradeContext({ page: 'Auto Trades', bot: bot.name });
        const runVersion = runVersionRef.current + 1;
        runVersionRef.current = runVersion;
        stopRef.current = false;
        const isCurrentRun = () => runVersionRef.current === runVersion && !stopRef.current;
        let localWins = 0;
        let localLosses = 0;
        let localProfit = 0;
        onSessionUpdate({ active: true, wins: 0, losses: 0, profit: 0 });

        const martingale = isCycleBot ? cycleConfig.martingale : globalMartingale;
        const tp = isCycleBot
            ? cycleConfig.takeProfit
            : riskConfig.takeProfit;
        const sl = isCycleBot
            ? cycleConfig.stopLoss
            : riskConfig.stopLoss;
        let stk = resumeStake ?? globalStake; // resume with saved stake (martingale preserved)
        let recoveryMode = false;
        let lastScanKey = '';
        const lastEvaluatedTickByMarket = new Map<string, number>();
        const marketProfitBySymbol = new Map<string, number>();
        const marketWinsBySymbol = new Map<string, number>();
        const marketLossesBySymbol = new Map<string, number>();
        const stoppedMarkets = new Set<string>();
        setMarketRiskStatus({});
        onLog(`🚀 ${bot.name} started | Stake: $${stk.toFixed(2)} | Martingale:${martingale.toFixed(2)}× TP:$${tp.toFixed(2)} SL:$${sl.toFixed(2)}`);

        while (isCurrentRun()) {
            try {
                // The scanner subscribes to every supported authenticated
                // market in the background. A global version only wakes this
                // loop; each market still needs its own fresh tick before it
                // can be selected.
                while (isCurrentRun() && scannerTickVersionRef.current <= 0) {
                    await new Promise(r => setTimeout(r, isFastExecutionEnabled() ? 0 : 80));
                }
                while (isCurrentRun() && scannerTickVersionRef.current === Number(lastScanKey)) {
                    await new Promise(r => setTimeout(r, isFastExecutionEnabled() ? 0 : 80));
                }
                if (!isCurrentRun()) break;
                lastScanKey = String(scannerTickVersionRef.current);
                const freshMarkets = getFreshAutoBotMarkets(
                    marketCandidatesRef.current.filter(candidate => !stoppedMarkets.has(candidate.symbol)),
                    lastEvaluatedTickByMarket,
                );
                const candidates = selectAutoBotMarketsForExecution(freshMarkets);
                if (!candidates.length) continue;

                const results = await Promise.allSettled(candidates.map(candidate =>
                    buyAndWait(
                        candidate.symbol,
                        candidate.trade.contract,
                        candidate.trade.barrier,
                        stk,
                            AUTO_BOT_TICK_DURATION,
                        {
                            metadata: {
                                source: 'auto-bots',
                                scan_score: candidate.score,
                                scan_ticks: AUTO_BOT_TICK_DURATION,
                                scan_markets: candidates.length,
                                scan_qualified_markets: freshMarkets.length,
                            },
                        },
                    )
                ));

                for (let index = 0; index < results.length && isCurrentRun(); index++) {
                    const result = results[index];
                    const candidate = candidates[index];
                    if (result.status === 'rejected' || !Number.isFinite(result.value)) {
                        onLog(`⚠ ${candidate.label}: ${describeTradeError(result.status === 'rejected' ? result.reason : 'Settlement pending')}`);
                        continue;
                    }
                    const profit = result.value;
                    const won = profit > 0;
                    localProfit = +(localProfit + profit).toFixed(2);
                    if (won) localWins++; else localLosses++;
                    const marketProfit = +((marketProfitBySymbol.get(candidate.symbol) ?? 0) + profit).toFixed(2);
                    const marketWins = (marketWinsBySymbol.get(candidate.symbol) ?? 0) + (won ? 1 : 0);
                    const marketLosses = (marketLossesBySymbol.get(candidate.symbol) ?? 0) + (won ? 0 : 1);
                    marketProfitBySymbol.set(candidate.symbol, marketProfit);
                    marketWinsBySymbol.set(candidate.symbol, marketWins);
                    marketLossesBySymbol.set(candidate.symbol, marketLosses);
                    const marketRisk = marketRiskConfigRef.current[candidate.symbol] ?? { takeProfit: tp, stopLoss: sl };
                    const marketStopped = isAutoBotMarketStopped(marketProfit, marketRisk);
                    if (marketStopped) {
                        stoppedMarkets.add(candidate.symbol);
                        onLog(`⏹ ${candidate.label} risk limit reached · ${fmtProfit(marketProfit)}`);
                    }
                    setMarketRiskStatus(previous => ({
                        ...previous,
                        [candidate.symbol]: {
                            wins: marketWins,
                            losses: marketLosses,
                            profit: marketProfit,
                            stopped: marketStopped,
                        },
                    }));

                    onSessionUpdate({ wins: localWins, losses: localLosses, profit: localProfit });
                    const signalLabel = candidate.trade.signal ? ` · ${candidate.trade.signal.toUpperCase()} entry` : '';
                    onLog(`${won ? '✅' : '❌'} ${candidate.label} · ${AUTO_BOT_TICK_DURATION}t${signalLabel}: ${candidate.trade.contract}${candidate.trade.barrier !== null ? '@' + candidate.trade.barrier : ''} ${fmtProfit(profit)} | Total: ${fmtProfit(localProfit)}`);

                    if (bot.id === 'auto-o2u7') recoveryMode = !won;
                    if (won) {
                        stk = globalStake;
                        pausedStakeRef.current = null;
                    } else {
                        stk = Math.max(0.35, +(stk * martingale).toFixed(2));
                        pausedStakeRef.current = stk; // save for resume
                    }

                }
            } catch (err: any) {
                onLog(`⚠️ ${err?.message || 'Error'}`);
                await new Promise(r => setTimeout(r, isFastExecutionEnabled() ? 0 : 1500));
            }
        }

        if (runVersionRef.current === runVersion) {
            stopRef.current = false;
            onSessionUpdate({ active: false });
            onLog(`⏹ Stopped. Session P/L: ${fmtProfit(localProfit)}`);
        }
    }, [bot, globalStake, globalMartingale, cycleConfig, riskConfig, isCycleBot, buyAndWait, onLog, onSessionUpdate]);

    const toggle = useCallback(() => {
        if (session.active) {
            stopRef.current = true;
            runVersionRef.current += 1;
            onSessionUpdate({ active: false });
            onLog('⏹ Stop requested. Waiting for any open contract to settle safely.');
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
                <span>📡 {Object.keys(scannerSnapshots).length} markets scanned · {qualifyingMarketCount} ready</span>
                <span className='autotrades__botcard-market-status'>{scannerTickVersion > 0 ? 'Live scanner' : 'Loading scanner…'}</span>
            </div>
            <div className='autotrades__botcard-markets'>
                <div className='autotrades__botcard-markets-title'>
                    <span>Best markets · 1-tick execution</span>
                    <span>{visibleMarketCandidates.length ? `${visibleMarketCandidates.length} visible slots` : 'Waiting'}</span>
                </div>
                {visibleMarketCandidates.length ? (
                    <div className='autotrades__botcard-market-tape'>
                        <div className='autotrades__botcard-market-track'>
                            {[...visibleMarketCandidates, ...visibleMarketCandidates].map((candidate, index) => {
                                const isClone = index >= visibleMarketCandidates.length;
                                const status = marketRiskStatus[candidate.symbol];
                                return (
                                    <div className='autotrades__botcard-market-tile' key={`${candidate.symbol}-${index}`}>
                                        <div className='autotrades__botcard-market-tile-top'>
                                            <strong>{candidate.label}</strong>
                                            <span className={status?.stopped ? 'watch' : candidate.qualifies ? 'ready' : 'watch'}>
                                                {status?.stopped ? 'STOPPED' : candidate.qualifies ? (candidate.trade.signal === 'strong' ? 'STRONG' : 'READY') : 'WATCH'}
                                            </span>
                                        </div>
                                        <div className='autotrades__botcard-market-tile-price'>
                                            {candidate.livePrice == null ? '—' : candidate.livePrice}
                                        </div>
                                        <span className='autotrades__botcard-market-detail'>
                                            {candidate.score.toFixed(1)}% · 1t · {candidate.trade.contract}
                                            {candidate.trade.barrier !== null ? ` @${candidate.trade.barrier}` : ''}
                                            {status ? ` · ${fmtProfit(status.profit)}` : ''}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className='autotrades__botcard-markets-empty'>
                        Scanning authenticated Deriv markets in the background…
                    </div>
                )}
            </div>
            {bot.cycle && (
                <div className='autotrades__cycle-config'>
                    <div className='autotrades__cycle-config-title'>
                        {bot.cycle.targetParity === 'odd' ? 'Odd' : 'Even'} cycle entry points
                    </div>
                    <div className='autotrades__cycle-entry-grid'>
                        <label>
                            Weak {bot.cycle.targetParity === 'odd' ? 'Even' : 'Odd'}
                            <NumberField
                                value={cycleConfig.weakEntry}
                                min={bot.cycle.targetParity === 'odd' ? 0 : 1}
                                max={bot.cycle.targetParity === 'odd' ? 8 : 9}
                                disabled={session.active}
                                onCommit={value => updateCycleConfig({ weakEntry: value })}
                            />
                        </label>
                        <label>
                            Strong {bot.cycle.targetParity === 'odd' ? 'Even' : 'Odd'}
                            <NumberField
                                value={cycleConfig.strongEntry}
                                min={bot.cycle.targetParity === 'odd' ? 0 : 1}
                                max={bot.cycle.targetParity === 'odd' ? 8 : 9}
                                disabled={session.active}
                                onCommit={value => updateCycleConfig({ strongEntry: value })}
                            />
                        </label>
                    </div>
                    <div className='autotrades__cycle-entry-help'>
                        Weak: selected digit → buy {bot.cycle.targetParity}. Strong: selected digit ×2 → {bot.cycle.targetParity} → buy {bot.cycle.targetParity}.
                    </div>
                    <div className='autotrades__cycle-risk-grid'>
                        <label>
                            Martingale ×
                            <NumberField
                                value={cycleConfig.martingale}
                                min={1}
                                max={5}
                                disabled={session.active}
                                onCommit={value => updateCycleConfig({ martingale: value })}
                            />
                        </label>
                        <label>
                            Take profit $
                            <NumberField
                                value={cycleConfig.takeProfit}
                                min={0.01}
                                max={100000}
                                disabled={session.active}
                                onCommit={value => updateCycleConfig({ takeProfit: value })}
                            />
                        </label>
                        <label>
                            Stop loss $
                            <NumberField
                                value={cycleConfig.stopLoss}
                                min={0.01}
                                max={100000}
                                disabled={session.active}
                                onCommit={value => updateCycleConfig({ stopLoss: value })}
                            />
                        </label>
                        <label>
                            Trade duration
                            <NumberField
                                value={1}
                                min={1}
                                max={1}
                                disabled
                                onCommit={() => undefined}
                            />
                        </label>
                    </div>
                </div>
            )}
            {!bot.cycle && (
                <div className='autotrades__bot-risk-grid'>
                    <label>
                        Take profit $
                        <NumberField
                            value={riskConfig.takeProfit}
                            min={0.01}
                            max={100000}
                            disabled={session.active}
                            onCommit={value => setRiskConfig(previous => ({
                                ...previous,
                                takeProfit: Math.max(0.01, Math.min(100000, value)),
                            }))}
                        />
                    </label>
                    <label>
                        Stop loss $
                        <NumberField
                            value={riskConfig.stopLoss}
                            min={0.01}
                            max={100000}
                            disabled={session.active}
                            onCommit={value => setRiskConfig(previous => ({
                                ...previous,
                                stopLoss: Math.max(0.01, Math.min(100000, value)),
                            }))}
                        />
                    </label>
                    <div className='autotrades__bot-fixed-ticks'>
                        <span>Trade duration</span>
                        <strong>1 tick</strong>
                    </div>
                </div>
            )}
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
    const SMART_CARD_IDS: SmartCardId[] = ['rise', 'fall', 'risefallbias', 'oddbias', 'evenbias'];
    const CONDITION_OPTIONS: Record<SmartCardId, string[]> = {
        rise: ['Rise'],
        fall: ['Fall'],
        risefallbias: ['Flow Bias'],
        oddbias: ['Odd Bias'],
        evenbias: ['Even Bias'],
        risefall: ['Rise', 'Fall'],
        evenodd: ['Even', 'Odd'],
        overunder: ['Over', 'Under'],
        matchdiffer: ['Matches', 'Differs'],
    };
    const ACTION_OPTIONS: Record<SmartCardId, string[]> = {
        rise: ['Buy Rise'],
        fall: ['Buy Fall'],
        risefallbias: ['Auto Bias'],
        oddbias: ['Buy Odd'],
        evenbias: ['Buy Even'],
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
    const {
        snapshots: autoBotSnapshots,
        tickVersion: autoBotTickVersion,
        connected: autoBotScannerConnected,
    } = useAuthenticatedAutoBotScanner();
    const autoBotSnapshotsRef = useRef<Record<string, AutoBotMarketSnapshot>>(autoBotSnapshots);
    const autoBotTickVersionRef = useRef(autoBotTickVersion);
    useEffect(() => { autoBotSnapshotsRef.current = autoBotSnapshots; }, [autoBotSnapshots]);
    useEffect(() => { autoBotTickVersionRef.current = autoBotTickVersion; }, [autoBotTickVersion]);
    type SmartExecutionMode = 'normal' | 'eachTick' | 'superSpeed';
    const [smartExecutionMode, setSmartExecutionMode] = useState<SmartExecutionMode>('normal');
    const smartExecutionModeRef = useRef<SmartExecutionMode>('normal');
    useEffect(() => { smartExecutionModeRef.current = smartExecutionMode; }, [smartExecutionMode]);

    // Per-card config (editable params)
    const [smartCardCfg, setSmartCardCfg] = useState<Record<SmartCardId, SmartCardConfig>>({
        rise:         { stake: 5, ticks: 1, martingale: 1, barrier: 5, lookback: 3, ifValue: 'Rise',      thenAction: 'Buy Rise',  bulkEnabled: false, bulkCount: 10, takeProfit: 5, stopLoss: 10 },
        fall:         { stake: 5, ticks: 1, martingale: 1, barrier: 5, lookback: 3, ifValue: 'Fall',      thenAction: 'Buy Fall',  bulkEnabled: false, bulkCount: 10, takeProfit: 5, stopLoss: 10 },
        risefallbias: { stake: 5, ticks: 1, martingale: 1, barrier: 5, lookback: 3, ifValue: 'Flow Bias', thenAction: 'Auto Bias', bulkEnabled: false, bulkCount: 10, takeProfit: 5, stopLoss: 10 },
        oddbias:      { stake: 5, ticks: 1, martingale: 1, barrier: 5, lookback: 3, ifValue: 'Odd Bias',  thenAction: 'Buy Odd',   bulkEnabled: false, bulkCount: 10, takeProfit: 5, stopLoss: 10 },
        evenbias:     { stake: 5, ticks: 1, martingale: 1, barrier: 5, lookback: 3, ifValue: 'Even Bias', thenAction: 'Buy Even',  bulkEnabled: false, bulkCount: 10, takeProfit: 5, stopLoss: 10 },
    });
    const batchTradingEnabled = Object.values(smartCardCfg).some(cfg => cfg.bulkEnabled);
    const smartCardCfgRef = useRef(smartCardCfg);
    useEffect(() => { smartCardCfgRef.current = smartCardCfg; }, [smartCardCfg]);

    const updateCardCfg = useCallback((id: SmartCardId, patch: Partial<typeof smartCardCfg['risefall']>) => {
        const safePatch: any = { ...patch };
        if ('stake' in safePatch) {
            const value = Number(safePatch.stake);
            safePatch.stake = Number.isFinite(value) ? Math.max(0.35, Math.min(1000, value)) : 0.35;
        }
        if ('ticks' in safePatch) {
            const value = Number(safePatch.ticks);
            safePatch.ticks = Number.isFinite(value) ? Math.max(1, Math.min(10, Math.floor(value))) : 1;
        }
        if ('martingale' in safePatch) {
            const value = Number(safePatch.martingale);
            safePatch.martingale = Number.isFinite(value) ? Math.max(1, Math.min(5, value)) : 1;
        }
        if ('barrier' in safePatch) {
            const value = Number(safePatch.barrier);
            safePatch.barrier = Number.isFinite(value) ? Math.max(0, Math.min(9, Math.floor(value))) : 5;
        }
        if ('lookback' in safePatch) {
            const value = Number(safePatch.lookback);
            safePatch.lookback = Number.isFinite(value) ? Math.max(1, Math.min(10, Math.floor(value))) : 3;
        }
        if ('bulkCount' in safePatch) {
            const value = Number(safePatch.bulkCount);
            safePatch.bulkCount = Number.isFinite(value) ? Math.max(1, Math.min(100, Math.floor(value))) : 10;
        }
        if ('takeProfit' in safePatch || 'stopLoss' in safePatch) {
            for (const key of ['takeProfit', 'stopLoss']) {
                if (!(key in safePatch)) continue;
                const value = Number(safePatch[key]);
                safePatch[key] = Number.isFinite(value) ? Math.max(0.01, Math.min(100000, value)) : 0.01;
            }
        }
        setSmartCardCfg(prev => ({ ...prev, [id]: { ...prev[id], ...safePatch } }));
    }, []);

    // Per-card session (runtime state)
    const [smartCardSess, setSmartCardSess] = useState<Record<SmartCardId, {
        running: boolean; wins: number; losses: number; profit: number; lastLog: string;
    }>>({
        rise:         { running: false, wins: 0, losses: 0, profit: 0, lastLog: '' },
        fall:         { running: false, wins: 0, losses: 0, profit: 0, lastLog: '' },
        risefallbias: { running: false, wins: 0, losses: 0, profit: 0, lastLog: '' },
        oddbias:      { running: false, wins: 0, losses: 0, profit: 0, lastLog: '' },
        evenbias:     { running: false, wins: 0, losses: 0, profit: 0, lastLog: '' },
    });
    const smartStopFlags = useRef<Record<string, boolean>>({
        rise: false, fall: false, risefallbias: false, oddbias: false, evenbias: false,
    });
    // A stop/start can happen while proposal, buy, or settlement is awaiting
    // the authenticated socket. The token makes the old async loop stale
    // immediately, so it cannot clear the new run's stop flag or buy again.
    const smartRunTokens = useRef<Record<string, number>>({
        rise: 0, fall: 0, risefallbias: 0, oddbias: 0, evenbias: 0,
    });
    const smartCurrentStakes = useRef<Record<string, number>>({
        rise: 5, fall: 5, risefallbias: 5, oddbias: 5, evenbias: 5,
    });

    const toggleBulkMode = useCallback((id: SmartCardId) => {
        const enabling = !smartCardCfgRef.current[id].bulkEnabled;
        if (enabling) {
            // Bulk owns the execution surface. Stop any other smart-card loop
            // before enabling it and force the shared mode back to single
            // execution; the batch branch below is the only active path.
            SMART_CARD_IDS.forEach(otherId => {
                if (otherId !== id && smartCardSess[otherId].running) {
                    smartStopFlags.current[otherId] = true;
                }
            });
            setSmartExecutionMode('normal');
        }
        setSmartCardCfg(prev => {
            const next = { ...prev };
            SMART_CARD_IDS.forEach(cardId => {
                next[cardId] = {
                    ...next[cardId],
                    bulkEnabled: enabling ? cardId === id : cardId === id ? false : next[cardId].bulkEnabled,
                };
            });
            return next;
        });
    }, [smartCardSess]);

    const updateSess = useCallback((id: SmartCardId, patch: Partial<typeof smartCardSess['risefall']>) => {
        setSmartCardSess(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    }, []);

    // Start/stop a smart card bot
    const toggleSmartCard = useCallback((id: SmartCardId, configOverride?: SmartCardConfig) => {
        if (smartCardSess[id].running) {
            smartStopFlags.current[id] = true;
            invalidateSmartRun(smartRunTokens.current, id);
            updateSess(id, { running: false, lastLog: 'Stop requested. Waiting for open contract cleanup…' });
            return;
        }

        // Init run
        smartStopFlags.current[id] = false;
        const runToken = beginSmartRun(smartRunTokens.current, id);
        const isRunActive = () => isSmartRunActive(
            smartRunTokens.current,
            id,
            runToken,
            smartStopFlags.current[id],
        );
        // Use the config from the rendered card when available. This avoids a
        // one-render race where the Bulk toggle is visibly ON but the ref
        // effect has not copied that edit before Start is clicked.
        const cfg = configOverride || smartCardCfgRef.current[id];
        if (!cfg) return;
        // Make an immediate click use the same configuration snapshot as the
        // rendered card, even before React flushes the ref-sync effect.
        smartCardCfgRef.current[id] = cfg;
        setTradeContext({ page: 'Auto Trades', bot: `${id} Smart Trading` });
        smartCurrentStakes.current[id] = cfg.stake;
        updateSess(id, { running: true, wins: 0, losses: 0, profit: 0, lastLog: 'Starting…' });

        let wins = 0, losses = 0, sessionProfit = 0;
        const usesMarketScanner = SCANNER_SMART_CARD_IDS.has(id);
        let evaluatedTick = usesMarketScanner
            ? autoBotTickVersionRef.current - 1
            : smartTickVersionRef.current - 1;
        let waitUntilTick = 0;
        const lastEvaluatedTickByMarket = new Map<string, number>();

        const loop = async () => {
            while (isRunActive()) {
                let pendingTransactionIds: string[] = [];
                try {
                    if (!isRunActive()) break;
                    const mode = smartExecutionModeRef.current;
                    const activeBulkOwner = SMART_CARD_IDS.find(cardId =>
                        smartCardCfgRef.current[cardId].bulkEnabled
                    );
                    if (activeBulkOwner && activeBulkOwner !== id) {
                        // A bulk batch has exclusive ownership of execution.
                        // This second guard covers a card that was already
                        // inside its loop when Bulk Trade was enabled.
                        smartStopFlags.current[id] = true;
                        break;
                    }
                    const tickRef = usesMarketScanner ? autoBotTickVersionRef : smartTickVersionRef;
                    // Every card evaluates once per new authenticated tick.
                    // Scanner cards additionally use each market's own tick
                    // version, so a quiet market is not replayed because an
                    // unrelated market moved.
                    while (isRunActive() && tickRef.current <= Math.max(evaluatedTick, waitUntilTick)) {
                        await new Promise(r => setTimeout(r, 40));
                    }
                    if (!isRunActive()) break;
                    evaluatedTick = tickRef.current;

                    const currentCfg = smartCardCfgRef.current[id] || cfg;
                    if (sessionProfit >= Number(currentCfg.takeProfit ?? 5)
                        || sessionProfit <= -Number(currentCfg.stopLoss ?? 10)) {
                        updateSess(id, {
                            running: false,
                            lastLog: sessionProfit >= Number(currentCfg.takeProfit ?? 5)
                                ? `Take profit reached: ${fmtProfit(sessionProfit)}`
                                : `Stop loss reached: ${fmtProfit(sessionProfit)}`,
                        });
                        break;
                    }
                    const scannerCandidates = usesMarketScanner
                        ? selectAutoBotMarketsForExecution(
                            getFreshAutoBotMarkets(
                                scanSmartCardMarkets(
                                    id,
                                    autoBotSnapshotsRef.current,
                                    currentCfg,
                                    smartSharedDepthRef.current,
                                ),
                                lastEvaluatedTickByMarket,
                            ),
                        )
                        : [];
                    const trade = usesMarketScanner
                        ? scannerCandidates[0]?.trade
                        : pickSmartTradeDecision(id, smartDigitsRef.current, currentCfg, smartSharedDepthRef.current);
                    if (!trade || !trade.meetsCondition && !usesMarketScanner) {
                        // Conditions are tick-gated. Do not repeatedly buy while
                        // the same non-matching window is on screen.
                        continue;
                    }
                    if (usesMarketScanner && !scannerCandidates.length) continue;
                    if (!isRunActive()) break;
                    const { contract, barrier } = trade;
                    const stk = Number(smartCurrentStakes.current[id]);
                    const sym = smartSharedSymbolRef.current;
                    if ((!usesMarketScanner && !sym) || !Number.isFinite(stk) || stk < 0.35) {
                        throw new Error('Invalid symbol or stake');
                    }
                    const batchEnabled = Boolean(currentCfg.bulkEnabled);
                    // Snapshot the edited count for this signal. Changes made
                    // while this batch is settling apply only to the next
                    // batch, never halfway through the current one.
                    const batchCount = Math.max(1, Math.min(100, Math.floor(currentCfg.bulkCount || 10)));

                    const batchId = `BATCH-${id}-${Date.now()}-${wins + losses}`;
                    const transactionId = `${batchId}-ORDER-1`;
                    const transactionTime = new Date().toLocaleTimeString('en', { hour12: false });
                    const scannerOrderIds = usesMarketScanner
                        ? scannerCandidates.map((_, index) => `${batchId}-MARKET-${index + 1}`)
                        : [];
                    const batchTransactionIds = Array.from({ length: batchCount }, (_, index) =>
                        `${batchId}-ORDER-${index + 1}`
                    );
                    pendingTransactionIds = usesMarketScanner
                        ? scannerOrderIds
                        : batchEnabled ? batchTransactionIds : [transactionId];
                    setTransactions(prev => [
                        ...prev.slice(-(usesMarketScanner
                            ? Math.max(99, scannerCandidates.length * 2)
                            : batchEnabled ? Math.max(99, batchCount * 2) : 99)),
                        ...(usesMarketScanner
                            ? scannerCandidates.map((candidate, index) => ({
                                id: scannerOrderIds[index],
                                time: transactionTime,
                                contract: `${candidate.trade.contract}${candidate.trade.barrier !== null ? '@' + candidate.trade.barrier : ''}`,
                                profit: null,
                                symbol: candidate.symbol,
                                stake: stk,
                                status: 'open',
                                batchId,
                            }))
                            : batchEnabled
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
                        countStake = true,
                        resultContext: { symbol?: string; contract?: string; barrier?: number | null } = {},
                    ) => {
                        const won = profit > 0;
                        sessionProfit = +(sessionProfit + profit).toFixed(2);
                        if (won) wins++; else losses++;

                        const ts = new Date().toLocaleTimeString('en', { hour12: false });
                        const resultContract = resultContext.contract ?? contract;
                        const resultBarrier = resultContext.barrier ?? barrier;
                        const resultSymbol = resultContext.symbol ?? sym;
                        const logMsg = `${won ? '✅' : '❌'} ${resultSymbol} · ${resultContract}${resultBarrier !== null ? '@' + resultBarrier : ''} ${fmtProfit(profit)}`;
                        updateSess(id, { wins, losses, profit: sessionProfit, lastLog: logMsg });

                        setSummaryStats(prev => ({
                            stake: +(prev.stake + (countStake ? stk : 0)).toFixed(2),
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

                    if (usesMarketScanner) {
                        // Scanner cards trade every fresh eligible market in
                        // parallel. Each market gets its own one-tick
                        // proposal, buy, and settlement; one slow market must
                        // not block the others from being dispatched.
                        const scannerResults = await Promise.allSettled(
                            scannerCandidates.map((candidate, index) =>
                                buyAndWait(
                                    candidate.symbol,
                                    candidate.trade.contract,
                                    candidate.trade.barrier,
                                    stk,
                                    AUTO_BOT_TICK_DURATION,
                                    {
                                        metadata: {
                                            source: 'auto-trades',
                                            execution_mode: 'market-scan',
                                            batch_id: batchId,
                                            batch_index: index + 1,
                                            batch_size: scannerCandidates.length,
                                            scan_score: candidate.score,
                                        },
                                    },
                                )
                            )
                        );
                        let settled = 0;
                        let roundLoss = false;
                        scannerResults.forEach((result, index) => {
                            if (result.status !== 'fulfilled' || !Number.isFinite(result.value)) return;
                            settled++;
                            const candidate = scannerCandidates[index];
                            const profit = Number(result.value);
                            if (profit <= 0) roundLoss = true;
                            recordResult(
                                profit,
                                scannerOrderIds[index],
                                false,
                                undefined,
                                true,
                                {
                                    symbol: candidate.symbol,
                                    contract: candidate.trade.contract,
                                    barrier: candidate.trade.barrier,
                                },
                            );
                        });
                        if (settled > 0) {
                            smartCurrentStakes.current[id] = roundLoss
                                ? Math.max(0.35, +(stk * currentCfg.martingale).toFixed(2))
                                : currentCfg.stake;
                        }
                        if (settled < scannerCandidates.length) {
                            setJournal(prev => [
                                `[${new Date().toLocaleTimeString('en', { hour12: false })}] [${id}] ${settled}/${scannerCandidates.length} market settlements received; pending markets remain open`,
                                ...prev,
                            ].slice(0, 50));
                        }
                    } else if (batchEnabled) {
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
                                        // Bulk exposure is counted when each
                                        // authenticated buy succeeds, not when
                                        // only one settlement callback arrives.
                                        setSummaryStats(prev => ({
                                            ...prev,
                                            stake: +(prev.stake + stk).toFixed(2),
                                        }));
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
                                const profit = Number(result.value);
                                if (!Number.isFinite(profit)) {
                                    setTransactions(prev => prev.map(transaction =>
                                        transaction.id === orderId
                                            ? { ...transaction, status: 'open', contractId }
                                            : transaction
                                    ));
                                    return;
                                }
                                batchProfit = +(batchProfit + profit).toFixed(2);
                                if (profit > 0) batchWins++; else batchLosses++;
                                recordResult(profit, orderId, false, contractId, false);
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
                        // Do not progress the stake from a partial batch. A
                        // pending or failed order has no definitive outcome,
                        // so martingale is only allowed after every requested
                        // contract settled independently.
                        if (settledCount === batchCount) {
                            smartCurrentStakes.current[id] = batchProfit <= 0
                                ? Math.max(0.35, +(stk * currentCfg.martingale).toFixed(2))
                                : currentCfg.stake;
                        }
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
                        if (!isRunActive()) break;
                        if (Number.isFinite(profit)) {
                            recordResult(profit);
                        } else {
                            setJournal(prev => [
                                `[${new Date().toLocaleTimeString('en', { hour12: false })}] [${id}] ${batchId}: settlement pending; native transaction remains open`,
                                ...prev,
                            ].slice(0, 50));
                        }
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
                    // Scanner cards re-evaluate as soon as any market produces
                    // a new tick. The per-market freshness map above prevents
                    // unchanged markets from being replayed.
                    waitUntilTick = usesMarketScanner
                        ? evaluatedTick
                        : evaluatedTick + Math.max(1, Math.min(10, currentCfg.lookback || 3));
                } catch (error) {
                    // A proposal/buy failure is not a taken trade. Remove its
                    // optimistic OPEN row instead of leaving a phantom
                    // transaction in the Bot Builder-style history.
                    if (pendingTransactionIds.length) {
                        setTransactions(prev => prev.filter(transaction => !pendingTransactionIds.includes(transaction.id)));
                    }
                    if (isRunActive()) {
                        const message = describeTradeError(error);
                        setJournal(prev => [
                            `[${new Date().toLocaleTimeString('en', { hour12: false })}] [${id}] ${message}`,
                            ...prev,
                        ].slice(0, 50));
                        updateSess(id, { lastLog: `⚠ ${message}` });
                    }
                    await new Promise(r => setTimeout(r, isFastExecutionEnabled() ? 0 : 1500));
                }
            }
            if (isSmartRunCurrent(smartRunTokens.current, id, runToken)) {
                smartStopFlags.current[id] = false;
                setSmartCardSess(prev => ({
                    ...prev,
                    [id]: { ...prev[id], running: false, lastLog: `Stopped. P/L: ${fmtProfit(sessionProfit)}` },
                }));
            }
        };

        // Keep the runner fire-and-forget, but never leave an unexpected
        // exception as an unhandled promise rejection that can take down the
        // Smart Trading page.
        void loop().catch(error => {
            if (smartRunTokens.current[id] !== runToken) return;
            smartStopFlags.current[id] = true;
            const message = describeTradeError(error);
            updateSess(id, { running: false, lastLog: `⚠ ${message}` });
            setJournal(prev => [
                `[${new Date().toLocaleTimeString('en', { hour12: false })}] [${id}] ${message}`,
                ...prev,
            ].slice(0, 50));
        });
    }, [smartCardSess, buyAndWait, updateSess]);

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
                    { id: 'rise' as SmartCardId,         title: 'Rise',             icon: '📈' },
                    { id: 'fall' as SmartCardId,         title: 'Fall',             icon: '📉' },
                    { id: 'risefallbias' as SmartCardId, title: 'Rise/Fall Bias',   icon: '🌊' },
                    { id: 'oddbias' as SmartCardId,      title: 'Odd Bias',         icon: '🟣' },
                    { id: 'evenbias' as SmartCardId,     title: 'Even Bias',        icon: '🔵' },
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
                            <span className={`st__dot ${autoBotScannerConnected ? 'live' : ''}`} />
                            {autoBotScannerConnected
                                ? `${Object.keys(autoBotSnapshots).length} priority markets scanning · up to 5 fresh entries`
                                : 'Priority market scanner connecting…'}
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
                            if (card.id === 'rise' || card.id === 'fall' || card.id === 'risefallbias') {
                                labelA = 'Rise'; labelB = 'Fall';
                                probA = riseProb; probB = fallProb;
                                statA = riseProb.toFixed(2) + '%'; statB = fallProb.toFixed(2) + '%';
                            } else if (card.id === 'oddbias') {
                                labelA = 'Odd'; labelB = 'Even';
                                probA = oddProb; probB = evenProb;
                                statA = oddProb.toFixed(2) + '%'; statB = evenProb.toFixed(2) + '%';
                            } else {
                                labelA = 'Even'; labelB = 'Odd';
                                probA = evenProb; probB = oddProb;
                                statA = evenProb.toFixed(2) + '%'; statB = oddProb.toFixed(2) + '%';
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
                                    <div className='st__digit-pattern'>
                                            <div className='st__pattern-label'>Last Digits Pattern</div>
                                            <div className='st__pattern-dots'>
                                                {last10.map((d, i) => (
                                                    <span key={i} className={`st__pdot ${
                                                        (card.id === 'oddbias' || card.id === 'evenbias')
                                                            ? (d % 2 === 0 ? 'even' : 'odd')
                                                            : `d${d % 5}`
                                                    }`}>
                                                        {(card.id === 'oddbias' || card.id === 'evenbias') ? evenOddPattern[i] : d}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className='st__pattern-note'>
                                                {(card.id === 'oddbias' || card.id === 'evenbias')
                                                    ? `${last10.length ? evenOddPattern.join(' · ') : 'Waiting for ticks'}`
                                                    : `Flow: ${riseProb.toFixed(1)}% rise · ${fallProb.toFixed(1)}% fall`}
                                            </div>
                                            {(card.id === 'oddbias' || card.id === 'evenbias') && (
                                                <div className='st__streak-note'>
                                                    Current streak: <strong>{last10.length ? `${evenOddStreak} ${last10[last10.length - 1] % 2 === 0 ? 'Even' : 'Odd'}` : '—'}</strong>
                                                </div>
                                            )}
                                        </div>

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
                                                  {card.id === 'rise' || card.id === 'fall' || card.id === 'risefallbias'
                                                      ? 'market flow is'
                                                      : 'digits show'}
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
                                        </div>
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
                                        <div className='st__param st__param--risk'>
                                            <label>TP ($)</label>
                                            <input type='number' min='0.01' max='100000' step='0.01' value={cfg.takeProfit ?? 5}
                                                disabled={isRunning}
                                                onChange={e => updateCardCfg(card.id, { takeProfit: +e.target.value })} />
                                        </div>
                                        <div className='st__param st__param--risk'>
                                            <label>SL ($)</label>
                                            <input type='number' min='0.01' max='100000' step='0.01' value={cfg.stopLoss ?? 10}
                                                disabled={isRunning}
                                                onChange={e => updateCardCfg(card.id, { stopLoss: +e.target.value })} />
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
                                                onClick={() => toggleBulkMode(card.id)}
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
                                scannerSnapshots={autoBotSnapshots}
                                scannerTickVersion={autoBotTickVersion}
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
