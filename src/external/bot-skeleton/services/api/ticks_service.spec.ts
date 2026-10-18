import { Map } from 'immutable';
import { api_base } from './api-base';
import TicksService from './ticks_service';

describe('TicksService subscription cleanup', () => {
    let originalApi: unknown;
    let originalIsRunning: unknown;
    let service: TicksService;
    let mockApi: { send: jest.Mock; forgetAll: jest.Mock; subscribe: jest.Mock };

    beforeEach(() => {
        originalApi = api_base.api;
        originalIsRunning = api_base.is_running;
        api_base.api = null;
        service = new TicksService();
        mockApi = {
            send: jest.fn().mockResolvedValue({}),
            forgetAll: jest.fn(),
            subscribe: jest.fn(() => ({
                subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
            })),
        };
        api_base.api = mockApi as any;
        service.subscriptions = Map({
            tick: Map({ R_10: 'tick-subscription-id' }),
            ohlc: Map({ R_10: Map({ 60: 'candle-subscription-id' }) }),
        }) as any;
    });

    afterEach(() => {
        api_base.api = originalApi as any;
        api_base.is_running = originalIsRunning as boolean;
        jest.useRealTimers();
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

    it('retries history after a failed request instead of reusing an empty tick cache', async () => {
        service.ticks = service.ticks.set('R_10', []);
        mockApi.send.mockRejectedValueOnce({
            error: { code: 'InputValidationFailed', message: 'Invalid history request' },
            msg_type: 'ticks_history',
            echo_req: { ticks_history: 'R_10' },
        });

        await expect(service.request({ symbol: 'R_10' })).rejects.toMatchObject({
            error: { code: 'InputValidationFailed' },
        });
        expect(service.ticks.has('R_10')).toBe(false);
        expect(service.historyReadySymbols.has('R_10')).toBe(false);

        mockApi.send.mockResolvedValueOnce({
            history: { prices: ['100.1', '100.2'], times: [100, 101] },
            msg_type: 'history',
        });

        await expect(service.request({ symbol: 'R_10' })).resolves.toEqual([
            { epoch: 100, quote: 100.1 },
            { epoch: 101, quote: 100.2 },
        ]);
        expect(mockApi.send).toHaveBeenCalledTimes(2);

        await service.request({ symbol: 'R_10' });
        expect(mockApi.send).toHaveBeenCalledTimes(2);
    });

    it('retries a transient ticks_history timeout and continues the same run when history returns', async () => {
        api_base.is_running = true;
        jest.useFakeTimers();
        mockApi.send
            .mockRejectedValueOnce({
                error: { code: 'RequestTimeout', message: 'No response before timeout' },
                msg_type: 'ticks_history',
                echo_req: { ticks_history: 'R_10' },
            })
            .mockResolvedValueOnce({
                history: { prices: ['200.1', '200.2'], times: [200, 201] },
                msg_type: 'history',
            });

        const request = service.request({ symbol: 'R_10' });
        await jest.advanceTimersByTimeAsync(500);

        await expect(request).resolves.toEqual([
            { epoch: 200, quote: 200.1 },
            { epoch: 201, quote: 200.2 },
        ]);
        expect(mockApi.send).toHaveBeenCalledTimes(2);
    });
});
