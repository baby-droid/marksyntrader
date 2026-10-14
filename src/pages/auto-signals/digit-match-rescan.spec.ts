import { DIGIT_MATCH_RESCAN_INTERVAL_MS, startDigitMatchMarketRescan } from './digit-match-rescan';

describe('Digit Match market rescan schedule', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('rescans immediately and then once each minute until it is cleaned up', () => {
        const rescan = jest.fn();
        const stop = startDigitMatchMarketRescan(true, rescan);

        expect(DIGIT_MATCH_RESCAN_INTERVAL_MS).toBe(60_000);
        expect(rescan).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(DIGIT_MATCH_RESCAN_INTERVAL_MS - 1);
        expect(rescan).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(1);
        expect(rescan).toHaveBeenCalledTimes(2);

        stop();
        jest.advanceTimersByTime(DIGIT_MATCH_RESCAN_INTERVAL_MS);
        expect(rescan).toHaveBeenCalledTimes(2);
    });

    it('does not schedule scans for other signal families', () => {
        const rescan = jest.fn();
        const stop = startDigitMatchMarketRescan(false, rescan);

        jest.advanceTimersByTime(DIGIT_MATCH_RESCAN_INTERVAL_MS * 2);
        stop();

        expect(rescan).not.toHaveBeenCalled();
    });
});
