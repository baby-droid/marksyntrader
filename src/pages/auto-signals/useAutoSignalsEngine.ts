import { useCallback, useEffect, useRef, useState } from 'react';
import { api_base, load, save_types } from '@/external/bot-skeleton';
import { useDerivTrade, type TickData } from '@/hooks/useDerivTrade';
import { DBOT_TABS } from '@/constants/bot-contents';
import { getDisplayCurrency, subscribeCurrency, toUsd } from '@/utils/currency-display';
import { setTradeContext } from '@/utils/trade-metadata';
import {
    AUTO_SIGNAL_BOTS,
    getAutoSignalBot,
    patchAutoSignalsBotXml,
} from './bot-xml';
import {
    beginAutoSignalsRun,
    clearAutoSignalsRun,
    getAutoSignalsRunSession,
    setAutoSignalsRunMessage,
    subscribeAutoSignalsRunSession,
} from './auto-signals-run-session';
import {
    evaluateAutoSignalCandidates,
    getSuggestedAutoSignalRuns,
    shouldExcludeAutoSignalMarket,
} from './auto-signals-engine';
import {
    ensureAutoSignalWorkspaceLoaded,
    isAutoSignalWorkspaceReady,
    startAutoSignalsBot,
} from './bot-builder-handoff';
import {
    isDigitMatchRescanDue,
    refreshMatchEntryReadiness,
    startDigitMatchMarketRescan,
} from './digit-match-rescan';
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
const MIN_TICK_SIZE = HISTORY_COUNT;

const DEFAULT_SETTINGS: AutoSignalsSettings = {
    maxRuns: 20,
    stake1: 1.5,
    stake2: 1.5,
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
    historyLoaded: boolean;
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
        // Migrate the previous built-in 1/2 stake pair once, while preserving
        // any amounts the user deliberately customized.
        const hadPreviousDefaultStakes = Number(saved.stake1) === 1 && Number(saved.stake2) === 2;
        return {
            // Run count is selected per signal; stored legacy maxRuns values
            // must not pin every new candidate to the old default of one.
            maxRuns: 20,
            stake1: hadPreviousDefaultStakes
                ? DEFAULT_SETTINGS.stake1
                : Math.max(0.01, Number(saved.stake1) || DEFAULT_SETTINGS.stake1),
            stake2: hadPreviousDefaultStakes
                ? DEFAULT_SETTINGS.stake2
                : Math.max(0.01, Number(saved.stake2) || DEFAULT_SETTINGS.stake2),
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
        historyLoaded: runtime.historyLoaded,
        candidate,
        candidates,
        availableContractTypes: [...new Set(candidates.map((item) => item.contractType))],
        error: runtime.error,
    };
};

const nextFrame = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

const isLiveBuilderWorkspace = (workspace: any): boolean => {
    if (!workspace || typeof workspace.getTopBlocks !== 'function') return false;
    const disposed = typeof workspace.isDisposed === 'function'
        ? workspace.isDisposed()
        : workspace.isDisposed;
    return !disposed;
};

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

const waitForBuilderWorkspace = async () => {
    for (let attempt = 0; attempt < 300; attempt += 1) {
        const workspace = getBlocklyWorkspace();
        if (isLiveBuilderWorkspace(workspace)) return workspace;
        await nextFrame();
    }
    throw new Error('Bot Builder workspace did not become available. Open Bot Builder and try again.');
};

const isExpectedBotLoaded = (workspace: any, expectedXml: string) => (
    isAutoSignalWorkspaceReady(workspace, expectedXml)
    && workspace.getTopBlocks(false).some((block: any) => block.type === 'trade_definition')
);

