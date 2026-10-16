import {
    DIGIT_MATCH_RESCAN_INTERVAL_MS,
    refreshMatchEntryReadiness,
    startDigitMatchMarketRescan,
} from './digit-match-rescan';
import type { AutoSignalCandidate } from './types';

const matchCandidate = (): AutoSignalCandidate => ({
    id: 'match-R_100-6',
    strategy: 'MATCHES',
    label: 'Matches',
    contractType: 'DIGITMATCH',
    barrier: 6,
    direction: 'matches',
    score: 78,
    tier: 'STRONG',
    state: 'setup',
    reason: 'Validated digit match',
    windows: [
        { window: 1000, sampleSize: 20, probability: 20, agrees: true },
        { window: 100, sampleSize: 10, probability: 20, agrees: true },
        { window: 50, sampleSize: 5, probability: 20, agrees: true },
        { window: 20, sampleSize: 2, probability: 0, agrees: false },
    ],
    entryDigit: 4,
    entryReady: false,
    createdAt: 1,
    expiresAt: 100_000,
    updatedAt: 1,
    recommendedRuns: 2,
});

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

describe('live Matches entry readiness', () => {
    it('updates the ready gate on the live digit without rescoring the prediction', () => {
        const candidate = matchCandidate();

        const ready = refreshMatchEntryReadiness([candidate], 4, 200)[0];
        expect(ready.entryReady).toBe(true);
        expect(ready.state).toBe('ready');
        expect(ready.updatedAt).toBe(200);
        expect(ready.score).toBe(candidate.score);
        expect(ready.entryDigit).toBe(candidate.entryDigit);

        const waiting = refreshMatchEntryReadiness([ready], 9, 300)[0];
        expect(waiting.entryReady).toBe(false);
        expect(waiting.state).toBe('setup');
        expect(waiting.updatedAt).toBe(300);
    });

    it('leaves other strategies and invalid digits unchanged', () => {
        const candidate = { ...matchCandidate(), strategy: 'EVEN' as const };
        expect(refreshMatchEntryReadiness([candidate], 4, 200)[0]).toBe(candidate);
        expect(refreshMatchEntryReadiness([matchCandidate()], 10, 200)[0].entryReady).toBe(false);
    });
});
