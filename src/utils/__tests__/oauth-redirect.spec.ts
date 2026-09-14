import {
  clearRememberedOAuthRedirectUri,
  getOAuthRedirectUri,
  getRememberedOAuthRedirectUri,
  rememberOAuthRedirectUri,
} from '../oauth-redirect';

describe('OAuth redirect URI resolution', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    process.env.NEXT_PUBLIC_DERIV_REDIRECT_URI = 'https://marksyntrader.replit.app/callback';
    process.env.NEXT_PUBLIC_DERIV_PREVIEW_REDIRECT_URI = '';
    process.env.NEXT_PUBLIC_APP_BUILD = '';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses the registered published URI outside preview mode', () => {
    window.history.replaceState({}, '', '/');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://marksyntrader.replit.app/'),
    });

    expect(getOAuthRedirectUri()).toBe('https://marksyntrader.replit.app/callback');
  });

  it('uses the preview origin and basename callback in a static preview build', () => {
    process.env.NEXT_PUBLIC_APP_BUILD = 'true';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://preview.example.replit.dev/bot/preview'),
    });

    expect(getOAuthRedirectUri()).toBe('https://preview.example.replit.dev/bot/preview/callback');
  });

  it('preserves the exact redirect URI used before leaving for Deriv', () => {
    const redirectUri = 'https://preview.example.replit.dev/bot/preview/callback';

    rememberOAuthRedirectUri(redirectUri);
    expect(getRememberedOAuthRedirectUri()).toBe(redirectUri);

    clearRememberedOAuthRedirectUri();
    expect(getRememberedOAuthRedirectUri()).toBeNull();
  });
});