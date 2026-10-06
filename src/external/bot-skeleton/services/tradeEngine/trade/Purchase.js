import { getExecutionSpeed, getExecutionSpeedDelay, isInstantExecutionForContext, isASpeedBoostEnabled, getPurchasesPerTick } from '../../../../../utils/execution-speed';
import { recordTradeMeta } from '../../../../../utils/trade-metadata';
import { isBotPaused } from '../../../../../utils/bot-pause-flag';
import { LogTypes } from '../../../constants/messages';
import { api_base } from '../../api/api-base';
import { contract as broadcastContract, contractStatus, info, log } from '../utils/broadcast';
import { doUntilDone, getUUID, recoverFromError, tradeOptionToBuy } from '../utils/helpers';
import { purchaseSuccessful } from './state/actions';
import { BEFORE_PURCHASE, DURING_PURCHASE } from './state/constants';
import { applyCommission } from '@/utils/commission';
import { observer as globalObserver } from '../../../utils/observer';
import { isNormalKillerBotV3Context } from '../../../../../utils/execution-speed';
import {
    configureNormalKillerPipeline,
    confirmNormalKillerEntry,
    createNormalKillerPipeline,
    getNormalKillerOpenCount,
    hasNormalKillerRiskLimitReached,
    getNormalKillerContractWinResult,
    isNormalKillerContractSettled,
    reserveNormalKillerEntry,
    settleNormalKillerEntry,
    voidNormalKillerEntry,
    NORMAL_KILLER_MAX_OPEN_CONTRACTS,
} from '../../../../../utils/normal-killer-pipeline';
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
    if (limit === 0 || isInstantExecutionForContext()) return Promise.resolve();
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
function fireSidePurchase(
    tradeOptions,
    contract_type,
    tradeOptionsOverride = tradeOptions,
    {
        bypassRateLimit = false,
        trackSettlement = false,
        settlementTimeoutMs = 10000,
        onPurchased,
        onUpdated,
        onSettled,
        onFailed,
        onTrackingError,
        isSettled = contract => Boolean(contract?.is_sold),
    } = {},
) {
    // Do NOT fire side purchases while the bot is paused.
    if (isBotPaused()) return trackSettlement ? Promise.resolve() : undefined;
    let resolveSettlement;
    const settlementPromise = trackSettlement
        ? new Promise(resolve => {
            resolveSettlement = resolve;
        })
        : null;
    const finishSettlement = () => {
        if (resolveSettlement) {
            resolveSettlement();
            resolveSettlement = null;
        }
    };
    try {
        const trade_option = tradeOptionToBuy(contract_type, tradeOptionsOverride);
        // Publish before the direct buy so followers enter on the same tick.
        // The confirmation below registers the contract ID for deduplication.
        const tradeKey = createTradeKey('bot-side');
        publishBotCopySignal(tradeOptionsOverride, contract_type, undefined, tradeKey);
        (bypassRateLimit ? Promise.resolve() : _acquireBuySlot())
            .then(() => api_base.api.send(trade_option))
            .then(response => {
                const { buy } = response;
                if (!buy) {
                    onFailed?.(new Error('The side purchase response did not include a contract.'));
                    finishSettlement();
                    return;
                }
                if (buy.contract_id) _sideContractIds.add(buy.contract_id);
                onPurchased?.(buy);
                publishBotCopySignal(tradeOptionsOverride, contract_type, buy.contract_id, tradeKey);
                contractStatus({ id: 'contract.purchase_received', data: buy.transaction_id, buy });
                log(LogTypes.PURCHASE, { transaction_id: buy.transaction_id });
                if (!trackSettlement) {
                    finishSettlement();
                    return;
                }
                if (!buy.contract_id) {
                    onFailed?.(new Error('The side purchase was accepted without a contract ID.'));
                    finishSettlement();
                    return;
                }

                let settled = false;
                let settlementSubscription;
                const settlementTimeout = settlementTimeoutMs > 0
                    ? setTimeout(() => {
                        finishSettlement();
                        settlementSubscription?.unsubscribe?.();
                    }, settlementTimeoutMs)
                    : null;
                const complete = () => {
                    if (settled) return;
                    settled = true;
                    if (settlementTimeout) clearTimeout(settlementTimeout);
                    settlementSubscription?.unsubscribe?.();
                    finishSettlement();
                };
                try {
                    settlementSubscription = api_base.api
                        .subscribe({
                            proposal_open_contract: 1,
                            contract_id: Number(buy.contract_id),
                        })
                        .subscribe(
                            ({ data }) => {
                                const contract = data?.proposal_open_contract;
                                if (
                                    !contract
                                    || Number(contract.contract_id) !== Number(buy.contract_id)
                                ) return;
                                try {
                                    onUpdated?.(contract);
                                } catch { /* UI updates cannot interrupt settlement tracking */ }
                                broadcastContract({
                                    accountID: api_base.account_info?.loginid,
                                    ...contract,
                                });
                                if (!isSettled(contract)) return;
                                _sideContractIds.delete(buy.contract_id);
                                try {
                                    onSettled?.(contract);
                                } finally {
                                    complete();
                                }
                            },
                            error => {
                                onTrackingError?.(error);
                                complete();
                            },
                        );
                    if (settled) settlementSubscription?.unsubscribe?.();
                } catch (error) {
                    onTrackingError?.(error);
                    complete();
                }
            })
            .catch(error => {
                /* side purchase failures are non-fatal — main contract is unaffected */
                onFailed?.(error);
                finishSettlement();
            });
    } catch (e) {
        /* ignore — never let a side purchase break the main strategy flow */
        onFailed?.(e);
        finishSettlement();
    }
    return settlementPromise;
}

