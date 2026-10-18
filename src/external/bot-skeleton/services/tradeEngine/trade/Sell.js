import { getLocalizedErrorMessage } from '@/constants/backend-error-messages';
import { LogTypes } from '../../../constants/messages';
import { observer as globalObserver } from '../../../utils/observer';
import { api_base } from '../../api/api-base';
import { contractStatus, log } from '../utils/broadcast';
import { doUntilDone, recoverFromError } from '../utils/helpers';
import { DURING_PURCHASE } from './state/constants';

export default Engine =>
    class Sell extends Engine {
        isSellAtMarketAvailable() {
            return this.contractId && !this.isSold && this.isSellAvailable && !this.isExpired;
        }

        sellAtMarket() {
            globalObserver.emit('bot.sell');

            // Prevent calling sell twice
            if (this.store.getState().scope !== DURING_PURCHASE) {
                return Promise.resolve();
            }

            if (!this.isSellAtMarketAvailable()) {
                log(LogTypes.NOT_OFFERED);
                return Promise.resolve();
            }

            let delay_index = 1;

            return new Promise((resolve, reject) => {
                const onContractSold = sell_response => {
                    delay_index = 1;

                    if (sell_response) {
                        const { sold_for } = sell_response.sell;
                        log(LogTypes.SELL, { sold_for });
                    }

                    contractStatus('purchase.sold');
                    this.waitForAfter();
                    resolve();
                };

                const contract_id = this.contractId;

                const sellContractAndGetContractInfo = () => {
                    return api_base.api.send({ sell: contract_id, price: 0 })
                        .then(sell_response => {
                            // Wait for the authoritative contract update before
                            // resolving the sell cycle. The missing return here
                            // previously let the trade engine advance early.
                            return doUntilDone(
                                () => api_base.api.send({ proposal_open_contract: 1, contract_id }),
                                undefined,
                                api_base,
                                { maxRetries: 3, retryOnCodes: ['RateLimit', 'RateLimitExceeded'] },
                            ).then(() => sell_response);
                        })
                        .catch(e => {
                            const error = e?.error ?? e;
                            const errorCode = error?.code ?? e?.code ?? e?.name;
                            if (errorCode === 'InvalidOfferings') {
                                // "InvalidOfferings" may occur when user tries to sell the contract too close
                                // to the expiry time. We shouldn't interrupt the bot but instead let the contract
                                // finish.
                                return Promise.resolve();
                            }

                            const sell_error = {
                                name: errorCode,
                                code: errorCode,
                                message: getLocalizedErrorMessage(errorCode, error?.details),
                                msg_type: e.msg_type,
                                error: {
                                    ...error,
                                    code: errorCode,
                                    message: error?.message,
                                },
                                echo_req: e?.echo_req,
                            };

                            if (errorCode === 'RateLimit' || errorCode === 'RateLimitExceeded') {
                                return Promise.reject(sell_error);
                            }

                            // For every other error, check whether the contract is not actually already sold.
                            return doUntilDone(() =>
                                api_base.api.send({
                                    proposal_open_contract: 1,
                                    contract_id,
                                })
                            ).then(proposal_open_contract_response => {
                                const { proposal_open_contract } = proposal_open_contract_response;

                                if (!proposal_open_contract.is_sold) {
                                    return Promise.reject(sell_error);
                                }

                                // If the contract is sold at this point it means there was a race condition.
                                // Pretend this sell request was successful and mislead the trade engine into
                                // moving onto the next scope.
                                return Promise.resolve({
                                    sell: {
                                        sold_for: proposal_open_contract.sell_price,
                                    },
                                });
                            });
                        });
                };

                const errors_to_ignore = ['NoOpenPosition', 'InvalidSellContractProposal', 'UnrecognisedRequest'];

                // Restart buy/sell on error is enabled, don't recover from sell error.
                if (!this.options.timeMachineEnabled) {
                    // eslint-disable-next-line no-promise-executor-return
                    return doUntilDone(sellContractAndGetContractInfo, errors_to_ignore, api_base, {
                        maxRetries: 5,
                        stopOnCodes: ['MarketIsClosed'],
                        retryOnCodes: [
                            'RateLimit',
                            'RateLimitExceeded',
                            'NoOpenPosition',
                            'InvalidSellContractProposal',
                            'UnrecognisedRequest',
                        ],
                    })
                        .then(sell_response => onContractSold(sell_response))
                        .catch(reject);
                }

                // If above checkbox not checked, try to recover from sell error.
                const recoverFn = (error_code, makeDelay) => {
                    return makeDelay().then(() => this.observer.emit('REVERT', 'during'));
                };
                // eslint-disable-next-line no-promise-executor-return
                return recoverFromError(
                    sellContractAndGetContractInfo,
                    recoverFn,
                    errors_to_ignore,
                    delay_index++
                ).then(sell_response => onContractSold(sell_response));
            });
        }
    };
