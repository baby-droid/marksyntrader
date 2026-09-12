import { useEffect, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import {
    CONNECTION_STATUS,
    connectionStatus$,
} from '@/external/bot-skeleton/services/api/observables/connection-status-stream';

export const AUTO_BOT_MARKETS = [
    { label: 'V10 (1s)', value: '1HZ10V' },
    { label: 'V25 (1s)', value: '1HZ25V' },
    { label: 'V50 (1s)', value: '1HZ50V' },
    { label: 'V75 (1s)', value: '1HZ75V' },
    { label: 'V100 (1s)', value: '1HZ100V' },
    { label: 'V10', value: 'R_10' },
    { label: 'V25', value: 'R_25' },
    { label: 'V50', value: 'R_50' },
    { label: 'V75', value: 'R_75' },
    { label: 'V100', value: 'R_100' },
    { label: 'Jump 10', value: 'JD10' },
    { label: 'Jump 25', value: 'JD25' },
    { label: 'Jump 50', value: 'JD50' },
    { label: 'Jump 75', value: 'JD75' },
    { label: 'Jump 100', value: 'JD100' },
    { label: 'Boom 300', value: 'BOOM300N' },
    { label: 'Boom 500', value: 'BOOM500' },
    { label: 'Boom 1000', value: 'BOOM1000' },
    { label: 'Crash 300', value: 'CRASH300N' },
    { label: 'Crash 500', value: 'CRASH500' },
    { label: 'Crash 1000', value: 'CRASH1000' },
    { label: 'Step Index', value: 'STPX' },
    { label: 'Bear Market', value: 'RDBEAR' },
    { label: 'Bull Market', value: 'RDBULL' },
] as const;

type AutoBotMarket = { label: string; value: string };

export interface AutoBotMarketSnapshot {
    symbol: string;
    label: string;
    digits: number[];
    livePrice: number | null;
    tickVersion: number;
    ready: boolean;
}

export interface AutoBotTrade {
    contract: string;
    barrier: number | null;
    shouldTrade?: boolean;
    signal?: 'weak' | 'strong';
}

export interface AutoBotDefinition {
    pickTrade: (digits: number[], recoveryMode?: boolean, cycleConfig?: unknown) => AutoBotTrade;
}

export interface AutoBotMarketCandidate {
    symbol: string;
    label: string;
    digits: number[];
    trade: AutoBotTrade;
    score: number;
    ticks: 1 | 2 | 3 | 4;
    weakPct?: number;
    strongPct?: number;
}

const digitFromQuote = (quote: number, pipSize: number) =>
    Number(Number(quote).toFixed(pipSize).slice(-1));

const isDigitMarket = (item: any): boolean => {
    const symbol = String(item?.symbol ?? '').trim();
    if (!symbol) return false;
    const market = String(item?.market ?? '').toLowerCase();
    const symbolType = String(item?.symbol_type ?? '').toLowerCase();
    return market === 'synthetic_index'
        || symbolType === 'synthetic_index'
        || /^(1HZ|R_|JD|BOOM|CRASH|STP|RDBULL|RDBEAR)/i.test(symbol);
};

const mergeMarkets = (discovered: AutoBotMarket[]): AutoBotMarket[] => {
    const bySymbol = new Map<string, AutoBotMarket>();
    [...AUTO_BOT_MARKETS, ...discovered].forEach(market => {
        if (market.value) bySymbol.set(market.value, market);
    });
    return [...bySymbol.values()];
};

const scoreTrade = (trade: AutoBotTrade, digits: number[]): number => {
    if (!digits.length) return 0;
    const n = digits.length;
    const barrier = Number(trade.barrier ?? 0);
    if (trade.contract === 'DIGITOVER') return digits.filter(digit => digit > barrier).length / n * 100;
    if (trade.contract === 'DIGITUNDER') return digits.filter(digit => digit < barrier).length / n * 100;
    if (trade.contract === 'DIGITMATCH') return digits.filter(digit => digit === barrier).length / n * 100;
    if (trade.contract === 'DIGITDIFF') return digits.filter(digit => digit !== barrier).length / n * 100;
    if (trade.contract === 'DIGITEVEN') return digits.filter(digit => digit % 2 === 0).length / n * 100;
    if (trade.contract === 'DIGITODD') return digits.filter(digit => digit % 2 !== 0).length / n * 100;
    return 50;
};

const chooseBestTicks = (
    bot: AutoBotDefinition,
    digits: number[],
    recoveryMode = false,
    cycleConfig?: unknown,
) => {
    const options = [1, 2, 3, 4] as const;
    return options.reduce((best, ticks) => {
        const sample = digits.slice(-Math.max(20, Math.min(1000, 40 + ticks * 10)));
        const trade = bot.pickTrade(sample, recoveryMode, cycleConfig);
        const score = scoreTrade(trade, sample) + (trade.shouldTrade === false ? -100 : 0);
        return score > best.score ? { ticks, score, trade } : best;
    }, {
        ticks: 1 as 1 | 2 | 3 | 4,
        score: -Infinity,
        trade: bot.pickTrade(digits, recoveryMode, cycleConfig),
    });
};

export function scanAutoBotMarkets(
    bot: AutoBotDefinition,
    snapshots: Record<string, AutoBotMarketSnapshot>,
    recoveryMode = false,
    cycleConfig?: unknown,
): AutoBotMarketCandidate[] {
    return Object.values(snapshots)
        .filter(snapshot => snapshot.ready && snapshot.digits.length >= 20)
        .map(snapshot => {
            const selected = chooseBestTicks(bot, snapshot.digits, recoveryMode, cycleConfig);
            const last1000 = snapshot.digits.slice(-1000);
            const weakDigit = Number((cycleConfig as any)?.weakEntry);
            const strongDigit = Number((cycleConfig as any)?.strongEntry);
            return {
                symbol: snapshot.symbol,
                label: snapshot.label,
                digits: snapshot.digits,
                trade: selected.trade,
                score: Math.max(0, Math.min(100, selected.score)),
                ticks: selected.ticks,
                ...(Number.isInteger(weakDigit) ? {
                    weakPct: last1000.filter(digit => digit === weakDigit).length / Math.max(1, last1000.length) * 100,
                } : {}),
                ...(Number.isInteger(strongDigit) ? {
                    strongPct: last1000.filter(digit => digit === strongDigit).length / Math.max(1, last1000.length) * 100,
                } : {}),
            };
        })
        .filter(candidate => candidate.trade.shouldTrade !== false && candidate.score >= 50)
        .sort((left, right) => right.score - left.score);
}

export function useAuthenticatedAutoBotScanner(): {
    snapshots: Record<string, AutoBotMarketSnapshot>;
    tickVersion: number;
    connected: boolean;
} {
    const [snapshots, setSnapshots] = useState<Record<string, AutoBotMarketSnapshot>>({});
    const [tickVersion, setTickVersion] = useState(0);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let alive = true;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        const subscriptions: Array<{ unsubscribe?: () => void }> = [];
        const generations = new Map<string, number>();
        const marketState = new Map<string, {
            prices: number[];
            epochs: Set<number>;
            live: Array<{ epoch: number; price: number }>;
            pipSize: number | null;
        }>();
        const marketLabels = new Map<string, string>(
            AUTO_BOT_MARKETS.map(market => [market.value, market.label]),
        );

        const publish = (symbol: string, ready = true) => {
            const market = marketState.get(symbol);
            if (!market || !alive) return;
            const hasPipSize = Number.isFinite(market.pipSize);
            const history = hasPipSize
                ? market.prices.map(price => digitFromQuote(price, market.pipSize as number))
                : [];
            const live = hasPipSize
                ? market.live.map(item => digitFromQuote(item.price, market.pipSize as number))
                : [];
            setSnapshots(previous => ({
                ...previous,
                [symbol]: {
                    symbol,
                    label: marketLabels.get(symbol) ?? symbol,
                    digits: [...history, ...live].slice(-1000),
                    livePrice: market.live.at(-1)?.price ?? null,
                    tickVersion: (previous[symbol]?.tickVersion ?? 0) + (ready ? 1 : 0),
                    ready: ready && hasPipSize,
                },
            }));
            setTickVersion(version => version + (ready && hasPipSize ? 1 : 0));
        };

        const start = async () => {
            const api = (api_base as any).api;
            if (!alive || !api) {
                retryTimer = setTimeout(() => void start(), 600);
                return;
            }

            setConnected(true);
            let markets = [...AUTO_BOT_MARKETS] as AutoBotMarket[];
            try {
                // Do not include product_type here. Deriv rejects that field
                // for active_symbols on some authenticated sessions.
                const response = await api.send({ active_symbols: 'full' });
                const discovered = (response?.active_symbols ?? [])
                    .filter(isDigitMarket)
                    .map((item: any) => ({
                        value: String(item.symbol),
                        label: String(item.display_name || item.name || item.symbol),
                    }));
                markets = mergeMarkets(discovered);
                markets.forEach(market => marketLabels.set(market.value, market.label));
            } catch {
                // Keep the known synthetic catalog when discovery is delayed
                // or unavailable. The authenticated streams still work.
            }

            await Promise.all(markets.map(async ({ value: symbol }) => {
                const generation = (generations.get(symbol) ?? 0) + 1;
                generations.set(symbol, generation);
                const market = {
                    prices: [],
                    epochs: new Set<number>(),
                    live: [],
                    pipSize: null as number | null,
                };
                marketState.set(symbol, market);

                try {
                    const historyResponse = await api.send({
                        ticks_history: symbol,
                        count: 1000,
                        end: 'latest',
                        style: 'ticks',
                    });
                    if (!alive || generations.get(symbol) !== generation) return;
                    market.prices = (historyResponse?.history?.prices ?? []).map(Number).filter(Number.isFinite);
                    publish(symbol, false);
                } catch {
                    // The live stream can still populate this market if history is delayed.
                }

                try {
                    const stream = api.subscribe({ ticks: symbol, subscribe: 1 });
                    const subscription = stream?.subscribe?.({
                        next: (message: any) => {
                            if (!alive || generations.get(symbol) !== generation) return;
                            const tick = message?.tick;
                            const price = Number(tick?.quote);
                            const epoch = Number(tick?.epoch ?? 0);
                            if (!Number.isFinite(price) || (epoch && market.epochs.has(epoch))) return;
                            if (Number.isFinite(Number(tick?.pip_size))) {
                                market.pipSize = Number(tick.pip_size);
                            }
                            if (epoch) market.epochs.add(epoch);
                            market.live.push({ epoch, price });
                            market.live = market.live.slice(-1000);
                            publish(symbol);
                        },
                        error: () => {
                            if (alive) setConnected(false);
                        },
                    });
                    if (subscription) subscriptions.push(subscription);
                } catch {
                    // Keep the remaining markets alive if one subscription is rejected.
                }
            }));
        };

        const connectionSub = connectionStatus$.subscribe(status => {
            if (!alive) return;
            const isOpen = status === CONNECTION_STATUS.OPENED;
            setConnected(isOpen);
            if (isOpen && !marketState.size) void start();
        });
        void start();

        return () => {
            alive = false;
            if (retryTimer) clearTimeout(retryTimer);
            connectionSub.unsubscribe();
            subscriptions.forEach(subscription => {
                try { subscription.unsubscribe?.(); } catch {}
            });
            marketState.clear();
            generations.clear();
        };
    }, []);

    return { snapshots, tickVersion, connected };
}