const waitForPendingBotLoad = async (expectedXml: string) => {
    let latestWorkspace: any = null;
    for (let attempt = 0; attempt < 300; attempt += 1) {
        const workspace = getBlocklyWorkspace();
        if (isLiveBuilderWorkspace(workspace)) {
            latestWorkspace = workspace;
            if (isExpectedBotLoaded(workspace, expectedXml)) return workspace;
            const hasPreviousBlocks = workspace.getTopBlocks(false).length > 0
                && workspace.strategy_to_load !== expectedXml;
            if (
                hasPreviousBlocks
                && (window as any).__pendingBotXml !== expectedXml
            ) {
                return null;
            }
        }
        await nextFrame();
    }
    return isLiveBuilderWorkspace(latestWorkspace) ? latestWorkspace : null;
};

const loadBotIntoWorkspace = async (
    expectedXml: string,
    botName: string,
    waitForPendingLoad: boolean,
) => {
    const workspace = (
        waitForPendingLoad ? await waitForPendingBotLoad(expectedXml) : null
    ) || await waitForBuilderWorkspace();
    const isExpected = () => isExpectedBotLoaded(workspace, expectedXml);
    if (isExpected()) return workspace;

    await ensureAutoSignalWorkspaceLoaded(workspace, expectedXml, async targetWorkspace => {
        await load({
            block_string: expectedXml,
            drop_event: null,
            file_name: botName,
            strategy_id: `auto_signal_${Date.now()}`,
            from: save_types.LOCAL,
            workspace: targetWorkspace,
            showIncompatibleStrategyDialog: false,
            show_snackbar: false,
        });
    });

    for (let attempt = 0; attempt < 300; attempt += 1) {
        if (isExpected()) return workspace;
        await nextFrame();
    }
    throw new Error('Bot Builder could not load the selected Auto-Signals bot. Try choosing it again.');
};

