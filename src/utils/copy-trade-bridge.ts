/**
 * Copy-trade bridge — intercepts DBot / Blockly bot engine trades and
 * publishes them to the trade bus so the copy-trading engine can mirror
 * them to follower accounts.
 *
 * DBot emits `globalObserver('bot.contract', contractObj)` for every
 * proposal_open_contract state change.  We capture the FIRST emission
 * per contract_id (the open / buy event) and publish a MasterTradeSignal.
 * Subsequent emissions (settlement) are ignored because the follower has
 * already placed their own copy of the trade.
 *
 * This module self-initialises on import — import it ONCE (from
 * copy-trading.ts) and the listener stays active for the app lifetime.
 */

import { observer as globalObserver } from '@/external/bot-skeleton/utils/observer';
import { publishMasterTrade, getMasterSource } from './trade-bus';

/** Contract IDs already published — prevents double-publish on open + settled events. */
const published = new Set<number>();
const MAX_PUBLISHED = 500; // cap so the set doesn't grow forever

function onBotContract(contract: any): void {
    if (!contract) return;

    // Only copy on BUY (open), not on settlement.
    // is_sold / is_expired being true means the contract has already closed.
    if (contract.is_sold || contract.is_expired) return;

    const cid = Number(contract.contract_id);
    if (!cid) return;

    // Deduplicate — bot.contract can fire multiple times for the same open contract
    if (published.has(cid)) return;
    published.add(cid);

    // Evict the oldest entry once the set gets too large
    if (published.size > MAX_PUBLISHED) {
        const first = published.values().next().value as number;
        published.delete(first);
    }

    // Extract trade parameters from the proposal_open_contract object
    const symbol        = contract.underlying_symbol ?? contract.symbol;
    const contract_type = contract.contract_type;
    // buy_price is the actual stake deducted from the account
    const stake         = Number(contract.buy_price ?? contract.stake ?? 0);
    // For tick contracts duration_unit === 't' and duration === tick count
    const duration      = Number(contract.duration ?? contract.ticks_count ?? 5);
    const duration_unit = (contract.duration_unit as string | undefined) ?? 't';
    // barrier is optional — only present for digit / barrier contract types
    const barrier       = contract.barrier ?? undefined;

    if (!symbol || !contract_type || stake <= 0) return;

    try {
        publishMasterTrade({
            symbol,
            contract_type,
            stake,
            duration,
            duration_unit,
            barrier,
            source:      getMasterSource(),
            time:        Date.now(),
            contract_id: cid,
        });
    } catch { /* never let copy-trade errors affect the running bot */ }
}

// Install the listener once at module-load time
try {
    globalObserver.register('bot.contract', onBotContract);
} catch {
    // Observer may not be available at import time in some test environments
}
