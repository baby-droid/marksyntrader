/**
 * Lightweight app-wide bus that broadcasts every buy the master account makes,
 * with the full contract parameters. The copy-trading engine subscribes to this
 * to mirror trades onto follower accounts in real time.
 */

export interface MasterTradeSignal {
    symbol: string;
    contract_type: string;
    stake: number;
    duration?: number;
    duration_unit?: string;
    barrier?: string | number;
    growth_rate?: number;
    limit_order?: { take_profit?: number };
    /** 'real' or 'demo' — the master account the trade originated from. */
    source: 'real' | 'demo';
    time: number;
    /** Optional contract_id for deduplication — prevents double-mirroring when
     *  both the direct publish path and the transaction-subscription fallback fire. */
    contract_id?: number;
    /** Optional per-purchase identity. Required when several identical
     *  contracts are intentionally bought within the deduplication window. */
    trade_key?: string;
}

/**
 * Determines the master account type reliably using localStorage keys that are
 * set by api-base.ts immediately after authorization.
 *
 * This is the canonical source-of-truth for copy-trading source detection.
 * Do NOT use `api_base.account_info.is_virtual` directly — it was historically
 * missing the `is_virtual` field, causing all demo-mode signals to be silently dropped.
 */
export function getMasterSource(): 'real' | 'demo' {
    try {
        // Primary: account_type is written by api-base after every successful auth
        const stored = localStorage.getItem('account_type');
        if (stored === 'demo') return 'demo';
        if (stored === 'real') return 'real';
        // Fallback: inspect active loginid prefix (VRTC / VRW / DEM = demo)
        const loginid = localStorage.getItem('active_loginid') ?? '';
        if (
            loginid.startsWith('VRTC') ||
            loginid.startsWith('VRW') ||
            loginid.startsWith('DEM') ||
            loginid.startsWith('DOT')
        ) return 'demo';
    } catch { /* localStorage unavailable */ }
    return 'real';
}

type Listener = (signal: MasterTradeSignal) => void;

const listeners = new Set<Listener>();
let tradeSequence = 0;

/** Creates a per-purchase identity so rapid repeated trades are not collapsed
 * by the copy engine's safety fingerprint deduplication. */
export const createTradeKey = (prefix = 'trade'): string =>
    `${prefix}-${Date.now()}-${++tradeSequence}`;

export const publishMasterTrade = (signal: MasterTradeSignal): void => {
    listeners.forEach(l => {
        try {
            l(signal);
        } catch {
            /* isolate listener errors */
        }
    });
};

export const subscribeMasterTrades = (cb: Listener): (() => void) => {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
};
