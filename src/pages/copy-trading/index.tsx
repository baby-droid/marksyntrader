// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import { api_base } from '@/external/bot-skeleton';
import './copy-trading.scss';

interface LinkedAccount {
  token: string;
  loginid: string;
  currency: string;
  balance?: number;
  status: 'active' | 'error' | 'pending';
  replicatedTrades: number;
}

const CopyTrading = observer(() => {
  const { balance, currency, tradeResults, totalProfit } = useDerivTrading();
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [tokenInput, setTokenInput] = useState('');
  const [isCopying, setIsCopying] = useState(false);
  const [copyMode, setCopyMode] = useState<'demo_real' | 'token'>('token');
  const [totalReplicated, setTotalReplicated] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const copyRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  const handleAddToken = useCallback(async () => {
    if (!tokenInput.trim()) return;
    const token = tokenInput.trim();
    setTokenInput('');

    const pending: LinkedAccount = {
      token,
      loginid: 'Verifying...',
      currency: '---',
      status: 'pending',
      replicatedTrades: 0,
    };
    setLinkedAccounts(prev => [...prev, pending]);

    try {
      // Verify token by authorizing
      const res = await api_base.api.send({ authorize: token });
      if (res?.authorize) {
        const { loginid, currency: cur, balance: bal } = res.authorize;
        setLinkedAccounts(prev =>
          prev.map(a => a.token === token
            ? { ...a, loginid, currency: cur, balance: parseFloat(bal || '0'), status: 'active' }
            : a
          )
        );
        addLog(`✅ Linked account: ${loginid} (${cur})`);
      } else {
        setLinkedAccounts(prev =>
          prev.map(a => a.token === token ? { ...a, loginid: 'Invalid', status: 'error' } : a)
        );
        addLog(`❌ Invalid token`);
      }
    } catch (e) {
      setLinkedAccounts(prev =>
        prev.map(a => a.token === token ? { ...a, loginid: 'Error', status: 'error' } : a)
      );
      addLog(`❌ Token verification failed`);
    }
  }, [tokenInput, addLog]);

  const handleRemoveAccount = useCallback((token: string) => {
    setLinkedAccounts(prev => prev.filter(a => a.token !== token));
    addLog(`Removed linked account`);
  }, [addLog]);

  const toggleCopy = useCallback(() => {
    if (isCopying) {
      copyRef.current = false;
      setIsCopying(false);
      addLog('⏸ Copy trading stopped');
    } else {
      if (linkedAccounts.filter(a => a.status === 'active').length === 0) {
        addLog('⚠️ No active linked accounts to copy to');
        return;
      }
      copyRef.current = true;
      setIsCopying(true);
      addLog('▶ Copy trading started');
    }
  }, [isCopying, linkedAccounts, addLog]);

  // When a new trade result comes in, replicate to linked accounts
  useEffect(() => {
    if (!isCopying || tradeResults.length === 0) return;
    const latest = tradeResults[0];
    const activeAccounts = linkedAccounts.filter(a => a.status === 'active');
    if (activeAccounts.length === 0) return;

    addLog(`🔁 Replicating trade: ${latest.type} @ ${latest.stake.toFixed(2)}`);
    setTotalReplicated(prev => prev + activeAccounts.length);
    setLinkedAccounts(prev =>
      prev.map(a => a.status === 'active'
        ? { ...a, replicatedTrades: a.replicatedTrades + 1 }
        : a
      )
    );
  }, [tradeResults.length]);

  return (
    <div className='copy-trading'>
      <div className='copy-trading__hero'>
        <div className='copy-trading__hero-content'>
          <div className='copy-trading__live-badge'>● LIVE COPY TRADING</div>
          <h1>Your account, your control.<br /><span>Maximize Gains with <em>CopyTrading</em></span></h1>
          <p>Mirror trades from your master account to multiple client accounts in real time — automatically and instantly.</p>
          <div className='copy-trading__hero-stats'>
            <div className='copy-trading__stat'><strong>{linkedAccounts.filter(a => a.status === 'active').length}</strong><span>LINKED ACCOUNTS</span></div>
            <div className='copy-trading__stat copy-trading__stat--status'>
              <div className={`copy-trading__status-indicator ${isCopying ? 'active' : ''}`} />
              <strong>{isCopying ? 'Active' : 'Idle'}</strong>
              <span>COPY STATUS</span>
            </div>
            <div className='copy-trading__stat'><strong>{totalReplicated}</strong><span>TRADES REPLICATED</span></div>
          </div>
        </div>
        <div className='copy-trading__hero-icon'>🔄</div>
      </div>

      <div className='copy-trading__body'>
        <div className='copy-trading__left'>
          {copyMode === 'token' && (
            <div className='copy-trading__card'>
              <div className='copy-trading__card-icon'>🔑</div>
              <h3>Token Replicator</h3>
              <p>Add client API tokens. When you trade, all linked accounts receive the same trade instantly.</p>
              <div className='copy-trading__token-row'>
                <input
                  type='text'
                  placeholder='Paste client API token...'
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddToken()}
                />
                <button className='copy-trading__btn copy-trading__btn--add' onClick={handleAddToken}>Add</button>
                <button className='copy-trading__btn copy-trading__btn--sync' onClick={() => {}}>🔄 Sync</button>
              </div>
              <button
                className={`copy-trading__copy-btn ${isCopying ? 'copy-trading__copy-btn--stop' : ''}`}
                onClick={toggleCopy}
              >
                {isCopying ? '⏹ Stop Copy Trading' : '▶ Start Copy Trading'}
              </button>
            </div>
          )}

          <div className='copy-trading__card'>
            <div className='copy-trading__card-icon'>📊</div>
            <h3>Demo → Real</h3>
            <p>Mirror trades from your demo account to your real account automatically.</p>
            <button className='copy-trading__mirror-btn'>▶ Start Demo → Real</button>
          </div>

          <div className='copy-trading__card copy-trading__card--log'>
            <h3>Activity Log</h3>
            <div className='copy-trading__log'>
              {log.length === 0 && <p className='copy-trading__log-empty'>No activity yet.</p>}
              {log.map((entry, i) => <div key={i} className='copy-trading__log-entry'>{entry}</div>)}
            </div>
          </div>
        </div>

        <div className='copy-trading__right'>
          <div className='copy-trading__card'>
            <div className='copy-trading__card-icon'>👥</div>
            <h3>Replicated Accounts</h3>
            {linkedAccounts.length === 0 ? (
              <div className='copy-trading__no-accounts'>
                <div className='copy-trading__no-accounts-icon'>🔗</div>
                <p>No accounts linked yet.</p>
                <p>Add a client API token or create accounts in settings.</p>
              </div>
            ) : (
              <div className='copy-trading__accounts'>
                {linkedAccounts.map((acc, i) => (
                  <div key={i} className={`copy-trading__account copy-trading__account--${acc.status}`}>
                    <div className='copy-trading__account-info'>
                      <div className={`copy-trading__account-dot copy-trading__account-dot--${acc.status}`} />
                      <div>
                        <strong>{acc.loginid}</strong>
                        <span>{acc.currency} {acc.balance?.toFixed(2) ?? '---'}</span>
                      </div>
                    </div>
                    <div className='copy-trading__account-meta'>
                      <span className={`copy-trading__account-status copy-trading__account-status--${acc.status}`}>
                        {acc.status}
                      </span>
                      <span>{acc.replicatedTrades} trades</span>
                      <button className='copy-trading__remove' onClick={() => handleRemoveAccount(acc.token)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {balance !== null && (
            <div className='copy-trading__card'>
              <h3>Master Account</h3>
              <div className='copy-trading__master'>
                <div className='copy-trading__master-balance'>
                  <span>Balance</span>
                  <strong>{currency} {balance.toFixed(2)}</strong>
                </div>
                <div className='copy-trading__master-pl'>
                  <span>Session P/L</span>
                  <strong className={totalProfit >= 0 ? 'pos' : 'neg'}>
                    {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default CopyTrading;
