/**
 * Trade Metadata Store
 *
 * Records execution context (speed mode, page, bot) for each contract.
 * Written at buy time via Purchase.js, read by the Reports modal.
 * Persisted in localStorage; capped at 500 entries (FIFO eviction).
 */

export interface TradeMeta {
    speed:    'normal' | 'crazy' | 'turbo';
    fast:     boolean;
    page:     string;   // e.g. 'Scalper Bots', 'Speed Lab', 'Free Bots', 'Bot Builder'
    bot:      string;   // specific bot/strategy name, or '' if unknown
    ts:       number;   // unix ms — for FIFO eviction
}

const STORE_KEY    = 'trade_metadata_v1';
const MAX_ENTRIES  = 500;

/** Current trade context — set by each page before it runs trades. */
let _activeCtx: Pick<TradeMeta, 'page' | 'bot'> = { page: 'Bot Builder', bot: '' };

/** Call this when a page/bot is about to start trading so the context
 *  is captured for all contracts bought during that session. */
export const setTradeContext = (ctx: Partial<Pick<TradeMeta, 'page' | 'bot'>>): void => {
    _activeCtx = { ..._activeCtx, ...ctx };
};

export const getTradeContext = (): Pick<TradeMeta, 'page' | 'bot'> => ({ ..._activeCtx });

/* ── Storage helpers ── */
function readStore(): Record<string, TradeMeta> {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function writeStore(store: Record<string, TradeMeta>): void {
    try {
        // Evict oldest if over cap
        const keys = Object.keys(store);
        if (keys.length > MAX_ENTRIES) {
            const sorted = keys.sort((a, b) => (store[a]?.ts ?? 0) - (store[b]?.ts ?? 0));
            sorted.slice(0, keys.length - MAX_ENTRIES).forEach(k => delete store[k]);
        }
        localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch { /* localStorage full — non-fatal */ }
}

/** Record metadata for a contract right after the buy response arrives. */
export const recordTradeMeta = (
    contractId: number | string,
    speedOverride?: Pick<TradeMeta, 'speed' | 'fast'>,
): void => {
    if (!contractId) return;
    const store = readStore();
    store[String(contractId)] = {
        speed: speedOverride?.speed ?? 'normal',
        fast:  speedOverride?.fast  ?? false,
        page:  _activeCtx.page,
        bot:   _activeCtx.bot,
        ts:    Date.now(),
    };
    writeStore(store);
};

/** Look up recorded metadata for a contract. Returns null if not found. */
export const getTradeMeta = (contractId: number | string): TradeMeta | null => {
    if (!contractId) return null;
    try {
        const store = readStore();
        return store[String(contractId)] ?? null;
    } catch { return null; }
};

/** Human-readable speed label. */
export const speedLabel = (meta: TradeMeta): string => {
    const tier = { normal: 'Normal', crazy: 'Crazy', turbo: 'Turbo' }[meta.speed] ?? meta.speed;
    return meta.fast ? `${tier} + ⚡ Fast` : tier;
};
