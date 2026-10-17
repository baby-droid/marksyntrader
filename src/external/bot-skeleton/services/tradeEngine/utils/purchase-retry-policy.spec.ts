import { shouldStopPurchaseRetry } from './purchase-retry-policy';

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
});
