// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import { copyEngine, CopyMode, Follower, FollowerAccount } from '@/utils/copy-trading';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import './copy-trading.scss';

const MODES: { id: CopyMode; title: string; desc: string; icon: string }[] = [
  {
    id: 'demo_demo',
    title: 'Demo → Demo',
    desc: 'Master demo trades are copied to follower demo account. No real money.',
    icon: '🎓',
  },
  {
    id: 'real_real',
    title: 'Real → Real',
    desc: 'Master real trades are mirrored to follower real account. Stake scaled by ratio.',
    icon: '💵',
  },
  {
    id: 'demo_real',
    title: 'Demo → Real',
    desc: 'Master demo trades are copied to follower real account with risk multiplier.',
    icon: '🧪',
  },
  {
    id: 'real_demo',
    title: 'Real → Demo',
    desc: 'Master real trades are mirrored to follower demo account. Risk-free training.',
    icon: '📚',
  },
];

const MIRROR_KEY = 'ct_master_mirror_v1';
const EXPIRE_MS  = 48 * 60 * 60 * 1000;

function saveMirrorState(active: boolean, running: boolean) {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify({
      active, running, expires: Date.now() + EXPIRE_MS,
    }));
  } catch {}
}
function loadMirrorState() {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.expires || Date.now() > s.expires) { localStorage.removeItem(MIRROR_KEY); return null; }
    return s;
  } catch { return null; }
}

/**
 * Auto-detect the logged-in user's real (non-virtual) account token from localStorage.
 * Returns { loginid, token } for the first active real account found, or null.
 */
