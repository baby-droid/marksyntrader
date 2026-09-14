const PREVIEW_BASE_PATH = '/bot/preview';

const isPreviewPath = (pathname: string): boolean =>
    pathname === PREVIEW_BASE_PATH || pathname.startsWith(`${PREVIEW_BASE_PATH}/`);

const isDevelopmentHost = (hostname: string): boolean =>
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.endsWith('.replit.dev');

/**
 * Resolve the URI used for both OAuth authorization and callback processing.
 *
 * Published builds use the exact URI registered in the Deriv application.
 * Replit preview/local builds use their current origin so OAuth does not
 * silently return to the published app. The preview URI still has to be
 * registered for the Deriv app ID before a preview login can complete.
 */
export const getOAuthRedirectUri = (): string => {
    if (typeof window === 'undefined') {
        return process.env.NEXT_PUBLIC_DERIV_REDIRECT_URI || '/callback';
    }

    const configuredUri = process.env.NEXT_PUBLIC_DERIV_REDIRECT_URI?.trim();
    const previewOverride = process.env.NEXT_PUBLIC_DERIV_PREVIEW_REDIRECT_URI?.trim();
    const previewBuild = process.env.NEXT_PUBLIC_APP_BUILD === 'true';
    const previewHost = isDevelopmentHost(window.location.hostname);
    const previewPath = isPreviewPath(window.location.pathname);

    if (previewOverride && (previewBuild || previewHost || previewPath)) {
        return previewOverride;
    }

    if (previewBuild || previewHost || previewPath) {
        const callbackPath = previewPath || previewBuild
            ? `${PREVIEW_BASE_PATH}/callback`
            : '/callback';
        return `${window.location.origin}${callbackPath}`;
    }

    return configuredUri || `${window.location.origin}/callback`;
};