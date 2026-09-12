const CHUNK_RELOAD_FLAG = 'chunk_reload_attempted';
const CHUNK_RELOAD_WINDOW_MS = 15_000;

export function isChunkLoadFailure(error: unknown): boolean {
    const value = error as { name?: string; message?: string } | null | undefined;
    const message = typeof value === 'string' ? value : value?.message ?? String(error ?? '');
    return (
        value?.name === 'ChunkLoadError' ||
        /loading chunk/i.test(message) ||
        /failed to fetch dynamically imported module/i.test(message) ||
        /error loading dynamically imported module/i.test(message) ||
        /loading css chunk/i.test(message)
    );
}

export function reloadAfterChunkFailure(): boolean {
    if (typeof window === 'undefined') return false;

    const now = Date.now();
    const previousAttempt = Number(sessionStorage.getItem(CHUNK_RELOAD_FLAG));

    // Allow one fresh retry per short window without creating an infinite reload
    // loop when the server is genuinely missing an asset.
    if (Number.isFinite(previousAttempt) && now - previousAttempt < CHUNK_RELOAD_WINDOW_MS) {
        return false;
    }

    sessionStorage.setItem(CHUNK_RELOAD_FLAG, String(now));
    const freshUrl = new URL(window.location.href);
    freshUrl.searchParams.set('__chunk_reload', String(now));
    window.location.replace(freshUrl.toString());
    return true;
}

export function installChunkRecovery(): () => void {
    if (typeof window === 'undefined') return () => undefined;

    const handleRejection = (event: PromiseRejectionEvent) => {
        if (isChunkLoadFailure(event.reason)) reloadAfterChunkFailure();
    };

    const handleError = (event: ErrorEvent) => {
        const target = event.target;
        const failedScript =
            target instanceof HTMLScriptElement && /\/static\/js\/|\.js(?:$|\?)/i.test(target.src);

        if (failedScript || isChunkLoadFailure(event.error ?? event.message)) {
            reloadAfterChunkFailure();
        }
    };

    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleError, true);

    return () => {
        window.removeEventListener('unhandledrejection', handleRejection);
        window.removeEventListener('error', handleError, true);
    };
}

export { CHUNK_RELOAD_FLAG };