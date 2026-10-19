export type PurchaseRetryPolicy = {
    maxRetries?: number;
    stopOnCodes?: readonly string[];
};

export const getRateLimitRetryDelayMs = (retriesAlreadyMade: number): number => {
    const retry = Number.isFinite(retriesAlreadyMade)
        ? Math.max(0, Math.floor(retriesAlreadyMade))
        : 0;
    return Math.min(250 * (2 ** retry), 5_000);
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
    if (!policy) return false;

    const errorCode = String(error?.error?.code ?? error?.name ?? '');
    if (policy.stopOnCodes?.includes(errorCode)) return true;

    if (Number.isFinite(policy.maxRetries)) {
        return Math.max(0, Math.floor(retriesAlreadyMade)) >= Number(policy.maxRetries);
    }

    return false;
};