function getRealAccountToken(): { loginid: string; token: string } | null {
  try {
    const accountsList    = JSON.parse(localStorage.getItem('accountsList')    ?? '{}');
    const clientAccounts  = JSON.parse(localStorage.getItem('clientAccounts')  ?? '{}');
    // Prefer real (non-virtual) accounts first
    for (const [loginid, accData] of Object.entries(clientAccounts)) {
      const acc = accData as any;
      if (!acc.is_virtual && accountsList[loginid]) {
        return { loginid, token: accountsList[loginid] };
      }
    }
    return null;
  } catch {
    return null;
  }
}

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
  const restoredRef = useRef(false);

  // ── Master Demo → Real mirror state ──
  const [mirrorRunning, setMirrorRunning] = useState(false);
  const [mirrorFollowerId, setMirrorFollowerId] = useState<string | null>(null);
  const [mirrorLoading, setMirrorLoading] = useState(false);
  const [mirrorLoginId, setMirrorLoginId] = useState<string | null>(null);

  useEffect(() => { return subscribeCurrency(() => setDisplayCur(getDisplayCurrency())); }, []);
  useEffect(() => { subscribeBalance?.(); }, []);

  // Restore persisted state on mount (runs once)
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    copyEngine.restoreState().catch(() => {});

    // Restore mirror state — auto-detect real account, no stored token needed
    const ms = loadMirrorState();
    if (ms?.running) {
      // Will be re-started via startMirror when user re-enters the page
    }
  }, []);

  useEffect(() => {
    const offChange = copyEngine.onChange(newFollowers => {
      setFollowers(newFollowers);
      const activeCount = newFollowers.filter(f => f.status === 'active').length;
      if (activeCount > prevActiveCount.current && !copyEngine.isRunning()) {
        setTimeout(() => {
          copyEngine.start();
          setIsCopying(copyEngine.isRunning());
        }, 400);
      }
      prevActiveCount.current = activeCount;
      setIsCopying(copyEngine.isRunning());
    });
    const offLog = copyEngine.onLog(msg =>
      setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100))
    );
    return () => { offChange(); offLog(); };
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
    } catch {}
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

  // ── Mirror: Demo → Real ──
  const startMirror = useCallback(async () => {
    const realAcct = getRealAccountToken();
    if (!realAcct) {
      alert('No real account found. Please log in with a real (non-virtual) Deriv account first.');
      return;
    }
    setMirrorLoading(true);
    setMirrorLoginId(realAcct.loginid);
    // Switch to demo→real mode, add the master's real token as a follower
    copyEngine.setMode('demo_real');
    setMode('demo_real');
    await copyEngine.addFollower(realAcct.token, 1);
    // Find the newly added follower by token
    const allFollowers = await new Promise<Follower[]>(resolve => {
      const unsub = copyEngine.onChange(fs => { unsub(); resolve(fs); });
    });
    const mirrorF = allFollowers.find(f => f.token === realAcct.token);
    if (mirrorF) setMirrorFollowerId(mirrorF.id);
    setMirrorRunning(true);
    saveMirrorState(true, true);
    setMirrorLoading(false);
  }, []);

  const stopMirror = useCallback(() => {
    if (mirrorFollowerId) {
      copyEngine.removeFollower(mirrorFollowerId);
      setMirrorFollowerId(null);
    }
    setMirrorRunning(false);
    setMirrorLoginId(null);
    saveMirrorState(false, false);
  }, [mirrorFollowerId]);

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
          <p>Add a follower API token — copy trading starts automatically once verified and stays active for 48 hrs across page refreshes.</p>
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

          {/* Master Demo → Master Real Mirror */}
          <div className='copy-trading__card copy-trading__card--mirror'>
            <div className='copy-trading__card-icon'>🔀</div>
            <h3>Master Demo → Master Real</h3>
            <p>
              Mirror your own demo trades to your real account automatically.
              Uses your currently logged-in real account — no extra API token needed.
            </p>
            {!mirrorRunning && (() => {
              const realAcct = getRealAccountToken();
              return realAcct ? (
                <div className='copy-trading__mirror-auto-notice'>
                  ✅ Real account detected: <strong>{realAcct.loginid}</strong>
                </div>
              ) : (
                <div className='copy-trading__mirror-auto-notice copy-trading__mirror-auto-notice--warn'>
                  ⚠️ No real account found. Log in with a real Deriv account to use this feature.
                </div>
              );
            })()}
            {mirrorRunning && mirrorLoginId && (
              <div className='copy-trading__mirror-auto-notice'>
                🟢 Mirroring demo → real account <strong>{mirrorLoginId}</strong>
              </div>
            )}
            <button
              className={`copy-trading__mirror-btn ${mirrorRunning ? 'copy-trading__mirror-btn--stop' : 'copy-trading__mirror-btn--start'}`}
              onClick={mirrorRunning ? stopMirror : startMirror}
              disabled={mirrorLoading || (!mirrorRunning && !getRealAccountToken())}
            >
              {mirrorLoading ? '⏳ Connecting…' : mirrorRunning ? '⏹ Stop Demo→Real Mirror' : '▶ Start Demo→Real Mirror'}
            </button>
            {mirrorRunning && (
              <div className='copy-trading__running-notice'>
                🔀 Demo → Real mirror active — your demo trades are being reflected to your real account.
              </div>
            )}
          </div>

          {/* Mode selector */}
          <div className='copy-trading__card'>
            <h3>Copy Mode</h3>
            <p className='copy-trading__mode-hint'>
              <strong>Risk multiplier</strong> scales the follower's stake relative to the master's stake.
              E.g. multiplier 2 means the follower risks 2× the master's stake on each trade.
              Use 1 for 1:1 mirroring.
            </p>
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
              after the token is verified and stays active for 48 hrs across page refreshes.
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
                <button className='copy-trading__paste-btn' onClick={pasteToken} title='Paste from clipboard'>📋</button>
              </div>
              <div className='copy-trading__ratio'>
                <label>{ratioLabel}</label>
                <input
                  type='number' min={0.01} step={0.1} value={ratioInput}
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

                    {/* Account picker — let master choose demo or real */}
                    {acc.account_list && acc.account_list.length > 1 && (
                      <div className='copy-trading__account-picker'>
                        <span className='copy-trading__account-picker-label'>Trade on:</span>
                        <div className='copy-trading__account-picker-btns'>
                          {acc.account_list.map((a: FollowerAccount) => {
                            const wantType = mode === 'demo_demo' || mode === 'real_demo' ? 'demo' : 'real';
                            const isAutoSelected = a.account_type === wantType;
                            const isCurrent = a.account_id === acc.loginid;
                            return (
                              <span
                                key={a.account_id}
                                className={`copy-trading__account-badge ${isCurrent ? 'active' : ''} ${a.account_type === 'demo' ? 'virtual' : 'real'}`}
                                title={isCurrent ? 'Currently active' : isAutoSelected ? `Auto-selected by ${mode} mode` : 'To switch, add its own API token'}
                              >
                                {a.account_type === 'demo' ? '🔵' : '🟢'} {a.account_type}
                                {isCurrent && <span className='copy-trading__badge-active-mark'> ✓</span>}
                                {isAutoSelected && !isCurrent && <span style={{ fontSize: '0.9rem', color: '#f59e0b' }}> ★</span>}
                              </span>
                            );
                          })}
                        </div>
                        <span className='copy-trading__account-list-note'>
                          ★ = auto-selected by current mode · ✓ = active · Add token to switch account
                        </span>
                      </div>
                    )}

                    <div className='copy-trading__account-meta'>
                      <div className='copy-trading__account-ratio'>
                        <label>{ratioLabel === 'Stake ratio' ? '×' : 'risk×'}</label>
                        <input
                          type='number' min={0.01} step={0.1} value={acc.ratio}
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
