import { getRateLimitRetryDelayMs, shouldStopPurchaseRetry } from './purchase-retry-policy';

describe('purchase retry policy', () => {
    it('stops immediately for an explicitly non-retryable purchase error', () => {
        expect(
            shouldStopPurchaseRetry(
                { error: { code: 'MarketIsClosed' } },
                1,
                { maxRetries: 20, stopOnCodes: ['MarketIsClosed'] },
            ),
        ).toBe(true);
    });

    it('allows the configured number of retries after the initial request', () => {
        const policy = { maxRetries: 2 };

        expect(shouldStopPurchaseRetry({ error: { code: 'CallError' } }, 0, policy)).toBe(false);
        expect(shouldStopPurchaseRetry({ error: { code: 'CallError' } }, 1, policy)).toBe(false);
        expect(shouldStopPurchaseRetry({ error: { code: 'CallError' } }, 2, policy)).toBe(true);
    });

    it('does not add a retry limit to shared requests unless a policy is supplied', () => {
        expect(shouldStopPurchaseRetry({ error: { code: 'MarketIsClosed' } }, 100)).toBe(false);
    });

    it('backs off exponentially on accelerated-mode rate limits and caps the delay', () => {
        expect([0, 1, 2, 3, 4, 5, 20].map(getRateLimitRetryDelayMs)).toEqual([
            250, 500, 1_000, 2_000, 4_000, 5_000, 5_000,
        ]);
    });
});
