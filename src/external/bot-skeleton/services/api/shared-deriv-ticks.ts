import { recordTick } from '@/utils/execution-speed';

type TickObserver = {
    next?: (message: any) => void;
    error?: (error: unknown) => void;
};

type TickApi = {
    subscribe: (request: { ticks: string; subscribe: 1 }) => {
        subscribe: (observer: {
            next: (message: any) => void;
            error: (error: unknown) => void;
            complete: () => void;
        }) => { unsubscribe?: () => void };
    };
};

type TickEntry = {
    api: TickApi;
    symbol: string;
    observers: Map<number, TickObserver>;
    subscription: { unsubscribe?: () => void } | null;
    seenIds: Set<string>;
    closed: boolean;
};

const feedsByApi = new WeakMap<object, Map<string, TickEntry>>();
let nextObserverId = 0;

const removeEntry = (entry: TickEntry) => {
    const apiFeeds = feedsByApi.get(entry.api as object);
    if (apiFeeds?.get(entry.symbol) === entry) {
        apiFeeds.delete(entry.symbol);
        if (!apiFeeds.size) feedsByApi.delete(entry.api as object);
    }
};

const notifyError = (entry: TickEntry, error: unknown) => {
    if (entry.closed) return;
    entry.closed = true;
    const observers = Array.from(entry.observers.values());
    entry.observers.clear();
    removeEntry(entry);
    try {
        entry.subscription?.unsubscribe?.();
    } catch {
        // The source may already be closed.
    }
    entry.subscription = null;
    observers.forEach(observer => {
        try {
            observer.error?.(error);
        } catch {
            // One consumer must not interrupt error delivery to other bots.
        }
    });
};

const startFeed = (entry: TickEntry) => {
    if (entry.subscription || entry.closed || !entry.observers.size) return;

    try {
        const source = entry.api.subscribe({ ticks: entry.symbol, subscribe: 1 });
        if (!source || typeof source.subscribe !== 'function') {
            throw new Error(`Deriv did not create a tick feed for ${entry.symbol}.`);
        }

        const subscription = source.subscribe({
            next: message => {
                const apiError = message?.error ?? message?.data?.error;
                if (apiError) {
                    const messageText = apiError?.message || apiError?.code || 'Deriv rejected the tick subscription.';
                    notifyError(entry, new Error(String(messageText)));
                    return;
                }
                const tick = message?.tick ?? message?.data?.tick;
                if (tick?.symbol && tick.symbol !== entry.symbol) return;

                if (tick?.id !== undefined && tick?.id !== null && String(tick.id) !== '') {
                    const id = String(tick.id);
                    if (entry.seenIds.has(id)) return;
                    entry.seenIds.add(id);
                    if (entry.seenIds.size > 2048) {
                        const oldestId = entry.seenIds.values().next().value;
                        if (oldestId !== undefined) entry.seenIds.delete(oldestId);
                    }
                }

                if (tick) recordTick();
                Array.from(entry.observers.values()).forEach(observer => {
                    try {
                        observer.next?.(message);
                    } catch (error) {
                        try {
                            observer.error?.(error);
                        } catch {
                            // A failing consumer must not stall another bot's tick.
                        }
                    }
                });
            },
            error: error => notifyError(entry, error),
            complete: () => notifyError(entry, new Error(`Deriv tick feed for ${entry.symbol} closed.`)),
        });

        entry.subscription = subscription;
        if (entry.closed) subscription?.unsubscribe?.();
    } catch (error) {
        notifyError(entry, error);
    }
};

/**
 * Share one authenticated Deriv tick subscription per API object and symbol.
 * Each caller retains its own callback/state; the router only fans out actual
 * tick messages and suppresses repeated API tick IDs, never equal prices.
 */
export const subscribeSharedDerivTicks = (
    api: TickApi | null | undefined,
    symbol: string,
    observer: TickObserver,
): { unsubscribe: () => void } => {
    const normalizedSymbol = String(symbol || '').trim();
    if (!api || typeof api.subscribe !== 'function' || !normalizedSymbol) {
        observer.error?.(new Error('A connected Deriv API and market symbol are required for live ticks.'));
        return { unsubscribe: () => {} };
    }

    let apiFeeds = feedsByApi.get(api as object);
    if (!apiFeeds) {
        apiFeeds = new Map();
        feedsByApi.set(api as object, apiFeeds);
    }

    let entry = apiFeeds.get(normalizedSymbol);
    if (!entry) {
        entry = {
            api,
            symbol: normalizedSymbol,
            observers: new Map(),
            subscription: null,
            seenIds: new Set(),
            closed: false,
        };
        apiFeeds.set(normalizedSymbol, entry);
    }

    const observerId = ++nextObserverId;
    entry.observers.set(observerId, observer);
    startFeed(entry);

    let unsubscribed = false;
    return {
        unsubscribe: () => {
            if (unsubscribed) return;
            unsubscribed = true;
            entry?.observers.delete(observerId);
            if (!entry || entry.observers.size || entry.closed) return;

            removeEntry(entry);
            try {
                entry.subscription?.unsubscribe?.();
            } catch {
                // A closed socket or expired feed is already detached.
            }
            entry.subscription = null;
            entry.closed = true;
        },
    };
};
