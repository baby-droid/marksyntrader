import { useCallback, useEffect, useRef, useState } from 'react';
import {
    api_base,
    load,
    save_types,
} from '@/external/bot-skeleton';
import { useDerivTrade, type TickData } from '@/hooks/useDerivTrade';
import { DBOT_TABS } from '@/constants/bot-contents';
import { getDisplayCurrency, subscribeCurrency, toUsd } from '@/utils/currency-display';
import { setTradeContext } from '@/utils/trade-metadata';
import {
    AUTO_SIGNAL_BOTS,
    patchAutoSignalsBotXml,
} from './bot-xml';
import {
    beginAutoSignalsRun,
    clearAutoSignalsRun,
    getAutoSignalsRunSession,
    setAutoSignalsRunMessage,
    subscribeAutoSignalsRunSession,
} from './auto-signals-run-session';
import { evaluateAutoSignalCandidates, shouldExcludeAutoSignalMarket } from './auto-signals-engine';
import type {
    AutoSignalAction,
    AutoSignalCandidate,
    AutoSignalFamily,
    AutoSignalMarket,
    AutoSignalsPageProps,
    AutoSignalsRun,
    AutoSignalsSettings,
} from './types';
import type { AutoLabTick } from '@/pages/auto-lab/auto-lab-engine';

const SETTINGS_KEY = 'auto_signals_settings_v1';
const HISTORY_COUNT = 1000;
const LIVE_TICK_STALE_MS = 8000;
const MIN_TICK_SIZE = 20;

const DEFAULT_SETTINGS: AutoSignalsSettings = {
    maxRuns: 1,
    stake1: 1,
    stake2: 2,
    takeProfit: 5,
    stopLoss: 10,
    martingale: 2,
};

type MarketInfo = Pick<AutoSignalMarket, 'symbol' | 'label' | 'market' | 'submarket'>;
type RawTick = { epoch: number; quote: number };
type MarketRuntime = {
    info: MarketInfo;
    rawTicks: Map<number, number>;
    ticks: AutoLabTick[];
    pipSize: number | null;
    lastTickAt: number | null;
    feedState: AutoSignalMarket['feedState'];
    candidate: AutoSignalCandidate | null;
    candidates: AutoSignalCandidate[];
    error?: string;
};

type RunPanelApi = {
    is_running?: boolean;
    onRunButtonClick?: () => void | Promise<void>;
    onStopButtonClick?: () => void;
    toggleDrawer?: (open: boolean) => void;
};

const readSettings = (): AutoSignalsSettings => {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
        if (!saved || typeof saved !== 'object') return DEFAULT_SETTINGS;
        return {
            maxRuns: Math.max(1, Math.min(10, Math.floor(Number(saved.maxRuns) || 1))),
            stake1: Math.max(0.01, Number(saved.stake1) || DEFAULT_SETTINGS.stake1),
            stake2: Math.max(0.01, Number(saved.stake2) || DEFAULT_SETTINGS.stake2),
            takeProfit: Math.max(0, Number(saved.takeProfit) || 0),
            stopLoss: Math.max(0, Number(saved.stopLoss) || 0),
            martingale: Math.max(1, Number(saved.martingale) || DEFAULT_SETTINGS.martingale),
        };
    } catch {
        return DEFAULT_SETTINGS;
    }
};

