import {
    getTicksHistoryRetryDelayMs,
    isTicksHistoryRequest,
} from '../ticks-history-backoff';

describe('ticks-history retry backoff', () => {
    it.each([
        [{ msg_type: 'ticks_history' }],
        [{ echo_req: { msg_type: 'ticks_history' } }],
        [{ echo_req: { ticks_history: 'R_50' } }],
        [{ error: { echo_req: { ticks_history: 'R_50' } } }],
    ])('recognizes a history request error: %o', error => {
        expect(isTicksHistoryRequest(error)).toBe(true);
    });

    it('does not classify purchase errors as history requests', () => {
        expect(isTicksHistoryRequest({
            msg_type: 'buy',
            echo_req: { buy: 12345 },
        })).toBe(false);
    });

    it('uses a nonzero exponential delay capped at five seconds', () => {
        expect([1, 2, 3, 4, 5, 6].map(getTicksHistoryRetryDelayMs)).toEqual([
            500, 1_000, 2_000, 4_000, 5_000, 5_000,
        ]);
    });
});
