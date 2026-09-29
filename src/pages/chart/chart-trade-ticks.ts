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

export type TickSettlementMode = 'include-entry-spot' | 'include-first-after-entry';

export function finiteEpoch(value: unknown): number | null {
    const epoch = Number(value);
    return Number.isFinite(epoch) && epoch > 0 ? epoch : null;
}

/**
 * Deriv's entry spot is the first contract tick. The contract counter starts
 * at that spot (T1), so the live feed and proposal_open_contract.tick_stream
 * use the same inclusive epoch anchor for every market family.
 *
 * Keep this rule in one place so desktop and mobile never drift apart.
 */
export function getTickSettlementMode(symbol?: string | null): TickSettlementMode {
    void symbol;
    return 'include-entry-spot';
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

        // The entry spot is T1. Inclusive matching is important for fast
        // markets because the authenticated feed can deliver that tick before
        // the POC entry_spot_time event reaches the UI.
        const isSettlementTick = anchor === null || epoch >= anchor;
        if (isSettlementTick) uniqueEpochs.add(epoch);
    }

    const sortedEpochs = [...uniqueEpochs].sort((a, b) => a - b);
    return settlementMode === 'include-entry-spot' || settlementMode === 'include-first-after-entry'
        ? sortedEpochs.length
        : 0;
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