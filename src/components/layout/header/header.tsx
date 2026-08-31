import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import { generateOAuthURL } from '@/components/shared';
import Button from '@/components/shared_ui/button';
import useActiveAccount from '@/hooks/api/account/useActiveAccount';
import { useApiBase } from '@/hooks/useApiBase';
import { useDepositReal } from '@/hooks/useDepositReal';
import { useLogout } from '@/hooks/useLogout';
import { useResetDemoBalance } from '@/hooks/useResetDemoBalance';
import { useStore } from '@/hooks/useStore';
import { isDemoAccount } from '@/utils/account-helpers';
import { navigateToTransfer } from '@/utils/transfer-utils';
import {
    isASpeedBoostEnabled,
    setASpeedBoostEnabled,
    subscribeASpeedBoost,
} from '@/utils/execution-speed';
import { Localize } from '@deriv-com/translations';
import { Header, useDevice, Wrapper } from '@deriv-com/ui';
import { AppLogo } from '../app-logo';
import AccountSwitcher from './account-switcher';
import MobileMenu from './mobile-menu';
import NavDrawer from '@/components/nav-drawer/NavDrawer';
import './header.scss';

const ApiTokenLoginModal = lazy(() => import('@/components/login-modal/api-token-login-modal'));

const AppHeader = observer(() => {
    const { isDesktop } = useDevice();
    const { isAuthorizing, activeLoginid, setIsAuthorizing, authData } = useApiBase();
    const { client } = useStore() ?? {};
    const [authTimeout, setAuthTimeout] = useState(false);
    const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
    const is_account_regenerating = client?.is_account_regenerating || false;

    // Detect OAuth callback on mount (before App.tsx cleans up the URL).
    // When ?code=...&state=... is present the full auth flow can take 7-15 s
    // (token exchange → accounts fetch → OTP → WebSocket auth), so we must
    // suppress the short fallback timeout and keep the spinner throughout.
    const [isOAuthPending, setIsOAuthPending] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return Boolean(params.get('code') && params.get('state'));
    });

    const { data: activeAccount } = useActiveAccount({
        allBalanceData: client?.all_accounts_balance,
        directBalance: client?.balance,
    });

    const handleLogout = useLogout();

    // Clear OAuth-pending flag once the account is set (auth succeeded)
    // or after a generous timeout in case something goes wrong.
    useEffect(() => {
        if (!isOAuthPending) return;

        if (activeLoginid) {
            setIsOAuthPending(false);
            return;
        }

        // Safety net: give up after 30 s and let the normal flow decide
        const timer = setTimeout(() => setIsOAuthPending(false), 30_000);
        return () => clearTimeout(timer);
    }, [isOAuthPending, activeLoginid]);

    // Handle direct URL access with legacy token param
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const account_id = urlParams.get('account_id');
        if (account_id) {
            setIsAuthorizing(true);
        }
    }, [setIsAuthorizing]);

    // Fallback timeout: show login button if auth never resolves.
    // Suppressed during the OAuth callback flow (isOAuthPending = true).
    useEffect(() => {
        if (isOAuthPending) return;

        const timer = setTimeout(() => {
            if (isAuthorizing && !activeLoginid) {
                setAuthTimeout(true);
                setIsAuthorizing(false);
            }
        }, 5000);

        if (activeLoginid || !isAuthorizing) {
            if (authTimeout) setAuthTimeout(false);
            clearTimeout(timer);
        }

        return () => clearTimeout(timer);
    }, [isAuthorizing, activeLoginid, setIsAuthorizing, authTimeout, isOAuthPending]);

    const handleSignup = useCallback(async () => {
        try {
            setIsAuthorizing(true);
            const oauthUrl = await generateOAuthURL('registration');
            if (oauthUrl) {
                window.location.replace(oauthUrl);
            } else {
                console.error('Failed to generate OAuth URL for signup');
                setIsAuthorizing(false);
            }
        } catch (error) {
            console.error('Signup redirection failed:', error);
            setIsAuthorizing(false);
        }
    }, [setIsAuthorizing]);

    const handleLogin = useCallback(async () => {
        try {
            // Set authorizing state immediately when login is clicked
            setIsAuthorizing(true);

            // Generate OAuth URL with CSRF token and PKCE parameters
            const oauthUrl = await generateOAuthURL();

            if (oauthUrl) {
                // Redirect to OAuth URL
                window.location.replace(oauthUrl);
            } else {
                console.error('Failed to generate OAuth URL');
                setIsAuthorizing(false);
            }
        } catch (error) {
            console.error('Login redirection failed:', error);
            // Reset authorizing state if redirection fails
            setIsAuthorizing(false);
        }
    }, [setIsAuthorizing]);

    const handleTransfer = useCallback(() => {
        const transferCurrency = authData?.currency;
        if (!transferCurrency) {
            console.error('No currency available for transfer');
            return;
        }
        navigateToTransfer(transferCurrency);
    }, [authData?.currency]);

    // Demo-account reset & real-account deposit hooks
    const isDemo = Boolean(activeLoginid && isDemoAccount(activeLoginid));
    const { isResetting, resetError, resetSuccess, resetBalance } = useResetDemoBalance();
    const { state: depositState, openDeposit } = useDepositReal();
    const [aSpeedBoost, setASpeedBoost] = useState(isASpeedBoostEnabled());

    useEffect(() => subscribeASpeedBoost(setASpeedBoost), []);

    const handleASpeedBoost = useCallback(() => {
        setASpeedBoostEnabled(!aSpeedBoost);
    }, [aSpeedBoost]);

    const renderAccountSection = useCallback(
        (position: 'left' | 'right' = 'right') => {
            // Show account switcher and logout when user is fully authenticated
            if (activeLoginid && !is_account_regenerating) {
                if (position === 'left' && !isDesktop) {
                    // For mobile left section - only account switcher
                    return (
                        <div className='auth-actions'>
                            <div className='account-info'>
                                <AccountSwitcher activeAccount={activeAccount} />
                            </div>
                        </div>
                    );
                } else if (position === 'right') {
                    // For right section - account switcher (desktop) + action button
                    return (
                        <div className='auth-actions'>
                            {isDesktop && (
                                <div className='account-info'>
                                    <AccountSwitcher activeAccount={activeAccount} />
                                </div>
                            )}
                            {isDemo ? (
                                // Demo account: Transfer button only
                                <Button
                                    primary
                                    disabled={client?.is_logging_out || !authData?.currency}
                                    onClick={handleTransfer}
                                >
                                    <Localize i18n_default_text='Transfer' />
                                </Button>
                            ) : (
                                // Real account: Transfer + Deposit buttons
                                <div className='header__real-actions'>
                                    <Button
                                        primary
                                        disabled={client?.is_logging_out || !authData?.currency}
                                        onClick={handleTransfer}
                                    >
                                        <Localize i18n_default_text='Transfer' />
                                    </Button>
                                    <button
                                        className='header__deposit-btn'
                                        disabled={client?.is_logging_out || depositState === 'loading'}
                                        onClick={openDeposit}
                                        title='Deposit funds to your real account'
                                    >
                                        {depositState === 'loading' ? (
                                            <span className='header__deposit-btn__spinner' />
                                        ) : (
                                            <>
                                                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' style={{ marginRight: 5 }}>
                                                    <path d='M12 5v14M5 12l7 7 7-7' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'/>
                                                </svg>
                                                Deposit
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                }
            }
            // Show login button only when fully settled (not during OAuth flow)
            else if (
                position === 'right' &&
                !isOAuthPending &&
                ((!is_account_regenerating && !isAuthorizing && !activeLoginid) || authTimeout)
            ) {
                // Disable auth buttons until the OAuth app id is configured, so the
                // click handlers (which would otherwise log "Failed to generate OAuth
                // URL") never fire. The env-not-set toast explains why.
                const isAuthConfigured = Boolean(process.env.NEXT_PUBLIC_DERIV_APP_ID);
                return (
                    <div className='auth-actions'>
                        <Button tertiary disabled={!isAuthConfigured} onClick={handleLogin}>
                            <Localize i18n_default_text='Log in' />
                        </Button>
                        <Button primary_light disabled={!isAuthConfigured} onClick={handleSignup}>
                            <Localize i18n_default_text='Sign up' />
                        </Button>
                        <button
                            onClick={() => setIsTokenModalOpen(true)}
                            style={{
                                background: 'none',
                                border: '1.5px solid rgba(56,189,248,0.5)',
                                borderRadius: '16px',
                                color: '#38bdf8',
                                fontSize: '13px',
                                fontWeight: 600,
                                padding: '6px 14px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(56,189,248,0.12)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                        >
                            🔑 API Token
                        </button>
                    </div>
                );
            }
            // Default: Show spinner during loading states or when authorizing
            else if (position === 'right') {
                return (
                    <div className='auth-actions auth-actions--loading'>
                        <svg
                            className='auth-actions__spinner'
                            viewBox='0 0 24 24'
                            fill='none'
                            xmlns='http://www.w3.org/2000/svg'
                        >
                            <circle
                                cx='12'
                                cy='12'
                                r='10'
                                stroke='currentColor'
                                strokeWidth='2.5'
                                strokeLinecap='round'
                                strokeDasharray='31.416'
                                strokeDashoffset='10'
                            />
                        </svg>
                    </div>
                );
            }

            return null;
        },
        [
            isAuthorizing,
            isDesktop,
            activeLoginid,
            client,
            activeAccount,
            authTimeout,
            is_account_regenerating,
            isOAuthPending,
            authData,
            isDemo,
            depositState,
            openDeposit,
            handleLogin,
            handleSignup,
            handleTransfer,
        ]
    );

    if (client?.should_hide_header) return null;

    // Left-side demo reset button: shown on desktop when logged in with a demo account
    const demoResetBtn = isDesktop && isDemo && activeLoginid && !is_account_regenerating ? (
        <button
            className={clsx('header__demo-reset-btn', {
                'header__demo-reset-btn--success': resetSuccess,
                'header__demo-reset-btn--error': Boolean(resetError),
            })}
            title={resetError ?? (resetSuccess ? 'Balance reset!' : 'Reset demo balance to 10,000 USD')}
            disabled={isResetting}
            onClick={resetBalance}
        >
            {isResetting ? (
                <span className='header__demo-reset-btn__spinner' />
            ) : resetSuccess ? (
                <>
                    <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
                        <path d='M5 12l5 5L19 7' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'/>
                    </svg>
                    Reset!
                </>
            ) : (
                <>
                    <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
                        <path d='M1 4v6h6M23 20v-6h-6' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'/>
                        <path d='M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'/>
                    </svg>
                    Reset Demo
                </>
            )}
        </button>
    ) : null;

    // App-wide execution preset. It lives beside the account controls so it
    // remains available while any bot page is open.
    const aSpeedBoostBtn = activeLoginid && !is_account_regenerating ? (
        <button
            type='button'
            className={clsx('header__a-speed-btn', {
                'header__a-speed-btn--active': aSpeedBoost,
            })}
            aria-pressed={aSpeedBoost}
            title={aSpeedBoost
                ? 'A-SPEED BOOST ON — Turbo direct-buy with zero intentional delay. Click to turn off.'
                : 'Turn on A-SPEED BOOST — app-wide Turbo direct-buy with zero intentional delay.'}
            onClick={handleASpeedBoost}
        >
            <span className='header__a-speed-btn__icon'>⚡</span>
            <span>A-SPEED BOOST</span>
            <span className='header__a-speed-btn__state'>{aSpeedBoost ? 'ON' : 'OFF'}</span>
        </button>
    ) : null;

    return (
        <>
            <Header
                className={clsx('app-header', {
                    'app-header--desktop': isDesktop,
                    'app-header--mobile': !isDesktop,
                })}
            >
                <Wrapper variant='left'>
                    <MobileMenu onLogout={handleLogout} />
                    <NavDrawer />
                    <AppLogo />
                    {isDesktop ? (
                        <>
                            {demoResetBtn}
                            {aSpeedBoostBtn}
                        </>
                    ) : (
                        <>
                            {renderAccountSection('left')}
                            {aSpeedBoostBtn}
                        </>
                    )}
                </Wrapper>
                <Wrapper variant='right'>
                    {renderAccountSection('right')}
                </Wrapper>
            </Header>
            <Suspense fallback={null}>
                <ApiTokenLoginModal
                    isOpen={isTokenModalOpen}
                    onClose={() => setIsTokenModalOpen(false)}
                />
            </Suspense>
        </>
    );
});

export default AppHeader;
