// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import { copyEngine, CopyMode, Follower, FollowerAccount } from '@/utils/copy-trading';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import './copy-trading.scss';

const MODES: { id: CopyMode; title: string; desc: string; icon: string }[] = [
  {
    id: 'real_real',
    title: 'Real → Real',
    desc: "Mirror your real-account trades to each follower's real account, stake scaled by their ratio.",
    icon: '💵',
  },
  {
    id: 'demo_real',
    title: 'Demo → Real',
    desc: "Test on demo — signals are copied to each follower's real account with a risk multiplier.",
    icon: '🧪',
  },
];

const CopyTrading = observer(() => {
  const { balance, currency, totalProfit, subscribeBalance } = useDerivTrading() as any;
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [mode, setMode] = useState<CopyMode>(copyEngine.getMode());
  const [isCopying, setIsCopying] = useState(copyEngine.isRunning());
  const [tokenInput, setTokenInput] = useState('');
  const [ratioInput, setRatioInput] = useState(1);
  const [log, setLog] = useState<string[]>([]);
  const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
  const prevActiveCount = useRef(0);

  useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

  useEffect(() => {
    subscribeBalance?.();
  }, []);

  useEffect(() => {
    const offChange = copyEngine.onChange(newFollowers => {
      setFollowers(newFollowers);

      // Auto-start copy trading when a new follower becomes active and
      // copy trading is not yet running
      const activeCount = newFollowers.filter(f => f.status === 'active').length;
      if (activeCount > prevActiveCount.current && !copyEngine.isRunning()) {
        // Slight delay to let the auth complete log message render first
        setTimeout(() => {
          copyEngine.start();
          setIsCopying(copyEngine.isRunning());
        }, 400);
      }
      prevActiveCount.current = activeCount;
    });
    const offLog = copyEngine.onLog(msg =>
      setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100))
    );
    return () => {
      offChange();
      offLog();
    };
  }, []);

  const selectMode = useCallback((m: CopyMode) => {
    setMode(m);
    copyEngine.setMode(m);
  }, []);

  const addToken = useCallback(() => {
    const token = tokenInput.trim();
    if (!token) return;
    copyEngine.addFollower(token, ratioInput);
    setTokenInput('');
  }, [tokenInput, ratioInput]);

  const pasteToken = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setTokenInput(text.trim());
    } catch {
      // Clipboard API not available or permission denied
    }
  }, []);

  const toggleCopy = useCallback(() => {
    if (isCopying) {
      copyEngine.stop();
      setIsCopying(false);
    } else {
      copyEngine.start();
      setIsCopying(copyEngine.isRunning());
    }
  }, [isCopying]);

  const fmt = (usd: number) => `${fromUsd(usd).toFixed(2)} ${displayCur}`;
  const fmtProfit = (usd: number) => `${usd >= 0 ? '+' : ''}${fromUsd(usd).toFixed(2)} ${displayCur}`;

  const active = followers.filter(f => f.status === 'active');
  const totalReplicated = followers.reduce((s, f) => s + f.replicated, 0);
  const ratioLabel = mode === 'real_real' ? 'Stake ratio' : 'Risk multiplier';

  return (
    <div className='copy-trading'>
      <div className='copy-trading__hero'>
        <div className='copy-trading__hero-content'>
          <div className='copy-trading__live-badge'>● LIVE COPY TRADING</div>
          <h1>Your account, your control.<br /><span>Mirror trades to <em>10 accounts</em></span></h1>
          <p>Add a follower API token — copy trading starts automatically once verified.</p>
          <div className='copy-trading__hero-stats'>
            <div className='copy-trading__stat'><strong>{active.length}/10</strong><span>LINKED ACCOUNTS</span></div>
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
          {/* Mode selector */}
          <div className='copy-trading__card'>
            <h3>Copy Mode</h3>
            <div className='copy-trading__modes'>
              {MODES.map(m => (
                <button
                  key={m.id}
                  className={`copy-trading__mode ${mode === m.id ? 'active' : ''}`}
                  onClick={() => selectMode(m.id)}
                >
                  <span className='copy-trading__mode-icon'>{m.icon}</span>
                  <strong>{m.title}</strong>
                  <span className='copy-trading__mode-desc'>{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Token adder */}
          <div className='copy-trading__card'>
            <div className='copy-trading__card-icon'>🔑</div>
            <h3>Link Follower ({followers.length}/10)</h3>
            <p>
              Add a follower API token (Read + Trade scope). Copy trading starts automatically
              after the token is verified. You can also start/stop it manually below.
            </p>
            <div className='copy-trading__token-row'>
              <div className='copy-trading__token-input-wrap'>
                <input
                  type='text'
                  placeholder='Paste follower API token (Read + Trade scopes)…'
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addToken()}
                />
                <button
                  className='copy-trading__paste-btn'
                  onClick={pasteToken}
                  title='Paste from clipboard'
                >
                  📋
                </button>
              </div>
              <div className='copy-trading__ratio'>
                <label>{ratioLabel}</label>
                <input
                  type='number'
                  min={0.01}
                  step={0.1}
                  value={ratioInput}
                  onChange={e => setRatioInput(Math.max(0.01, Number(e.target.value)))}
                />
              </div>
              <button
                className='copy-trading__btn copy-trading__btn--add'
                onClick={addToken}
                disabled={followers.length >= 10 || !tokenInput.trim()}
              >
                🔗 Add &amp; Join
              </button>
            </div>

            {/* Manual start / stop override */}
            <button
              className={`copy-trading__copy-btn ${isCopying ? 'copy-trading__copy-btn--stop' : ''}`}
              onClick={toggleCopy}
              disabled={!isCopying && active.length === 0}
              title={!isCopying && active.length === 0 ? 'Add and verify a follower token first' : undefined}
            >
              {isCopying ? '⏹ Stop Copy Trading' : active.length === 0 ? '⏳ Waiting for follower…' : '▶ Start Copy Trading'}
            </button>

            {isCopying && (
              <div className='copy-trading__running-notice'>
                ✅ Copy trading is active — trades from your master account will be mirrored automatically.
              </div>
            )}
          </div>

          <div className='copy-trading__card copy-trading__card--log'>
            <h3>Activity Log</h3>
            <div className='copy-trading__log'>
              {log.length === 0 && <p className='copy-trading__log-empty'>No activity yet. Add a follower token to begin.</p>}
              {log.map((entry, i) => <div key={i} className='copy-trading__log-entry'>{entry}</div>)}
            </div>
          </div>
        </div>

        <div className='copy-trading__right'>
          <div className='copy-trading__card'>
            <div className='copy-trading__card-icon'>👥</div>
            <h3>Follower Accounts ({active.length} active)</h3>
            {followers.length === 0 ? (
              <div className='copy-trading__no-accounts'>
                <div className='copy-trading__no-accounts-icon'>🔗</div>
                <p>No accounts linked yet.</p>
                <p>Add a follower API token above — it will auto-join after verification.</p>
              </div>
            ) : (
              <div className='copy-trading__accounts'>
                {followers.map(acc => (
                  <div key={acc.id} className={`copy-trading__account copy-trading__account--${acc.status}`}>
                    <div className='copy-trading__account-info'>
                      <div className={`copy-trading__account-dot copy-trading__account-dot--${acc.status}`} />
                      <div>
                        <strong>{acc.loginid || '…'}{acc.is_virtual ? ' (demo)' : ' (real)'}</strong>
                        <span>{acc.currency} {acc.balance?.toFixed(2) ?? '---'}</span>
                        {acc.status === 'pending' && <span className='copy-trading__verifying'>⏳ Connecting…</span>}
                      </div>
                    </div>
                    {/* Show all accounts linked to this token */}
                    {acc.account_list && acc.account_list.length > 1 && (
                      <div className='copy-trading__account-list'>
                        <span className='copy-trading__account-list-label'>All accounts on this token:</span>
                        <div className='copy-trading__account-badges'>
                          {acc.account_list.map((a: FollowerAccount) => (
                            <span
                              key={a.loginid}
                              className={`copy-trading__account-badge ${a.loginid === acc.loginid ? 'active' : ''} ${a.is_virtual ? 'virtual' : 'real'}`}
                              title={a.loginid === acc.loginid ? 'Currently trading on this account' : 'To trade on this account, provide its own API token'}
                            >
                              {a.is_virtual ? '🔵' : '🟢'} {a.loginid} · {a.currency}
                              {a.loginid === acc.loginid && <span className='copy-trading__badge-active-mark'> ✓</span>}
                            </span>
                          ))}
                        </div>
                        <span className='copy-trading__account-list-note'>
                          ✓ = Active trading account. To use a different account, add its own API token.
                        </span>
                      </div>
                    )}
                    <div className='copy-trading__account-meta'>
                      <div className='copy-trading__account-ratio'>
                        <label>{ratioLabel === 'Stake ratio' ? '×' : 'risk×'}</label>
                        <input
                          type='number'
                          min={0.01}
                          step={0.1}
                          value={acc.ratio}
                          onChange={e => copyEngine.setRatio(acc.id, Number(e.target.value))}
                        />
                      </div>
                      <span className={`copy-trading__account-status copy-trading__account-status--${acc.status}`}>
                        {acc.status === 'pending' ? '⏳ verifying…' : acc.status === 'error' ? (acc.lastError || 'error') : acc.status}
                      </span>
                      <span>{acc.replicated} trades</span>
                      <button className='copy-trading__remove' onClick={() => copyEngine.removeFollower(acc.id)}>✕</button>
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
                  <strong>{fmt(balance)}</strong>
                </div>
                <div className='copy-trading__master-pl'>
                  <span>Session P/L</span>
                  <strong className={totalProfit >= 0 ? 'pos' : 'neg'}>
                    {fmtProfit(totalProfit)}
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
