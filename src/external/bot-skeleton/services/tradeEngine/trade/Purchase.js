import { getExecutionSpeed, getExecutionSpeedDelay } from '../../../../../utils/execution-speed';
import { LogTypes } from '../../../constants/messages';
import { api_base } from '../../api/api-base';
import { contractStatus, info, log } from '../utils/broadcast';
import { doUntilDone, getUUID, recoverFromError, tradeOptionToBuy } from '../utils/helpers';
import { purchaseSuccessful } from './state/actions';
import { BEFORE_PURCHASE } from './state/constants';

let delayIndex = 0;
let purchase_reference;

// --- Rate-limit-aware buy queue ---
// Deriv allows ~5 buy requests/second. In Crazy/Turbo mode we cap the sliding
// window so we never trigger a rate-limit response in the first place.
// Turbo: up to 5/s (max allowed); Crazy: up to 3/s (safe margin).
let _buyTimestamps = [];
const _buyRateLimit = { normal: 1, crazy: 3, turbo: 5 }; // calls per second

function _acquireBuySlot() {
    const speed = getExecutionSpeed();
    const limit  = _buyRateLimit[speed] ?? 1;
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

export default Engine =>
    class Purchase extends Engine {
        purchase(contract_type) {
            // Prevent calling purchase twice
            if (this.store.getState().scope !== BEFORE_PURCHASE) {
                return Promise.resolve();
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
                (speed === 'crazy' || speed === 'turbo') &&
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
