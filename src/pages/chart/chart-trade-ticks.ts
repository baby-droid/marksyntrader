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

export function finiteEpoch(value: unknown): number | null {
    const epoch = Number(value);
    return Number.isFinite(epoch) && epoch > 0 ? epoch : null;
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
): number | null {
    if (!Array.isArray(stream)) return null;

    const epochs = new Set<number>();
    for (const item of stream as Array<DerivContractTick | number | string>) {
        const epoch = typeof item === 'object' && item !== null
            ? (
                finiteEpoch((item as DerivContractTick).epoch)
                ?? finiteEpoch((item as DerivContractTick).tick_time)
                ?? finiteEpoch((item as DerivContractTick).time)
            )
            : finiteEpoch(item);
        if (epoch !== null && (entryEpoch == null || epoch >= entryEpoch)) {
            epochs.add(epoch);
        }
    }

    // Some historical responses contain stream entries without epoch. In
    // that case the array itself is still the best contract-side count.
    return epochs.size > 0 ? epochs.size : stream.length;
}

export function clampContractTickCount(count: number, totalTicks: number): number {
    return Math.max(0, Math.min(Math.floor(count), Math.max(0, totalTicks)));
}