/**
 * Copy-trading engine — Deriv new REST + OTP-WebSocket API.
 *
 * Auth flow per follower PAT:
 *  1. GET  /trading/v1/options/accounts          (Bearer PAT) → account list + IDs
 *  2. POST /trading/v1/options/accounts/{id}/otp (Bearer PAT) → one-time WS URL
 *  3. new WebSocket(otpUrl)                      → authenticated, send messages directly
 *
 * Trade replication uses the bulk-purchase REST endpoint when ≥2 followers share the
 * same account type; individual WS sends are used when ratios differ across followers.
 *
 * Two independent engine instances are exported:
 *   copyEngine  — follower copy trading (up to 15 followers, any mode)
 *   mirrorEngine — master demo→real mirror (1 follower: master's own real account)
 *
 * Mode → source / follower account-type mapping:
 *  real_real → listen to 'real' master trades → follower needs REAL account
 *  demo_real → listen to 'demo' master trades → follower needs REAL account
 *  demo_demo → listen to 'demo' master trades → follower needs DEMO account
 *  real_demo → listen to 'real' master trades → follower needs DEMO account
 */

import { MasterTradeSignal, subscribeMasterTrades, getMasterSource, publishMasterTrade } from './trade-bus';
// Auto-initialises the DBot→copy-trade bridge (bot.contract listener).
// Must be imported here so it activates as soon as copy-trading loads.
import './copy-trade-bridge';
import { api_base } from '@/external/bot-skeleton';

// ── Config ──────────────────────────────────────────────────────────────────
const REST_BASE          = 'https://api.derivws.com';
const APP_ID             = String(process.env.NEXT_PUBLIC_DERIV_APP_ID || '36300');
const PING_MS            = 28_000;
const CONNECT_TIMEOUT_MS = 20_000;
/** 48 hours 40 minutes — how long the reconnect loop keeps retrying per follower. */
const RECONNECT_WINDOW_MS = ((48 * 60) + 40) * 60 * 1000;

// ── Types ───────────────────────────────────────────────────────────────────
export type CopyMode       = 'real_real' | 'demo_real' | 'demo_demo' | 'real_demo';
export type FollowerStatus = 'pending' | 'active' | 'error' | 'removed';

export interface FollowerAccount {
    account_id:   string;
    currency:     string;
    account_type: 'real' | 'demo';
    balance:      number;
    status:       string;
}

export interface Follower {
    id:               string;
    token:            string;
    loginid:          string;
    currency:         string;
    balance:          number;
    is_virtual:       boolean;
    status:           FollowerStatus;
    ratio:            number;
    commission:       number;   // % of stake logged as commission per trade (0–50)
    commissionEarned: number;   // cumulative commission tracked this session
    replicated:       number;
    lastError?:       string;
    account_list?:    FollowerAccount[];
}

interface FollowerConn {
    ws:                   WebSocket | null;
    reqId:                number;
    pending:              Map<number, (d: any) => void>;
    pingTimer:            ReturnType<typeof setInterval> | null;
    reconnectCount:       number;
    /** Timestamp when the first reconnect attempt began for this outage — used to
     *  enforce the RECONNECT_WINDOW_MS cap instead of an attempt-count cap. */
    reconnectSessionStart: number;
    dead:                 boolean;
    token:                string;
    accountId:            string;
    /** Guards against concurrent connectFollower calls for the same follower.
     *  A second call awaits the in-progress one then returns, preventing two
     *  simultaneous OTP WebSockets which orphan trade-buy promise responses. */
    connecting:           Promise<void> | null;
}

interface CopyEngineOptions {
    storageKey:   string;
    maxFollowers: number;
    label:        string;
}

type ChangeListener = (followers: Follower[]) => void;
type LogListener    = (msg: string) => void;

// ── REST helpers ─────────────────────────────────────────────────────────────

function makeHeaders(token: string): Record<string, string> {
    return {
        'Deriv-App-ID':  APP_ID,
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
    };
}

function makeBulkHeaders(): Record<string, string> {
    return {
        'Deriv-App-ID': APP_ID,
        'Content-Type': 'application/json',
    };
}

function describeHttpError(status: number): string {
    if (status === 401) return 'Token invalid or expired — generate a fresh API token in Deriv → Account Settings → API Tokens.';
    if (status === 403) return 'Token missing required scopes — enable both Read AND Trade when creating the token in Deriv.';
    if (status === 429) return 'Rate limited by Deriv — wait a few seconds and try again.';
    return `Deriv API returned HTTP ${status}. Check your internet connection or try again.`;
}

async function restGet(path: string, token: string): Promise<any> {
    let res: Response;
    try {
        res = await fetch(`${REST_BASE}${path}`, { headers: makeHeaders(token) });
    } catch {
        throw new Error('Network error — unable to reach Deriv servers.');
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.errors?.[0]?.message || describeHttpError(res.status));
    }
    return res.json();
}

