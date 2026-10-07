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
import { evaluateAutoSignal, shouldExcludeAutoSignalMarket } from './auto-signals-engine';
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

const marketSnapshot = (
    runtime: MarketRuntime,
    family: AutoSignalFamily,
    now: number,
): AutoSignalMarket => {
    const ticks = runtime.ticks;
    const latest = ticks[ticks.length - 1];
    const live = runtime.lastTickAt != null && now - runtime.lastTickAt <= LIVE_TICK_STALE_MS;
    const expired = runtime.candidate?.expiresAt != null && now >= runtime.candidate.expiresAt;
    const candidate = runtime.candidate
        ? expired
            ? { ...runtime.candidate, state: 'expired' as const, entryReady: false }
            : !live
                ? { ...runtime.candidate, state: 'unavailable' as const, entryReady: false }
                : runtime.candidate
        : null;
    return {
        ...runtime.info,
        tickCount: ticks.length,
        latestDigit: latest?.digit ?? null,
        latestQuote: latest?.quote ?? null,
        updatedAt: runtime.lastTickAt,
        feedState: live ? 'live' : runtime.feedState === 'error' ? 'error' : runtime.lastTickAt ? 'stale' : runtime.feedState,
        candidate,
        availableContractTypes: candidate ? [candidate.contractType] : [],
        error: runtime.error,
    };
};

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const getBlocklyWorkspace = () => (window as any).Blockly?.derivWorkspace;

const waitForWorkspace = async () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const workspace = getBlocklyWorkspace();
        if (workspace) return workspace;
        await wait(100);
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
    const familyRef = useRef(family);
    const isPreparingRunRef = useRef(false);
    const flushTimerRef = useRef<number | null>(null);
    familyRef.current = family;

    const queueMarketRefresh = useCallback(() => {
        if (flushTimerRef.current != null) return;
        flushTimerRef.current = window.setTimeout(() => {
            flushTimerRef.current = null;
            const now = Date.now();
            const snapshot = Array.from(runtimesRef.current.values()).map((runtime) => {
                if (runtime.ticks.length >= MIN_TICK_SIZE) {
                    runtime.candidate = evaluateAutoSignal({
                        market: runtime.info,
                        ticks: runtime.ticks,
                        family: familyRef.current,
                        previous: runtime.candidate,
                        now,
                    });
                } else {
                    runtime.candidate = null;
                }
                return marketSnapshot(runtime, familyRef.current, now);
            });
            setMarkets(snapshot);
        }, 120);
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
                })));

                for (const runtime of runtimes) {
                    const unsubscribe = subscribeTicks(runtime.info.symbol, (tick: TickData) => {
                        if (cancelled || generation !== generationRef.current) return;
                        if (!Number.isFinite(tick.epoch) || !Number.isFinite(tick.quote)) return;
                        if (Number.isFinite(tick.pip_size) && tick.pip_size > 0) runtime.pipSize = tick.pip_size;
                        if (!runtime.pipSize) return;
                        runtime.rawTicks.set(tick.epoch, tick.quote);
                        const digit = digitFromQuote(tick.quote, runtime.pipSize);
                        if (digit == null) return;
                        runtime.lastTickAt = Date.now();
                        runtime.feedState = 'live';
                        runtime.error = undefined;
                        runtime.ticks = Array.from(runtime.rawTicks.entries())
                            .sort(([left], [right]) => left - right)
                            .slice(-HISTORY_COUNT)
                            .flatMap(([epoch, quote]) => {
                                const historicalDigit = digitFromQuote(quote, runtime.pipSize!);
                                return historicalDigit == null ? [] : [{
                                    symbol: runtime.info.symbol,
                                    epoch,
                                    quote,
                                    digit: historicalDigit,
                                    pip_size: runtime.pipSize!,
                                }];
                            });
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
                            if (runtime.pipSize) {
                                runtime.ticks = Array.from(runtime.rawTicks.entries())
                                    .sort(([left], [right]) => left - right)
                                    .slice(-HISTORY_COUNT)
                                    .flatMap(([epoch, quote]) => {
                                        const digit = digitFromQuote(quote, runtime.pipSize!);
                                        return digit == null ? [] : [{
                                            symbol: runtime.info.symbol,
                                            epoch,
                                            quote,
                                            digit,
                                            pip_size: runtime.pipSize!,
                                        }];
                                    });
                            }
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
            if (flushTimerRef.current != null) {
                window.clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
            }
        };
    }, [authorized, connected, queueMarketRefresh, refreshToken, send, subscribeTicks]);

    const onFamilyChange = useCallback((nextFamily: AutoSignalFamily) => {
        familyRef.current = nextFamily;
        setFamily(nextFamily);
        queueMarketRefresh();
    }, [queueMarketRefresh]);

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
        const candidate = runtime?.candidate;
        const now = Date.now();
        const live = runtime?.lastTickAt != null && now - runtime.lastTickAt <= LIVE_TICK_STALE_MS;
        if (!runtime || !candidate || candidate.id !== market.candidate?.id || !live
            || candidate.expiresAt == null || candidate.expiresAt <= now) {
            setMessage('That signal is no longer current. Wait for the authenticated feed to rescan it.');
            queueMarketRefresh();
            return;
        }
        if (action === 'entry-trade' && !candidate.entryReady) {
            setMessage('The entry digit is not confirmed on the latest live ticks yet.');
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

            const nextRun: AutoSignalsRun = {
                symbol: market.symbol,
                action,
                strategy: candidate.strategy,
                startedAt: Date.now(),
                maxRuns: settings.maxRuns,
                completedRuns: 0,
            };
            beginAutoSignalsRun(
                nextRun,
                () => runPanel.onStopButtonClick?.(),
                `${bot.name} is starting on ${market.symbol} in Bot Builder.`,
            );

            let lastError: unknown = null;
            for (let attempt = 0; attempt < 6; attempt += 1) {
                try {
                    if (!runPanel.onRunButtonClick) throw new Error('Bot Builder Run control is unavailable.');
                    if (runPanel.is_running) break;
                    await runPanel.onRunButtonClick();
                    lastError = null;
                    break;
                } catch (error) {
                    lastError = error;
                    if (runPanel.is_running) {
                        lastError = null;
                        break;
                    }
                    if (attempt < 5) await wait(200);
                }
            }
            if (lastError) throw lastError;
            const runMessage = `${bot.name} is loaded in Bot Builder on ${market.symbol}. Use the main Stop control there at any time.`;
            setMessage(runMessage);
            setAutoSignalsRunMessage(runMessage);
        } catch (error: any) {
            const errorMessage = error?.message || 'The Bot Builder handoff failed.';
            clearAutoSignalsRun(errorMessage);
            setMessage(errorMessage);
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

