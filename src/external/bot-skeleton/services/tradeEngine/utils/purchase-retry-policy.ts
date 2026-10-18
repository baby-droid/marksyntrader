export type PurchaseRetryPolicy = {
    maxRetries?: number;
    stopOnCodes?: readonly string[];
    retryOnCodes?: readonly string[];
};

export const getRateLimitRetryDelayMs = (retriesAlreadyMade: number): number => {
    const retry = Number.isFinite(retriesAlreadyMade)
        ? Math.max(0, Math.floor(retriesAlreadyMade))
        : 0;
    return Math.min(500 * (2 ** retry), 15_000);
};

/**
 * `retriesAlreadyMade` is independent of the delay/backoff index. Fast tiers
 * use a separate retry delay and must still have a finite retry budget.
 */
export const shouldStopPurchaseRetry = (
    error: any,
    retriesAlreadyMade: number,
    policy?: PurchaseRetryPolicy,
): boolean => {
    const errorCode = String(error?.error?.code ?? error?.code ?? error?.name ?? '');
    // A local request-budget rejection is deliberate: retrying it immediately
    // would re-enter the same saturated queue and make a Bot Builder run look
    // frozen. Surface it to the caller instead.
    if (errorCode === 'RequestBudgetExceeded') return true;
    if (!policy) return false;

    if (policy.stopOnCodes?.includes(errorCode)) return true;
    if (policy.retryOnCodes && !policy.retryOnCodes.includes(errorCode)) return true;

    if (Number.isFinite(policy.maxRetries)) {
        return Math.max(0, Math.floor(retriesAlreadyMade)) >= Number(policy.maxRetries);
    }

    return false;
};
