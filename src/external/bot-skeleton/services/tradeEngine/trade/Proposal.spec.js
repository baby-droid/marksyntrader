jest.mock('@/constants/backend-error-messages', () => ({
    getLocalizedErrorMessage: jest.fn(code => code),
}));

jest.mock('../../api/api-base', () => ({
    api_base: {
        api: null,
        is_running: true,
    },
}));

jest.mock('../utils/helpers', () => ({
    doUntilDone: jest.fn(promiseFn => Promise.resolve().then(promiseFn)),
    tradeOptionToProposal: jest.fn(),
}));

import { api_base } from '../../api/api-base';
import { doUntilDone } from '../utils/helpers';
import Proposal from './Proposal';
import { proposalsReady } from './state/actions';

const purchaseReference = 'proposal-test-reference';
const template = {
    contract_type: 'DIGITOVER',
    passthrough: {
        contract_type: 'DIGITOVER',
        purchase_reference: purchaseReference,
    },
    proposal: 1,
    underlying_symbol: 'R_100',
};

const createEngine = () => {
    const Engine = Proposal(class {});
    const engine = new Engine();
    engine.data = { proposals: [] };
    engine.proposal_templates = [template];
    engine.startPromise = Promise.resolve();
    engine.store = { dispatch: jest.fn() };
    engine.$scope = { observer: { emit: jest.fn() } };
    engine.getPurchaseReference = () => purchaseReference;
    return engine;
};

describe('Bot Builder proposal requests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        api_base.api = { send: jest.fn() };
    });

    it('sends through the authenticated API and releases the purchase gate on its reply', async () => {
        const engine = createEngine();
        const returnedProposal = {
            msg_type: 'proposal',
            passthrough: template.passthrough,
            proposal: { id: 'proposal-123', ask_price: 1 },
        };
        api_base.api.send.mockResolvedValue(returnedProposal);

        await engine.requestProposals();
        await Promise.resolve();

        expect(api_base.api.send).toHaveBeenCalledWith(template);
        expect(doUntilDone).toHaveBeenCalledWith(
            expect.any(Function),
            undefined,
            api_base,
            { maxRetries: 5, stopOnCodes: ['MarketIsClosed'] },
        );
        expect(engine.data.proposals).toEqual([
            {
                ...returnedProposal.proposal,
                ...template.passthrough,
            },
        ]);
        expect(engine.store.dispatch).toHaveBeenCalledWith(proposalsReady());
    });

    it('records invalid proposals so the XML purchase gate cannot wait forever', async () => {
        const engine = createEngine();
        api_base.api.send.mockRejectedValue({
            error: {
                code: 'ContractBuyValidationError',
                echo_req: { passthrough: template.passthrough },
                message: 'Invalid contract selection',
            },
        });

        await engine.requestProposals();
        await Promise.resolve();

        expect(engine.data.proposals[0].error.code).toBe('ContractBuyValidationError');
        expect(engine.store.dispatch).toHaveBeenCalledWith(proposalsReady());
        expect(engine.$scope.observer.emit).not.toHaveBeenCalledWith('bot.async_error');
    });

    it('stops the run on terminal proposal errors instead of leaving it in loading state', async () => {
        const engine = createEngine();
        api_base.api.send.mockRejectedValue({
            error: { code: 'MarketIsClosed', message: 'Market is closed' },
        });

        await engine.requestProposals();

        expect(engine.$scope.observer.emit).toHaveBeenCalledWith('Error', expect.any(Object));
        expect(engine.$scope.observer.emit).toHaveBeenCalledWith('bot.async_error');
    });
});
