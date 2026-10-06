type TicksHistoryRequestError = {
    msg_type?: unknown;
    echo_req?: Record<string, unknown>;
    error?: {
        msg_type?: unknown;
        echo_req?: Record<string, unknown>;
    };
};

export function isTicksHistoryRequest(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const requestError = error as TicksHistoryRequestError;
    const echoRequest = requestError.echo_req ?? requestError.error?.echo_req ?? {};

    return requestError.msg_type === 'ticks_history'
        || requestError.error?.msg_type === 'ticks_history'
        || echoRequest.msg_type === 'ticks_history'
        || Object.prototype.hasOwnProperty.call(echoRequest, 'ticks_history');
}

export function getTicksHistoryRetryDelayMs(retryNumber: number): number {
    const attempt = Number.isFinite(retryNumber)
        ? Math.max(1, Math.floor(retryNumber))
        : 1;
    return Math.min(500 * (2 ** (attempt - 1)), 5_000);
}
