import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDerivTrade, type SettledContract, type TickData } from '@/hooks/useDerivTrade';
import { useStore } from '@/hooks/useStore';
import { getMasterSource } from '@/utils/trade-bus';
import { KING_FISHER_MARKETS } from '@/utils/king-fisher-market-scanner';
import {
    advanceAutoLabGate,
    createAutoLabGate,
    evaluateAutoLabCandidates,
    getAutoLabDigitStats,
    isAutoLabContractWin,
    resetAutoLabGateAfterTrade,
    type AutoLabCandidate,
    type AutoLabContractType,
    type AutoLabGateState,
    type AutoLabMarketWindow,
    type AutoLabTick,
} from './auto-lab-engine';
import type {
    AutoLabAccount,
    AutoLabDigitStat,
    AutoLabMarket,
    AutoLabMode,
    AutoLabSession,
    AutoLabSettings,
    AutoLabSignal,
    AutoLabStatus,
    AutoLabTrade,
} from './AutoLabView';

const HISTORY_COUNT = 500;
const MAX_TICKS = 1500;
const MIN_READY_TICKS = 20;
const TICK_WATCHDOG_MS = 15000;

type MarketInfo = { symbol: string; label: string };
type RawHistoryPoint = { price: number; epoch: number };
type RuntimeMarket = {
    pipSize: number | null;
    rawHistory: RawHistoryPoint[];
    ticks: AutoLabTick[];
};
type PendingVirtualTrade = AutoLabCandidate & { settleAtEpoch: number };

const initialSession = (stake: number): AutoLabSession => ({
    wins: 0,
    losses: 0,
    trades: 0,
    pnl: 0,
    currentStake: stake,
    lossLevel: 0,
    virtualWins: 0,
    virtualLosses: 0,
    virtualGatePhase: 'losses',
});

