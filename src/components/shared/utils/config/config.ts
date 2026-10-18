import {
    buildAuthorizationUrl,
    buildSignUpUrl,
    getAuthInfo,
    parseReferralLink,
    parseLandingParams,
    resolveReferralViaProxy,
    getOAuthScopes,
} from '@/external/deriv-core';
import type { AuthConfig } from '@/external/deriv-core';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { getOAuthRedirectUri, rememberOAuthRedirectUri } from '@/utils/oauth-redirect';
import brandConfig from '../../../../../brand.config.json';

// =============================================================================
// Constants - Domain & Server Configuration (from brand.config.json)
// =============================================================================

// Production app domains
export const PRODUCTION_DOMAINS = {
    COM: brandConfig.platform.hostname.production.com,
} as const;

// Staging app domains
export const STAGING_DOMAINS = {
    COM: brandConfig.platform.hostname.staging.com,
} as const;

// WebSocket server URLs.
// `WebSocket` requires a `ws:`/`wss:` scheme — passing an `https:`/`http:` URL
// (as brand.config.json stores them, since they're shared with plain HTTP/REST
// usages elsewhere) throws a SyntaxError in the browser. Normalize here so the
// actual live-connection code always gets a valid WebSocket URL.
const toWebSocketScheme = (url: string) => url.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');

export const WS_SERVERS = {
    STAGING: toWebSocketScheme(`${brandConfig.platform.derivws.url.staging}options/ws/public`),
    PRODUCTION: toWebSocketScheme(`${brandConfig.platform.derivws.url.production}options/ws/public`),
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

// Helper to check if we're on production.
// NEXT_PUBLIC_DERIV_ENV is the authoritative signal (set at build/deploy time and
// also read by vendored deriv-core for OAuth), so a deployed partner domain resolves the
// same environment for WebSocket and OAuth. Falls back to hostname detection when
// the env var is unset (e.g. local dev).
export const isProduction = () => {
    const env = process.env.NEXT_PUBLIC_DERIV_ENV;
    if (env === 'production') return true;
    if (env === 'preview' || env === 'staging') return false;

    const hostname = window.location.hostname;
    const productionDomains = Object.values(PRODUCTION_DOMAINS) as string[];
    return productionDomains.includes(hostname);
};

export const isLocal = () => /localhost(:\d+)?$/i.test(window.location.hostname);

const getDefaultServerURL = () => {
    const isProductionEnv = isProduction();

    try {
        return isProductionEnv ? WS_SERVERS.PRODUCTION : WS_SERVERS.STAGING;
    } catch (error) {
        console.error('Error in getDefaultServerURL:', error);
    }

    return isProductionEnv ? WS_SERVERS.PRODUCTION : WS_SERVERS.STAGING;
};

/**
 * Gets the WebSocket URL using the authenticated flow
 * 1. Get the active OAuth access token (or the account token stored by the legacy login flow)
 * 2. Fetch OTP WebSocket URL from DerivWSAccountsService
 *
 * @returns Promise with WebSocket URL or fallback to default server
 */
export const getSocketURL = async (): Promise<string> => {
    const activeLoginId = typeof window === 'undefined' ? null : window.localStorage.getItem('active_loginid');
    let accessToken: string | null | undefined;

    try {
        const authInfo = getAuthInfo();
        accessToken = authInfo?.access_token;
    } catch (error) {
        console.error('[DerivWS] Could not read the saved OAuth session:', error);
    }

    if (!accessToken && activeLoginId && activeLoginId !== 'null') {
        try {
            const storedAccounts = JSON.parse(window.localStorage.getItem('accountsList') || '{}');
            const accountToken = storedAccounts?.[activeLoginId];
            if (typeof accountToken === 'string') {
                accessToken = accountToken;
            } else if (accountToken && typeof accountToken === 'object') {
                accessToken = accountToken.access_token || accountToken.token;
            }
        } catch (error) {
            console.error('[DerivWS] Could not read the saved account token:', error);
        }
    }

    if (!accessToken) {
        if (activeLoginId && activeLoginId !== 'null') {
            throw new Error('Your saved Deriv account has no valid access token. Sign in again to trade.');
        }
        return getDefaultServerURL();
    }

    try {
        return await DerivWSAccountsService.getAuthenticatedWebSocketURL(accessToken);
    } catch (error) {
        console.error('[DerivWS] Error in getSocketURL:', error);
        throw error;
    }
};

export const getDebugServiceWorker = () => {
    const debug_service_worker_flag = window.localStorage.getItem('debug_service_worker');
    if (debug_service_worker_flag) return !!parseInt(debug_service_worker_flag);

    return false;
};

/**
 * Generates the OAuth login or sign-up URL using vendored deriv-core
 *
 * @param prompt - Optional prompt parameter ('registration' for sign-up flow)
 * @returns Promise with the OAuth URL string
 */
export const generateOAuthURL = async (prompt?: string): Promise<string> => {
    try {
        const clientId = process.env.NEXT_PUBLIC_DERIV_APP_ID;
        if (!clientId) return '';

        const redirectUri = getOAuthRedirectUri();
        rememberOAuthRedirectUri(redirectUri);
        const config: AuthConfig = {
            clientId,
            redirectUri,
            scopes: getOAuthScopes(process.env.NEXT_PUBLIC_DERIV_OAUTH_SCOPES),
        };

        // Static referral link (fallback for direct visits without affiliate click)
        const referralLink = process.env.NEXT_PUBLIC_DERIV_REFERRAL_LINK;
        if (referralLink) {
            const referral = parseReferralLink(referralLink);
            if (referral) {
                config.affiliateToken = referral.affiliateToken;
                config.affiliateTokenParam = referral.affiliateTokenParam;
                config.utmCampaign = referral.utmCampaign;
                if (referral.utmSource) config.utmSource = referral.utmSource;
                if (referral.utmMedium) config.utmMedium = referral.utmMedium;
            }
        }

        // Override with live per-click params from landing URL (e.g. Scaleo t= token)
        const landing = parseLandingParams();
        if (landing) {
            // Only override the token when the landing URL actually carries one
            // (t=). parseLandingParams returns non-null for any utm_* param, so an
            // unguarded write would clobber a valid env token with '' on generic
            // marketing links (e.g. ?utm_source=google with no t=).
            if (landing.affiliateToken) {
                config.affiliateToken = landing.affiliateToken;
                config.affiliateTokenParam = landing.affiliateTokenParam;
            }
            if (landing.utmSource) config.utmSource = landing.utmSource;
            if (landing.utmMedium) config.utmMedium = landing.utmMedium;
            if (landing.utmCampaign) config.utmCampaign = landing.utmCampaign;
        }

        // If we still have no token and the referral link is a Scaleo click link,
        // resolve a fresh per-user token via the BFF proxy (non-blocking).
        if (!config.affiliateToken && referralLink) {
            const resolved = await resolveReferralViaProxy(referralLink);
            if (resolved) {
                config.affiliateToken = resolved.affiliateToken;
                config.affiliateTokenParam = resolved.affiliateTokenParam;
                if (resolved.utmSource) config.utmSource = resolved.utmSource;
                if (resolved.utmMedium) config.utmMedium = resolved.utmMedium;
                if (resolved.utmCampaign) config.utmCampaign = resolved.utmCampaign;
            }
        }

        if (prompt === 'registration') {
            return await buildSignUpUrl(config);
        }
        return await buildAuthorizationUrl(config);
    } catch (error) {
        console.error('Error generating OAuth URL:', error);
        return '';
    }
};
