/**
 * Deriv contract tick metadata helpers.
 *
 * The public `ticks` stream is useful for low-latency UI updates, but it is
 * not the contract's settlement ledger. `proposal_open_contract.tick_count`
 * and `tick_stream` are the authoritative contract-side values and are used
 * to reconcile the live counter.
 */

export type DerivContractTick = {
    epoch?: number | string;
    [key: string]: unknown;
};

export type TickSettlementMode = 'include-first-after-entry';

export function finiteEpoch(value: unknown): number | null {
    const epoch = Number(value);
    return Number.isFinite(epoch) && epoch > 0 ? epoch : null;
}

/**
 * The entry spot is never a duration tick. The first unique quote strictly
 * after the entry spot is settlement tick 1 for every market family. This is
 * important for 1-second Volatility and Jump indices: their faster stream must
 * not make a 3-tick contract display only T2.
 *
 * Keep this rule in one place so desktop and mobile never drift apart.
 */
export function getTickSettlementMode(symbol?: string | null): TickSettlementMode {
    // Keep the market argument in the API because settlement rules may grow,
    // but all currently supported tick-duration markets count post-entry tick
    // 1 consistently.
    void symbol;
    return 'include-first-after-entry';
}

export function countSettlementEpochs(
    epochs: unknown,
    entryEpoch?: number | null,
    symbol?: string | null,
): number {
    if (!Array.isArray(epochs)) return 0;

    const uniqueEpochs = new Set<number>();
    const anchor = finiteEpoch(entryEpoch);
    getTickSettlementMode(symbol);

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

        // The entry spot is not a settled duration tick. Every market starts
        // from the first unique tick strictly after the entry timestamp.
        const isSettlementTick = anchor === null || epoch > anchor;
        if (isSettlementTick) uniqueEpochs.add(epoch);
    }

    return [...uniqueEpochs].sort((a, b) => a - b).length;
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