async function restPost(path: string, token: string, body?: object): Promise<any> {
    let res: Response;
    try {
        res = await fetch(`${REST_BASE}${path}`, {
            method:  'POST',
            headers: makeHeaders(token),
            body:    body ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw new Error('Network error — unable to reach Deriv servers.');
    }
    if (!res.ok) {
        const bd = await res.json().catch(() => ({}));
        throw new Error(bd?.errors?.[0]?.message || describeHttpError(res.status));
    }
    return res.json();
}

/**
 * Bulk-purchase REST call — places the same contract across multiple accounts in ONE call.
 * Uses per-account PAT tokens, NOT a Bearer token (per API docs).
 * Returns per-account results.
 */
async function bulkPurchase(
    accountType: 'real' | 'demo',
    contractParams: Record<string, any>,
    accounts: { account_id: string; token: string }[],
): Promise<{ account_id: string; ok: boolean; error?: string }[]> {
    let res: Response;
    try {
        res = await fetch(`${REST_BASE}/trading/v1/options/contracts/bulk-purchase/${accountType}`, {
            method:  'POST',
            headers: makeBulkHeaders(),
            body:    JSON.stringify({ contract_parameters: contractParams, accounts }),
        });
    } catch {
        return accounts.map(a => ({ account_id: a.account_id, ok: false, error: 'Network error' }));
    }
    if (!res.ok) {
        const bd = await res.json().catch(() => ({}));
        const msg = bd?.errors?.[0]?.message || describeHttpError(res.status);
        return accounts.map(a => ({ account_id: a.account_id, ok: false, error: msg }));
    }
    const data = await res.json().catch(() => ({ data: { transactions: [] } }));
    const txns = (data?.data?.transactions ?? []) as any[];
    return accounts.map((a, i) => {
        const t = txns[i];
        if (!t) return { account_id: a.account_id, ok: false, error: 'No result' };
        if (t.error) return { account_id: a.account_id, ok: false, error: t.error.message ?? 'error' };
        return { account_id: a.account_id, ok: true };
    });
}

// ── Mode helpers ─────────────────────────────────────────────────────────────

function followerNeedsAccountType(mode: CopyMode): 'real' | 'demo' {
    return mode === 'demo_demo' || mode === 'real_demo' ? 'demo' : 'real';
}

function masterSourceFor(mode: CopyMode): 'real' | 'demo' {
    return mode === 'real_real' || mode === 'real_demo' ? 'real' : 'demo';
}

// ── OTP WebSocket builder ────────────────────────────────────────────────────

async function openOtpWebSocket(
    token:     string,
    accountId: string,
    onMessage: (d: any) => void,
    onClose:   () => void,
    onError:   (e: Event) => void,
): Promise<WebSocket> {
    const otpData = await restPost(`/trading/v1/options/accounts/${accountId}/otp`, token);
    const wsUrl   = otpData?.data?.url as string | undefined;
    if (!wsUrl) throw new Error('Deriv did not return a WebSocket URL.');

    const ws = new WebSocket(wsUrl);
    ws.onmessage = (e: MessageEvent) => {
        try { onMessage(JSON.parse(e.data as string)); } catch { /* ignore */ }
    };
    ws.onclose = onClose;
    ws.onerror = onError;

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            ws.close();
            reject(new Error('WebSocket timed out. Check your internet and try again.'));
        }, CONNECT_TIMEOUT_MS);
        ws.onopen = () => { clearTimeout(timer); resolve(); };
    });

    return ws;
}

// ── CopyEngine ───────────────────────────────────────────────────────────────

const EXPIRE_MS = 72 * 60 * 60 * 1000; // 72 hours

class CopyEngine {
    private followers:       Follower[]             = [];
    private conns:           Map<string, FollowerConn> = new Map();
    private changeListeners: Set<ChangeListener>    = new Set();
    private logListeners:    Set<LogListener>       = new Set();
    private mode:            CopyMode               = 'real_real';
    private running:         boolean                = false;
    private restoring:       boolean                = false;
    private unsubBus:        (() => void) | null    = null;
    /** contract_ids already mirrored — prevents double-mirror between direct
     *  publish path (which has contract_id) and the transaction backup path. */
    private mirroredContracts: Set<number>          = new Set();
    /** Fingerprint → timestamp dedup for early/pre-signals (no contract_id yet).
     *  Fingerprint: "symbol|contract_type|duration|barrier".  TTL = 5 s. */
    private recentSignals:     Map<string, number>  = new Map();
    /** Tracks fingerprints published by no-contract-id pre-signals so the
     *  subsequent transaction-backup signal (which HAS a contract_id) can be
     *  blocked and won't cause a duplicate follower buy. */
    private preSignaledFps:    Map<string, number>  = new Map();
    /** Exact pre-signal identities for rapid repeated trades, such as a batch
     *  of identical contracts. */
    private preSignaledKeys:   Map<string, number>  = new Map();
    /** Kept alive for the engine lifetime — DerivAPIBasic sends a real WS
     *  subscribe message on every api.onMessage().subscribe() call, so we must
     *  create it only once and never unsubscribe it. */
    private txnApiSub:         { unsubscribe: () => void } | null = null;

    constructor(private readonly opts: CopyEngineOptions) {}

    // ── Pub/sub ──────────────────────────────────────────────────────────────

    onChange(cb: ChangeListener): () => void {
        this.changeListeners.add(cb);
        cb(this.snapshot());
        return () => this.changeListeners.delete(cb);
    }

    onLog(cb: LogListener): () => void {
        this.logListeners.add(cb);
        return () => this.logListeners.delete(cb);
    }

    private emit(): void { this.changeListeners.forEach(l => l(this.snapshot())); }
    private log(msg: string): void { this.logListeners.forEach(l => l(msg)); }
    private snapshot(): Follower[] { return this.followers.map(f => ({ ...f })); }

    getMode():            CopyMode { return this.mode; }
    setMode(m: CopyMode): void     { this.mode = m; this.saveState(); this.emit(); }
    isRunning():          boolean  { return this.running; }

