export type PurchaseRetryPolicy = {
    maxRetries?: number;
    stopOnCodes?: readonly string[];
};

/**
 * `retriesAlreadyMade` is independent of the delay/backoff index. Fast tiers
 * intentionally keep the latter fixed for rate limits, but must still have a
 * finite retry budget.
 */
export const shouldStopPurchaseRetry = (
    error: any,
    retriesAlreadyMade: number,
    policy?: PurchaseRetryPolicy,
): boolean => {
    if (!policy) return false;

    const errorCode = String(error?.error?.code ?? error?.name ?? '');
    if (policy.stopOnCodes?.includes(errorCode)) return true;

    if (Number.isFinite(policy.maxRetries)) {
        return Math.max(0, Math.floor(retriesAlreadyMade)) >= Number(policy.maxRetries);
    }

    return false;
};
