import { getLocalizedErrorMessage } from '@/constants/backend-error-messages';
import { api_base } from '../../api/api-base';
import { doUntilDone, tradeOptionToProposal } from '../utils/helpers';
import { clearProposals, proposalsReady } from './state/actions';

const proposalRetryPolicy = {
    maxRetries: 5,
    stopOnCodes: ['MarketIsClosed'],
};

export default Engine =>
    class Proposal extends Engine {
        makeProposals(trade_option) {
            if (!this.isNewTradeOption(trade_option)) {
                return;
            }

            // Generate a purchase reference when trade options are different from previous trade options.
            // This will ensure the bot doesn't mistakenly purchase the wrong proposal.
            this.regeneratePurchaseReference();
            this.trade_option = trade_option;
            this.proposal_templates = tradeOptionToProposal(trade_option, this.getPurchaseReference());
            this.renewProposalsOnPurchase();
        }

        selectProposal(contract_type) {
            const { proposals } = this.data;

            if (proposals.length === 0) {
                throw Error(getLocalizedErrorMessage('ProposalsNotReady'));
            }

            const to_buy = proposals.find(proposal => {
                if (
                    proposal.contract_type === contract_type &&
                    proposal.purchase_reference === this.getPurchaseReference()
                ) {
                    // Below happens when a user has had one of the proposals return
                    // with a ContractBuyValidationError. We allow the logic to continue
                    // to here cause the opposite proposal may still be valid. Only once
                    // they attempt to purchase the errored proposal we will intervene.
                    if (proposal.error) {
                        // Ensure we throw the localized error message
                        throw proposal.error;
                    }

                    return proposal;
                }

                return false;
            });

            if (!to_buy) {
                throw new Error(getLocalizedErrorMessage('SelectedProposalNotExist'));
            }

            return {
                id: to_buy.id,
                askPrice: to_buy.ask_price,
            };
        }

        renewProposalsOnPurchase() {
            this.data.proposals = [];
            this.store.dispatch(clearProposals());
            return this.requestProposals();
        }

        requestProposals() {
            // Since there are two proposals (in most cases), an error may be logged twice, to avoid this
            // flip this boolean on error.
            let has_informed_error = false;

            return Promise.all(
                this.proposal_templates.map(proposal => {
                    return doUntilDone(
                        () => {
                            if (!api_base.api) {
                                throw new Error('Deriv API connection is not ready for price proposals.');
                            }
                            return api_base.api.send(proposal);
                        },
                        undefined,
                        api_base,
                        proposalRetryPolicy,
                    )
                        .then(response => {
                            const responseData = response?.data ?? response;
                            if (responseData?.proposal || responseData?.error) {
                                this.handleProposalResponse({
                                    ...responseData,
                                    msg_type: responseData.msg_type ?? 'proposal',
                                });
                            }
                            return response;
                        })
                        .catch(error => {
                            // We intercept ContractBuyValidationError as user may have specified
                            // e.g. a DIGITUNDER 0 or DIGITOVER 9, while one proposal may be invalid
                            // the other is valid. We will error on Purchase rather than here.
                            if (error?.error?.code === 'ContractBuyValidationError') {
                                const apiError = error.error;
                                const localizedError = new Error(
                                    getLocalizedErrorMessage(apiError.code, apiError),
                                );
                                localizedError.code = apiError.code;
                                localizedError.details = apiError.details;
                                localizedError.message_to_client = apiError.message_to_client;

                                this.recordProposalError({
                                    ...apiError.echo_req?.passthrough,
                                    ...error?.echo_req?.passthrough,
                                    ...proposal.passthrough,
                                }, localizedError);

                                return null;
                            }

                            if (!has_informed_error) {
                                has_informed_error = true;
                                const apiError = error?.error ?? error ?? {};
                                const localizedErrorMessage = apiError.code
                                    ? getLocalizedErrorMessage(apiError.code, apiError)
                                    : apiError.message || getLocalizedErrorMessage('GeneralError');

                                const localizedError = {
                                    ...apiError,
                                    message: localizedErrorMessage,
                                };
                                this.$scope.observer.emit('Error', localizedError);
                                // A failed proposal prevents the bot from entering its
                                // purchase block. Stop the run rather than leaving it
                                // waiting forever for proposalsReady.
                                this.$scope.observer.emit('bot.async_error');
                            }
                            return null;
                        });
                })
            );
        }

        recordProposalError(passthrough, error) {
            const existing = this.data.proposals.find(
                proposal =>
                    proposal.contract_type === passthrough?.contract_type &&
                    proposal.purchase_reference === passthrough?.purchase_reference,
            );

            if (existing) {
                // Don't replace an already-valid proposal with a duplicate
                // error delivered through the promise and message observers.
                if (!existing.id) existing.error = error;
            } else {
                this.data.proposals.push({ ...passthrough, error });
            }

            // Error results count as completed proposal responses. This is
            // essential when every requested contract type is invalid; without
            // this, the before-purchase gate remains closed indefinitely.
            this.checkProposalReady();
        }

        handleProposalResponse(data) {
            const { passthrough, proposal, error } = data;
            const requestPassthrough = passthrough ?? data.echo_req?.passthrough ?? {};

            if (error) {
                const localizedError = new Error(getLocalizedErrorMessage(error.code, error));
                localizedError.code = error.code;
                localizedError.details = error.details;
                localizedError.message_to_client = error.message_to_client;
                this.recordProposalError(requestPassthrough, localizedError);
                return;
            }

            if (proposal && this.data.proposals.findIndex(p => p.id === proposal.id) === -1) {
                // Add proposals based on the ID returned by the API.
                this.data.proposals.push({ ...proposal, ...requestPassthrough });
                this.checkProposalReady();
            }
        }

        observeProposals() {
            if (!api_base.api) return;
            const subscription = api_base.api.onMessage().subscribe(response => {
                if (response.data.msg_type === 'proposal') {
                    this.handleProposalResponse(response.data);
                }
            });
            api_base.pushSubscription(subscription);
        }

        checkProposalReady() {
            // Proposals are considered ready when the proposals in our memory match the ones
            // we've requested from the API, we determine this by checking the passthrough of the response.
            const { proposals } = this.data;

            if (proposals.length > 0 && this.proposal_templates) {
                const has_equal_proposals = this.proposal_templates.every(template => {
                    return (
                        proposals.findIndex(proposal => {
                            return (
                                proposal.purchase_reference === template.passthrough.purchase_reference &&
                                proposal.contract_type === template.contract_type
                            );
                        }) !== -1
                    );
                });

                if (has_equal_proposals) {
                    this.startPromise.then(() => this.store.dispatch(proposalsReady()));
                }
            }
        }

        isNewTradeOption(trade_option) {
            if (!this.trade_option) {
                this.trade_option = trade_option;
                return true;
            }

            // Compare incoming "trade_option" argument with "this.trade_option", if any
            // of the values is different, this is a new tradeOption and new proposals
            // should be generated.
            return [
                'amount',
                'barrierOffset',
                'basis',
                'duration',
                'duration_unit',
                'prediction',
                'secondBarrierOffset',
                'underlying_symbol',
            ].some(value => this.trade_option[value] !== trade_option[value]);
        }
    };