const autoSignalTemplateCache = new Map<string, Promise<string>>();
const loadAutoSignalTemplate = (file: string) => {
    const cached = autoSignalTemplateCache.get(file);
    if (cached) return cached;
    const request = fetch(file).then(async response => {
        if (!response.ok) throw new Error(`Could not load bot template (${response.status}).`);
        return response.text();
    }).catch(error => {
        autoSignalTemplateCache.delete(file);
        throw error;
    });
    autoSignalTemplateCache.set(file, request);
    return request;
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
    const familyRef = useRef<AutoSignalFamily>('AUTO');
    const [settings, setSettings] = useState<AutoSignalsSettings>(readSettings);
    const activeRun = runSession.run;
    const [displayCurrency, setDisplayCurrency] = useState(getDisplayCurrency);
    const [refreshToken, setRefreshToken] = useState(0);
    const runtimesRef = useRef(new Map<string, MarketRuntime>());
    const unsubscribeRef = useRef<Array<() => void>>([]);
    const generationRef = useRef(0);
    const isPreparingRunRef = useRef(false);
    const forceScoreRefreshRef = useRef(false);
    const lastDigitMatchScanAtRef = useRef(0);
    const flushQueuedRef = useRef(false);
    const mountedRef = useRef(true);
    const dirtySymbolsRef = useRef(new Set<string>());
    const queueMarketRefresh = useCallback(() => {
        if (flushQueuedRef.current) return;
        flushQueuedRef.current = true;
        queueMicrotask(() => {
            flushQueuedRef.current = false;
            if (!mountedRef.current) return;
            const now = Date.now();
            const activeFamily = familyRef.current;
            const forceScoreRefresh = forceScoreRefreshRef.current;
            forceScoreRefreshRef.current = false;
            const shouldScore = activeFamily !== 'MATCHES'
                || isDigitMatchRescanDue(now, lastDigitMatchScanAtRef.current, forceScoreRefresh);
            if (activeFamily === 'MATCHES' && shouldScore) {
                lastDigitMatchScanAtRef.current = now;
            }
            const snapshot = Array.from(runtimesRef.current.values()).map((runtime) => {
                if (shouldScore && dirtySymbolsRef.current.delete(runtime.info.symbol)) {
                    runtime.candidates = runtime.ticks.length >= MIN_TICK_SIZE
                        ? evaluateAutoSignalCandidates({
                            market: runtime.info,
                            ticks: runtime.ticks,
                            family: activeFamily,
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
    const queueFullMarketRefresh = useCallback(() => {
        forceScoreRefreshRef.current = true;
        runtimesRef.current.forEach((runtime) => {
            dirtySymbolsRef.current.add(runtime.info.symbol);
        });
        queueMarketRefresh();
    }, [queueMarketRefresh]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeCurrency(() => setDisplayCurrency(getDisplayCurrency()));
        return unsubscribe;
    }, []);

    useEffect(() => {
        const filesToWarm = new Set([
            ...Object.values(AUTO_SIGNAL_BOTS).map((bot) => bot.file),
            '/bots/normal-killer-bot-v3.xml',
        ]);
        // Warm all supported templates during the baseline scan so selecting
        // Trade Only does not wait for a template request.
        filesToWarm.forEach(file => {
            void loadAutoSignalTemplate(file).catch(() => undefined);
        });
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
        // Re-score the current authenticated tick windows locally. Live ticks
        // continue refreshing cards between sweeps, so no extra Deriv history
        // requests are needed.
        return startDigitMatchMarketRescan(
            family === 'MATCHES' && connected && authorized && status === 'scanning',
            queueFullMarketRefresh,
        );
    }, [authorized, connected, family, queueFullMarketRefresh, status]);

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
                        historyLoaded: false,
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
                        if (familyRef.current === 'MATCHES') {
                            const latestDigit = runtime.ticks[runtime.ticks.length - 1]?.digit ?? null;
                            runtime.candidates = refreshMatchEntryReadiness(
                                runtime.candidates,
                                latestDigit,
                                runtime.lastTickAt,
                            );
                            runtime.candidate = runtime.candidates.find(
                                (candidate) => candidate.id === runtime.candidate?.id,
                            ) ?? runtime.candidates[0] ?? null;
                        }
                        dirtySymbolsRef.current.add(runtime.info.symbol);
                        queueMarketRefresh();
                    });
                    unsubscribeRef.current.push(unsubscribe);
                }

                setStatus('scanning');
                setMessage(`Live authenticated scan on ${runtimes.length} open synthetic markets.`);
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
                            runtime.historyLoaded = true;
                            dirtySymbolsRef.current.add(runtime.info.symbol);
                            queueMarketRefresh();
                        } catch (error: any) {
                            if (cancelled || generation !== generationRef.current) return;
                            runtime.historyLoaded = true;
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
            flushQueuedRef.current = false;
        };
    }, [authorized, connected, queueMarketRefresh, refreshToken, send, subscribeTicks]);

    const onFamilyChange = useCallback((nextFamily: AutoSignalFamily) => {
        familyRef.current = nextFamily;
        forceScoreRefreshRef.current = true;
        setFamily(nextFamily);
        queueFullMarketRefresh();
    }, [queueFullMarketRefresh]);

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
        const selectedRuns = candidate
            ? getSuggestedAutoSignalRuns(candidate.recommendedRuns, settings.maxRuns)
            : 0;
        if (selectedRuns < 1) {
            setMessage('This signal is below the minimum run threshold. Wait for a stronger, current signal.');
            return;
        }
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
        const bot = getAutoSignalBot(action, candidate);
        let builderHandoffStarted = false;
        try {
            setMessage(`Preparing ${bot.name} for ${market.label}…`);
            const template = await loadAutoSignalTemplate(bot.file);
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
                // Apply the candidate's signal-selected count to the XML
                // after-purchase run cap. Bot Builder's Stop control remains
                // available throughout the run.
                settings: { ...settings, maxRuns: selectedRuns },
                accountAmounts,
            });

            setTradeContext({ page: 'Auto-Signals', bot: bot.name });
            // Auto-Signals uses one live-tick contract per cycle. Faster mode
            // removes client-added waits; it must not fan out duplicate orders.
            const purchasesPerTick = 1;
            const builderAlreadyMounted = isLiveBuilderWorkspace(getBlocklyWorkspace());
            if (!builderAlreadyMounted) {
                (window as any).__pendingBotXml = configuredXml;
                (window as any).__pendingBotName = bot.name;
            }
            builderHandoffStarted = true;
            setActiveTab(DBOT_TABS.BOT_BUILDER);
            runPanel.toggleDrawer?.(true);
            // The pending values cover a workspace that is still mounting.
            // If Bot Builder is already mounted, use its official loader now;
            // changing only strategy_to_load would leave its old blocks active.
            const loadedWorkspace = await loadBotIntoWorkspace(
                configuredXml,
                bot.name,
                !builderAlreadyMounted,
            );
            if ((window as any).__pendingBotXml === configuredXml) {
                (window as any).__pendingBotXml = null;
                (window as any).__pendingBotName = null;
            }
            if (runPanel.is_running) throw new Error('Stop the currently running Bot Builder bot before loading another.');

            const latestRuntime = runtimesRef.current.get(market.symbol);
            const latestCandidate = latestRuntime?.candidates.find((item) => item.id === candidate.id);
            const latestTickIsLive = latestRuntime?.lastTickAt != null
                && Date.now() - latestRuntime.lastTickAt <= LIVE_TICK_STALE_MS;
            if (!latestCandidate || latestCandidate.id !== candidate.id || !latestTickIsLive
                || latestCandidate.expiresAt == null || latestCandidate.expiresAt <= Date.now()) {
                throw new Error('The signal changed while the bot was loading. Return to Auto-Signals and choose the latest signal.');
            }
            if (loadedWorkspace !== getBlocklyWorkspace()) {
                throw new Error('Bot Builder workspace changed while loading. Choose the current signal again.');
            }

            const nextRun: AutoSignalsRun = {
                symbol: market.symbol,
                action,
                strategy: candidate.strategy,
                startedAt: Date.now(),
                maxRuns: selectedRuns,
                completedRuns: 0,
                purchasesPerTick,
            };
            beginAutoSignalsRun(
                nextRun,
                `${bot.name} is starting on ${market.symbol} for ${selectedRuns} validated signal cycles, with one purchase per eligible tick.`,
            );

            // Automatically start after the selected XML is ready. Keep the
            // app-level Builder active so the loaded workspace and run panel
            // remain available while this session runs.
            await startAutoSignalsBot(runPanel, (error: any) => {
                    const startError = error?.message || 'Bot Builder could not start this bot.';
                    clearAutoSignalsRun(startError);
                    setAutoSignalsRunMessage(startError);
            });
            const currentSession = getAutoSignalsRunSession();
            if (currentSession.run?.startedAt === nextRun.startedAt) {
                const runMessage = action === 'entry-trade' && !candidate.entryReady
                    ? `${bot.name} is watching for its entry condition on ${market.symbol}; it will stop after ${selectedRuns} cycles.`
                    : `${bot.name} is trading ${market.symbol} for up to ${selectedRuns} validated cycles, one purchase per eligible tick.`;
                setAutoSignalsRunMessage(runMessage);
            } else {
                setAutoSignalsRunMessage(currentSession.message || `${bot.name} started on ${market.symbol}.`);
            }
        } catch (error: any) {
            const errorMessage = error?.message || 'The Bot Builder handoff failed.';
            if ((window as any).__pendingBotName === bot.name) {
                (window as any).__pendingBotXml = null;
                (window as any).__pendingBotName = null;
            }
            clearAutoSignalsRun(errorMessage);
            setAutoSignalsRunMessage(errorMessage);
            setMessage(errorMessage);
            // Once XML has been handed to Builder, keep that workspace visible
            // on both success and failure so the user can inspect the bot and
            // its Summary/Transactions/Journal panel.
            if (builderHandoffStarted) {
                setActiveTab(DBOT_TABS.BOT_BUILDER);
                runPanel.toggleDrawer?.(true);
            }
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

