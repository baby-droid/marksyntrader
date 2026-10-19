jest.mock('@/external/deriv-core', () => ({
    buildAuthorizationUrl: jest.fn(),
    buildSignUpUrl: jest.fn(),
    getAuthInfo: jest.fn(),
    getOAuthScopes: jest.fn(),
    parseLandingParams: jest.fn(),
    parseReferralLink: jest.fn(),
    resolveReferralViaProxy: jest.fn(),
}));

jest.mock('@/services/derivws-accounts.service', () => ({
    DerivWSAccountsService: {
        getAuthenticatedWebSocketURL: jest.fn(),
    },
}));

import { getAuthInfo } from '@/external/deriv-core';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { getSocketURL } from './config';

const mockGetAuthInfo = getAuthInfo as jest.Mock;
const mockGetAuthenticatedWebSocketURL = DerivWSAccountsService.getAuthenticatedWebSocketURL as jest.Mock;

describe('getSocketURL', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        localStorage.clear();
        mockGetAuthInfo.mockReset().mockReturnValue(null);
        mockGetAuthenticatedWebSocketURL.mockReset().mockResolvedValue('wss://api.derivws.com/trading/v1/options/ws/real?otp=test');
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('uses the authenticated OTP URL for the OAuth access token', async () => {
        mockGetAuthInfo.mockReturnValue({ access_token: 'oauth-access-token' });

        await expect(getSocketURL()).resolves.toContain('?otp=');
        expect(mockGetAuthenticatedWebSocketURL).toHaveBeenCalledWith('oauth-access-token');
    });

    it('uses the active account token if the legacy login flow has no auth_info record', async () => {
        localStorage.setItem('active_loginid', 'CR12345');
        localStorage.setItem('accountsList', JSON.stringify({ CR12345: 'account-access-token' }));

        await getSocketURL();

        expect(mockGetAuthenticatedWebSocketURL).toHaveBeenCalledWith('account-access-token');
    });

    it('uses the public market-data socket only when no account is signed in', async () => {
        await expect(getSocketURL()).resolves.toMatch(/\/public$/);
        expect(mockGetAuthenticatedWebSocketURL).not.toHaveBeenCalled();
    });

    it('does not silently fall back to the public socket for a saved account without a token', async () => {
        localStorage.setItem('active_loginid', 'CR12345');

        await expect(getSocketURL()).rejects.toThrow(/Sign in again to trade/);
        expect(mockGetAuthenticatedWebSocketURL).not.toHaveBeenCalled();
    });

    it('propagates OTP failures instead of returning the public socket', async () => {
        localStorage.setItem('active_loginid', 'CR12345');
        localStorage.setItem('accountsList', JSON.stringify({ CR12345: 'account-access-token' }));
        mockGetAuthenticatedWebSocketURL.mockRejectedValueOnce(new Error('OTP request failed'));

        await expect(getSocketURL()).rejects.toThrow('OTP request failed');
    });
});
