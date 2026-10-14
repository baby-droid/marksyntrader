import { Map } from 'immutable';
import { api_base } from './api-base';
import TicksService from './ticks_service';

describe('TicksService subscription cleanup', () => {
    let originalApi: unknown;
    let service: TicksService;
    let mockApi: { send: jest.Mock; forgetAll: jest.Mock };

    beforeEach(() => {
        originalApi = api_base.api;
        api_base.api = null;
        service = new TicksService();
        mockApi = {
            send: jest.fn().mockResolvedValue({}),
            forgetAll: jest.fn(),
        };
        api_base.api = mockApi as any;
        service.subscriptions = Map({
            tick: Map({ R_10: 'tick-subscription-id' }),
            ohlc: Map({ R_10: Map({ 60: 'candle-subscription-id' }) }),
        }) as any;
    });

    afterEach(() => {
        api_base.api = originalApi as any;
        jest.restoreAllMocks();
    });

    it('forgets only tracked subscription IDs instead of sending global forget_all requests', async () => {
        await service.unsubscribeFromTicksService();

        expect(mockApi.send).toHaveBeenNthCalledWith(1, { forget: 'tick-subscription-id' });
        expect(mockApi.send).toHaveBeenNthCalledWith(2, { forget: 'candle-subscription-id' });
        expect(mockApi.forgetAll).not.toHaveBeenCalled();
        expect(service.subscriptions.get('tick')).toBeUndefined();
        expect(service.subscriptions.get('ohlc')).toBeUndefined();
    });

    it('keeps a rate-limited subscription ID for the next cleanup without rejecting', async () => {
        mockApi.send.mockRejectedValue({ error: { code: 'RateLimit' } });
        const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(service.unsubscribeFromTicksService()).resolves.toBeUndefined();

        expect(service.subscriptions.getIn(['tick', 'R_10'])).toBe('tick-subscription-id');
        expect(warning).toHaveBeenCalledTimes(2);
    });
});
