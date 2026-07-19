/**
 * Copy-trading engine — Deriv new API (OTP-authenticated WebSocket).
 *
 * Auth flow per follower PAT token:
 *  1. GET  /trading/v1/options/accounts        (Bearer PAT) → account list + IDs
 *  2. POST /trading/v1/options/accounts/{id}/otp (Bearer PAT) → one-time WS URL
 *  3. new WebSocket(otpUrl)                    → authenticated, NO `authorize` message needed
 *
 * The old `wss://ws.derivws.com/websockets/v3?app_id=...` + `authorize: token`
 * WebSocket model is NOT used — PAT tokens fail/time-out on that endpoint.
 *
 * Mode → source / follower account-type mapping:
 *  real_real → listen to 'real' master trades → follower needs REAL account
 *  demo_real → listen to 'demo' master trades → follower needs REAL account
 *  demo_demo → listen to 'demo' master trades → follower needs DEMO account
 *  real_demo → listen to 'real' master trades → follower needs DEMO account
 *
 * Keepalive: ping every 28 s (docs recommend 30 s max).
 * Reconnect: exponential backoff up to MAX_RECONNECTS attempts, then mark error.
 */

import { MasterTradeSignal, subscribeMasterTrades } from './trade-bus';

// ── Config ─────────────────────────────────────────────────────────────────
const REST_BASE          = 'https://api.derivws.com';
const APP_ID             = String(process.env.NEXT_PUBLIC_DERIV_APP_ID || '36300');
const MAX_FOLLOWERS      = 10;
const PING_MS            = 28_000;   // 28 s — docs say send ping every 30 s
const CONNECT_TIMEOUT_MS = 20_000;
const MAX_RECONNECTS     = 5;

// ── Types ──────────────────────────────────────────────────────────────────
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
    id:                string;
    token:             string;
    loginid:           string;
    currency:          string;
    balance:           number;
    is_virtual:        boolean;
    status:            FollowerStatus;
    ratio:             number;
    commission:        number;   // % of stake logged as commission per trade (0–50)
    commissionEarned:  number;   // cumulative USD commission tracked this session
    replicated:        number;
    lastError?:        string;
    account_list?:     FollowerAccount[];
}

interface FollowerConn {
    ws:             WebSocket | null;
    reqId:          number;
    pending:        Map<number, (d: any) => void>;
    pingTimer:      ReturnType<typeof setInterval> | null;
    reconnectCount: number;
    dead:           boolean;     // true when follower intentionally removed
    token:          string;
    accountId:      string;
}

type ChangeListener = (followers: Follower[]) => void;
type LogListener    = (msg: string) => void;

// ── REST helpers ───────────────────────────────────────────────────────────

function makeHeaders(token: string): Record<string, string> {
    return {
        'Deriv-App-ID':  APP_ID,
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
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
        throw new Error('Network error — unable to reach Deriv servers. Check your internet connection.');
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const apiMsg = body?.errors?.[0]?.message;
        throw new Error(apiMsg || describeHttpError(res.status));
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
        throw new Error('Network error — unable to reach Deriv servers. Check your internet connection.');
    }
    if (!res.ok) {
        const bd = await res.json().catch(() => ({}));
        const apiMsg = bd?.errors?.[0]?.message;
        throw new Error(apiMsg || describeHttpError(res.status));
    }
    return res.json();
}

// ── Mode helpers ───────────────────────────────────────────────────────────

/** Which account type should the follower trade on for the given copy mode? */
function followerNeedsAccountType(mode: CopyMode): 'real' | 'demo' {
    return mode === 'demo_demo' || mode === 'real_demo' ? 'demo' : 'real';
}

/** Which master account type should we listen to for the given copy mode? */
function masterSourceFor(mode: CopyMode): 'real' | 'demo' {
    return mode === 'real_real' || mode === 'real_demo' ? 'real' : 'demo';
}

// ── OTP WebSocket builder ──────────────────────────────────────────────────

