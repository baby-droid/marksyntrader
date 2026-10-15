import { DIGIT_MATCH_RESCAN_INTERVAL_MS, isDigitMatchRescanDue } from './digit-match-rescan';

describe('Digit Matches rescan cadence', () => {
    it('waits a full minute between Matches market rescans unless forced', () => {
        const lastRescan = 10_000;
        expect(isDigitMatchRescanDue(lastRescan + DIGIT_MATCH_RESCAN_INTERVAL_MS - 1, lastRescan)).toBe(false);
        expect(isDigitMatchRescanDue(lastRescan + DIGIT_MATCH_RESCAN_INTERVAL_MS, lastRescan)).toBe(true);
        expect(isDigitMatchRescanDue(lastRescan + 1, lastRescan, true)).toBe(true);
    });
});
