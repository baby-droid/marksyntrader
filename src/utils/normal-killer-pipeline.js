export const NORMAL_KILLER_MAX_OPEN_CONTRACTS = 3;

export const createNormalKillerPipeline = () => ({
    currentStake: null,
    baseStake: null,
    multiplier: 2,
    takeProfit: 0,
    stopLoss: 0,
    lastPurchaseEpoch: null,
    nextSequence: 1,
    entries: [],
    riskTripped: false,
});

export const configureNormalKillerPipeline = (pipeline, config = {}) => {
    const currentStake = Number(config.currentStake);
    const baseStake = Number(config.baseStake);
    const multiplier = Number(config.multiplier);
    const takeProfit = Number(config.takeProfit);
    const stopLoss = Number(config.stopLoss);

    if (pipeline.currentStake == null && Number.isFinite(currentStake) && currentStake > 0) {
        pipeline.currentStake = currentStake;
    }
    if (Number.isFinite(baseStake) && baseStake > 0) pipeline.baseStake = baseStake;
    if (Number.isFinite(multiplier) && multiplier > 0) pipeline.multiplier = multiplier;
    if (Number.isFinite(takeProfit) && takeProfit >= 0) pipeline.takeProfit = takeProfit;
    if (Number.isFinite(stopLoss) && stopLoss >= 0) pipeline.stopLoss = stopLoss;

    return pipeline.currentStake;
};

export const getNormalKillerOpenCount = pipeline =>
    pipeline.entries.filter(entry => entry.status === 'pending' || entry.status === 'open').length;

/**
 * @param {any} pipeline
 * @param {{ epoch?: number, kind?: string, stake?: number, maxOpen?: number }} options
 */
export const reserveNormalKillerEntry = (pipeline, options = {}) => {
    const {
        epoch,
        kind,
        stake,
        maxOpen = NORMAL_KILLER_MAX_OPEN_CONTRACTS,
    } = options;
    const numericEpoch = Number(epoch);
    const numericStake = Number(stake);
    if (
        !Number.isFinite(numericEpoch)
        || !Number.isFinite(numericStake)
        || numericStake <= 0
        || pipeline.riskTripped
        || pipeline.entries.length >= maxOpen
        || getNormalKillerOpenCount(pipeline) >= maxOpen
        || pipeline.lastPurchaseEpoch === numericEpoch
    ) {
        return null;
    }

    const entry = {
        sequence: pipeline.nextSequence++,
        epoch: numericEpoch,
        kind,
        stake: numericStake,
        status: 'pending',
        contractId: null,
        won: null,
    };
    pipeline.entries.push(entry);
    pipeline.lastPurchaseEpoch = numericEpoch;
    return entry;
};

export const confirmNormalKillerEntry = (pipeline, entry, contractId) => {
    if (
        !entry
        || !pipeline.entries.includes(entry)
        || entry.status !== 'pending'
        || contractId == null
    ) return false;
    entry.contractId = contractId == null ? null : Number(contractId);
    entry.status = 'open';
    return true;
};

const drainSettledEntries = pipeline => {
    const applied = [];
    while (pipeline.entries.length > 0) {
        const entry = pipeline.entries[0];
        if (entry.status !== 'settled' && entry.status !== 'void') break;
        pipeline.entries.shift();
        if (entry.status === 'void') continue;

        const previousStake = Number(pipeline.currentStake);
        pipeline.currentStake = entry.won
            ? Number(pipeline.baseStake)
            : previousStake * Number(pipeline.multiplier);
        applied.push({
            sequence: entry.sequence,
            kind: entry.kind,
            won: entry.won,
            previousStake,
            nextStake: pipeline.currentStake,
        });
    }
    return applied;
};

export const voidNormalKillerEntry = (pipeline, entry) => {
    if (!entry || !pipeline.entries.includes(entry) || entry.status !== 'pending') return [];
    entry.status = 'void';
    return drainSettledEntries(pipeline);
};

export const settleNormalKillerEntry = (pipeline, entry, won) => {
    if (
        !entry
        || !pipeline.entries.includes(entry)
        || (entry.status !== 'pending' && entry.status !== 'open')
    ) return [];
    entry.status = 'settled';
    entry.won = Boolean(won);
    return drainSettledEntries(pipeline);
};

export const hasNormalKillerRiskLimitReached = (pipeline, totalProfit) => {
    const profit = Number(totalProfit);
    if (!Number.isFinite(profit)) return false;
    return (
        (pipeline.takeProfit > 0 && profit >= pipeline.takeProfit)
        || (pipeline.stopLoss > 0 && profit <= -pipeline.stopLoss)
    );
};
