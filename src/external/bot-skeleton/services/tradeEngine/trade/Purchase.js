import { getExecutionSpeed, getExecutionSpeedDelay, isFastExecutionEnabled, isASpeedBoostEnabled, getPurchasesPerTick } from '../../../../../utils/execution-speed';
import { recordTradeMeta } from '../../../../../utils/trade-metadata';
import { isBotPaused } from '../../../../../utils/bot-pause-flag';
import { LogTypes } from '../../../constants/messages';
import { api_base } from '../../api/api-base';
import { contractStatus, info, log } from '../utils/broadcast';
import { doUntilDone, getUUID, recoverFromError, tradeOptionToBuy } from '../utils/helpers';
import { purchaseSuccessful } from './state/actions';
import { BEFORE_PURCHASE } from './state/constants';
import {
    createTradeKey,
    getMasterSource,
    normalizeLimitOrder,
    publishMasterTrade,
} from '../../../../../utils/trade-bus';

let delayIndex = 0;
let purchase_reference;

// --- Rate-limit-aware buy queue ---
// Normal=1/s sequential. Crazy/Turbo set to 0 = bypass throttle entirely
// for true zero-delay fire-and-forget (the API server enforces its own limits).
let _buyTimestamps = [];
const _buyRateLimit = { normal: 1, crazy: 0, turbo: 0, supersonic: 0 };

/**
 * Build the same copy-trade payload for every Bot Builder purchase path.
 * Crazy/Turbo side purchases bypass OpenContract subscriptions, so they must
 * publish here instead of relying only on the bot.contract bridge.
 */
function copySignalFromTradeOptions(tradeOptions, contract_type, contract_id, trade_key) {
    const symbol = tradeOptions?.symbol;
    const stake = Number(tradeOptions?.amount);
    if (!symbol || !contract_type || !Number.isFinite(stake) || stake <= 0) return null;

    const isAccumulator = String(contract_type).toUpperCase() === 'ACCU';
    const signal = {
        symbol,
        contract_type,
        stake,
        ...(isAccumulator
            ? {}
            : {
                duration: Number(tradeOptions?.duration ?? 1),
                duration_unit: tradeOptions?.duration_unit ?? 't',
            }),
        ...(tradeOptions?.prediction !== undefined
            ? { barrier: tradeOptions.prediction }
            : tradeOptions?.barrierOffset !== undefined
                ? { barrier: tradeOptions.barrierOffset }
                : {}),
        ...(tradeOptions?.growth_rate != null
            ? { growth_rate: Number(tradeOptions.growth_rate) }
            : {}),
        ...(normalizeLimitOrder(tradeOptions?.limit_order)
            ? { limit_order: normalizeLimitOrder(tradeOptions.limit_order) }
            : {}),
        source: getMasterSource(),
        time: Date.now(),
        ...(contract_id != null ? { contract_id: Number(contract_id) } : {}),
        ...(trade_key ? { trade_key } : {}),
    };
    return signal;
}

function publishBotCopySignal(tradeOptions, contract_type, contract_id, trade_key) {
    const key = trade_key ?? createTradeKey('bot');
    const signal = copySignalFromTradeOptions(tradeOptions, contract_type, contract_id, key);
    if (!signal) return key;
    try {
        publishMasterTrade(signal);
    } catch {
        // Copy-trading must never interrupt the master Bot Builder purchase.
    }
    return key;
}

// Side purchases (Crazy/Turbo's extra per-tick contracts) are NOT tracked by
// the main single-contract state machine, so Stop/Terminate cannot see them
// through the normal contractId/isSold path. We keep our own registry here
// and force-sell everything in it whenever the bot is stopped, so pressing
// Stop always closes every open position — not just the one the engine was
// actively tracking.
const _sideContractIds = new Set();

