import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cleanupUrl, handleOAuthCallback } from '@/external/deriv-core';
import './callback.scss';

type Status = 'loading' | 'error';

const CallbackPage = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<Status>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const processed = useRef(false);

    useEffect(() => {
        if (processed.current) return;
        processed.current = true;

        const run = async () => {
            try {
                const redirectUri =
                    process.env.NEXT_PUBLIC_DERIV_REDIRECT_URI ||
                    `${window.location.origin}/callback`;

                const authInfo = await handleOAuthCallback(window.location.href, {
                    clientId: process.env.NEXT_PUBLIC_DERIV_APP_ID || '',
                    redirectUri,
                    scopes: 'trade read',
                });

                const { DerivWSAccountsService } = await import('@/services/derivws-accounts.service');
                DerivWSAccountsService.clearCache();
                const accounts = await DerivWSAccountsService.fetchAccountsList(authInfo.access_token);

                if (!accounts || accounts.length === 0) {
                    throw new Error('No trading accounts found for this Deriv profile.');
                }

                DerivWSAccountsService.storeAccounts(accounts);
                const first = accounts[0];
                localStorage.setItem('active_loginid', first.account_id);
                localStorage.setItem('account_type', first.account_type);

                const { api_base } = await import('@/external/bot-skeleton');
                await api_base.init(true);

                cleanupUrl(redirectUri);
                navigate('/', { replace: true });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Authentication failed.';
                console.error('[Callback] OAuth error:', err);
                setErrorMsg(msg);
                setStatus('error');
            }
        };

        run();
    }, [navigate]);

    return (
        <div className='callback-page'>
            <div className='callback-page__card'>
                <div className='callback-page__logo'>
                    <span className='callback-page__logo-icon'>⚡</span>
                    <span className='callback-page__logo-text'>Marksyntrader</span>
                </div>

                {status === 'loading' && (
                    <>
                        <div className='callback-page__spinner'>
                            <div className='callback-page__spinner-ring' />
                        </div>
                        <h2 className='callback-page__title'>Connecting your account…</h2>
                        <p className='callback-page__subtitle'>
                            Verifying your Deriv credentials and setting up your workspace.
                        </p>
                        <div className='callback-page__steps'>
                            <Step label='Verifying OAuth token' done />
                            <Step label='Loading account list' done={false} active />
                            <Step label='Initialising WebSocket' done={false} />
                        </div>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className='callback-page__error-icon'>⚠</div>
                        <h2 className='callback-page__title callback-page__title--error'>
                            Authentication Failed
                        </h2>
                        <p className='callback-page__subtitle'>{errorMsg}</p>
                        <button
                            className='callback-page__retry-btn'
                            onClick={() => navigate('/', { replace: true })}
                        >
                            ← Back to login
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

const Step = ({ label, done, active }: { label: string; done: boolean; active?: boolean }) => (
    <div className={`callback-step ${done ? 'callback-step--done' : ''} ${active ? 'callback-step--active' : ''}`}>
        <span className='callback-step__dot'>
            {done ? '✓' : active ? <span className='callback-step__pulse' /> : '○'}
        </span>
        <span className='callback-step__label'>{label}</span>
    </div>
);

export default CallbackPage;
