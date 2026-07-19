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

import { MasterTradeSignal, subscribeMasterTrades } from './trade-bus';

// ── Config ──────────────────────────────────────────────────────────────────
const REST_BASE          = 'https://api.derivws.com';
const APP_ID             = String(process.env.NEXT_PUBLIC_DERIV_APP_ID || '36300');
const PING_MS            = 28_000;
const CONNECT_TIMEOUT_MS = 20_000;
const MAX_RECONNECTS     = 5;

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
    ws:             WebSocket | null;
    reqId:          number;
    pending:        Map<number, (d: any) => void>;
    pingTimer:      ReturnType<typeof setInterval> | null;
    reconnectCount: number;
    dead:           boolean;
    token:          string;
    accountId:      string;
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

const EXPIRE_MS = 48 * 60 * 60 * 1000; // 48 hours

class CopyEngine {
    private followers:       Follower[]             = [];
    private conns:           Map<string, FollowerConn> = new Map();
    private changeListeners: Set<ChangeListener>    = new Set();
    private logListeners:    Set<LogListener>       = new Set();
    private mode:            CopyMode               = 'real_real';
    private running:         boolean                = false;
    private unsubBus:        (() => void) | null    = null;

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
            if (state.running) {
                setTimeout(() => {
                    if (!this.running && this.followers.some(x => x.status === 'active')) this.start();
                }, 2500);
            }
        } catch { /* corrupted — ignore */ }
    }

    clearState(): void {
        try { localStorage.removeItem(this.opts.storageKey); } catch { /* noop */ }
    }

    // ── WS send (req_id matching) ────────────────────────────────────────────

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

    // ── Connect / reconnect a follower ───────────────────────────────────────

    private async connectFollower(id: string): Promise<void> {
        const conn = this.conns.get(id);
        if (!conn || conn.dead) return;

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
            this.updateFollower(id, { status: 'error', lastError: 'Connection lost — reconnecting…' });
            this.scheduleReconnect(id);
        };
        const onError = (_e: Event): void => { /* onClose fires after */ };

        if (conn.pingTimer) { clearInterval(conn.pingTimer); conn.pingTimer = null; }

        const ws = await openOtpWebSocket(token, accountId, onMessage, onClose, onError);
        conn.ws = ws;

        conn.pingTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ping: 1 }));
        }, PING_MS);

        this.wsSend(conn, { balance: 1, subscribe: 1 }).catch(() => {});
    }

    private scheduleReconnect(id: string): void {
        const conn = this.conns.get(id);
        if (!conn || conn.dead) return;
        if (conn.reconnectCount >= MAX_RECONNECTS) {
            this.updateFollower(id, {
                status: 'error',
                lastError: `Max reconnect attempts reached. Remove and re-add the token.`,
            });
            const loginid = this.followers.find(f => f.id === id)?.loginid ?? id;
            this.log(`⚠️ ${loginid}: max reconnects reached.`);
            return;
        }
        const delay = Math.min(2000 * 2 ** conn.reconnectCount, 30_000);
        conn.reconnectCount++;
        const loginid = this.followers.find(f => f.id === id)?.loginid ?? id;
        this.log(`🔄 ${loginid}: reconnecting in ${Math.round(delay / 1000)} s…`);
        setTimeout(async () => {
            if (!conn || conn.dead) return;
            try {
                await this.connectFollower(id);
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
            pingTimer: null, reconnectCount: 0, dead: false,
            token: trimmed, accountId: '',
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
        this.unsubBus = subscribeMasterTrades(sig => this.onMasterTrade(sig));
        this.log(`▶ ${this.opts.label} started (${this.modeLabel()}).`);
        this.saveState();
        this.emit();
    }

    stop(): void {
        if (!this.running) return;
        this.running = false;
        this.unsubBus?.();
        this.unsubBus = null;
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

    // ── Trade replication ────────────────────────────────────────────────────

    private onMasterTrade(sig: MasterTradeSignal): void {
        if (!this.running) return;
        if (sig.source !== masterSourceFor(this.mode)) return;

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

        // ── Individual WS sends (per-follower ratio + commission) ─────────
        for (const { f, conn } of individualGroup) {
            const stake         = Math.max(0.35, +(sig.stake * f.ratio).toFixed(2));
            const commissionAmt = +(stake * (f.commission ?? 0) / 100).toFixed(2);

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
            if (sig.barrier != null) proposalReq.barrier = String(sig.barrier);

            this.wsSend(conn, proposalReq)
                .then((propRes: any) => {
                    if (propRes?.error) throw new Error(propRes.error.message);
                    const pid      = propRes?.proposal?.id as string | undefined;
                    const askPrice = Number(propRes?.proposal?.ask_price ?? stake);
                    if (!pid) throw new Error('No proposal ID returned');
                    return this.wsSend(conn, { buy: pid, price: askPrice });
                })
                .then(() => {
                    const cur = this.followers.find(x => x.id === f.id);
                    if (cur) this.updateFollower(f.id, {
                        replicated:       cur.replicated + 1,
                        commissionEarned: +(cur.commissionEarned + commissionAmt).toFixed(2),
                    });
                    const commLog = commissionAmt > 0 ? ` | 💰 +${commissionAmt}` : '';
                    this.log(`🔁 ${f.loginid}: ${sig.contract_type} ×${stake} ${f.currency}${commLog}`);
                })
                .catch(err => this.log(`❌ ${f.loginid}: ${err?.message ?? 'buy failed'}`));
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
                duration:          sig.duration,
                duration_unit:     sig.duration_unit,
                underlying_symbol: sig.symbol,
            };
            if (sig.barrier != null) contractParams.barrier = String(sig.barrier);

            bulkPurchase(wantType, contractParams, accounts).then(results => {
                for (const r of results) {
                    const entry = bulkGroup.find(({ f }) => f.loginid === r.account_id);
                    if (!entry) continue;
                    if (r.ok) {
                        const cur = this.followers.find(x => x.id === entry.f.id);
                        if (cur) this.updateFollower(entry.f.id, { replicated: cur.replicated + 1 });
                        this.log(`🔁 ${r.account_id}: ${sig.contract_type} ×${stake} (bulk)`);
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
