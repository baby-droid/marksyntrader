import Ticks from './Ticks';

const createEngine = request => {
    const Engine = Ticks(class {});
    const engine = new Engine();
    engine.symbol = 'R_100';
    engine.options = { candleInterval: 60 };
    engine.$scope = { ticksService: { request } };
    return engine;
};

describe('Bot Builder tick-history blocks', () => {
    it('rejects a failed history request from getTicks instead of hanging', async () => {
        const historyError = new Error('ticks_history failed');
        const engine = createEngine(jest.fn().mockRejectedValue(historyError));

        await expect(engine.getTicks()).rejects.toBe(historyError);
    });

    it('rejects a failed history request from getLastTick instead of returning a fake tick value', async () => {
        const historyError = new Error('ticks_history failed');
        const engine = createEngine(jest.fn().mockRejectedValue(historyError));

        await expect(engine.getLastTick(false)).rejects.toBe(historyError);
    });

    it('propagates candle-history failures through OHLC blocks', async () => {
        const historyError = new Error('candles history failed');
        const request = jest.fn().mockRejectedValue(historyError);
        const engine = createEngine(request);

        await expect(engine.getOhlc({ granularity: 60 })).rejects.toBe(historyError);
        expect(request).toHaveBeenCalledWith({ symbol: 'R_100', granularity: 60 });
    });
});
