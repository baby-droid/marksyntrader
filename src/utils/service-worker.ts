const PREVIEW_HOST_PATTERN = /(?:localhost|127\.0\.0\.1|\.replit\.dev)$/i;
const PREVIEW_CLEANUP_KEY = 'marksyntrader_preview_sw_cleaned_v1';

const isPreviewHost = (): boolean => {
    if (typeof window === 'undefined') return false;
    return PREVIEW_HOST_PATTERN.test(window.location.hostname);
};

const unregisterPreviewWorkers = async (): Promise<void> => {
    if (!('serviceWorker' in navigator)) return;

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));

    if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    }
};

/**
 * PWA workers are useful on deployed domains, but they must not control the
 * Replit development preview. A worker left over from an older build can claim
 * the preview tab and make a valid Rsbuild response appear blank.
 */
export const setupServiceWorker = (): void => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (isPreviewHost()) {
        const cleanup = unregisterPreviewWorkers()
            .then(() => {
                if (!navigator.serviceWorker.controller) return;
                if (sessionStorage.getItem(PREVIEW_CLEANUP_KEY) === '1') return;

                sessionStorage.setItem(PREVIEW_CLEANUP_KEY, '1');
                window.location.reload();
            })
            .catch(() => undefined);
        void cleanup;
        return;
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {});
};