    // ── Persistence ──────────────────────────────────────────────────────────

    saveState(): void {
        try {
            const payload = {
                mode: this.mode, running: this.running,
                expires: Date.now() + EXPIRE_MS,
                followers: this.followers
                    .filter(f => f.status === 'active' || f.status === 'pending')
                    .map(f => ({ token: f.token, ratio: f.ratio, commission: f.commission ?? 0 })),
            };
            localStorage.setItem(this.opts.storageKey, JSON.stringify(payload));
        } catch { /* storage unavailable */ }
    }

    async restoreState(): Promise<void> {
        // Guard: skip if already restoring or already has followers from a previous restore
        if (this.restoring || this.followers.length > 0) return;
        this.restoring = true;
        try {
            const raw = localStorage.getItem(this.opts.storageKey);
            if (!raw) return;
            const state = JSON.parse(raw);
            if (!state?.expires || Date.now() > state.expires) {
                localStorage.removeItem(this.opts.storageKey);
                return;
            }
            if (state.mode) this.mode = state.mode as CopyMode;
            if (Array.isArray(state.followers)) {
                for (const f of state.followers as { token: string; ratio: number; commission?: number }[]) {
                    if (f.token && !this.followers.some(x => x.token === f.token)) {
                        await this.addFollower(f.token, f.ratio ?? 1);
                        if (f.commission) {
                            const added = this.followers.find(x => x.token === f.token);
                            if (added) this.updateFollower(added.id, { commission: f.commission });
                        }
                    }
                }
            }
            // Auto-start: if the engine was running when the page was last closed,
            // restart it automatically — this runs even when NOT on the copy-trading page.
            //
            // addFollower() is async (token validation + OTP WebSocket handshake), so
            // followers are still 'pending' a few seconds after restoreState returns.
            // We poll every 1 s for up to 30 s instead of a single fixed 2.5 s delay,
            // so the engine starts as soon as the first follower becomes 'active'
            // regardless of network speed.
            if (state.running) {
                const autoStartAt = Date.now();
                const tryStart = (): void => {
                    if (this.running) return; // already started
                    if (this.followers.some(x => x.status === 'active')) {
                        this.start();
                    } else if (Date.now() - autoStartAt < 30_000) {
                        setTimeout(tryStart, 1_000);
                    }
                };
                setTimeout(tryStart, 1_000);
            }
        } catch { /* corrupted — ignore */ }
        finally { this.restoring = false; }
    }

    clearState(): void {
        try { localStorage.removeItem(this.opts.storageKey); } catch { /* noop */ }
    }

    // ── WS send (req_id matching) ────────────────────────────────────────────

    private wsSend(conn: FollowerConn, msg: object, timeoutMs = 15_000): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = conn.reqId++;
            const timer = setTimeout(() => {
                if (conn.pending.has(id)) {
                    conn.pending.delete(id);
                    reject(new Error('Request timed out'));
                }
            }, timeoutMs);

            conn.pending.set(id, d => {
                clearTimeout(timer);
                if (d.error) reject(d.error);
                else resolve(d);
            });

