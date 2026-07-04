/**
 * Lightweight app-wide bus that broadcasts every buy the master account makes,
 * with the full contract parameters. The copy-trading engine subscribes to this
 * to mirror trades onto follower accounts in real time.
 */

export interface MasterTradeSignal {
    symbol: string;
    contract_type: string;
    stake: number;
    duration: number;
    duration_unit: string;
    barrier?: string | number;
    /** 'real' or 'demo' — the master account the trade originated from. */
    source: 'real' | 'demo';
    time: number;
}

type Listener = (signal: MasterTradeSignal) => void;

const listeners = new Set<Listener>();

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
