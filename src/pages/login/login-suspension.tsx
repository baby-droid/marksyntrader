import { lazy, Suspense, useCallback, useState } from 'react';
import { generateOAuthURL } from '@/components/shared';
import './login-suspension.scss';

const ApiTokenLoginModal = lazy(() => import('@/components/login-modal/api-token-login-modal'));

const LoginSuspensionPage = () => {
    const [loading, setLoading] = useState<'login' | 'signup' | null>(null);
    const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);

    const handleLogin = useCallback(async () => {
        setLoading('login');
        try {
            const url = await generateOAuthURL();
            if (url) window.location.replace(url);
        } finally {
            setLoading(null);
        }
    }, []);

    const handleSignUp = useCallback(async () => {
        setLoading('signup');
        try {
            const url = await generateOAuthURL('registration');
            if (url) window.location.replace(url);
        } finally {
            setLoading(null);
        }
    }, []);

    return (
        <div className='login-suspension'>
            <div className='login-suspension__bg'>
                <div className='login-suspension__bg-orb login-suspension__bg-orb--1' />
                <div className='login-suspension__bg-orb login-suspension__bg-orb--2' />
                <div className='login-suspension__bg-grid' />
            </div>

            <div className='login-suspension__content'>
                <div className='login-suspension__brand'>
                    <div className='login-suspension__brand-icon'>⚡</div>
                    <h1 className='login-suspension__brand-name'>Marksyntrader</h1>
                    <p className='login-suspension__brand-tagline'>
                        Visual Trading Bot — Powered by Deriv
                    </p>
                </div>

                <div className='login-suspension__card'>
                    <div className='login-suspension__card-header'>
                        <h2>Welcome back</h2>
                        <p>Connect your Deriv account to start trading with automated bots</p>
                    </div>

                    <div className='login-suspension__actions'>
                        <button
                            className='login-suspension__btn login-suspension__btn--primary'
                            onClick={handleLogin}
                            disabled={loading !== null}
                        >
                            {loading === 'login' ? (
                                <span className='login-suspension__spinner' />
                            ) : (
                                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                                    <path d='M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3' />
                                </svg>
                            )}
                            Log in with Deriv
                        </button>

                        <button
                            className='login-suspension__btn login-suspension__btn--secondary'
                            onClick={handleSignUp}
                            disabled={loading !== null}
                        >
                            {loading === 'signup' ? (
                                <span className='login-suspension__spinner' />
                            ) : (
                                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                                    <path d='M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8zM19 8v6M22 11h-6' />
                                </svg>
                            )}
                            Create Deriv account
                        </button>

                        <div className='login-suspension__divider'>
                            <span>or</span>
                        </div>

                        <button
                            className='login-suspension__btn login-suspension__btn--token'
                            onClick={() => setIsTokenModalOpen(true)}
                            disabled={loading !== null}
                        >
                            🔑 Use API Access Token
                        </button>
                    </div>

                    <div className='login-suspension__note'>
                        <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                            <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                            <path d='M7 11V7a5 5 0 0110 0v4' />
                        </svg>
                        Secured with OAuth 2.0 · Scopes: <code>trade</code> <code>read</code>
                    </div>
                </div>

                <div className='login-suspension__features'>
                    {[
                        { icon: '🤖', title: 'Visual Bot Builder', desc: 'Build bots with drag-and-drop blocks — no code required' },
                        { icon: '⚡', title: 'Fast Execution', desc: '1-tick contracts fired immediately on signal' },
                        { icon: '📚', title: 'Bot Library', desc: 'Save, upload and reuse your XML strategies' },
                    ].map(f => (
                        <div key={f.title} className='login-suspension__feature'>
                            <span className='login-suspension__feature-icon'>{f.icon}</span>
                            <div>
                                <strong>{f.title}</strong>
                                <p>{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <p className='login-suspension__footer'>
                    To register your redirect URI{' '}
                    <code>https://marksyntrader.replit.app/callback</code>{' '}
                    visit the{' '}
                    <a href='https://developers.deriv.com' target='_blank' rel='noreferrer'>
                        Deriv Developer Portal
                    </a>
                    .
                </p>
            </div>

            <Suspense fallback={null}>
                <ApiTokenLoginModal
                    isOpen={isTokenModalOpen}
                    onClose={() => setIsTokenModalOpen(false)}
                />
            </Suspense>
        </div>
    );
};

export default LoginSuspensionPage;