export function sellAllSideContracts() {
    const ids = Array.from(_sideContractIds);
    _sideContractIds.clear();
    ids.forEach(contract_id => {
        api_base.api.send({ sell: contract_id, price: 0 }).catch(() => {
            /* already sold/expired — nothing to do */
        });
    });
}

function _acquireBuySlot() {
    const speed = getExecutionSpeed();
    const limit  = _buyRateLimit[speed] ?? 1;
    // In crazy / turbo / Fast mode skip the throttle entirely — resolve immediately.
    if (limit === 0 || isFastExecutionEnabled()) return Promise.resolve();
    const now    = Date.now();
    // Remove timestamps older than 1 second
    _buyTimestamps = _buyTimestamps.filter(t => now - t < 1000);
    if (_buyTimestamps.length < limit) {
        _buyTimestamps.push(now);
        return Promise.resolve();
    }
    // Wait until the oldest stamp falls out of the 1-second window
    const wait = 1000 - (now - _buyTimestamps[0]) + 5;
    return new Promise(resolve => setTimeout(resolve, wait)).then(_acquireBuySlot);
}

// Fires an extra, independent contract purchase alongside the engine's main
// tracked contract. Used by Crazy/Turbo to place several purchases within the
// same tick. These side purchases deliberately do NOT touch the shared
// Purchase engine state (this.contractId / this.isSold / store scope) — that
// state machine drives afterPurchase/trade-again/martingale for ONE contract
// at a time, and is not safe to share across concurrent contracts. Side
// purchases still go through the real API, settle independently, and show up
// normally in transactions/reports/balance.
function fireSidePurchase(tradeOptions, contract_type, tradeOptionsOverride = tradeOptions) {
    // Do NOT fire side purchases while the bot is paused.
    if (isBotPaused()) return;
    try {
        const trade_option = tradeOptionToBuy(contract_type, tradeOptionsOverride);
        // Publish before the direct buy so followers enter on the same tick.
        // The confirmation below registers the contract ID for deduplication.
        const tradeKey = createTradeKey('bot-side');
        publishBotCopySignal(tradeOptionsOverride, contract_type, undefined, tradeKey);
        _acquireBuySlot()
            .then(() => api_base.api.send(trade_option))
            .then(response => {
                const { buy } = response;
                if (!buy) return;
                if (buy.contract_id) _sideContractIds.add(buy.contract_id);
                publishBotCopySignal(tradeOptionsOverride, contract_type, buy.contract_id, tradeKey);
                contractStatus({ id: 'contract.purchase_received', data: buy.transaction_id, buy });
                log(LogTypes.PURCHASE, { transaction_id: buy.transaction_id });
            })
            .catch(() => {
                /* side purchase failures are non-fatal — main contract is unaffected */
            });
    } catch (e) {
        /* ignore — never let a side purchase break the main strategy flow */
    }
}

