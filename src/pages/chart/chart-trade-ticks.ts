/**
 * Deriv contract tick metadata helpers.
 *
 * The public `ticks` stream is useful for low-latency UI updates, but it is
 * not the contract's settlement ledger. `proposal_open_contract.tick_count`
 * and `tick_stream` are used to anchor and verify contract settlement. The
 * visible counter follows the live tick stream and is reconciled with the
 * contract stream so it remains real-time without drifting.
 */

export type DerivContractTick = {
    epoch?: number | string;
    [key: string]: unknown;
};

export type TickSettlementMode = 'include-first-after-entry' | 'skip-first-after-entry';

export function finiteEpoch(value: unknown): number | null {
    const epoch = Number(value);
    return Number.isFinite(epoch) && epoch > 0 ? epoch : null;
}

/**
 * The entry spot is the anchor, not a numbered settlement tick. Plain
 * Volatility, Bear, and Bull contracts count the first quote after entry as
 * T1. 1-second Volatility and Jump markets expose one leading post-entry
 * quote, so that quote is discarded and the following quote is T1.
 *
 * Keep this rule in one place so desktop and mobile never drift apart.
 */
export function getTickSettlementMode(symbol?: string | null): TickSettlementMode {
    const normalized = String(symbol ?? '').toUpperCase();
    return /^1HZ/.test(normalized) || /^JD/.test(normalized)
        ? 'skip-first-after-entry'
        : 'include-first-after-entry';
}

export function countSettlementEpochs(
    epochs: unknown,
    entryEpoch?: number | null,
    symbol?: string | null,
): number {
    if (!Array.isArray(epochs)) return 0;

    const uniqueEpochs = new Set<number>();
    const anchor = finiteEpoch(entryEpoch);
    const settlementMode = getTickSettlementMode(symbol);
    for (const value of epochs) {
        const epoch = finiteEpoch(
            typeof value === 'object' && value !== null
                ? (
                    (value as DerivContractTick).epoch
                    ?? (value as DerivContractTick).tick_time
                    ?? (value as DerivContractTick).time
                )
                : value,
        );
        if (epoch === null) continue;

        // The entry spot is only the anchor. Numbered settlement ticks start
        // strictly after it, so entry=9 followed by 0,1,2 is T1/T2/T3 on
        // plain markets.
        const isSettlementTick = anchor === null || epoch > anchor;
        if (isSettlementTick) uniqueEpochs.add(epoch);
    }

    const sortedEpochs = [...uniqueEpochs].sort((a, b) => a - b);
    return settlementMode === 'skip-first-after-entry'
        ? Math.max(0, sortedEpochs.length - 1)
        : sortedEpochs.length;
}

export function getPocEntryEpoch(poc: Record<string, unknown>): number | null {
    // entry_spot_time is the documented field. Keep entry_tick_time as a
    // compatibility fallback for older Deriv responses.
    return finiteEpoch(poc.entry_spot_time) ?? finiteEpoch(poc.entry_tick_time);
}

export function getPocTickCount(poc: Record<string, unknown>): number | null {
    const count = Number(poc.tick_count);
    return Number.isFinite(count) && count >= 0 ? Math.floor(count) : null;
}

export function getPocStreamCount(
    stream: unknown,
    entryEpoch?: number | null,
    symbol?: string | null,
): number | null {
    if (!Array.isArray(stream)) return null;

    const epochValues: unknown[] = [];
    let hasEpoch = false;
    for (const item of stream as Array<DerivContractTick | number | string>) {
        const epoch = typeof item === 'object' && item !== null
            ? (
                (item as DerivContractTick).epoch
                ?? (item as DerivContractTick).tick_time
                ?? (item as DerivContractTick).time
            )
            : item;
        if (finiteEpoch(epoch) !== null) hasEpoch = true;
        epochValues.push(epoch);
    }

    // Some historical responses contain stream entries without epoch. In
    // that case the array itself is still the best contract-side count.
    return hasEpoch
        ? countSettlementEpochs(epochValues, entryEpoch, symbol)
        : stream.length;
}

export function clampContractTickCount(count: number, totalTicks: number): number {
    return Math.max(0, Math.min(Math.floor(count), Math.max(0, totalTicks)));
}