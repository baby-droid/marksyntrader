const PREVIEW_BASE_PATH = '/bot/preview';
const OAUTH_REDIRECT_URI_KEY = 'marksyntrader.oauth_redirect_uri';

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

    // A stale deployment URL must not override the host the user is currently
    // using. This keeps OAuth on the actual published app when a Replit
    // deployment has been renamed or moved to its generated -- hostname.
    if (configuredUri) {
        try {
            const configuredUrl = new URL(configuredUri);
            if (configuredUrl.origin === window.location.origin) {
                return configuredUri;
            }
        } catch {
            // Fall through to the current origin when the configured value is invalid.
        }
    }

    return `${window.location.origin}/callback`;
};

/**
 * Keep the exact redirect URI used to start OAuth available for the callback.
 * OAuth requires the token exchange redirect_uri to match the authorization
 * request byte-for-byte, so recomputing it after a host/path change is unsafe.
 */
export const rememberOAuthRedirectUri = (redirectUri: string): void => {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(OAUTH_REDIRECT_URI_KEY, redirectUri);
    } catch {
        // Session storage can be unavailable in privacy-restricted browsers.
    }
};

export const getRememberedOAuthRedirectUri = (): string | null => {
    if (typeof window === 'undefined') return null;
    try {
        return window.sessionStorage.getItem(OAUTH_REDIRECT_URI_KEY);
    } catch {
        return null;
    }
};

export const clearRememberedOAuthRedirectUri = (): void => {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.removeItem(OAUTH_REDIRECT_URI_KEY);
    } catch {
        // Session storage can be unavailable in privacy-restricted browsers.
    }
};