            if (conn.ws?.readyState === WebSocket.OPEN) {
                conn.ws.send(JSON.stringify({ ...msg, req_id: id }));
            } else {
                clearTimeout(timer);
                conn.pending.delete(id);
                reject(new Error('WebSocket not open'));
            }
        });
    }

    /** Reject all pending wsSend promises — called on WS close so they don't hang. */
    private drainPending(conn: FollowerConn): void {
        for (const cb of conn.pending.values()) {
            try { cb({ error: { message: 'Connection closed' } }); } catch { /* noop */ }
        }
        conn.pending.clear();
    }

    // ── Connect / reconnect a follower ───────────────────────────────────────

    private async connectFollower(id: string): Promise<void> {
        const conn = this.conns.get(id);
        if (!conn || conn.dead) return;

        // ── Concurrent-call guard ────────────────────────────────────────────
        // If a connectFollower call is already in progress for this follower,
        // wait for it to finish then return — do NOT open a second WebSocket.
        // Without this guard, overlapping calls from restoreState + page onChange
        // create two simultaneous OTP WebSockets.  The second overwrites conn.ws,
        // which orphans all wsSend pending-promise callbacks on the first socket:
        // trade-buy replies are silently dropped and mirroring appears broken.
        if (conn.connecting) {
            await conn.connecting;
            return;
        }

        let resolveConnecting!: () => void;
        conn.connecting = new Promise(r => { resolveConnecting = r; });

        try {
            // Silently close any stale WebSocket before opening a new one.
            // Null out onclose first so closing it doesn't trigger scheduleReconnect.
            if (conn.ws) {
                const stale = conn.ws;
                stale.onclose = null;
                try { stale.close(); } catch { /* noop */ }
                conn.ws = null;
            }
            if (conn.pingTimer) { clearInterval(conn.pingTimer); conn.pingTimer = null; }

            const { token, accountId } = conn;

            const onMessage = (d: any): void => {
                if (!d || conn.dead) return;
                if (d.req_id != null && conn.pending.has(d.req_id)) {
                    const cb = conn.pending.get(d.req_id)!;
                    conn.pending.delete(d.req_id);
                    cb(d);
                }
                if (d.balance?.balance != null) {
                    this.updateFollower(id, { balance: parseFloat(String(d.balance.balance)) });
                }
            };
            const onClose = (): void => {
                if (conn.dead) return;
                this.drainPending(conn);   // reject any in-flight wsSend promises immediately
                this.updateFollower(id, { status: 'error', lastError: 'Connection lost — reconnecting…' });
                this.scheduleReconnect(id);
            };
            const onError = (_e: Event): void => { /* onClose fires after */ };

            const ws = await openOtpWebSocket(token, accountId, onMessage, onClose, onError);
            conn.ws = ws;

            conn.pingTimer = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ping: 1 }));
            }, PING_MS);

            this.wsSend(conn, { balance: 1, subscribe: 1 }).catch(() => {});
        } finally {
            conn.connecting = null;
            resolveConnecting();
        }
    }

    private scheduleReconnect(id: string): void {
        const conn = this.conns.get(id);
        if (!conn || conn.dead) return;

        // Record when reconnect attempts first began for this outage
        if (!conn.reconnectSessionStart) conn.reconnectSessionStart = Date.now();

        // Give up only after the reconnect window has expired (48 hrs 40 mins)
        const elapsed = Date.now() - conn.reconnectSessionStart;
        if (elapsed > RECONNECT_WINDOW_MS) {
            this.updateFollower(id, {
                status: 'error',
                lastError: 'Copy session expired — remove and re-add the token to resume.',
            });
            const loginid = this.followers.find(f => f.id === id)?.loginid ?? id;
            this.log(`⚠️ ${loginid}: reconnect window expired (${Math.round(elapsed / 3600000)}h).`);
            return;
        }

        // Exponential backoff capped at 30s; after many failures the count is clamped
        // to avoid arithmetic overflow, but we never stop retrying within the window.
        const clampedCount = Math.min(conn.reconnectCount, 4); // 2^4 = 16 → 32s → capped 30s
        const delay = Math.min(2000 * 2 ** clampedCount, 30_000);
        conn.reconnectCount++;
        const loginid = this.followers.find(f => f.id === id)?.loginid ?? id;
        this.log(`🔄 ${loginid}: reconnecting in ${Math.round(delay / 1000)} s… (session age ${Math.round(elapsed / 60000)}m)`);
        setTimeout(async () => {
            if (!conn || conn.dead) return;
            try {
                await this.connectFollower(id);
                // Success — reset attempt counters but keep session start so the
                // window is relative to the FIRST outage in this session, not re-zeroed.
                conn.reconnectCount = 0;
                this.updateFollower(id, { status: 'active', lastError: undefined });
                this.log(`✅ ${loginid}: reconnected.`);
            } catch { this.scheduleReconnect(id); }
        }, delay);
    }

    // ── Add follower ─────────────────────────────────────────────────────────

    async addFollower(token: string, ratio = 1): Promise<void> {
        const trimmed = token.trim();
        if (!trimmed) {
            this.log('⚠️ Token is empty. Paste your API token (Read + Trade scopes).');
            return;
        }
        if (this.followers.some(f => f.token === trimmed)) {
            this.log('ℹ️ This token is already linked.');
            return;
        }
        if (this.followers.length >= this.opts.maxFollowers) {
            this.log(`⚠️ Maximum ${this.opts.maxFollowers} accounts already reached.`);
            return;
        }

        const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        this.followers.push({
            id, token: trimmed, loginid: 'Verifying…', currency: '---',
            balance: 0, is_virtual: false, status: 'pending',
            ratio, commission: 0, commissionEarned: 0, replicated: 0,
        });
        this.emit();

        const conn: FollowerConn = {
            ws: null, reqId: 1, pending: new Map(),
            pingTimer: null, reconnectCount: 0, reconnectSessionStart: 0, dead: false,
            token: trimmed, accountId: '', connecting: null,
        };
        this.conns.set(id, conn);

        try {
            this.log(`🔑 [${this.opts.label}] Validating token…`);
            const accountsData = await restGet('/trading/v1/options/accounts', trimmed);
            const rawAccounts  = (accountsData?.data ?? []) as any[];
            if (!rawAccounts.length) throw new Error('No trading accounts found. Ensure token has Read + Trade scopes.');

            const allAccounts: FollowerAccount[] = rawAccounts.map(a => ({
                account_id:   String(a.account_id),
                currency:     String(a.currency || 'USD'),
                account_type: (a.account_type === 'demo' ? 'demo' : 'real') as 'real' | 'demo',
                balance:      Number(a.balance ?? 0),
                status:       String(a.status || 'active'),
            }));

            const wantType = followerNeedsAccountType(this.mode);
            const target   =
                allAccounts.find(a => a.account_type === wantType && a.status === 'active')
                ?? allAccounts.find(a => a.status === 'active')
                ?? allAccounts[0];

            conn.accountId = target.account_id;
            this.updateFollower(id, {
                loginid:      target.account_id,
                currency:     target.currency,
                balance:      target.balance,
                is_virtual:   target.account_type === 'demo',
                account_list: allAccounts,
            });

            this.log(`🔗 Opening WebSocket for ${target.account_id}…`);
            await this.connectFollower(id);
            this.updateFollower(id, { status: 'active', lastError: undefined });
            this.saveState();

            const extra = allAccounts.length > 1 ? ` (${allAccounts.length} accounts on token)` : '';
            this.log(`✅ Linked ${target.account_id} · ${target.currency} · ${target.account_type}${extra}`);

        } catch (err: any) {
            const msg = err?.message ?? String(err);
            this.updateFollower(id, { status: 'error', lastError: msg });
            this.log(`❌ Link failed: ${msg}`);
        }
    }

    // ── Switch account type for a follower (demo ↔ real) ─────────────────────

    async switchAccount(id: string, accountType: 'real' | 'demo'): Promise<void> {
        const follower = this.followers.find(f => f.id === id);
        const conn     = this.conns.get(id);
        if (!follower || !conn || conn.dead) return;

        const target = follower.account_list?.find(a => a.account_type === accountType && a.status === 'active')
            ?? follower.account_list?.find(a => a.account_type === accountType);
        if (!target) {
            this.log(`⚠️ No ${accountType} account found for this token.`);
            return;
        }
        if (target.account_id === follower.loginid) {
            this.log(`ℹ️ ${follower.loginid} is already on ${accountType}.`);
            return;
        }

        // Close current WS
        if (conn.pingTimer) { clearInterval(conn.pingTimer); conn.pingTimer = null; }
        try { conn.ws?.close(); } catch { /* noop */ }
        conn.ws = null;
        conn.pending.clear();
        conn.reconnectCount = 0;
        conn.accountId = target.account_id;

        this.updateFollower(id, {
            loginid:    target.account_id,
            currency:   target.currency,
            balance:    target.balance,
            is_virtual: accountType === 'demo',
            status:     'pending',
            lastError:  undefined,
        });
        this.log(`🔄 Switching → ${target.account_id} (${accountType})…`);

        try {
            await this.connectFollower(id);
            this.updateFollower(id, { status: 'active', lastError: undefined });
            this.log(`✅ ${target.account_id}: connected (${accountType}).`);
            this.saveState();
        } catch (err: any) {
            this.updateFollower(id, { status: 'error', lastError: err?.message ?? 'Switch failed' });
            this.log(`❌ Switch failed: ${err?.message ?? 'unknown'}`);
        }
    }

    // ── Retry ────────────────────────────────────────────────────────────────

    async retryFollower(id: string): Promise<void> {
        const follower = this.followers.find(f => f.id === id);
        const conn     = this.conns.get(id);
        if (!follower || !conn || conn.dead) return;
        this.updateFollower(id, { status: 'pending', lastError: undefined });
        conn.reconnectCount = 0;
        this.log(`🔁 Retrying ${follower.loginid}…`);
        try {
            if (!conn.accountId) {
                const data = await restGet('/trading/v1/options/accounts', conn.token);
                const raws = (data?.data ?? []) as any[];
                const t    = raws.find(a => a.account_type === followerNeedsAccountType(this.mode)) ?? raws[0];
                if (!t) throw new Error('No valid account found for retry.');
                conn.accountId = String(t.account_id);
            }
            await this.connectFollower(id);
            this.updateFollower(id, { status: 'active', lastError: undefined });
            this.log(`✅ ${follower.loginid}: reconnected.`);
        } catch (err: any) {
            this.updateFollower(id, { status: 'error', lastError: err?.message ?? String(err) });
            this.log(`❌ Retry failed: ${err?.message ?? String(err)}`);
        }
    }

    // ── Update / remove ──────────────────────────────────────────────────────

    private updateFollower(id: string, patch: Partial<Follower>): void {
        const f = this.followers.find(x => x.id === id);
        if (!f) return;
        Object.assign(f, patch);
        this.emit();
    }

    setRatio(id: string, ratio: number): void {
        this.updateFollower(id, { ratio: Math.max(0.01, ratio) });
        this.saveState();
    }

    setCommission(id: string, pct: number): void {
        this.updateFollower(id, { commission: Math.max(0, Math.min(50, +pct.toFixed(2))) });
        this.saveState();
    }

    removeFollower(id: string): void {
        const conn = this.conns.get(id);
        if (conn) {
            conn.dead = true;
            if (conn.pingTimer) clearInterval(conn.pingTimer);
            try { conn.ws?.close(); } catch { /* noop */ }
            conn.pending.clear();
            this.conns.delete(id);
        }
        this.followers = this.followers.filter(f => f.id !== id);
        this.saveState();
        this.emit();
    }

    // ── Start / stop ─────────────────────────────────────────────────────────

    start(): void {
        if (this.running) return;
        if (!this.followers.some(f => f.status === 'active')) {
            this.log(`⚠️ [${this.opts.label}] No active accounts — add and verify a follower token first.`);
            return;
        }
        this.running  = true;
        this.mirroredContracts.clear();
        this.recentSignals.clear();
        this.preSignaledFps.clear();
        this.unsubBus = subscribeMasterTrades(sig => this.onMasterTrade(sig));
        // Fallback: subscribe to master account transactions so trades from ALL
        // UI paths (bot, manual, scalper, AI assistant) are always captured.
        // IMPORTANT: only subscribe once per engine lifetime — DerivAPIBasic's
        // api.onMessage().subscribe() sends a real {transaction:1,subscribe:1}
        // WS message each call.  Calling it on every start() causes duplicate
        // listeners AND repeated AlreadySubscribed errors that corrupt routing.
        if (!this.txnApiSub) this.subscribeMasterTransactions();
        this.log(`▶ ${this.opts.label} started (${this.modeLabel()}).`);
        this.saveState();
        this.emit();
    }

    stop(): void {
        if (!this.running) return;
        this.running = false;
        this.unsubBus?.();
        this.unsubBus = null;
        // Do NOT unsubscribe txnApiSub — DerivAPIBasic sends a new WS subscribe
        // message on every api.onMessage().subscribe() call, so we keep the one
        // listener alive permanently and gate on this.running inside the callback.
        this.mirroredContracts.clear();
        this.log(`⏸ ${this.opts.label} stopped.`);
        this.saveState();
        this.emit();
    }

    private modeLabel(): string {
        const labels: Record<CopyMode, string> = {
            real_real: 'Real → Real', demo_real: 'Demo → Real',
            demo_demo: 'Demo → Demo', real_demo: 'Real → Demo',
        };
        return labels[this.mode];
    }

    // ── Master account transaction subscription (fallback) ───────────────────

    /** Subscribe to master account's transaction stream so trades placed via
     *  any UI path (bot, manual, scalper) are always captured, even if the
     *  direct publishMasterTrade call is missed. Deduplicates via contract_id.
     *
     *  IMPORTANT: api.onMessage().subscribe(callback) passes the raw parsed WS
     *  message directly as the argument — NOT wrapped in { data }.
     *  The transaction field name is `action` (not `action_type`) per Deriv docs.
     *
     *  BUG FIX: do NOT add contract_id to mirroredContracts here before calling
     *  publishMasterTrade — that caused onMasterTrade to immediately see it as
     *  "already mirrored" and skip it, making the backup path self-defeating.
     *  Let onMasterTrade own all deduplication logic.
     */
    private subscribeMasterTransactions(): void {
        try {
            const api = (api_base as any)?.api;
            if (!api?.onMessage || !api?.send) return;

            // api_base.ts already subscribes to the transaction stream on startup.
            // Do NOT send another subscribe request — Deriv returns AlreadySubscribed.
            // The events are already flowing; just attach an onMessage listener below.

            // Local set prevents re-processing the SAME transaction event twice
            // (the stream can occasionally re-emit).  Dedup against already-mirrored
            // contracts is handled inside onMasterTrade, not here.
            const txnSeen = new Set<number>();

            const sub = api.onMessage().subscribe((msg: any) => {
                if (!this.running) return;
                // msg IS the raw WS data object (not wrapped in {data})
                if (!msg?.transaction) return;
                const txn = msg.transaction;
                // Deriv docs: field is "action", values: "buy"|"sell"|"deposit"|"withdrawal"
                if (txn.action !== 'buy') return;
                const contract_id = Number(txn.contract_id);
                if (!contract_id) return;

                // Skip if this transaction event has already been processed locally
                if (txnSeen.has(contract_id)) return;
                txnSeen.add(contract_id);
                if (txnSeen.size > 200) {
                    const first = txnSeen.values().next().value as number;
                    txnSeen.delete(first);
                }

                // Fetch full contract details (transaction only has symbol + amount).
                // NOTE: do NOT add to mirroredContracts here — let onMasterTrade
                // decide whether to skip (it checks mirroredContracts + fingerprints).
                api.send({ proposal_open_contract: 1, contract_id })
                    .then((res: any) => {
                        if (!this.running) return;
                        const poc = res?.proposal_open_contract;
                        if (!poc) return;
                        const symbol        = poc.underlying_symbol ?? poc.symbol ?? txn.underlying_symbol;
                        const contract_type = poc.contract_type;
                        // buy_price = actual stake debited
                        const stake         = Number(poc.buy_price ?? txn.amount ?? 0);
                        // Accumulators do not use duration; other contracts do.
                        const isAccumulator = poc.contract_type === 'ACCU';
                        const duration      = isAccumulator ? undefined : Number(poc.tick_count ?? poc.duration ?? 1);
                        const duration_unit = isAccumulator ? undefined : (poc.duration_unit as string | undefined) ?? 't';
                        const barrier       = poc.barrier ?? undefined;
                        const growth_rate   = poc.growth_rate != null ? Number(poc.growth_rate) : undefined;
                        if (!symbol || !contract_type || stake <= 0) return;
                        publishMasterTrade({
                            symbol, contract_type, stake, duration, duration_unit, barrier, growth_rate,
                            source: getMasterSource(),
                            time:   Date.now(),
                            contract_id,   // onMasterTrade will deduplicate via mirroredContracts
                        });
                    })
                    .catch(() => {});
            });

            this.txnApiSub = sub;
            this.log(`📡 ${this.opts.label}: subscribed to master transaction stream.`);
        } catch { /* api not ready yet — skip, direct hook path still works */ }
    }

    // ── Trade replication ────────────────────────────────────────────────────

    private onMasterTrade(sig: MasterTradeSignal): void {
        if (!this.running) return;
        if (sig.source !== masterSourceFor(this.mode)) return;

        // ── Deduplication layer 1: contract_id ────────────────────────────
        // Prevents double-mirror when both the early/parallel publish path
        // (no contract_id) AND the transaction-backup path (has contract_id)
        // fire for the same trade.
        if (sig.contract_id) {
            if (this.mirroredContracts.has(sig.contract_id)) return;

            // A direct post-buy confirmation for a pre-signal carries the
            // exact trade key. Register the contract ID but do not buy again.
            if (sig.trade_key) {
                const preTs = this.preSignaledKeys.get(sig.trade_key);
                if (preTs && Date.now() - preTs < 5000) {
                    this.preSignaledKeys.delete(sig.trade_key);
                    this.mirroredContracts.add(sig.contract_id);
                    return;
                }
            }

            // ── Cross-check: was this trade already handled by a pre-signal? ──
            // When the manual-trader fires publishMasterTrade WITHOUT a contract_id
            // (before the buy is confirmed), the trade executes immediately.
            // The transaction-backup path then fires again WITH the contract_id.
            // mirroredContracts can't block it (the pre-signal never added a cid),
            // but preSignaledFps tracks the fingerprint of every pre-signal that ran.
            // If we find a matching fingerprint within 5 s, the pre-signal already
            // handled this trade — block the backup and register the cid so any
            // further signals for the same contract are also blocked.
            const fp = `${sig.symbol}|${sig.contract_type}|${sig.duration}|${sig.barrier ?? ''}`;
            const preTs = this.preSignaledFps.get(fp);
            if (preTs && Date.now() - preTs < 5000) {
                this.mirroredContracts.add(sig.contract_id); // prevent future dupes
                return;
            }

            // Not a backup — this is a fresh signal (e.g. from the bot bridge).
            // Register the contract_id so any later signal for the same contract
            // (e.g. the transaction-backup for this bot trade) is blocked.
            this.mirroredContracts.add(sig.contract_id);
            if (this.mirroredContracts.size > 200) {
                const first = this.mirroredContracts.values().next().value as number;
                this.mirroredContracts.delete(first);
            }
        }

        // ── Deduplication layer 2: fingerprint for pre-signals (no contract_id)
        //
        // Applies ONLY to signals published without a contract_id — these come from
        // the manual-trader hooks (useDerivTrade / useDerivTrading) which publish
        // before the buy is confirmed so the follower enters on the SAME tick.
        //
        // Bot/scalper signals from copy-trade-bridge.ts always have a contract_id
        // and are deduplicated above via mirroredContracts.  Applying fingerprint to
        // them would block every second loop trade that shares symbol/type/duration
        // within 5 s — the previous regression this was introduced to fix.
        if (!sig.contract_id) {
            const fp     = `${sig.symbol}|${sig.contract_type}|${sig.duration}|${sig.barrier ?? ''}`;
            const fpNow  = Date.now();
            if (sig.trade_key) {
                const keyLast = this.preSignaledKeys.get(sig.trade_key);
                if (keyLast && fpNow - keyLast < 5000) return;
                this.preSignaledKeys.set(sig.trade_key, fpNow);
                if (this.preSignaledKeys.size > 200) {
                    const oldestKey = this.preSignaledKeys.keys().next().value as string | undefined;
                    if (oldestKey) this.preSignaledKeys.delete(oldestKey);
                }
            } else {
                const fpLast = this.recentSignals.get(fp);
                if (fpLast && fpNow - fpLast < 5000) return;   // same legacy signal within 5 s → skip
                this.recentSignals.set(fp, fpNow);
            }
            // Record in preSignaledFps so the transaction-backup (with contract_id)
            // for this same trade is blocked by the cross-check in layer 1 above.
            this.preSignaledFps.set(fp, fpNow);
            if (this.recentSignals.size > 100) {
                const oldestKey = this.recentSignals.keys().next().value as string | undefined;
                if (oldestKey) { this.recentSignals.delete(oldestKey); this.preSignaledFps.delete(oldestKey); }
            }
        }

        const activeFollowers = this.followers.filter(f => f.status === 'active');
        if (!activeFollowers.length) return;

        // ── Group by account type for bulk-purchase efficiency ────────────
        // Followers with ratio=1 can use bulk-purchase; others need individual WS sends.
        const wantType = followerNeedsAccountType(this.mode);

        // Separate: bulk-eligible (same account type, ratio=1, commission tracked separately)
        // vs individual (custom ratio or mixed type)
        const bulkGroup:     { f: Follower; conn: FollowerConn }[] = [];
        const individualGroup: { f: Follower; conn: FollowerConn }[] = [];

        for (const f of activeFollowers) {
            const conn = this.conns.get(f.id);
            if (!conn || conn.dead) continue;
            // Use bulk-purchase when ratio=1 and WS isn't open (or as fallback)
            // Always prefer WS (already connected) — it supports per-follower ratio
            if (conn.ws?.readyState === WebSocket.OPEN) {
                individualGroup.push({ f, conn });
            } else {
                bulkGroup.push({ f, conn });
            }
        }

        // ── Individual WS sends — direct buy (1 RTT) ─────────────────────
        // Primary path: `buy:"1"` with inline `parameters` is a SINGLE round
        // trip on the raw OTP WebSocket (confirmed by Deriv API docs).  This
        // halves latency vs the old proposal→buy two-step, so the follower
        // enters on the SAME market tick as the master.
        //
        // NOTE: The old code used proposal→buy because DerivAPIBasic rejects
        // `buy:"1"` with parameters for digit types. That restriction does NOT
        // apply here — follower connections use raw WebSocket (`wsSend`), not
        // the DerivAPIBasic library.  The server itself accepts direct buy for
        // all contract types including DIGITMATCH, DIGITOVER, etc.
        //
        // Fallback: if the server rejects the direct buy for any reason, we
        // automatically retry via the proven proposal→buy two-step.
        for (const { f, conn } of individualGroup) {
            const stake         = Math.max(0.35, +(sig.stake * f.ratio).toFixed(2));
            const commissionAmt = +(stake * (f.commission ?? 0) / 100).toFixed(2);
            const currency      = f.currency === '---' ? 'USD' : f.currency;

            // Build the contract parameters object (shared by both paths)
            const contractParams: Record<string, any> = {
                amount:            stake,
                basis:             'stake',
                contract_type:     sig.contract_type,   // e.g. DIGITMATCH, CALL, PUT …
                currency,
                underlying_symbol: sig.symbol,          // e.g. R_100
            };
            if (sig.duration != null) contractParams.duration = sig.duration;
            if (sig.duration_unit) contractParams.duration_unit = sig.duration_unit;
            if (sig.growth_rate != null) contractParams.growth_rate = sig.growth_rate;
            if (sig.limit_order) contractParams.limit_order = sig.limit_order;
            // barrier = digit prediction (e.g. "8" for DIGITMATCH) or barrier level — must be string
            if (sig.barrier != null && sig.barrier !== '') {
                contractParams.barrier = String(sig.barrier);
            }

            // ── FAST PATH: direct buy — 1 RTT ─────────────────────────────
            // price = max we're willing to pay; set to 2× stake so small
            // spread movements never block the purchase. The actual charge
            // for binary options is always exactly the stake.
            this.wsSend(conn, { buy: '1', price: +(stake * 2).toFixed(2), parameters: contractParams })
                .then((buyRes: any) => {
                    const cur = this.followers.find(x => x.id === f.id);
                    if (cur) this.updateFollower(f.id, {
                        replicated:       cur.replicated + 1,
                        commissionEarned: +(cur.commissionEarned + commissionAmt).toFixed(2),
                    });
                    const barrierStr = sig.barrier != null ? ` [barrier:${sig.barrier}]` : '';
                    const commLog    = commissionAmt > 0 ? ` | 💰 +${commissionAmt}` : '';
                    const durationLabel = sig.duration != null ? ` ${sig.duration}${sig.duration_unit ?? ''}` : '';
                    this.log(`🔁 ${f.loginid}: ${sig.contract_type}${barrierStr} ×${stake} ${currency}${durationLabel}${commLog}`);
                })
                .catch(() => {
                    // ── FALLBACK: proposal → buy — 2 RTTs ─────────────────
                    // Runs only if the direct buy was rejected by the server.
                    this.wsSend(conn, { proposal: 1, ...contractParams })
                        .then((propRes: any) => {
                            const pid      = propRes?.proposal?.id as string | undefined;
                            const askPrice = Number(propRes?.proposal?.ask_price ?? stake);
                            if (!pid) throw new Error('Proposal returned no ID');
                            return this.wsSend(conn, { buy: pid, price: askPrice });
                        })
                        .then(() => {
                            const cur = this.followers.find(x => x.id === f.id);
                            if (cur) this.updateFollower(f.id, {
                                replicated:       cur.replicated + 1,
                                commissionEarned: +(cur.commissionEarned + commissionAmt).toFixed(2),
                            });
                            const barrierStr = sig.barrier != null ? ` [barrier:${sig.barrier}]` : '';
                            const commLog    = commissionAmt > 0 ? ` | 💰 +${commissionAmt}` : '';
                            const durationLabel = sig.duration != null ? ` ${sig.duration}${sig.duration_unit ?? ''}` : '';
                            this.log(`🔁 ${f.loginid}: ${sig.contract_type}${barrierStr} ×${stake} ${currency}${durationLabel}${commLog} [via proposal]`);
                        })
                        .catch(err => this.log(`❌ ${f.loginid}: ${err?.message ?? 'trade failed'}`));
                });
        }

        // ── Bulk-purchase (WS not open — fallback path) ───────────────────
        if (bulkGroup.length > 0) {
            const stake = Math.max(0.35, +(sig.stake).toFixed(2)); // ratio=1 for bulk
            const accounts = bulkGroup.map(({ f }) => ({
                account_id: f.loginid,
                token:      f.token,
            }));
            const contractParams: Record<string, any> = {
                amount:            stake,
                basis:             'stake',
                contract_type:     sig.contract_type,
                currency:          'USD',
                underlying_symbol: sig.symbol,
            };
            if (sig.duration != null) contractParams.duration = sig.duration;
            if (sig.duration_unit) contractParams.duration_unit = sig.duration_unit;
            if (sig.growth_rate != null) contractParams.growth_rate = sig.growth_rate;
            if (sig.limit_order) contractParams.limit_order = sig.limit_order;
            if (sig.barrier != null) contractParams.barrier = String(sig.barrier);

            bulkPurchase(wantType, contractParams, accounts).then(results => {
                for (const r of results) {
                    const entry = bulkGroup.find(({ f }) => f.loginid === r.account_id);
                    if (!entry) continue;
                    if (r.ok) {
                        const cur = this.followers.find(x => x.id === entry.f.id);
                        if (cur) this.updateFollower(entry.f.id, { replicated: cur.replicated + 1 });
                            const durationLabel = sig.duration != null ? ` ${sig.duration}${sig.duration_unit ?? ''}` : '';
                            this.log(`🔁 ${r.account_id}: ${sig.contract_type} ×${stake}${durationLabel} (bulk)`);
                    } else {
                        this.log(`❌ ${r.account_id}: ${r.error}`);
                    }
                }
            });
        }
    }
}

// ── Engine exports ────────────────────────────────────────────────────────────

/** Main copy-trading engine — up to 15 followers, any mode. */
export const copyEngine   = new CopyEngine({
    storageKey:   'ct_state_v2',
    maxFollowers: 15,
    label:        'Copy Trading',
});

/** Mirror engine — master's demo→real only, always 1 follower (master's own real account). */
export const mirrorEngine = new CopyEngine({
    storageKey:   'ct_mirror_v2',
    maxFollowers: 1,
    label:        'Mirror',
});