export default Engine =>
    class Purchase extends Engine {
        resetNormalKillerPipeline() {
            this.normalKillerPipeline = createNormalKillerPipeline();
            this.normalKillerMainEntry = null;
            this.normalKillerNextPurchaseEpoch = null;
        }

        configureNormalKillerPipeline(currentStake, baseStake, multiplier, takeProfit, stopLoss) {
            if (!this.normalKillerPipeline) {
                this.normalKillerPipeline = createNormalKillerPipeline();
            }
            configureNormalKillerPipeline(this.normalKillerPipeline, {
                currentStake,
                baseStake,
                multiplier,
                takeProfit,
                stopLoss,
            });
        }

        setNormalKillerPurchaseEpoch(epoch) {
            this.normalKillerNextPurchaseEpoch = Number(epoch);
        }

        normalKillerRiskReached() {
            const pipeline = this.normalKillerPipeline;
            if (!pipeline || pipeline.currentStake == null) return false;
            if (hasNormalKillerRiskLimitReached(pipeline, this.getTotalProfit(false))) {
                pipeline.riskTripped = true;
                if (this.isSold !== false) {
                    globalObserver.emit('bot.stop_button_click');
                }
                return true;
            }
            return pipeline.riskTripped;
        }

        settleNormalKillerContract(entry, contract) {
            if (!entry || !contract) return;
            const won = getNormalKillerContractWinResult(contract);
            if (won == null) return;
            if (contract.profit == null) {
                const rawProfit = Number(contract.sell_price) - Number(contract.buy_price);
                if (Number.isFinite(rawProfit)) {
                    settleNormalKillerEntry(
                        this.normalKillerPipeline,
                        entry,
                        applyCommission(rawProfit) > 0,
                    );
                    this.normalKillerRiskReached();
                    return;
                }
            }
            settleNormalKillerEntry(this.normalKillerPipeline, entry, won);
            this.normalKillerRiskReached();
        }

        voidNormalKillerContract(entry) {
            if (!entry) return;
            voidNormalKillerEntry(this.normalKillerPipeline, entry);
        }

        purchaseNormalKillerTick(contract_type, epoch) {
            const pipeline = this.normalKillerPipeline;
            if (
                !isNormalKillerBotV3Context()
                || !pipeline
                || pipeline.currentStake == null
                || this.store.getState().scope !== DURING_PURCHASE
                || this.isSold !== false
                || isBotPaused()
                || this.normalKillerRiskReached()
            ) {
                return Promise.resolve(false);
            }

            const entry = reserveNormalKillerEntry(pipeline, {
                epoch,
                kind: 'side',
                stake: pipeline.currentStake,
                maxOpen: NORMAL_KILLER_MAX_OPEN_CONTRACTS,
            });
            if (!entry) return Promise.resolve(false);

            const tradeOptions = {
                ...this.tradeOptions,
                amount: entry.stake,
            };
            fireSidePurchase(this.tradeOptions, contract_type, tradeOptions, {
                trackSettlement: true,
                settlementTimeoutMs: 0,
                onPurchased: buy => {
                    confirmNormalKillerEntry(pipeline, entry, buy.contract_id);
                },
                onSettled: contract => {
                    this.updateTotals(contract);
                    this.settleNormalKillerContract(entry, contract);
                },
                isSettled: isNormalKillerContractSettled,
                onFailed: () => {
                    this.voidNormalKillerContract(entry);
                },
            });
            return Promise.resolve(true);
        }

        purchase(contract_type) {
            // Prevent calling purchase twice
            if (this.store.getState().scope !== BEFORE_PURCHASE) {
                return Promise.resolve();
            }

            // Do NOT buy while paused — the interpreter's async callback already
            // skips loop() when paused_, but purchase() is called synchronously
            // before that check, so we guard here as well.
            if (isBotPaused()) return Promise.resolve();

            if (
                isNormalKillerBotV3Context()
                && this.normalKillerPipeline
                && this.normalKillerPipeline.currentStake != null
            ) {
                const epoch = this.normalKillerNextPurchaseEpoch;
                this.normalKillerNextPurchaseEpoch = null;
                if (this.normalKillerRiskReached()) return Promise.resolve();

                const entry = reserveNormalKillerEntry(this.normalKillerPipeline, {
                    epoch,
                    kind: 'main',
                    stake: this.normalKillerPipeline.currentStake,
                    maxOpen: NORMAL_KILLER_MAX_OPEN_CONTRACTS,
                });
                if (!entry) return Promise.resolve();

                const tradeOptions = {
                    ...this.tradeOptions,
                    amount: entry.stake,
                };
                return this._executePurchase(contract_type, tradeOptions, true, false, null, entry)
                    .catch(error => {
                        this.voidNormalKillerContract(entry);
                        throw error;
                    });
            }

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

            const isSameTickPair = unique_specs.length === 2
                && unique_specs.every(spec => spec.same_tick_pair === true);
            // Multiple Purchase is also used by strategy blocks that provide
            // several same-tick contracts. A-SPEED BOOST explicitly means
            // one contract for one tick, so keep only the first selected
            // contract and do not create untracked side orders. An explicit
            // paired-entry block is one strategy action, not a bulk fan-out.
            const effective_specs = isASpeedBoostEnabled() && !isSameTickPair
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
                const pairExecution = isSameTickPair
                    ? { mainContractId: null, mainProfit: null, sideProfit: null }
                    : null;
                if (pairExecution) {
                    this._kingFisherCurrentPair = pairExecution;
                    this._kingFisherLastPairWin = null;
                    this._kingFisherSideSettlementPromises = [];
                }
                effective_specs.slice(1).forEach(spec => {
                    const sideSettlement = fireSidePurchase(
                        this.tradeOptions,
                        spec.contract_type,
                        {
                            ...this.tradeOptions,
                            amount: spec.amount ?? this.tradeOptions.amount,
                            prediction: spec.prediction,
                        },
                        pairExecution
                            ? {
                                bypassRateLimit: true,
                                trackSettlement: true,
                                onSettled: contract => {
                                    this.updateTotals(contract);
                                    this.recordKingFisherPairSettlement(pairExecution, contract, 'side');
                                },
                            }
                            : undefined,
                    );
                    if (pairExecution && sideSettlement) {
                        this._kingFisherSideSettlementPromises.push(sideSettlement);
                    }
                });
                return this._executePurchase(
                    effective_specs[0].contract_type,
                    {
                        ...this.tradeOptions,
                        amount: effective_specs[0].amount ?? this.tradeOptions.amount,
                        prediction: effective_specs[0].prediction,
                    },
                    true,
                    Boolean(pairExecution),
                    pairExecution,
                );
            }

            // The first contract follows the normal tracked lifecycle. The
            // remaining contracts are independent same-tick purchases.
            effective_specs.slice(1).forEach(spec => {
                fireSidePurchase(this.tradeOptions, spec.contract_type);
            });

            return this.purchase(effective_specs[0].contract_type);
        }

        _executePurchase(
            contract_type,
            tradeOptions = this.tradeOptions,
            forceDirect = false,
            bypassRateLimit = false,
            pairExecution = null,
            normalKillerEntry = null,
        ) {
            let tradeKey = null;
            const acquireBuySlot = () => bypassRateLimit ? Promise.resolve() : _acquireBuySlot();
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
                         fast:  isInstantExecutionForContext(),
                    });
                } catch { /* non-fatal */ }

                this.contractId = buy.contract_id;
                if (normalKillerEntry) {
                    if (buy.contract_id) {
                        confirmNormalKillerEntry(
                            this.normalKillerPipeline,
                            normalKillerEntry,
                            buy.contract_id,
                        );
                        this.normalKillerMainEntry = normalKillerEntry;
                    } else {
                        this.voidNormalKillerContract(normalKillerEntry);
                    }
                }
                if (pairExecution) {
                    pairExecution.mainContractId = Number(buy.contract_id);
                }
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
            // Instant/Crazy/Turbo modes bypass the proposal-wait round-trip:
            // use direct buy parameters instead of a pre-fetched proposal ID.
            const useDirectBuy =
                forceDirect ||
                (isInstantExecutionForContext() || speed === 'crazy' || speed === 'turbo' || speed === 'supersonic') &&
                !this.options.timeMachineEnabled;

            if (this.is_proposal_subscription_required && !useDirectBuy) {
                // ── Original proposal-based path (Normal speed / timeMachine) ──
                const { id, askPrice } = this.selectProposal(contract_type);
                tradeKey = createTradeKey('bot');
                publishBotCopySignal(tradeOptions, contract_type, undefined, tradeKey);

                const action = () => acquireBuySlot().then(() =>
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
            const action = () => acquireBuySlot().then(() =>
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

        recordKingFisherPairSettlement(pairExecution, contract, leg) {
            if (!pairExecution || !contract) return;
            const rawProfit = Number(contract.sell_price) - Number(contract.buy_price);
            const profit = applyCommission(Number.isFinite(rawProfit) ? rawProfit : 0);
            pairExecution[leg === 'side' ? 'sideProfit' : 'mainProfit'] = profit;
            if (pairExecution.mainProfit !== null && pairExecution.sideProfit !== null) {
                this._kingFisherLastPairWin = pairExecution.mainProfit + pairExecution.sideProfit > 0;
            }
        }

        finishKingFisherPair(pairExecution) {
            if (!pairExecution || pairExecution.mainProfit === null) return;
            const sideProfit = Number(pairExecution.sideProfit) || 0;
            this._kingFisherLastPairWin = pairExecution.mainProfit + sideProfit > 0;
            if (this._kingFisherCurrentPair === pairExecution) this._kingFisherCurrentPair = null;
            this._kingFisherSideSettlementPromises = [];
        }

        isKingFisherPairWin() {
            return typeof this._kingFisherLastPairWin === 'boolean'
                ? this._kingFisherLastPairWin
                : null;
        }
        getPurchaseReference = () => purchase_reference;
        regeneratePurchaseReference = () => {
            purchase_reference = getUUID();
        };
    };
