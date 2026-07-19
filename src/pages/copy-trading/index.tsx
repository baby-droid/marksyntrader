// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import { copyEngine, mirrorEngine, CopyMode, Follower, FollowerAccount } from '@/utils/copy-trading';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import './copy-trading.scss';

// ── Mode options ─────────────────────────────────────────────────────────────
const MODES: { id: CopyMode; title: string; desc: string; icon: string }[] = [
  { id: 'demo_demo', title: 'Demo → Demo', desc: 'Copy demo trades to follower demo account.', icon: '🎓' },
  { id: 'real_real', title: 'Real → Real', desc: 'Mirror real trades to follower real account.', icon: '💵' },
  { id: 'demo_real', title: 'Demo → Real', desc: 'Copy demo trades to follower real account.', icon: '🧪' },
  { id: 'real_demo', title: 'Real → Demo', desc: 'Mirror real trades to follower demo account.', icon: '📚' },
];

// ── Mirror state persistence (separate from mirror engine storage) ────────────
const MIRROR_LS_KEY = 'ct_master_mirror_v1';
const EXPIRE_MS     = 72 * 60 * 60 * 1000;

function saveMirrorUi(active: boolean, running: boolean) {
  try { localStorage.setItem(MIRROR_LS_KEY, JSON.stringify({ active, running, expires: Date.now() + EXPIRE_MS })); } catch {}
}
function loadMirrorUi() {
  try {
    const raw = localStorage.getItem(MIRROR_LS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.expires || Date.now() > s.expires) { localStorage.removeItem(MIRROR_LS_KEY); return null; }
    return s;
  } catch { return null; }
}

// ── Real account auto-detection ───────────────────────────────────────────────
function getRealAccountToken(): { loginid: string; token: string } | null {
  try {
    // ── 1. Bearer token ──────────────────────────────────────────────────
    let masterToken: string | null = null;
    try {
      const authInfo = JSON.parse(localStorage.getItem('auth_info') ?? 'null');
      if (authInfo?.access_token && (!authInfo.expires_at || Date.now() < authInfo.expires_at * 1000))
        masterToken = authInfo.access_token;
    } catch { /* ignore */ }
    if (!masterToken) masterToken = localStorage.getItem('authToken');

    // ── 2. Account lists (most reliable sources first) ───────────────────
    const tryParsed = (src: Storage, key: string): any[] | null => {
      try { return JSON.parse(src.getItem(key) ?? 'null'); } catch { return null; }
    };
    for (const list of [tryParsed(sessionStorage, 'deriv_accounts'), tryParsed(localStorage, 'deriv_accounts')]) {
      if (!Array.isArray(list)) continue;
      const real = list.find((a: any) => a.account_type === 'real' || (!a.account_type && !a.is_virtual));
      if (real && masterToken) return { loginid: real.account_id ?? real.loginid, token: masterToken };
    }

    // ── 3. OAuth fallback ────────────────────────────────────────────────
    const clientAccounts = tryParsed(localStorage, 'clientAccounts') as any;
    const accountsList   = tryParsed(localStorage, 'accountsList')   as any;
    if (clientAccounts && typeof clientAccounts === 'object') {
      for (const [loginid, accData] of Object.entries(clientAccounts)) {
        const acc = accData as any;
        const tok = (accountsList && accountsList[loginid]) || masterToken;
        if (!acc.is_virtual && tok) return { loginid, token: tok };
      }
    }
    return null;
  } catch { return null; }
}