async function openOtpWebSocket(
    token:     string,
    accountId: string,
    onMessage: (d: any) => void,
    onClose:   () => void,
    onError:   (e: Event) => void,
): Promise<WebSocket> {
    // Get one-time authenticated WebSocket URL from Deriv REST
    const otpData = await restPost(`/trading/v1/options/accounts/${accountId}/otp`, token);
    const wsUrl   = otpData?.data?.url as string | undefined;
    if (!wsUrl) throw new Error('Deriv did not return a WebSocket URL. Verify your App ID is registered correctly.');

    const ws = new WebSocket(wsUrl);
    ws.onmessage = (e: MessageEvent) => {
        try { onMessage(JSON.parse(e.data as string)); } catch { /* ignore malformed */ }
    };
    ws.onclose = onClose;
    ws.onerror = onError;

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            ws.close();
            reject(new Error(`WebSocket connection timed out after ${CONNECT_TIMEOUT_MS / 1000} s. Check your internet and try again.`));
        }, CONNECT_TIMEOUT_MS);
        ws.onopen = () => { clearTimeout(timer); resolve(); };
    });

    return ws;
}

// ── Copy Engine ────────────────────────────────────────────────────────────

const STORAGE_KEY  = 'ct_state_v2';
const EXPIRE_MS    = 48 * 60 * 60 * 1000; // 48 hours

class CopyEngine {
    private followers:      Follower[]            = [];
    private conns:          Map<string, FollowerConn> = new Map();
    private changeListeners: Set<ChangeListener> = new Set();
    private logListeners:    Set<LogListener>    = new Set();
    private mode:    CopyMode = 'real_real';
    private running: boolean  = false;
    private unsubBus: (() => void) | null = null;

    // ── Pub/sub ──────────────────────────────────────────────────────────

    onChange(cb: ChangeListener): () => void {
        this.changeListeners.add(cb);
        cb(this.snapshot());
        return () => this.changeListeners.delete(cb);
    }

    onLog(cb: LogListener): () => void {
        this.logListeners.add(cb);
        return () => this.logListeners.delete(cb);
    }

    private emit(): void {
        const snap = this.snapshot();
        this.changeListeners.forEach(l => l(snap));
    }

    private log(msg: string): void {
        this.logListeners.forEach(l => l(msg));
    }

    private snapshot(): Follower[] {
        return this.followers.map(f => ({ ...f }));
    }

    getMode():            CopyMode { return this.mode; }
    setMode(m: CopyMode): void     { this.mode = m; this.saveState(); this.emit(); }
    isRunning():          boolean  { return this.running; }

    // ── Persistence ──────────────────────────────────────────────────────

