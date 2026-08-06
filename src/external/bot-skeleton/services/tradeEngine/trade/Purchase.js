import { getExecutionSpeed, getExecutionSpeedDelay, isFastExecutionEnabled, SPEED_PURCHASES_PER_TICK } from '../../../../../utils/execution-speed';
import { isBotPaused } from '../../../../../utils/bot-pause-flag';
import { LogTypes } from '../../../constants/messages';
import { api_base } from '../../api/api-base';
import { contractStatus, info, log } from '../utils/broadcast';
import { doUntilDone, getUUID, recoverFromError, tradeOptionToBuy } from '../utils/helpers';
import { purchaseSuccessful } from './state/actions';
import { BEFORE_PURCHASE } from './state/constants';

let delayIndex = 0;
let purchase_reference;

// --- Rate-limit-aware buy queue ---
// Normal=1/s sequential. Crazy/Turbo set to 0 = bypass throttle entirely
// for true zero-delay fire-and-forget (the API server enforces its own limits).
let _buyTimestamps = [];
const _buyRateLimit = { normal: 1, crazy: 0, turbo: 0, supersonic: 0 };

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
function fireSidePurchase(tradeOptions, contract_type) {
    // Do NOT fire side purchases while the bot is paused.
    if (isBotPaused()) return;
    try {
        const trade_option = tradeOptionToBuy(contract_type, tradeOptions);
        _acquireBuySlot()
            .then(() => api_base.api.send(trade_option))
            .then(response => {
                const { buy } = response;
                if (!buy) return;
                if (buy.contract_id) _sideContractIds.add(buy.contract_id);
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

            // Speed-tier fan-out: Normal fires 1 purchase per tick (unchanged).
            // Crazy fires 5 purchases in parallel per tick, Turbo fires 10 — the
            // first drives the bot's normal single-contract flow (afterPurchase,
            // trade-again, martingale), the rest are independent side purchases
            // fired at the same instant for extra throughput.
            const speed = getExecutionSpeed();
            const purchases_per_tick = SPEED_PURCHASES_PER_TICK[speed] ?? 1;
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

        _executePurchase(contract_type) {
            const onSuccess = response => {
                const { buy } = response;

                contractStatus({
                    id: 'contract.purchase_received',
                    data: buy.transaction_id,
                    buy,
                });

                this.contractId = buy.contract_id;
                this.store.dispatch(purchaseSuccessful());

                if (this.is_proposal_subscription_required) {
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
            const useDirectBuy =
                (speed === 'crazy' || speed === 'turbo' || speed === 'supersonic') &&
                !this.options.timeMachineEnabled;

            if (this.is_proposal_subscription_required && !useDirectBuy) {
                // ── Original proposal-based path (Normal speed / timeMachine) ──
                const { id, askPrice } = this.selectProposal(contract_type);

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
            const trade_option = tradeOptionToBuy(contract_type, this.tradeOptions);
            const action = () => _acquireBuySlot().then(() =>
                api_base.api.send(trade_option)
            );

            this.isSold = false;

            contractStatus({
                id: 'contract.purchase_sent',
                data: this.tradeOptions.amount,
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
