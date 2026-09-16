import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearTradingToken, getTradingToken, hasTradingToken, setTradingToken } from '@/utils/trading-token';
import './connect.scss';

const APP_ID = (process.env.NEXT_PUBLIC_DERIV_APP_ID as string) || '1089';
const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`;

type Status = 'idle' | 'testing' | 'success' | 'error';

interface AccountInfo {
    loginid: string;
    balance: number;
    currency: string;
    fullname?: string;
    email?: string;
}

export default function ConnectPage() {
    const navigate = useNavigate();
    const [token, setToken] = useState('');
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState('');
    const [account, setAccount] = useState<AccountInfo | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (hasTradingToken()) {
            const existing = getTradingToken()!;
            setToken(existing);
            setStatus('success');
            testToken(existing, false);
        }
        return () => { wsRef.current?.close(); };
    }, []);

    const testToken = useCallback((tkn: string, save: boolean) => {
        const cleaned = tkn.trim();
        if (!cleaned) { setError('Please paste your Deriv API token.'); setStatus('error'); return; }
        setStatus('testing');
        setError('');
        setAccount(null);

        wsRef.current?.close();
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        let timeout: ReturnType<typeof setTimeout>;

        ws.onopen = () => {
            ws.send(JSON.stringify({ authorize: cleaned, req_id: 1 }));
            timeout = setTimeout(() => {
                setError('Connection timed out. Check your internet or try again.');
                setStatus('error');
                ws.close();
            }, 10000);
        };

        ws.onmessage = (e) => {
            clearTimeout(timeout);
            const d = JSON.parse(e.data);
            if (d.error) {
                setError(d.error.message || 'Invalid API token.');
                setStatus('error');
                ws.close();
                return;
            }
            if (d.authorize) {
                const a = d.authorize;
                setAccount({
                    loginid: a.loginid,
                    balance: parseFloat(a.balance ?? '0'),
                    currency: a.currency ?? 'USD',
                    fullname: a.fullname,
                    email: a.email,
                });
                if (save) setTradingToken(cleaned);
                setStatus('success');
            }
            ws.close();
        };

        ws.onerror = () => {
            clearTimeout(timeout);
            setError('Connection failed. Please check your internet connection.');
            setStatus('error');
        };
    }, []);

    const handleConnect = () => testToken(token, true);

    const handleDisconnect = () => {
        clearTradingToken();
        setToken('');
        setAccount(null);
        setStatus('idle');
        setError('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleConnect();
    };

    return (
        <div className='connect-page'>
            <div className='connect-page__card'>
                <div className='connect-page__header'>
                    <div className='connect-page__logo'>🔌</div>
                    <h1>Connect Trading Account</h1>
                    <p>Link your Deriv API token once to enable live trading across all pages.</p>
                </div>

                {status === 'success' && account && (
                    <div className='connect-page__account-info'>
                        <div className='connect-page__account-badge'>✅ Connected</div>
                        <div className='connect-page__account-details'>
                            <div className='connect-page__account-row'>
                                <span>Account</span>
                                <strong>{account.loginid}</strong>
                            </div>
                            {account.fullname && (
                                <div className='connect-page__account-row'>
                                    <span>Name</span>
                                    <strong>{account.fullname}</strong>
                                </div>
                            )}
                            <div className='connect-page__account-row'>
                                <span>Balance</span>
                                <strong className='connect-page__balance'>
                                    {account.balance.toFixed(2)} {account.currency}
                                </strong>
                            </div>
                        </div>
                        <div className='connect-page__actions'>
                            <button className='connect-page__btn connect-page__btn--primary' onClick={() => navigate('/')}>
                                ▶ Go to Dashboard
                            </button>
                            <button className='connect-page__btn connect-page__btn--danger' onClick={handleDisconnect}>
                                🔌 Disconnect
                            </button>
                        </div>
                    </div>
                )}

                {status !== 'success' && (
                    <>
                        <div className='connect-page__steps'>
                            <div className='connect-page__step'>
                                <span className='connect-page__step-num'>1</span>
                                <div>
                                    <strong>Get your API token</strong>
                                    <p>
                                        Go to{' '}
                                        <a href='https://app.deriv.com/account/api-token' target='_blank' rel='noopener noreferrer'>
                                            app.deriv.com/account/api-token
                                        </a>{' '}
                                        and create a token with <em>Read</em> + <em>Trade</em> permissions.
                                    </p>
                                </div>
                            </div>
                            <div className='connect-page__step'>
                                <span className='connect-page__step-num'>2</span>
                                <div>
                                    <strong>Paste it below</strong>
                                    <p>Your token starts with <code>a1-</code></p>
                                </div>
                            </div>
                            <div className='connect-page__step'>
                                <span className='connect-page__step-num'>3</span>
                                <div>
                                    <strong>Click Connect</strong>
                                    <p>All trading pages (AI, Speed Lab, Hedge) will use this token automatically.</p>
                                </div>
                            </div>
                        </div>

                        <div className='connect-page__input-group'>
                            <label htmlFor='api-token'>Deriv API Token</label>
                            <input
                                id='api-token'
                                type='password'
                                value={token}
                                onChange={e => setToken(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder='a1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
                                className='connect-page__input'
                                autoComplete='off'
                                spellCheck={false}
                            />
                            {error && <div className='connect-page__error'>⚠️ {error}</div>}
                        </div>

                        <button
                            className='connect-page__btn connect-page__btn--primary connect-page__btn--full'
                            onClick={handleConnect}
                            disabled={status === 'testing' || !token.trim()}
                        >
                            {status === 'testing' ? (
                                <span className='connect-page__spinner' />
                            ) : (
                                '🔌 Connect Account'
                            )}
                        </button>

                        <div className='connect-page__back'>
                            <button className='connect-page__btn connect-page__btn--ghost' onClick={() => navigate('/')}>
                                ← Back to Dashboard
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
