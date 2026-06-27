import { useCallback, useState } from 'react';
import { storeAuthInfo } from '@/external/deriv-core';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import './api-token-login-modal.scss';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const ApiTokenLoginModal = ({ isOpen, onClose }: Props) => {
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = useCallback(async () => {
        const trimmed = token.trim();
        if (!trimmed) {
            setError('Please paste your access token.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            storeAuthInfo({
                access_token: trimmed,
                token_type: 'Bearer',
                expires_in: 86400,
                expires_at: Math.floor(Date.now() / 1000) + 86400,
                scope: 'trade',
                refresh_token: '',
            });

            DerivWSAccountsService.clearCache();

            const accounts = await DerivWSAccountsService.fetchAccountsList(trimmed);

            if (!accounts || accounts.length === 0) {
                throw new Error('No trading accounts found. Check that your token has the "trade" scope.');
            }

            DerivWSAccountsService.storeAccounts(accounts);
            const first = accounts[0];
            localStorage.setItem('active_loginid', first.account_id);
            localStorage.setItem('account_type', first.account_type);

            const { api_base } = await import('@/external/bot-skeleton');
            await api_base.init(true);

            setToken('');
            onClose();
        } catch (err: unknown) {
            localStorage.removeItem('auth_info');
            const msg = err instanceof Error ? err.message : 'Invalid token or network error.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [token, onClose]);

    if (!isOpen) return null;

    return (
        <div className='token-modal-overlay' onClick={onClose}>
            <div className='token-modal' onClick={e => e.stopPropagation()}>
                <div className='token-modal__header'>
                    <h2>Login with API Token</h2>
                    <button className='token-modal__close' onClick={onClose} aria-label='Close'>
                        ✕
                    </button>
                </div>

                <div className='token-modal__body'>
                    <p>
                        Paste your Deriv OAuth2 <strong>access_token</strong> below to connect directly —
                        no redirect required.
                    </p>

                    <div className='token-modal__steps'>
                        <p>How to get your token</p>
                        <ol>
                            <li>
                                Go to{' '}
                                <a href='https://developers.deriv.com' target='_blank' rel='noreferrer'>
                                    developers.deriv.com
                                </a>{' '}
                                and register your app
                            </li>
                            <li>Complete OAuth2 login on that registered app</li>
                            <li>Copy the <code>access_token</code> from the response</li>
                            <li>Paste it here — valid for 24 hours</li>
                        </ol>
                    </div>

                    <div className='token-modal__input-group'>
                        <label htmlFor='api-token-input'>Access Token</label>
                        <input
                            id='api-token-input'
                            type='password'
                            value={token}
                            onChange={e => { setToken(e.target.value); setError(''); }}
                            placeholder='Paste your access token here…'
                            onKeyDown={e => e.key === 'Enter' && !loading && handleSubmit()}
                            autoFocus
                            autoComplete='off'
                        />
                    </div>

                    {error && <div className='token-modal__error'>⚠ {error}</div>}
                </div>

                <div className='token-modal__footer'>
                    <button className='token-modal__btn token-modal__btn--secondary' onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className='token-modal__btn token-modal__btn--primary'
                        onClick={handleSubmit}
                        disabled={loading || !token.trim()}
                    >
                        {loading ? 'Connecting…' : 'Connect'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiTokenLoginModal;