const getLastDigit = (price: number, pipSize: number): number | null => {
    if (!Number.isFinite(price) || !Number.isFinite(pipSize) || pipSize < 0 || pipSize > 10) return null;
    const formatted = price.toFixed(Math.floor(pipSize));
    const digit = Number(formatted[formatted.length - 1]);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

const mergeTicks = (existing: AutoLabTick[], incoming: AutoLabTick[]): AutoLabTick[] => {
    const byEpoch = new Map<number, AutoLabTick>();
    for (const tick of existing) byEpoch.set(tick.epoch, tick);
    for (const tick of incoming) byEpoch.set(tick.epoch, tick);
    return [...byEpoch.values()].sort((left, right) => left.epoch - right.epoch).slice(-MAX_TICKS);
};

const toAutoLabTick = (tick: TickData): AutoLabTick | null => {
    const symbol = String(tick.symbol || '');
    const quote = Number(tick.quote);
    const epoch = Number(tick.epoch);
    const pipSize = Number(tick.pip_size);
    const digit = getLastDigit(quote, pipSize);
    if (!symbol || !Number.isFinite(quote) || !Number.isFinite(epoch) || digit == null) return null;
    return { symbol, quote, epoch, pip_size: pipSize, digit };
};

const normalizeActiveSymbols = (response: any): MarketInfo[] => {
    const activeSymbols = response?.active_symbols;
    if (!Array.isArray(activeSymbols)) return [];
    const available = new Set(
        activeSymbols
            .filter((item: any) => item?.exchange_is_open !== 0 && item?.is_trading_suspended !== 1)
            .map((item: any) => String(item?.underlying_symbol ?? item?.symbol ?? '')),
    );
    return KING_FISHER_MARKETS
        .filter(market => available.has(market.symbol))
        .map(market => ({ symbol: market.symbol, label: market.label }));
};

const displaySignal = (value: AutoLabCandidate | null, detailFallback: string): AutoLabSignal => value
    ? {
        label: value.contract_type.replace('DIGIT', 'Digit '),
        detail: `${value.strategy} · ${value.detail}`,
        market: value.label,
        confidence: value.score,
    }
    : {
        label: 'Waiting for a qualified setup',
        detail: detailFallback,
        market: '',
        confidence: null,
    };

const roundStake = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const getNextStake = (baseStake: number, lossLevel: number, multiplier: number, mode: 'normal' | 'split') => {
    const exponent = mode === 'normal' ? lossLevel : Math.ceil(lossLevel / 2);
    return roundStake(baseStake * Math.pow(multiplier, Math.max(0, exponent)));
};

const durationSeconds = (duration: number, unit: AutoLabSettings['durationUnit']) => {
    const unitSeconds: Record<AutoLabSettings['durationUnit'], number> = {
        t: 1,
        s: 1,
        m: 60,
        h: 3600,
        d: 86400,
    };
    return Math.max(1, Math.floor(duration)) * unitSeconds[unit];
};

const gatePhaseLabel = (phase: AutoLabGateState['phase']) => {
    if (phase === 'armed') return 'armed';
    return phase === 'losses' ? 'virtual losses' : 'virtual wins';
};

export const useAutoLabEngine = (
    mode: AutoLabMode,
    settings: AutoLabSettings,
    liveAcknowledged: boolean,
) => {
    const { connected, authorized, balance, currency, send, subscribeTicks, buyContract } = useDerivTrade();
    const { client } = useStore();
    const loginId = client.loginid || '';
    const source = authorized ? getMasterSource() : null;
    const account: AutoLabAccount = {
        connected,
        authorized,
        isVirtual: source == null ? null : source === 'demo',
        balance,
        currency,
        loginId,
    };
    const accountRef = useRef(account);
    const settingsRef = useRef(settings);
    const modeRef = useRef(mode);
    const liveAcknowledgedRef = useRef(liveAcknowledged);
    accountRef.current = account;
    settingsRef.current = settings;
    modeRef.current = mode;
    liveAcknowledgedRef.current = liveAcknowledged;

    const [status, setStatus] = useState<AutoLabStatus>('idle');
    const [message, setMessage] = useState('Authorize the connected account to load synthetic markets.');
    const [instruments, setInstruments] = useState<MarketInfo[]>([]);
    const [markets, setMarkets] = useState<AutoLabMarket[]>([]);
    const [digitStats, setDigitStats] = useState<AutoLabDigitStat[]>([]);
    const [trades, setTrades] = useState<AutoLabTrade[]>([]);
    const [currentSignal, setCurrentSignal] = useState<AutoLabSignal>({
        label: 'Waiting for live market data',
        detail: 'Market history and live ticks will appear after account authorization.',
        market: '',
        confidence: null,
    });
    const [session, setSession] = useState<AutoLabSession>(() => initialSession(settings.stake));

    const sessionRef = useRef(session);
    const statusRef = useRef(status);
    const runRef = useRef(false);
    const pendingVirtualRef = useRef<PendingVirtualTrade | null>(null);
    const gateRef = useRef(createAutoLabGate(settings.virtualLossesRequired, settings.virtualWinsRequired));
    const tickDataRef = useRef<Map<string, RuntimeMarket>>(new Map());
    const activeMarketsRef = useRef<MarketInfo[]>([]);
    const startedAccountRef = useRef<string | null>(null);
    const lastTickAtRef = useRef<Map<string, number>>(new Map());
    const historyErrorsRef = useRef(new Set<string>());
    const openTradeIdsRef = useRef(new Set<number>());
    const settledTradeIdsRef = useRef(new Set<number>());
    const earlySettlementsRef = useRef(new Map<number, SettledContract>());
    const realOrderPendingRef = useRef(false);

    sessionRef.current = session;
    statusRef.current = status;

    const updateSession = useCallback((next: AutoLabSession) => {
        sessionRef.current = next;
        setSession(next);
    }, []);

    const activeMarkets = useMemo(() => {
        if (settings.marketSelection === 'ALL') return instruments;
        return instruments.filter(market => market.symbol === settings.marketSelection);
    }, [instruments, settings.marketSelection]);
    activeMarketsRef.current = activeMarkets;

    const stopEngine = useCallback((nextStatus: AutoLabStatus, nextMessage: string) => {
        runRef.current = false;
        pendingVirtualRef.current = null;
        realOrderPendingRef.current = false;
        startedAccountRef.current = null;
        setStatus(nextStatus);
        setMessage(nextMessage);
    }, []);

    useEffect(() => {
        if (!connected || !authorized) {
            setInstruments([]);
            setMarkets([]);
            setDigitStats([]);
            if (runRef.current) stopEngine('stopped', 'The authorized connection was lost. Auto Lab stopped and will not place more orders.');
            else setMessage(connected ? 'Authorize the connected account to load synthetic markets.' : 'Connect a Deriv account to load synthetic markets.');
            return;
        }

        let cancelled = false;
        setMessage('Loading the authorized account’s available synthetic markets…');
        send({ active_symbols: 'full' })
            .then((response: any) => {
                if (cancelled) return;
                if (response?.error) throw new Error(response.error.message || 'Deriv rejected the active-symbols request.');
                const supported = normalizeActiveSymbols(response);
                setInstruments(supported);
                setMessage(supported.length
                    ? 'Attaching authenticated live feeds and loading recent tick history…'
                    : 'No supported synthetic markets were returned for this account.');
            })
            .catch((error: any) => {
                if (cancelled) return;
                setInstruments([]);
                setMessage(error?.message || 'Could not load synthetic markets from the authorized account.');
            });

        return () => {
            cancelled = true;
        };
    }, [connected, authorized, send, stopEngine]);

    const refreshMarketView = useCallback(() => {
        const infos = activeMarketsRef.current;
        const windows: AutoLabMarketWindow[] = infos.map(info => ({
            ...info,
            ticks: tickDataRef.current.get(info.symbol)?.ticks ?? [],
        }));
        const strategySettings = settingsRef.current;
        const candidates = evaluateAutoLabCandidates(modeRef.current, windows, strategySettings);
        const bestBySymbol = new Map<string, AutoLabCandidate>();
        for (const item of candidates) {
            if (!bestBySymbol.has(item.symbol)) bestBySymbol.set(item.symbol, item);
        }
        setMarkets(infos.map(info => {
            const runtime = tickDataRef.current.get(info.symbol);
            const latest = runtime?.ticks[runtime.ticks.length - 1];
            const candidateForMarket = bestBySymbol.get(info.symbol);
            return {
                symbol: info.symbol,
                label: info.label,
                digit: latest?.digit ?? null,
                quote: latest?.quote ?? null,
                tickCount: runtime?.ticks.length ?? 0,
                score: candidateForMarket?.score ?? null,
                signal: candidateForMarket?.contract_type
                    ? candidateForMarket.contract_type.replace('DIGIT', 'Digit ')
                    : latest ? 'Tracking' : 'Waiting',
            };
        }));

        const selectedMarket = candidates[0]?.symbol
            ?? windows.find(window => window.ticks.length)?.symbol
            ?? windows[0]?.symbol;
        const selectedTicks = windows.find(window => window.symbol === selectedMarket)?.ticks ?? [];
        setDigitStats(getAutoLabDigitStats(selectedTicks.slice(-Math.max(1, strategySettings.ticksWindow))));
        const best = candidates[0] ?? null;
        const gate = gateRef.current;
        if (runRef.current && best && gate.phase !== 'armed') {
            setCurrentSignal({
                label: `${gatePhaseLabel(gate.phase)} · ${gate.phase === 'losses' ? gate.consecutiveLosses : gate.consecutiveWins}`,
                detail: `Virtual checks are required before a real order. Current setup: ${best.strategy} · ${best.detail}`,
                market: best.label,
                confidence: best.score,
            });
        } else {
            setCurrentSignal(displaySignal(best, `Waiting for at least ${MIN_READY_TICKS} valid ticks and a qualifying strategy condition.`));
        }
        return { candidates, windows };
    }, []);

    useEffect(() => {
        if (!connected || !authorized || !activeMarkets.length) {
            tickDataRef.current.clear();
            lastTickAtRef.current.clear();
            setMarkets([]);
            setDigitStats([]);
            return;
        }

        let cancelled = false;
        const cleanups = new Map<string, () => void>();
        const now = () => Date.now();
        tickDataRef.current = new Map(activeMarkets.map(market => [
            market.symbol,
            { pipSize: null, rawHistory: [], ticks: [] },
        ]));
        lastTickAtRef.current = new Map(activeMarkets.map(market => [market.symbol, now()]));
        historyErrorsRef.current = new Set();

        const handleTick = (symbol: string, tick: TickData) => {
            const runtime = tickDataRef.current.get(symbol);
            const liveTick = toAutoLabTick(tick);
            if (!runtime || !liveTick || liveTick.symbol !== symbol) return;
            lastTickAtRef.current.set(symbol, now());
            if (runtime.pipSize == null) {
                runtime.pipSize = liveTick.pip_size;
                const historyTicks = runtime.rawHistory
                    .map(point => {
                        const digit = getLastDigit(point.price, liveTick.pip_size);
                        return digit == null
                            ? null
                            : { symbol, digit, quote: point.price, epoch: point.epoch, pip_size: liveTick.pip_size };
                    })
                    .filter((point): point is AutoLabTick => point !== null);
                runtime.ticks = mergeTicks(runtime.ticks, historyTicks);
            }
            runtime.ticks = mergeTicks(runtime.ticks, [liveTick]);
            const result = refreshMarketView();
            if (runRef.current && result) {
                processStrategyTick(liveTick, result.candidates);
            }
        };

        const attach = (market: MarketInfo) => {
            cleanups.get(market.symbol)?.();
            cleanups.set(market.symbol, subscribeTicks(market.symbol, tick => handleTick(market.symbol, tick)));
            lastTickAtRef.current.set(market.symbol, now());
        };

        activeMarkets.forEach(attach);
        refreshMarketView();

        const loadHistories = async () => {
            for (const market of activeMarkets) {
                if (cancelled) return;
                try {
                    const response: any = await send({
                        ticks_history: market.symbol,
                        count: HISTORY_COUNT,
                        end: 'latest',
                        style: 'ticks',
                    });
                    if (cancelled) return;
                    if (response?.error) throw new Error(response.error.message || 'History request failed.');
                    const prices = response?.history?.prices;
                    const times = response?.history?.times;
                    if (!Array.isArray(prices) || !Array.isArray(times) || prices.length !== times.length) {
                        throw new Error('Deriv returned an incomplete tick-history response.');
                    }
                    const runtime = tickDataRef.current.get(market.symbol);
                    if (!runtime) continue;
                    runtime.rawHistory = prices.flatMap((price: unknown, index: number) => {
                        const normalizedPrice = Number(price);
                        const epoch = Number(times[index]);
                        return Number.isFinite(normalizedPrice) && Number.isFinite(epoch)
                            ? [{ price: normalizedPrice, epoch }]
                            : [];
                    });
                    if (runtime.pipSize != null) {
                        const historicalTicks = runtime.rawHistory
                            .map(point => {
                                const digit = getLastDigit(point.price, runtime.pipSize!);
                                return digit == null
                                    ? null
                                    : { symbol: market.symbol, digit, quote: point.price, epoch: point.epoch, pip_size: runtime.pipSize! };
                            })
                            .filter((point): point is AutoLabTick => point !== null);
                        runtime.ticks = mergeTicks(runtime.ticks, historicalTicks);
                    }
                    refreshMarketView();
                } catch (error: any) {
                    if (cancelled) return;
                    historyErrorsRef.current.add(market.symbol);
                    const ready = activeMarketsRef.current.some(item =>
                        (tickDataRef.current.get(item.symbol)?.ticks.length ?? 0) >= MIN_READY_TICKS,
                    );
                    if (!ready) {
                        setMessage(`${market.label} history is unavailable: ${error?.message || 'request failed'}. Live ticks are still being collected.`);
                    }
                }
            }
            if (!cancelled) {
                const ready = activeMarketsRef.current.some(item =>
                    (tickDataRef.current.get(item.symbol)?.ticks.length ?? 0) >= MIN_READY_TICKS,
                );
                if (ready) setMessage('');
                else setMessage('Live feeds are attached. Waiting for enough valid ticks to evaluate a strategy.');
            }
        };
        void loadHistories();

        const watchdog = window.setInterval(() => {
            for (const market of activeMarkets) {
                const lastTickAt = lastTickAtRef.current.get(market.symbol) ?? 0;
                if (now() - lastTickAt > TICK_WATCHDOG_MS) attach(market);
            }
        }, 5000);

        return () => {
            cancelled = true;
            window.clearInterval(watchdog);
            cleanups.forEach(cleanup => cleanup());
            cleanups.clear();
        };
    }, [connected, authorized, activeMarkets, send, subscribeTicks, refreshMarketView]);

    function processStrategyTick(tick: AutoLabTick, candidates: AutoLabCandidate[]) {
        const best = candidates[0];
        const gate = gateRef.current;
        const pendingVirtual = pendingVirtualRef.current;
        if (pendingVirtual && pendingVirtual.symbol === tick.symbol && tick.epoch >= pendingVirtual.settleAtEpoch) {
            const won = isAutoLabContractWin(
                pendingVirtual.contract_type,
                pendingVirtual.barrier,
                tick,
                pendingVirtual.entryQuote,
                pendingVirtual.barrier2,
            );
            pendingVirtualRef.current = null;
            const nextGate = advanceAutoLabGate(
                gate,
                won,
                tick.epoch,
                settingsRef.current.virtualLossesRequired,
                settingsRef.current.virtualWinsRequired,
            );
            gateRef.current = nextGate;
            const previous = sessionRef.current;
            updateSession({
                ...previous,
                virtualWins: nextGate.consecutiveWins,
                virtualLosses: nextGate.consecutiveLosses,
                virtualGatePhase: nextGate.phase,
            });
        }

        if (!runRef.current || realOrderPendingRef.current) return;
        if (!best || best.symbol !== tick.symbol || best.epoch !== tick.epoch) return;
        const activeGate = gateRef.current;
        if (activeGate.phase !== 'armed') {
            if (!pendingVirtualRef.current) {
                const contract = best.contract_type;
                const durationless = contract === 'ACCU' || contract === 'MULTUP' || contract === 'MULTDOWN';
                const duration = durationless ? 1 : settingsRef.current.duration;
                const unit = durationless ? 't' : settingsRef.current.durationUnit;
                pendingVirtualRef.current = {
                    ...best,
                    settleAtEpoch: best.epoch + durationSeconds(duration, unit),
                };
            }
            return;
        }
        if (activeGate.armedEpoch != null && activeGate.armedEpoch > 0 && tick.epoch <= activeGate.armedEpoch) return;
        void placeRealTrade(best);
    }

    const placeRealTrade = async (signal: AutoLabCandidate) => {
        if (realOrderPendingRef.current || !runRef.current) return;
        const startIdentity = startedAccountRef.current;
        const accountNow = accountRef.current;
        if (!startIdentity || !accountNow.connected || !accountNow.authorized) {
            stopEngine('stopped', 'The account connection changed. Auto Lab stopped before placing another order.');
            return;
        }
        const currentSource = getMasterSource();
        const identity = `${accountNow.loginId}|${currentSource}`;
        if (identity !== startIdentity) {
            stopEngine('stopped', 'The account changed during this run. Auto Lab stopped to protect the newly selected account.');
            return;
        }
        if (accountNow.isVirtual === false && !liveAcknowledgedRef.current) {
            stopEngine('stopped', 'Real-account confirmation was removed. Auto Lab stopped before the next order.');
            return;
        }

        const currentSettings = settingsRef.current;
        const baseStake = roundStake(currentSettings.stake);
        const previousSession = sessionRef.current;
        const stake = getNextStake(
            baseStake,
            previousSession.lossLevel,
            currentSettings.multiplier,
            currentSettings.martingaleMode,
        );
        if (!Number.isFinite(stake) || stake <= 0) {
            stopEngine('risk-stopped', 'The calculated stake is invalid. No order was placed.');
            return;
        }
        if (accountNow.balance != null && stake > accountNow.balance) {
            stopEngine('risk-stopped', 'The next stake exceeds the available account balance. No order was placed.');
            return;
        }

        realOrderPendingRef.current = true;
        setStatus('running');
        setMessage(`Buying ${signal.contract_type} on ${signal.label} through the authenticated account…`);

        const shouldBuy = () => {
            const liveAccount = accountRef.current;
            return runRef.current
                && liveAccount.connected
                && liveAccount.authorized
                && `${liveAccount.loginId}|${getMasterSource()}` === startIdentity
                && (liveAccount.isVirtual !== false || liveAcknowledgedRef.current);
        };

        try {
            const result = await buyContract({
                symbol: signal.symbol,
                contract_type: signal.contract_type,
                ...(['ACCU', 'MULTUP', 'MULTDOWN'].includes(signal.contract_type)
                    ? {}
                    : {
                        duration: currentSettings.contractType === 'AUTO' ? 1 : currentSettings.duration,
                        duration_unit: currentSettings.contractType === 'AUTO' ? 't' : currentSettings.durationUnit,
                    }),
                stake,
                ...(signal.barrier == null ? {} : { barrier: signal.barrier }),
                ...(signal.barrier2 == null ? {} : { barrier2: signal.barrier2 }),
                ...(['CALLSPREAD', 'PUTSPREAD'].includes(signal.contract_type)
                    ? { barrier_range: currentSettings.barrierRange }
                    : {}),
                ...(['MULTUP', 'MULTDOWN', 'LBFLOATCALL', 'LBFLOATPUT', 'LBHIGHLOW'].includes(signal.contract_type)
                    ? { multiplier: currentSettings.contractMultiplier }
                    : {}),
                ...(signal.contract_type === 'ACCU' ? { growth_rate: currentSettings.growthRate } : {}),
                ...(['TICKHIGH', 'TICKLOW'].includes(signal.contract_type)
                    ? { selected_tick: currentSettings.selectedTick }
                    : {}),
                currency: currency || undefined,
                metadata: {
                    origin: 'auto-lab',
                    bot_name: 'Auto Lab',
                    bot_type: 'auto_lab',
                    strategy_mode: signal.strategy,
                    setup_score: signal.score,
                },
                shouldBuy,
            }, settled => handleSettlement(settled));

            const contractId = Number(result.contract_id);
            if (!Number.isFinite(contractId) || contractId <= 0) throw new Error('Deriv did not return a valid contract ID.');
            const earlySettlement = earlySettlementsRef.current.get(contractId);
            earlySettlementsRef.current.delete(contractId);
            openTradeIdsRef.current.add(contractId);
            const actualStake = Number(result.buy_price);
            const newTrade: AutoLabTrade = {
                id: String(contractId),
                time: new Date().toLocaleTimeString(),
                market: signal.label,
                contract: signal.contract_type,
                stake: Number.isFinite(actualStake) && actualStake > 0 ? actualStake : stake,
                profit: earlySettlement?.profit ?? 0,
                status: earlySettlement ? earlySettlement.status === 'won' ? 'WIN' : 'LOSS' : 'OPEN',
            };
            setTrades(previous => [newTrade, ...previous].slice(0, 100));
            updateSession({ ...sessionRef.current, trades: sessionRef.current.trades + 1 });
            if (earlySettlement) {
                settledTradeIdsRef.current.add(contractId);
                openTradeIdsRef.current.delete(contractId);
                completeRealSettlement(earlySettlement);
            } else {
                setMessage(`Order ${contractId} is open. Waiting for Deriv’s settlement result.`);
            }
        } catch (error: any) {
            realOrderPendingRef.current = false;
            if (!runRef.current && /cancelled before purchase/i.test(String(error?.message))) return;
            stopEngine('stopped', `Order was not placed: ${error?.message || 'the authenticated trade request failed'}`);
        }
    };

    const completeRealSettlement = (settled: SettledContract) => {
        realOrderPendingRef.current = false;
        const currentSettings = settingsRef.current;
        const previous = sessionRef.current;
        const profit = Number(settled.profit);
        const nextPnl = previous.pnl + (Number.isFinite(profit) ? profit : 0);
        const won = settled.status === 'won';
        const nextLossLevel = won ? 0 : previous.lossLevel + 1;
        const baseStake = roundStake(currentSettings.stake);
        const nextStake = getNextStake(baseStake, nextLossLevel, currentSettings.multiplier, currentSettings.martingaleMode);
        const nextSession: AutoLabSession = {
            ...previous,
            wins: previous.wins + (won ? 1 : 0),
            losses: previous.losses + (won ? 0 : 1),
            pnl: nextPnl,
            lossLevel: nextLossLevel,
            currentStake: won ? baseStake : nextStake,
            virtualWins: 0,
            virtualLosses: 0,
            virtualGatePhase: currentSettings.virtualLossesRequired > 0 ? 'losses' : 'armed',
        };
        updateSession(nextSession);
        gateRef.current = resetAutoLabGateAfterTrade(
            currentSettings.virtualLossesRequired,
            currentSettings.virtualWinsRequired,
        );
        pendingVirtualRef.current = null;

        const reachedProfit = currentSettings.takeProfit > 0 && nextPnl >= currentSettings.takeProfit;
        const reachedLoss = currentSettings.stopLoss > 0 && nextPnl <= -currentSettings.stopLoss;
        const exceededRecovery = nextLossLevel > currentSettings.maxMartingaleLevel;
        if (reachedProfit || reachedLoss || exceededRecovery) {
            runRef.current = false;
            startedAccountRef.current = null;
            setStatus('risk-stopped');
            setMessage(reachedProfit
                ? 'Take-profit limit reached. Auto Lab stopped.'
                : reachedLoss
                    ? 'Stop-loss limit reached. Auto Lab stopped.'
                    : 'Maximum recovery level reached. Auto Lab stopped.');
        } else if (runRef.current) {
            setStatus(gateRef.current.phase === 'armed' ? 'running' : 'scanning');
            setMessage(`Contract settled ${settled.status}. Next stake and session P/L use Deriv’s reported values.`);
        }
    };

    const handleSettlement = (settled: SettledContract) => {
        const contractId = Number(settled.contract_id);
        if (!Number.isFinite(contractId) || contractId <= 0 || settledTradeIdsRef.current.has(contractId)) return;
        if (!openTradeIdsRef.current.has(contractId)) {
            earlySettlementsRef.current.set(contractId, settled);
            return;
        }
        settledTradeIdsRef.current.add(contractId);
        openTradeIdsRef.current.delete(contractId);
        setTrades(previous => previous.map(trade => trade.id === String(contractId)
            ? {
                ...trade,
                profit: Number(settled.profit),
                status: settled.status === 'won' ? 'WIN' : 'LOSS',
            }
            : trade,
        ));
        completeRealSettlement(settled);
    };

    const canStart = useMemo(() => {
        const selectedReady = activeMarkets.some(market =>
            (tickDataRef.current.get(market.symbol)?.ticks.length ?? 0) >= MIN_READY_TICKS,
        );
        return connected
            && authorized
            && account.isVirtual != null
            && selectedReady
            && Number.isFinite(settings.stake)
            && settings.stake >= 0.35;
    }, [connected, authorized, account.isVirtual, activeMarkets, markets, settings.stake]);

    const onStart = useCallback(() => {
        const currentAccount = accountRef.current;
        if (!currentAccount.connected || !currentAccount.authorized) {
            setMessage('Connect and authorize a Deriv account before starting Auto Lab.');
            return;
        }
        if (currentAccount.isVirtual == null) {
            setMessage('The account type could not be verified. No trade will be placed.');
            return;
        }
        if (currentAccount.isVirtual === false && !liveAcknowledgedRef.current) {
            setMessage('Confirm real-account execution before starting.');
            return;
        }
        const readyMarket = activeMarketsRef.current.some(market =>
            (tickDataRef.current.get(market.symbol)?.ticks.length ?? 0) >= MIN_READY_TICKS,
        );
        if (!readyMarket) {
            setMessage(`Wait for at least ${MIN_READY_TICKS} valid ticks from a selected market.`);
            return;
        }
        if (!Number.isFinite(settingsRef.current.stake) || settingsRef.current.stake < 0.35) {
            setMessage('Enter a base stake of at least 0.35 USD before starting.');
            return;
        }

        const gate = createAutoLabGate(
            settingsRef.current.virtualLossesRequired,
            settingsRef.current.virtualWinsRequired,
        );
        gateRef.current = gate;
        pendingVirtualRef.current = null;
        startedAccountRef.current = `${currentAccount.loginId}|${getMasterSource()}`;
        runRef.current = true;
        setStatus(gate.phase === 'armed' ? 'running' : 'scanning');
        setMessage(gate.phase === 'armed'
            ? 'Strategy is active. The configured contract will be placed only after a qualified signal.'
            : 'Virtual gate is active. Only simulated checks run until its loss/win conditions are met.');
        updateSession({
            ...sessionRef.current,
            virtualWins: 0,
            virtualLosses: 0,
            virtualGatePhase: gate.phase,
        });
    }, [updateSession]);

    const onPause = useCallback(() => {
        if (!runRef.current) return;
        runRef.current = false;
        pendingVirtualRef.current = null;
        gateRef.current = createAutoLabGate(
            settingsRef.current.virtualLossesRequired,
            settingsRef.current.virtualWinsRequired,
        );
        setStatus('paused');
        setMessage(realOrderPendingRef.current
            ? 'Paused. No new orders will be placed; the open contract will still be recorded when Deriv settles it.'
            : 'Paused. No new orders will be placed until the run resumes.');
    }, []);

    const onStop = useCallback(() => {
        stopEngine('stopped', 'Run stopped. Session results remain visible; open Deriv contracts will still report their actual settlement.');
    }, [stopEngine]);

    const identity = `${loginId}|${source ?? 'unknown'}`;
    useEffect(() => {
        if (runRef.current && startedAccountRef.current && identity !== startedAccountRef.current) {
            stopEngine('stopped', 'The selected account changed. Auto Lab stopped so no order can go to a different account.');
        }
    }, [identity, stopEngine]);

    useEffect(() => {
        if ((!connected || !authorized) && runRef.current) {
            stopEngine('stopped', 'The authorized connection was lost. Auto Lab stopped.');
        }
    }, [connected, authorized, stopEngine]);

    useEffect(() => {
        if (status === 'paused' || status === 'stopped' || status === 'risk-stopped') return;
        if (runRef.current && !realOrderPendingRef.current) {
            const ready = activeMarkets.some(market =>
                (tickDataRef.current.get(market.symbol)?.ticks.length ?? 0) >= MIN_READY_TICKS,
            );
            if (ready && status === 'connecting') setStatus('scanning');
        }
    }, [activeMarkets, markets, status]);

    return {
        account,
        status,
        currentSignal,
        session,
        markets,
        digitStats,
        trades,
        canStart,
        message,
        onStart,
        onPause,
        onStop,
        inputsDisabled: status === 'connecting' || status === 'scanning' || status === 'running',
    };
};