const digitFromQuote = (quote: number, pipSize: number) => {
    if (!Number.isFinite(quote) || !Number.isFinite(pipSize) || pipSize <= 0) return null;
    const places = Math.max(0, Math.min(10, (String(pipSize).split('.')[1] || '').length));
    const normalized = Number(quote).toFixed(places).replace('.', '');
    const digit = Number(normalized.slice(-1));
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

const marketSnapshot = (runtime: MarketRuntime, now: number): AutoSignalMarket => {
    const ticks = runtime.ticks;
    const latest = ticks[ticks.length - 1];
    const live = runtime.lastTickAt != null && now - runtime.lastTickAt <= LIVE_TICK_STALE_MS;
    const candidates = runtime.candidates.map((item) => {
        if (item.expiresAt != null && now >= item.expiresAt) {
            return { ...item, state: 'expired' as const, entryReady: false };
        }
        return !live ? { ...item, state: 'unavailable' as const, entryReady: false } : item;
    });
    const candidate = candidates.find((item) => item.id === runtime.candidate?.id) ?? candidates[0] ?? null;
    return {
        ...runtime.info,
        tickCount: ticks.length,
        latestDigit: latest?.digit ?? null,
        latestQuote: latest?.quote ?? null,
        updatedAt: runtime.lastTickAt,
        feedState: live ? 'live' : runtime.feedState === 'error' ? 'error' : runtime.lastTickAt ? 'stale' : runtime.feedState,
        candidate,
        candidates,
        availableContractTypes: [...new Set(candidates.map((item) => item.contractType))],
        error: runtime.error,
    };
};

const nextFrame = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

const rebuildRuntimeTicks = (runtime: MarketRuntime) => {
    if (!runtime.pipSize) {
        runtime.ticks = [];
        return;
    }
    const sorted = Array.from(runtime.rawTicks.entries())
        .sort(([left], [right]) => left - right)
        .slice(-HISTORY_COUNT);
    runtime.rawTicks = new Map(sorted);
    runtime.ticks = sorted.flatMap(([epoch, quote]) => {
        const digit = digitFromQuote(quote, runtime.pipSize!);
        return digit == null ? [] : [{
            symbol: runtime.info.symbol,
            epoch,
            quote,
            digit,
            pip_size: runtime.pipSize!,
        }];
    });
};

const appendLiveTick = (runtime: MarketRuntime, tick: TickData) => {
    const previousPipSize = runtime.pipSize;
    if (Number.isFinite(tick.pip_size) && tick.pip_size > 0) runtime.pipSize = tick.pip_size;
    if (!runtime.pipSize) return;

    const alreadySeen = runtime.rawTicks.has(tick.epoch);
    runtime.rawTicks.set(tick.epoch, tick.quote);
    const digit = digitFromQuote(tick.quote, runtime.pipSize);
    if (digit == null) return;

    const latestEpoch = runtime.ticks[runtime.ticks.length - 1]?.epoch ?? -Infinity;
    if (
        !alreadySeen
        && tick.epoch > latestEpoch
        && previousPipSize === runtime.pipSize
    ) {
        runtime.ticks.push({
            symbol: runtime.info.symbol,
            epoch: tick.epoch,
            quote: tick.quote,
            digit,
            pip_size: runtime.pipSize,
        });
        if (runtime.ticks.length > HISTORY_COUNT) {
            const removed = runtime.ticks.shift();
            if (removed) runtime.rawTicks.delete(removed.epoch);
        }
    } else {
        rebuildRuntimeTicks(runtime);
    }
};

const getBlocklyWorkspace = () => (window as any).Blockly?.derivWorkspace;

const waitForWorkspace = async () => {
    for (let attempt = 0; attempt < 300; attempt += 1) {
        const workspace = getBlocklyWorkspace();
        if (workspace) return workspace;
        await nextFrame();
    }
    throw new Error('Bot Builder workspace did not become ready.');
};

const accountAmount = (amount: number, currency: string, displayCurrency: string) => {
    if (currency && currency.toUpperCase() !== 'USD') return amount;
    return displayCurrency === 'KSH' ? toUsd(amount) : amount;
};

export const useAutoSignalsEngine = ({
    setActiveTab,
    runPanel,
}: {
    setActiveTab: (tab: number) => void;
    runPanel: RunPanelApi;
}): AutoSignalsPageProps => {
    const { connected, authorized, currency, send, subscribeTicks } = useDerivTrade();
    const [status, setStatus] = useState<AutoSignalsPageProps['status']>('idle');
    const [runSession, setRunSession] = useState(getAutoSignalsRunSession);
    const [message, setMessage] = useState(
        () => getAutoSignalsRunSession().message || 'Authorize the Deriv account to scan available synthetic markets.',
    );
    const [markets, setMarkets] = useState<AutoSignalMarket[]>([]);
    const [family, setFamily] = useState<AutoSignalFamily>('AUTO');
    const [settings, setSettings] = useState<AutoSignalsSettings>(readSettings);
    const activeRun = runSession.run;
    const [displayCurrency, setDisplayCurrency] = useState(getDisplayCurrency);
    const [refreshToken, setRefreshToken] = useState(0);
    const runtimesRef = useRef(new Map<string, MarketRuntime>());
    const unsubscribeRef = useRef<Array<() => void>>([]);
    const generationRef = useRef(0);
    const isPreparingRunRef = useRef(false);
    const flushFrameRef = useRef<number | null>(null);
    const dirtySymbolsRef = useRef(new Set<string>());
    const queueMarketRefresh = useCallback(() => {
        if (flushFrameRef.current != null) return;
        flushFrameRef.current = window.requestAnimationFrame(() => {
            flushFrameRef.current = null;
            const now = Date.now();
            const snapshot = Array.from(runtimesRef.current.values()).map((runtime) => {
                if (dirtySymbolsRef.current.delete(runtime.info.symbol)) {
                    runtime.candidates = runtime.ticks.length >= MIN_TICK_SIZE
                        ? evaluateAutoSignalCandidates({
                            market: runtime.info,
                            ticks: runtime.ticks,
                            family: 'AUTO',
                            previous: runtime.candidate,
                            now,
                        })
                        : [];
                    runtime.candidate = runtime.candidates[0] ?? null;
                }
                return marketSnapshot(runtime, now);
            });
            setMarkets(snapshot);
        });
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeCurrency(() => setDisplayCurrency(getDisplayCurrency()));
        return unsubscribe;
    }, []);

    useEffect(() => subscribeAutoSignalsRunSession((nextSession) => {
        setRunSession(nextSession);
        if (nextSession.message) setMessage(nextSession.message);
    }), []);

    useEffect(() => {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch {
            // Settings remain usable for this session when browser storage is disabled.
        }
    }, [settings]);

    useEffect(() => {
        const interval = window.setInterval(queueMarketRefresh, 1000);
        return () => window.clearInterval(interval);
    }, [queueMarketRefresh]);

    useEffect(() => {
        if (!connected || !authorized) {
            setStatus('idle');
            setMessage(connected
                ? 'Authorize the Deriv account to scan available synthetic markets.'
                : 'Connect a Deriv account to start the authenticated scan.');
            setMarkets([]);
            return;
        }

        const generation = ++generationRef.current;
        let cancelled = false;
        setStatus('loading');
        setMessage('Loading open synthetic markets and attaching authenticated tick feeds…');

        const detachFeeds = () => {
            unsubscribeRef.current.forEach((unsubscribe) => unsubscribe());
            unsubscribeRef.current = [];
            runtimesRef.current.clear();
        };

        const loadMarkets = async () => {
            try {
                const response: any = await send({ active_symbols: 'full' });
                if (cancelled || generation !== generationRef.current) return;
                if (response?.error) throw new Error(response.error.message || 'Deriv rejected the market list request.');
                const source = Array.isArray(response?.active_symbols) ? response.active_symbols : [];
                const supported = source.filter((item: any) => {
                    const symbol = String(item?.symbol || item?.underlying_symbol || '').trim();
                    return symbol && !shouldExcludeAutoSignalMarket({ ...item, symbol });
                });
                if (!supported.length) {
                    setMarkets([]);
                    setStatus('scanning');
                    setMessage('No open synthetic markets are available for this account.');
                    return;
                }

                const runtimes = supported.map((item: any) => {
                    const symbol = String(item.symbol || item.underlying_symbol).trim();
                    const info: MarketInfo = {
                        symbol,
                        label: String(item.display_name || item.underlying_symbol_name || symbol),
                        market: String(item.market),
                        submarket: String(item.submarket || 'random_index'),
                    };
                         const runtime: MarketRuntime = {
                        info,
                        rawTicks: new Map(),
                        ticks: [],
                        pipSize: null,
                        lastTickAt: null,
                        feedState: 'loading',
                        candidate: null,
                            candidates: [],
                    };
                    runtimesRef.current.set(symbol, runtime);
                    return runtime;
                });

                setMarkets(runtimes.map((runtime) => ({
                    ...runtime.info,
                    tickCount: 0,
                    latestDigit: null,
                    latestQuote: null,
                    updatedAt: null,
                    feedState: 'loading',
                    candidate: null,
                    availableContractTypes: [],
                    candidates: [],
                })));

                for (const runtime of runtimes) {
                    const unsubscribe = subscribeTicks(runtime.info.symbol, (tick: TickData) => {
                        if (cancelled || generation !== generationRef.current) return;
                        if (!Number.isFinite(tick.epoch) || !Number.isFinite(tick.quote)) return;
                        appendLiveTick(runtime, tick);
                        if (!runtime.pipSize || !runtime.ticks.length) return;
                        runtime.lastTickAt = Date.now();
                        runtime.feedState = 'live';
                        runtime.error = undefined;
                        dirtySymbolsRef.current.add(runtime.info.symbol);
                        queueMarketRefresh();
                    });
                    unsubscribeRef.current.push(unsubscribe);
                }

                setStatus('scanning');
                setMessage(`Live authenticated scan on ${runtimes.length} open synthetic markets; Jump 100 is excluded.`);
                queueMarketRefresh();

                let cursor = 0;
                const loadHistoryWorker = async () => {
                    while (!cancelled && generation === generationRef.current) {
                        const index = cursor;
                        cursor += 1;
                        if (index >= runtimes.length) return;
                        const runtime = runtimes[index];
                        try {
                            const historyResponse: any = await send({
                                ticks_history: runtime.info.symbol,
                                count: HISTORY_COUNT,
                                end: 'latest',
                                style: 'ticks',
                            });
                            if (cancelled || generation !== generationRef.current) return;
                            if (historyResponse?.error) throw new Error(historyResponse.error.message || 'History request failed.');
                            const prices: unknown[] = historyResponse?.history?.prices ?? [];
                            const times: unknown[] = historyResponse?.history?.times ?? [];
                            for (let item = 0; item < Math.min(prices.length, times.length); item += 1) {
                                const epoch = Number(times[item]);
                                const quote = Number(prices[item]);
                                if (Number.isFinite(epoch) && Number.isFinite(quote)) {
                                    runtime.rawTicks.set(epoch, quote);
                                }
                            }
                            if (runtime.pipSize) rebuildRuntimeTicks(runtime);
                            dirtySymbolsRef.current.add(runtime.info.symbol);
                            queueMarketRefresh();
                        } catch (error: any) {
                            if (cancelled || generation !== generationRef.current) return;
                            runtime.error = error?.message || 'Could not load recent tick history.';
                            if (!runtime.lastTickAt) runtime.feedState = 'error';
                            queueMarketRefresh();
                        }
                    }
                };
                await Promise.all(Array.from(
                    { length: Math.min(4, runtimes.length) },
                    () => loadHistoryWorker(),
                ));
            } catch (error: any) {
                if (cancelled || generation !== generationRef.current) return;
                detachFeeds();
                setStatus('error');
                setMessage(error?.message || 'Could not load the authenticated synthetic-market list.');
            }
        };

        detachFeeds();
        void loadMarkets();
        return () => {
            cancelled = true;
            generationRef.current += 1;
            detachFeeds();
            dirtySymbolsRef.current.clear();
            if (flushFrameRef.current != null) {
                window.cancelAnimationFrame(flushFrameRef.current);
                flushFrameRef.current = null;
            }
        };
    }, [authorized, connected, queueMarketRefresh, refreshToken, send, subscribeTicks]);

    const onFamilyChange = useCallback((nextFamily: AutoSignalFamily) => {
        setFamily(nextFamily);
    }, []);

    const onSettingsChange = useCallback(<K extends keyof AutoSignalsSettings>(
        key: K,
        value: AutoSignalsSettings[K],
    ) => {
        setSettings((current) => ({ ...current, [key]: value }));
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshToken((current) => current + 1);
    }, []);

    const onTrade = useCallback(async (market: AutoSignalMarket, action: AutoSignalAction) => {
        if (isPreparingRunRef.current) return;
        if (runPanel.is_running || getAutoSignalsRunSession().run) {
            setMessage('A Bot Builder run is already active. Stop it in Bot Builder before starting another.');
            return;
        }

        const runtime = runtimesRef.current.get(market.symbol);
        const candidate = market.candidate;
        const now = Date.now();
        const live = runtime?.lastTickAt != null && now - runtime.lastTickAt <= LIVE_TICK_STALE_MS;
        const latestCandidate = runtime?.candidates.find((item) => item.id === candidate?.id);
        if (!runtime || !candidate || !latestCandidate || latestCandidate.id !== candidate.id || !live
            || candidate.expiresAt == null || candidate.expiresAt <= now) {
            setMessage('That signal is no longer current. Wait for the authenticated feed to rescan it.');
            queueMarketRefresh();
            return;
        }
        if (!api_base.api || !authorized) {
            setMessage('Authorize the Deriv account before loading a trading bot.');
            return;
        }

        isPreparingRunRef.current = true;
        const bot = AUTO_SIGNAL_BOTS[action];
        try {
            setMessage(`Preparing ${bot.name} for ${market.label}…`);
            const response = await fetch(bot.file);
            if (!response.ok) throw new Error(`Could not load ${bot.name} (${response.status}).`);
            const template = await response.text();
            const accountAmounts = {
                stake1: accountAmount(settings.stake1, currency, displayCurrency),
                stake2: accountAmount(settings.stake2, currency, displayCurrency),
                takeProfit: accountAmount(settings.takeProfit, currency, displayCurrency),
                stopLoss: accountAmount(settings.stopLoss, currency, displayCurrency),
            };
            const configuredXml = patchAutoSignalsBotXml(template, {
                action,
                market,
                candidate,
                settings,
                accountAmounts,
            });

            setTradeContext({ page: 'Auto-Signals', bot: bot.name });
            (window as any).__pendingBotXml = configuredXml;
            (window as any).__pendingBotName = bot.name;
            setActiveTab(DBOT_TABS.BOT_BUILDER);
            runPanel.toggleDrawer?.(true);
            const workspace = await waitForWorkspace();
            if (runPanel.is_running) throw new Error('Stop the currently running Bot Builder bot before loading another.');
            await load({
                block_string: configuredXml,
                drop_event: null,
                file_name: bot.name,
                strategy_id: `auto-signals-${action}`,
                from: save_types.LOCAL,
                workspace,
                showIncompatibleStrategyDialog: false,
                show_snackbar: false,
            });
            workspace.strategy_to_load = configuredXml;
            setActiveTab(DBOT_TABS.BOT_BUILDER);

            const latestRuntime = runtimesRef.current.get(market.symbol);
            const latestCandidate = latestRuntime?.candidates.find((item) => item.id === candidate.id);
            const latestTickIsLive = latestRuntime?.lastTickAt != null
                && Date.now() - latestRuntime.lastTickAt <= LIVE_TICK_STALE_MS;
            if (!latestCandidate || latestCandidate.id !== candidate.id || !latestTickIsLive
                || latestCandidate.expiresAt == null || latestCandidate.expiresAt <= Date.now()) {
                throw new Error('The signal changed while the bot was loading. Return to Auto-Signals and choose the latest signal.');
            }

            const nextRun: AutoSignalsRun = {
                symbol: market.symbol,
                action,
                strategy: candidate.strategy,
                startedAt: Date.now(),
                maxRuns: settings.maxRuns,
                completedRuns: 0,
            };
            beginAutoSignalsRun(nextRun, `${bot.name} is starting on ${market.symbol} in Bot Builder.`);

            if (!runPanel.onRunButtonClick) throw new Error('Bot Builder Run control is unavailable.');
            const startAttempt = runPanel.onRunButtonClick();
            // RunPanel sets is_running synchronously when shouldRunBot() accepts
            // the workspace. Capture that before awaiting: a one-tick contract
            // can settle and stop the bot before the promise continuation runs.
            const startedSynchronously = Boolean(runPanel.is_running);
            await startAttempt;
            if (!startedSynchronously && !runPanel.is_running) {
                throw new Error('Bot Builder did not start this bot. Check the selected account and bot trade settings.');
            }
            const currentSession = getAutoSignalsRunSession();
            if (currentSession.run?.startedAt === nextRun.startedAt) {
                const runMessage = action === 'entry-trade' && !candidate.entryReady
                    ? `${bot.name} is watching for its entry condition on ${market.symbol}.`
                    : `${bot.name} is trading ${market.symbol} with one-tick contracts.`;
                setMessage(runMessage);
                setAutoSignalsRunMessage(runMessage);
            } else {
                setMessage(currentSession.message || `${bot.name} started on ${market.symbol}.`);
            }
        } catch (error: any) {
            const errorMessage = error?.message || 'The Bot Builder handoff failed.';
            clearAutoSignalsRun(errorMessage);
            setMessage(errorMessage);
            setActiveTab(DBOT_TABS.AUTO_SIGNALS);
        } finally {
            isPreparingRunRef.current = false;
        }
    }, [
        authorized,
        currency,
        displayCurrency,
        queueMarketRefresh,
        runPanel,
        setActiveTab,
        settings,
    ]);

    const displayCode = currency && currency.toUpperCase() !== 'USD'
        ? currency
        : displayCurrency;

    return {
        connected,
        authorized,
        status,
        message,
        markets,
        family,
        settings,
        currency: currency || 'USD',
        displayCurrency: displayCode,
        activeRun,
        onFamilyChange,
        onSettingsChange,
        onRefresh,
        onTrade,
    };
};