// ── Main component ────────────────────────────────────────────────────────────
const CopyTrading = observer(() => {
  const { balance, totalProfit, subscribeBalance } = useDerivTrading() as any;
  const [displayCur, setDisplayCur] = useState(getDisplayCurrency());

  // ── Copy engine state ──────────────────────────────────────────────────
  const [followers, setFollowers]   = useState<Follower[]>([]);
  const [mode, setMode]             = useState<CopyMode>(copyEngine.getMode());
  const [isCopying, setIsCopying]   = useState(copyEngine.isRunning());
  const [tokenInput, setTokenInput] = useState('');
  const [ratioInput, setRatioInput] = useState(1);
  const [log, setLog]               = useState<string[]>([]);
  const prevActiveRef               = useRef(0);
  const restoredRef                 = useRef(false);

  // ── Mirror engine state ────────────────────────────────────────────────
  const [mirrorFollowers, setMirrorFollowers] = useState<Follower[]>([]);
  const [mirrorRunning, setMirrorRunning]     = useState(false);
  const [mirrorLoading, setMirrorLoading]     = useState(false);
  const [mirrorLog, setMirrorLog]             = useState<string[]>([]);

  const fmt      = (usd: number) => `${fromUsd(usd).toFixed(2)} ${displayCur}`;
  const fmtProfit = (usd: number) => `${usd >= 0 ? '+' : ''}${fromUsd(usd).toFixed(2)} ${displayCur}`;
  const ratioLabel = mode === 'real_real' ? 'Stake ratio' : 'Risk ×';

  useEffect(() => { return subscribeCurrency(() => setDisplayCur(getDisplayCurrency())); }, []);
  useEffect(() => { subscribeBalance?.(); }, []);

  // Restore both engines on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    copyEngine.restoreState().catch(() => {});
    mirrorEngine.restoreState().catch(() => {});
    // Restore mirror UI state
    const ms = loadMirrorUi();
    if (ms?.running) setMirrorRunning(true);
  }, []);

  // Copy engine listeners
  useEffect(() => {
    const offChange = copyEngine.onChange(fs => {
      setFollowers(fs);
      const activeCount = fs.filter(f => f.status === 'active').length;
      if (activeCount > prevActiveRef.current && !copyEngine.isRunning()) {
        setTimeout(() => { copyEngine.start(); setIsCopying(copyEngine.isRunning()); }, 400);
      }
      prevActiveRef.current = activeCount;
      setIsCopying(copyEngine.isRunning());
    });
    const offLog = copyEngine.onLog(msg =>
      setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100))
    );
    return () => { offChange(); offLog(); };
  }, []);

  // Mirror engine listeners
  useEffect(() => {
    const offChange = mirrorEngine.onChange(fs => {
      setMirrorFollowers(fs);
      setMirrorRunning(mirrorEngine.isRunning());
    });
    const offLog = mirrorEngine.onLog(msg =>
      setMirrorLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50))
    );
    return () => { offChange(); offLog(); };
  }, []);

  // Copy engine actions
  const selectMode = useCallback((m: CopyMode) => { setMode(m); copyEngine.setMode(m); }, []);
  const addToken   = useCallback(() => {
    const t = tokenInput.trim();
    if (!t) return;
    copyEngine.addFollower(t, ratioInput);
    setTokenInput('');
  }, [tokenInput, ratioInput]);
  const pasteToken = useCallback(async () => {
    try { const txt = await navigator.clipboard.readText(); if (txt.trim()) setTokenInput(txt.trim()); } catch {}
  }, []);
  const toggleCopy = useCallback(() => {
    if (isCopying) { copyEngine.stop(); setIsCopying(false); }
    else           { copyEngine.start(); setIsCopying(copyEngine.isRunning()); }
  }, [isCopying]);

  // Mirror engine actions (independent of copy engine)
  const startMirror = useCallback(async () => {
    const realAcct = getRealAccountToken();
    if (!realAcct) {
      alert('No real account detected. Log in with a real Deriv account to use the mirror.');
      return;
    }
    setMirrorLoading(true);
    mirrorEngine.setMode('demo_real');
    // Clear any existing mirror follower first
    const existing = mirrorFollowers[0];
    if (existing) mirrorEngine.removeFollower(existing.id);
    await mirrorEngine.addFollower(realAcct.token, 1);
    mirrorEngine.start();
    setMirrorRunning(mirrorEngine.isRunning());
    saveMirrorUi(true, true);
    setMirrorLoading(false);
  }, [mirrorFollowers]);

  const stopMirror = useCallback(() => {
    mirrorEngine.stop();
    const mf = mirrorFollowers[0];
    if (mf) mirrorEngine.removeFollower(mf.id);
    setMirrorRunning(false);
    saveMirrorUi(false, false);
  }, [mirrorFollowers]);

  const active          = followers.filter(f => f.status === 'active');
  const totalReplicated = followers.reduce((s, f) => s + f.replicated, 0);
  const mirrorAcct      = mirrorFollowers[0];
  const realAcct        = getRealAccountToken();

  return (
    <div className='copy-trading'>
      {/* Hero */}
      <div className='copy-trading__hero'>
        <div className='copy-trading__hero-content'>
          <div className='copy-trading__live-badge'>● LIVE COPY TRADING</div>
          <h1>Your account, your control.<br /><span>Mirror trades to <em>15 accounts</em></span></h1>
          <p>Add follower API tokens — copy trading starts automatically and stays active for 48 hrs across refreshes.</p>
          <div className='copy-trading__hero-stats'>
            <div className='copy-trading__stat'><strong>{active.length}/15</strong><span>LINKED</span></div>
            <div className='copy-trading__stat copy-trading__stat--status'>
              <div className={`copy-trading__status-indicator ${isCopying ? 'active' : ''}`} />
              <strong>{isCopying ? 'Active' : 'Idle'}</strong>
              <span>COPY STATUS</span>
            </div>
            <div className='copy-trading__stat'><strong>{totalReplicated}</strong><span>REPLICATED</span></div>
          </div>
        </div>
        <div className='copy-trading__hero-icon'>🔄</div>
      </div>

      <div className='copy-trading__body'>
        <div className='copy-trading__left'>

          {/* ─── Master Demo → Master Real Mirror (independent engine) ─── */}
          <div className='copy-trading__card copy-trading__card--mirror'>
            <div className='copy-trading__card-icon'>🔀</div>
            <h3>Master Demo → Master Real</h3>
            <p>Mirror your own demo trades to your real account automatically.</p>

            {!mirrorRunning ? (
              realAcct ? (
                <div className='copy-trading__mirror-auto-notice'>
                  ✅ Real account detected: <strong>{realAcct.loginid}</strong>
                </div>
              ) : (
                <div className='copy-trading__mirror-auto-notice copy-trading__mirror-auto-notice--warn'>
                  ⚠️ No real account found. Log in with a real Deriv account to use this feature.
                </div>
              )
            ) : (
              mirrorAcct && (
                <div className='copy-trading__mirror-auto-notice'>
                  🟢 Mirroring demo → <strong>{mirrorAcct.loginid}</strong>
                  {mirrorAcct.balance > 0 && <> · {mirrorAcct.currency} {mirrorAcct.balance.toFixed(2)}</>}
                </div>
              )
            )}

            <button
              className={`copy-trading__mirror-btn ${mirrorRunning ? 'copy-trading__mirror-btn--stop' : 'copy-trading__mirror-btn--start'}`}
              onClick={mirrorRunning ? stopMirror : startMirror}
              disabled={mirrorLoading || (!mirrorRunning && !realAcct)}
            >
              {mirrorLoading ? '⏳ Connecting…' : mirrorRunning ? '⏹ Stop Mirror' : '▶ Start Demo→Real Mirror'}
            </button>

            {mirrorLog.length > 0 && (
              <div className='copy-trading__mirror-log'>
                {mirrorLog.slice(0, 4).map((m, i) => <div key={i} className='copy-trading__mirror-log-entry'>{m}</div>)}
              </div>
            )}
          </div>

          {/* ─── Copy Mode selector ─── */}
          <div className='copy-trading__card'>
            <h3>Copy Mode</h3>
            <p className='copy-trading__mode-hint'>
              <strong>Risk ×</strong> scales the follower's stake. <strong>Commission %</strong> is tracked per trade as earned income.
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

          {/* ─── Add follower token ─── */}
          <div className='copy-trading__card'>
            <div className='copy-trading__card-icon'>🔑</div>
            <h3>Link Follower ({followers.length}/15)</h3>
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
                disabled={followers.length >= 15 || !tokenInput.trim()}
              >
                🔗 Link
              </button>
            </div>

            <button
              className={`copy-trading__copy-btn ${isCopying ? 'copy-trading__copy-btn--stop' : ''}`}
              onClick={toggleCopy}
              disabled={!isCopying && active.length === 0}
            >
              {isCopying ? '⏹ Stop Copy Trading' : active.length === 0 ? '⏳ Waiting for follower…' : '▶ Start Copy Trading'}
            </button>
            {isCopying && (
              <div className='copy-trading__running-notice'>
                ✅ Copy trading active — trades from your master account are being mirrored.
              </div>
            )}
          </div>

          {/* ─── Activity log ─── */}
          <div className='copy-trading__card copy-trading__card--log'>
            <h3>Activity Log</h3>
            <div className='copy-trading__log'>
              {log.length === 0
                ? <p className='copy-trading__log-empty'>No activity yet. Link a follower token to begin.</p>
                : log.map((e, i) => <div key={i} className='copy-trading__log-entry'>{e}</div>)
              }
            </div>
          </div>
        </div>

        {/* ─── Right column: follower accounts ─── */}
        <div className='copy-trading__right'>
          <div className='copy-trading__card'>
            <div className='copy-trading__card-icon'>👥</div>
            <h3>Follower Accounts ({active.length} active)</h3>

            {followers.length === 0 ? (
              <div className='copy-trading__no-accounts'>
                <div className='copy-trading__no-accounts-icon'>🔗</div>
                <p>No accounts linked yet.</p>
                <p>Paste a follower API token to begin.</p>
              </div>
            ) : (
              <div className='copy-trading__follower-list'>
                {followers.map(acc => (
                  <div
                    key={acc.id}
                    className={`copy-trading__follower-row copy-trading__follower-row--${acc.status}`}
                  >
                    {/* Status dot + identity */}
                    <span className={`copy-trading__follower-dot copy-trading__follower-dot--${acc.status}`} />
                    <div className='copy-trading__follower-id'>
                      <strong>{acc.loginid}</strong>
                      <em>{acc.is_virtual ? 'demo' : 'real'}</em>
                    </div>
                    <span className='copy-trading__follower-bal'>
                      {acc.currency !== '---' ? `${acc.currency} ${acc.balance.toFixed(2)}` : '---'}
                    </span>

                    {/* Account type switcher — TRADE ON: real ✓ / demo */}
                    <div className='copy-trading__acct-switcher'>
                      <span className='copy-trading__acct-switcher-label'>Trade on:</span>
                      {acc.account_list && acc.account_list.length > 1
                        ? acc.account_list.map((a: FollowerAccount) => {
                            const isCurrent = a.account_id === acc.loginid;
                            return (
                              <button
                                key={a.account_id}
                                title={isCurrent ? 'Currently active' : `Switch to ${a.account_type}`}
                                className={`copy-trading__acct-badge copy-trading__acct-badge--${a.account_type}${isCurrent ? ' active' : ''}`}
                                onClick={() => !isCurrent && copyEngine.switchAccount(acc.id, a.account_type)}
                                disabled={isCurrent || acc.status === 'pending'}
                              >
                                {a.account_type}
                                {isCurrent && <span className='copy-trading__acct-check'> ✓</span>}
                              </button>
                            );
                          })
                        : (
                          <span className={`copy-trading__acct-badge copy-trading__acct-badge--${acc.is_virtual ? 'demo' : 'real'} active`}>
                            {acc.is_virtual ? 'demo' : 'real'} <span className='copy-trading__acct-check'>✓</span>
                          </span>
                        )
                      }
                    </div>

                    {/* Controls: ratio only — commission is automatic */}
                    <label className='copy-trading__follower-ctrl' title={ratioLabel}>
                      <span>×</span>
                      <input
                        type='number' min={0.01} step={0.1} value={acc.ratio}
                        onChange={e => copyEngine.setRatio(acc.id, Number(e.target.value))}
                      />
                    </label>

                    {/* Stats */}
                    <span className='copy-trading__follower-trades' title='Trades replicated'>
                      {acc.replicated}T
                    </span>

                    {(acc.commissionEarned ?? 0) > 0 && (
                      <span className='copy-trading__commission-earned' title='Commission earned this session'>
                        💰{fmt(acc.commissionEarned ?? 0)}
                      </span>
                    )}

                    {/* Status text / error */}
                    <span
                      className={`copy-trading__follower-status copy-trading__follower-status--${acc.status}`}
                      title={acc.status === 'error' ? acc.lastError : acc.status}
                    >
                      {acc.status === 'pending' ? '⏳' : acc.status === 'error' ? '⚠' : acc.status === 'active' ? '' : acc.status}
                    </span>

                    {/* Retry button for errors */}
                    {acc.status === 'error' && (
                      <button
                        className='copy-trading__follower-retry'
                        onClick={() => copyEngine.retryFollower(acc.id)}
                        title='Retry connection'
                      >↺</button>
                    )}

                    <button
                      className='copy-trading__follower-remove'
                      onClick={() => copyEngine.removeFollower(acc.id)}
                      title='Remove follower'
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Master account card */}
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
