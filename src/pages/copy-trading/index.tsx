// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import { copyEngine, CopyMode, Follower } from '@/utils/copy-trading';
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
  const { balance, currency, totalProfit } = useDerivTrading();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [mode, setMode] = useState<CopyMode>(copyEngine.getMode());
  const [isCopying, setIsCopying] = useState(copyEngine.isRunning());
  const [tokenInput, setTokenInput] = useState('');
  const [ratioInput, setRatioInput] = useState(1);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const offChange = copyEngine.onChange(setFollowers);
    const offLog = copyEngine.onLog(msg =>
      setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 60))
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
    if (!tokenInput.trim()) return;
    copyEngine.addFollower(tokenInput, ratioInput);
    setTokenInput('');
  }, [tokenInput, ratioInput]);

  const toggleCopy = useCallback(() => {
    if (isCopying) {
      copyEngine.stop();
      setIsCopying(false);
    } else {
      copyEngine.start();
      setIsCopying(copyEngine.isRunning());
    }
  }, [isCopying]);

  const active = followers.filter(f => f.status === 'active');
  const totalReplicated = followers.reduce((s, f) => s + f.replicated, 0);
  const ratioLabel = mode === 'real_real' ? 'Stake ratio' : 'Risk multiplier';

  return (
    <div className='copy-trading'>
      <div className='copy-trading__hero'>
        <div className='copy-trading__hero-content'>
          <div className='copy-trading__live-badge'>● LIVE COPY TRADING</div>
          <h1>Your account, your control.<br /><span>Mirror trades to <em>10 accounts</em></span></h1>
          <p>Copy trades from your master account to up to 10 client accounts in real time — automatically and instantly.</p>
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
            <p>Add a client API token (Read + Trade scope). Each follower gets its own live connection.</p>
            <div className='copy-trading__token-row'>
              <input
                type='text'
                placeholder='Paste client API token…'
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addToken()}
              />
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
                disabled={followers.length >= 10}
              >
                Add
              </button>
            </div>
            <button
              className={`copy-trading__copy-btn ${isCopying ? 'copy-trading__copy-btn--stop' : ''}`}
              onClick={toggleCopy}
            >
              {isCopying ? '⏹ Stop Copy Trading' : '▶ Start Copy Trading'}
            </button>
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
            <h3>Follower Accounts ({active.length} active)</h3>
            {followers.length === 0 ? (
              <div className='copy-trading__no-accounts'>
                <div className='copy-trading__no-accounts-icon'>🔗</div>
                <p>No accounts linked yet.</p>
                <p>Add a client API token to start mirroring trades.</p>
              </div>
            ) : (
              <div className='copy-trading__accounts'>
                {followers.map(acc => (
                  <div key={acc.id} className={`copy-trading__account copy-trading__account--${acc.status}`}>
                    <div className='copy-trading__account-info'>
                      <div className={`copy-trading__account-dot copy-trading__account-dot--${acc.status}`} />
                      <div>
                        <strong>{acc.loginid}{acc.is_virtual ? ' (demo)' : ''}</strong>
                        <span>{acc.currency} {acc.balance?.toFixed(2) ?? '---'}</span>
                      </div>
                    </div>
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
                        {acc.status === 'error' ? (acc.lastError || 'error') : acc.status}
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
