import { TextEncoder, TextDecoder } from 'util';
import { webcrypto } from 'crypto';
import {
  buildAuthorizationUrl,
  buildSignUpUrl,
  DEFAULT_OAUTH_SCOPES,
  handleOAuthCallback,
  OAuthError,
} from './oauth';
import { clearAllAuthData, getAuthInfo } from './storage';

Object.assign(global, { TextEncoder, TextDecoder });
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

describe('Deriv OAuth', () => {
  const publishedConfig = {
    clientId: 'test-client',
    redirectUri: 'https://marksyntrader.replit.app/callback',
  };
  const previewConfig = {
    clientId: 'test-client',
    redirectUri: 'https://preview.example.replit.dev/bot/preview/callback',
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    jest.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    clearAllAuthData();
  });

  it('uses the accepted trade scope for the published authorization URL', async () => {
    const url = new URL(await buildAuthorizationUrl(publishedConfig));

    expect(url.origin + url.pathname).toBe('https://auth.deriv.com/oauth2/auth');
    expect(url.searchParams.get('client_id')).toBe('test-client');
    expect(url.searchParams.get('redirect_uri')).toBe(publishedConfig.redirectUri);
    expect(url.searchParams.get('scope')).toBe(DEFAULT_OAUTH_SCOPES);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('preserves explicitly configured space-separated scopes', async () => {
    const url = new URL(
      await buildAuthorizationUrl({
        ...publishedConfig,
        scopes: 'trade payment',
      })
    );

    expect(url.searchParams.get('scope')).toBe('trade payment');
  });

  it('keeps the preview callback URI exact and adds the registration prompt', async () => {
    const url = new URL(await buildSignUpUrl(previewConfig));

    expect(url.searchParams.get('redirect_uri')).toBe(previewConfig.redirectUri);
    expect(url.searchParams.get('scope')).toBe('trade');
    expect(url.searchParams.get('prompt')).toBe('registration');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('validates state and exchanges the callback code with the original PKCE verifier', async () => {
    const authorizationUrl = new URL(await buildAuthorizationUrl(publishedConfig));
    const state = authorizationUrl.searchParams.get('state')!;
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'trade',
          refresh_token: 'refresh-token',
        }),
      } as Response
    );

    const authInfo = await handleOAuthCallback(
      `https://marksyntrader.replit.app/callback?code=auth-code&state=${encodeURIComponent(state)}`,
      publishedConfig
    );

    expect(authInfo.access_token).toBe('access-token');
    expect(getAuthInfo()?.access_token).toBe('access-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(requestUrl).toBe('https://auth.deriv.com/oauth2/token');
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    const body = new URLSearchParams(String(requestInit?.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('client_id')).toBe('test-client');
    expect(body.get('redirect_uri')).toBe(publishedConfig.redirectUri);
    expect(body.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sessionStorage.getItem('oauth_csrf_token')).toBeNull();
    expect(sessionStorage.getItem('oauth_code_verifier')).toBeNull();
  });

  it('rejects a callback with a missing or mismatched state', async () => {
    await buildAuthorizationUrl(publishedConfig);

    await expect(
      handleOAuthCallback(
        'https://marksyntrader.replit.app/callback?code=auth-code&state=wrong-state',
        publishedConfig
      )
    ).rejects.toThrow(OAuthError);
  });

  it('surfaces an OAuth error response without attempting token exchange', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');

    await expect(
      handleOAuthCallback(
        'https://marksyntrader.replit.app/callback?error=access_denied&error_description=User%20cancelled',
        publishedConfig
      )
    ).rejects.toThrow('OAuth error: access_denied - User cancelled');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});