    saveState(): void {
        try {
            const payload = {
                mode:    this.mode,
                running: this.running,
                expires: Date.now() + EXPIRE_MS,
                followers: this.followers
                    .filter(f => f.status === 'active' || f.status === 'pending')
                    .map(f => ({ token: f.token, ratio: f.ratio, commission: f.commission ?? 0 })),
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch { /* storage unavailable */ }
    }

    /** Call once on app mount to reconnect saved followers. */
    async restoreState(): Promise<void> {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const state = JSON.parse(raw);
            if (!state?.expires || Date.now() > state.expires) {
                localStorage.removeItem(STORAGE_KEY);
                return;
            }
            if (state.mode) this.mode = state.mode as CopyMode;
            if (Array.isArray(state.followers)) {
                for (const f of state.followers as { token: string; ratio: number; commission?: number }[]) {
                    if (f.token && !this.followers.some(x => x.token === f.token)) {
                        await this.addFollower(f.token, f.ratio ?? 1);
                        // Restore commission after addFollower sets it to 0
                        if (f.commission) {
                            const added = this.followers.find(x => x.token === f.token);
                            if (added) this.updateFollower(added.id, { commission: f.commission });
                        }
                    }
                }
            }
            // Auto-restart if copy trading was running
            if (state.running) {
                setTimeout(() => {
                    if (!this.running && this.followers.some(x => x.status === 'active')) {
                        this.start();
                    }
                }, 2500);
            }
        } catch { /* corrupted data — ignore */ }
    }

    clearState(): void {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    }

    // ── WS send (req_id matching) ────────────────────────────────────────

    private wsSend(conn: FollowerConn, msg: object): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = conn.reqId++;
            conn.pending.set(id, d => {
                if (d.error) reject(d.error);
                else resolve(d);
            });
            if (conn.ws?.readyState === WebSocket.OPEN) {
                conn.ws.send(JSON.stringify({ ...msg, req_id: id }));
            } else {
                conn.pending.delete(id);
                reject(new Error('WebSocket not open'));
            }
        });
    }

    // ── Connect / reconnect a single follower ────────────────────────────

    private async connectFollower(id: string): Promise<void> {
        const conn = this.conns.get(id);
        if (!conn || conn.dead) return;

        const { token, accountId } = conn;

        const onMessage = (d: any): void => {
            if (!d || conn.dead) return;
            // Route req_id responses
            if (d.req_id != null && conn.pending.has(d.req_id)) {
                const cb = conn.pending.get(d.req_id)!;
                conn.pending.delete(d.req_id);
                cb(d);
            }
            // Live balance subscription push
            if (d.balance?.balance != null) {
                this.updateFollower(id, { balance: parseFloat(String(d.balance.balance)) });
            }
        };

        const onClose = (): void => {
            if (conn.dead) return;
            this.updateFollower(id, { status: 'error', lastError: 'Connection lost — reconnecting…' });
            this.scheduleReconnect(id);
        };

        const onError = (_e: Event): void => {
            if (conn.dead) return;
            // onClose will fire right after; log is handled there
        };

        // Tear down previous ping timer
        if (conn.pingTimer) {
            clearInterval(conn.pingTimer);
            conn.pingTimer = null;
        }

        // Get fresh OTP WebSocket URL and connect
        const ws = await openOtpWebSocket(token, accountId, onMessage, onClose, onError);
        conn.ws = ws;

        // 28-second keepalive ping (docs recommend every 30 s)
        conn.pingTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ ping: 1 }));
            }
        }, PING_MS);

        // Subscribe to live balance
        this.wsSend(conn, { balance: 1, subscribe: 1 }).catch(() => {});
    }

    private scheduleReconnect(id: string): void {
        const conn = this.conns.get(id);
        if (!conn || conn.dead) return;

        if (conn.reconnectCount >= MAX_RECONNECTS) {
            this.updateFollower(id, {
                status: 'error',
                lastError: `Disconnected after ${MAX_RECONNECTS} attempts. Remove and re-add the token.`,
            });
            const loginid = this.followers.find(f => f.id === id)?.loginid ?? id;
            this.log(`⚠️ ${loginid}: max reconnect attempts reached — remove and re-add the token.`);
            return;
        }

        const delay = Math.min(2000 * 2 ** conn.reconnectCount, 30_000);
        conn.reconnectCount++;

        const loginid = this.followers.find(f => f.id === id)?.loginid ?? id;
        this.log(`🔄 ${loginid}: reconnecting in ${Math.round(delay / 1000)} s (attempt ${conn.reconnectCount}/${MAX_RECONNECTS})…`);

        setTimeout(async () => {
            if (!conn || conn.dead) return;
            try {
                await this.connectFollower(id);
                conn.reconnectCount = 0;
                this.updateFollower(id, { status: 'active', lastError: undefined });
                this.log(`✅ ${loginid}: reconnected successfully.`);
            } catch {
                this.scheduleReconnect(id);
            }
        }, delay);
    }

    // ── Add follower ─────────────────────────────────────────────────────

    async addFollower(token: string, ratio = 1): Promise<void> {
        const trimmed = token.trim();
        if (!trimmed) {
            this.log('⚠️ Token is empty. Paste your API token (Read + Trade scopes) from Deriv → Account Settings → API Tokens.');
            return;
        }
        if (this.followers.some(f => f.token === trimmed)) {
            this.log('ℹ️ This token is already linked.');
            return;
        }
        if (this.followers.length >= MAX_FOLLOWERS) {
            this.log(`⚠️ Maximum ${MAX_FOLLOWERS} follower accounts already reached.`);
            return;
        }

        const id: string = `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const follower: Follower = {
            id, token: trimmed,
            loginid: 'Verifying…', currency: '---',
            balance: 0, is_virtual: false,
            status: 'pending', ratio,
            commission: 0, commissionEarned: 0,
            replicated: 0,
        };
        this.followers.push(follower);
        this.emit();

        const conn: FollowerConn = {
            ws: null, reqId: 1, pending: new Map(),
            pingTimer: null, reconnectCount: 0, dead: false,
            token: trimmed, accountId: '',
        };
        this.conns.set(id, conn);

        try {
            // ── Step 1: Validate PAT via REST ────────────────────────────
            this.log('🔑 Validating API token with Deriv…');
            const accountsData   = await restGet('/trading/v1/options/accounts', trimmed);
            const rawAccounts    = (accountsData?.data ?? []) as any[];

            if (!rawAccounts.length) {
                throw new Error('No trading accounts found for this token. Ensure the token has Read + Trade scopes and at least one active Options account.');
            }

            const allAccounts: FollowerAccount[] = rawAccounts.map(a => ({
                account_id:   String(a.account_id),
                currency:     String(a.currency || 'USD'),
                account_type: (a.account_type === 'demo' ? 'demo' : 'real') as 'real' | 'demo',
                balance:      Number(a.balance ?? 0),
                status:       String(a.status || 'active'),
            }));

            // ── Step 2: Pick the right account based on copy mode ────────
            const wantType      = followerNeedsAccountType(this.mode);
            const targetAccount =
                allAccounts.find(a => a.account_type === wantType && a.status === 'active')
                ?? allAccounts.find(a => a.status === 'active')
                ?? allAccounts[0];

            conn.accountId = targetAccount.account_id;

            this.updateFollower(id, {
                loginid:      targetAccount.account_id,
                currency:     targetAccount.currency,
                balance:      targetAccount.balance,
                is_virtual:   targetAccount.account_type === 'demo',
                account_list: allAccounts,
            });

            // ── Step 3: Open OTP-authenticated WebSocket ─────────────────
            this.log(`🔗 Opening authenticated WebSocket for ${targetAccount.account_id}…`);
            await this.connectFollower(id);

            this.updateFollower(id, { status: 'active', lastError: undefined });
            this.saveState();

            const typeLabel  = targetAccount.account_type === 'demo' ? '· demo' : '· real';
            const extraLabel = allAccounts.length > 1
                ? ` | ${allAccounts.length} accounts on token`
                : '';
            this.log(`✅ Linked ${targetAccount.account_id} (${targetAccount.currency} ${typeLabel}${extraLabel})`);

        } catch (err: any) {
            const msg = err?.message ?? String(err);
            this.updateFollower(id, { status: 'error', lastError: msg });
            this.log(`❌ Link failed: ${msg}`);
        }
    }

    /** Retry connection for a follower that errored. */
    async retryFollower(id: string): Promise<void> {
        const follower = this.followers.find(f => f.id === id);
        const conn     = this.conns.get(id);
        if (!follower || !conn || conn.dead) return;

        this.updateFollower(id, { status: 'pending', lastError: undefined });
        conn.reconnectCount = 0;

        this.log(`🔁 Retrying ${follower.loginid}…`);
        try {
            // Re-validate + reconnect (accountId may still be set from before)
            if (!conn.accountId) {
                const accountsData = await restGet('/trading/v1/options/accounts', conn.token);
                const rawAccounts  = (accountsData?.data ?? []) as any[];
                const wantType     = followerNeedsAccountType(this.mode);
                const target =
                    rawAccounts.find(a => a.account_type === wantType && a.status === 'active')
                    ?? rawAccounts[0];
                if (!target) throw new Error('No valid account found for retry.');
                conn.accountId = String(target.account_id);
            }
            await this.connectFollower(id);
            this.updateFollower(id, { status: 'active', lastError: undefined });
            this.log(`✅ ${follower.loginid}: reconnected.`);
        } catch (err: any) {
            const msg = err?.message ?? String(err);
            this.updateFollower(id, { status: 'error', lastError: msg });
            this.log(`❌ Retry failed: ${msg}`);
        }
    }

    // ── Update / remove ──────────────────────────────────────────────────

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
        this.updateFollower(id, { commission: Math.max(0, Math.min(50, pct)) });
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

    // ── Start / stop ─────────────────────────────────────────────────────

    start(): void {
        if (this.running) return;
        if (!this.followers.some(f => f.status === 'active')) {
            this.log('⚠️ No active follower accounts — add and verify a follower token first.');
            return;
        }
        this.running  = true;
        this.unsubBus = subscribeMasterTrades(sig => this.onMasterTrade(sig));
        this.log(`▶ Copy trading started (${this.modeLabel()}).`);
        this.saveState();
        this.emit();
    }

    stop(): void {
        if (!this.running) return;
        this.running = false;
        this.unsubBus?.();
        this.unsubBus = null;
        this.log('⏸ Copy trading stopped.');
        this.saveState();
        this.emit();
    }

    private modeLabel(): string {
        const labels: Record<CopyMode, string> = {
            real_real: 'Real → Real',
            demo_real: 'Demo → Real',
            demo_demo: 'Demo → Demo',
            real_demo: 'Real → Demo',
        };
        return labels[this.mode];
    }

    // ── Trade replication ────────────────────────────────────────────────

    private onMasterTrade(sig: MasterTradeSignal): void {
        if (!this.running) return;

        // Only mirror trades from the correct master account type
        if (sig.source !== masterSourceFor(this.mode)) return;

        this.followers
            .filter(f => f.status === 'active')
            .forEach(f => {
                const conn = this.conns.get(f.id);
                if (!conn || conn.dead || conn.ws?.readyState !== WebSocket.OPEN) return;

                const stake = Math.max(0.35, +(sig.stake * f.ratio).toFixed(2));
                const commissionAmt = +(stake * (f.commission ?? 0) / 100).toFixed(2);

                // New Deriv API requires `underlying_symbol` (not `symbol`)
                const proposalReq: Record<string, any> = {
                    proposal:          1,
                    amount:            stake,
                    basis:             'stake',
                    contract_type:     sig.contract_type,
                    currency:          f.currency === '---' ? 'USD' : f.currency,
                    duration:          sig.duration,
                    duration_unit:     sig.duration_unit,
                    underlying_symbol: sig.symbol,
                };
                if (sig.barrier !== undefined && sig.barrier !== null) {
                    proposalReq.barrier = String(sig.barrier);
                }

                this.wsSend(conn, proposalReq)
                    .then((propRes: any) => {
                        if (propRes?.error) throw new Error(propRes.error.message);
                        const pid      = propRes?.proposal?.id as string | undefined;
                        const askPrice = Number(propRes?.proposal?.ask_price ?? stake);
                        if (!pid) throw new Error('No proposal ID returned from Deriv');
                        return this.wsSend(conn, { buy: pid, price: askPrice });
                    })
                    .then(() => {
                        const cur = this.followers.find(x => x.id === f.id);
                        if (cur) {
                            this.updateFollower(f.id, {
                                replicated:       cur.replicated + 1,
                                commissionEarned: +(cur.commissionEarned + commissionAmt).toFixed(2),
                            });
                        }
                        const commLog = commissionAmt > 0 ? ` | commission +${commissionAmt} ${f.currency}` : '';
                        this.log(`🔁 ${f.loginid}: ${sig.contract_type} × ${stake} ${f.currency}${commLog}`);
                    })
                    .catch(err => {
                        this.log(`❌ ${f.loginid}: ${err?.message ?? 'buy failed'}`);
                    });
            });
    }
}

export const copyEngine = new CopyEngine();