export default Engine =>
    class Purchase extends Engine {
        purchase(contract_type) {
            // Prevent calling purchase twice
            if (this.store.getState().scope !== BEFORE_PURCHASE) {
                return Promise.resolve();
            }

            // Do NOT buy while paused — the interpreter's async callback already
            // skips loop() when paused_, but purchase() is called synchronously
            // before that check, so we guard here as well.
            if (isBotPaused()) return Promise.resolve();

            // Speed-tier fan-out: Normal fires 1 purchase per tick. Explicit
            // Crazy/Turbo can still use their legacy side-contract throughput,
            // but A-SPEED BOOST is a latency preset and must remain one order
            // per tick.
            const speed = getExecutionSpeed();
            const purchases_per_tick = getPurchasesPerTick();
            if (purchases_per_tick > 1 && this.tradeOptions) {
                for (let i = 0; i < purchases_per_tick - 1; i++) {
                    fireSidePurchase(this.tradeOptions, contract_type);
                }
            }

            // Execution-speed throttle (Normal/Crazy/Turbo selector beside Run).
            const speed_delay = getExecutionSpeedDelay();
            if (speed_delay > 0) {
                return new Promise(resolve => setTimeout(resolve, speed_delay)).then(() => {
                    if (this.store.getState().scope !== BEFORE_PURCHASE) {
                        return Promise.resolve();
                    }
                    return this._executePurchase(contract_type);
                });
            }
            return this._executePurchase(contract_type);
        }

        purchaseMultiple(contract_types = []) {
            if (this.store.getState().scope !== BEFORE_PURCHASE || isBotPaused()) {
                return Promise.resolve();
            }

            const specs = contract_types
                .map(spec => typeof spec === 'string' ? { contract_type: spec } : spec)
                .filter(spec => spec?.contract_type);
            const unique_specs = specs.filter((spec, index, all) =>
                all.findIndex(candidate =>
                    candidate.contract_type === spec.contract_type &&
                    candidate.prediction === spec.prediction
                ) === index
            );
            if (!unique_specs.length) return Promise.resolve();

            // Multiple Purchase is also used by strategy blocks that provide
            // several same-tick contracts. A-SPEED BOOST explicitly means
            // one contract for one tick, so keep only the first selected
            // contract and do not create untracked side orders.
            const effective_specs = isASpeedBoostEnabled()
                ? unique_specs.slice(0, 1)
                : unique_specs;

            /* A prediction supplied by the XML purchase block is intentionally
               bought directly. Proposals are created once by Bot.start(), so
               selecting a different barrier after the first settlement would
               otherwise reuse the first phase's proposal and stop the bot. */
            const hasDynamicOptions = effective_specs.some(spec =>
                spec.dynamic === true || spec.prediction !== undefined
            );
            if (hasDynamicOptions) {
                effective_specs.slice(1).forEach(spec => {
                    fireSidePurchase(this.tradeOptions, spec.contract_type, {
                        ...this.tradeOptions,
                        amount: spec.amount ?? this.tradeOptions.amount,
                        prediction: spec.prediction,
                    });
                });
                return this._executePurchase(
                    effective_specs[0].contract_type,
                    {
                        ...this.tradeOptions,
                        amount: effective_specs[0].amount ?? this.tradeOptions.amount,
                        prediction: effective_specs[0].prediction,
                    },
                    true
                );
            }

            // The first contract follows the normal tracked lifecycle. The
            // remaining contracts are independent same-tick purchases.
            effective_specs.slice(1).forEach(spec => {
                fireSidePurchase(this.tradeOptions, spec.contract_type);
            });

            return this.purchase(effective_specs[0].contract_type);
        }

        _executePurchase(contract_type, tradeOptions = this.tradeOptions, forceDirect = false) {
            let tradeKey = null;
            const onSuccess = response => {
                const { buy } = response;

                contractStatus({
                    id: 'contract.purchase_received',
                    data: buy.transaction_id,
                    buy,
                });

                // Record speed mode + page/bot context for this contract
                try {
                    recordTradeMeta(buy.contract_id, {
                        speed: getExecutionSpeed(),
                        fast:  isFastExecutionEnabled(),
                    });
                } catch { /* non-fatal */ }

                this.contractId = buy.contract_id;
                this.store.dispatch(purchaseSuccessful());
                // Confirm the pre-signal with the master contract ID. This lets
                // copy-trading register the ID and block the later bot.contract
                // or transaction-backup signal from buying a duplicate.
                if (tradeKey) {
                    publishBotCopySignal(tradeOptions, contract_type, buy.contract_id, tradeKey);
                }

                // Dynamic Multiple Purchase entries are bought directly from
                // the phase-specific parameters. Refreshing the old proposal
                // subscription here races the next before_purchase handoff
                // and can leave the interpreter waiting in the previous
                // phase. The next Bot.start() refreshes proposals when the
                // phase or stake changes; keep the eager refresh for the
                // normal proposal-based purchase path.
                if (this.is_proposal_subscription_required && !forceDirect) {
                    this.renewProposalsOnPurchase();
                }

                delayIndex = 0;
                log(LogTypes.PURCHASE, { transaction_id: buy.transaction_id });
                info({
                    accountID: this.accountInfo.loginid,
                    totalRuns: this.updateAndReturnTotalRuns(),
                    transaction_ids: { buy: buy.transaction_id },
                    contract_type,
                    buy_price: buy.buy_price,
                });
            };

            const speed = getExecutionSpeed();
            // In Crazy/Turbo mode bypass the proposal-wait round-trip: use direct
            // buy parameters instead of a pre-fetched proposal ID. This eliminates
            // the proposal→wait→buy latency that was the main throughput bottleneck.
            // Fast Execution and A-SPEED bypass the proposal round-trip just like
            // Crazy/Turbo — the biggest single source of purchase latency.
            const useDirectBuy =
                forceDirect ||
                (isFastExecutionEnabled() || isASpeedBoostEnabled() || speed === 'crazy' || speed === 'turbo' || speed === 'supersonic') &&
                !this.options.timeMachineEnabled;

            if (this.is_proposal_subscription_required && !useDirectBuy) {
                // ── Original proposal-based path (Normal speed / timeMachine) ──
                const { id, askPrice } = this.selectProposal(contract_type);
                tradeKey = createTradeKey('bot');
                publishBotCopySignal(tradeOptions, contract_type, undefined, tradeKey);

                const action = () => _acquireBuySlot().then(() =>
                    api_base.api.send({ buy: id, price: askPrice })
                );

                this.isSold = false;

                contractStatus({
                    id: 'contract.purchase_sent',
                    data: askPrice,
                });

                if (!this.options.timeMachineEnabled) {
                    return doUntilDone(action).then(onSuccess);
                }

                return recoverFromError(
                    action,
                    (errorCode, makeDelay) => {
                        if (errorCode !== 'DisconnectError') {
                            this.renewProposalsOnPurchase();
                        } else {
                            this.clearProposals();
                        }

                        const unsubscribe = this.store.subscribe(() => {
                            const { scope, proposalsReady } = this.store.getState();
                            if (scope === BEFORE_PURCHASE && proposalsReady) {
                                makeDelay().then(() => this.observer.emit('REVERT', 'before'));
                                unsubscribe();
                            }
                        });
                    },
                    ['PriceMoved', 'InvalidContractProposal'],
                    delayIndex++
                ).then(onSuccess);
            }

            // ── Direct-buy path (Crazy/Turbo, or no payout block) ──
            // Build the buy request from current trade options — no proposal ID
            // needed. The rate-limiter slot ensures we stay within API limits.
            const trade_option = tradeOptionToBuy(contract_type, tradeOptions);
            tradeKey = createTradeKey('bot');
            publishBotCopySignal(tradeOptions, contract_type, undefined, tradeKey);
            const action = () => _acquireBuySlot().then(() =>
                api_base.api.send(trade_option)
            );

            this.isSold = false;

            contractStatus({
                id: 'contract.purchase_sent',
                data: tradeOptions.amount,
            });

            if (!this.options.timeMachineEnabled) {
                return doUntilDone(action).then(onSuccess);
            }

            return recoverFromError(
                action,
                (errorCode, makeDelay) => {
                    if (errorCode === 'DisconnectError') {
                        this.clearProposals();
                    }
                    const unsubscribe = this.store.subscribe(() => {
                        const { scope } = this.store.getState();
                        if (scope === BEFORE_PURCHASE) {
                            makeDelay().then(() => this.observer.emit('REVERT', 'before'));
                            unsubscribe();
                        }
                    });
                },
                ['PriceMoved', 'InvalidContractProposal'],
                delayIndex++
            ).then(onSuccess);
        }
        getPurchaseReference = () => purchase_reference;
        regeneratePurchaseReference = () => {
            purchase_reference = getUUID();
        };
    };
