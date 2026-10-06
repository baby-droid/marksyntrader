import { api_base } from '../services/api';
import { forgetAccumulatorsProposalRequest } from './accumulators-proposal-handler';

jest.mock('../services/api', () => ({
    api_base: {
        api: {
            forget: jest.fn(),
            send: jest.fn(),
        },
    },
}));

jest.mock('./dbot-store', () => ({
    __esModule: true,
    default: { instance: { client: { currency: 'USD' } } },
}));

describe('forgetAccumulatorsProposalRequest', () => {
    const mockApi = api_base.api as any;

    beforeEach(() => {
        jest.clearAllMocks();
        (window as any).Blockly = { accumulators_request: { proposal: true } };
    });

    afterEach(() => {
        delete (window as any).Blockly;
        jest.restoreAllMocks();
    });

    it('does not send a global forget request when there is no active proposal', async () => {
        const instance = {
            is_bot_running: false,
            is_proposal_requested_for_accumulators: false,
            subscription_id_for_accumulators: null,
        };

        await forgetAccumulatorsProposalRequest(instance);

        expect(mockApi.forget).not.toHaveBeenCalled();
        expect(mockApi.send).not.toHaveBeenCalled();
    });

    it('forgets only the active subscription and resets local state', async () => {
        mockApi.forget.mockResolvedValue({} as never);
        const instance = {
            is_bot_running: false,
            is_proposal_requested_for_accumulators: true,
            subscription_id_for_accumulators: 'proposal-subscription',
        };

        await forgetAccumulatorsProposalRequest(instance);

        expect(mockApi.forget).toHaveBeenCalledWith('proposal-subscription');
        expect(mockApi.send).not.toHaveBeenCalled();
        expect(instance.subscription_id_for_accumulators).toBeNull();
        expect(instance.is_proposal_requested_for_accumulators).toBe(false);
        expect((window as any).Blockly.accumulators_request).toEqual({});
    });

    it('contains request failures during cleanup instead of rejecting into Blockly events', async () => {
        mockApi.send.mockRejectedValue({ error: { code: 'RateLimit' } });
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const instance = {
            is_bot_running: false,
            is_proposal_requested_for_accumulators: true,
            subscription_id_for_accumulators: null,
        };

        await expect(forgetAccumulatorsProposalRequest(instance)).resolves.toBeUndefined();
        expect(mockApi.send).toHaveBeenCalledWith({ forget_all: 'proposal' });
        expect(instance.is_proposal_requested_for_accumulators).toBe(false);
    });
});
