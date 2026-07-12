/**
 * Copy-trading engine.
 *
 * Each follower is a standalone authorized Deriv WebSocket connection (the
 * master trades on the app's own connection). When the master opens a trade,
 * `subscribeMasterTrades` fires and every active follower places the same
 * contract with a scaled stake.
 *
 *  - Real -> Real : mirror the master's REAL-account trades to followers.
 *  - Demo -> Real : mirror the master's DEMO signals to followers (risk-scaled).
 *
 * See the Deriv API docs (https://developers.deriv.com/llms.txt): authorize ->
 * buy with { parameters }.
 */
import { MasterTradeSignal, subscribeMasterTrades } from './trade-bus';

// Follower connections must authorize under the SAME registered app as the
// main app's own connection (api-token-login-modal / derivws-accounts.service)
// — using the generic demo app id (1089) here caused follower authorize/buy
// calls to run under a different app's trading scopes, which is the root
// cause of followers failing to link or reciprocate trades reliably.
const APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || 1089;
const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`;

export type CopyMode = 'real_real' | 'demo_real';

export type FollowerStatus = 'pending' | 'active' | 'error' | 'removed';

export interface FollowerAccount {
    loginid: string;
    currency: string;
    is_virtual: boolean;
    balance?: string;
}

export interface Follower {
    id: string;
    token: string;
    loginid: string;
    currency: string;
    balance: number;
    is_virtual: boolean;
    status: FollowerStatus;
    /** Real->Real: stake multiplier. Demo->Real: risk multiplier. */
    ratio: number;
    replicated: number;
    lastError?: string;
    /** All accounts linked to this token (from authorize account_list) */
    account_list?: FollowerAccount[];
}

interface FollowerConn {
    ws: WebSocket;
    reqId: number;
    pending: Map<number, (d: any) => void>;
}

type ChangeListener = (followers: Follower[]) => void;
type LogListener = (msg: string) => void;

class CopyEngine {
    private followers: Follower[] = [];
    private conns = new Map<string, FollowerConn>();
    private changeListeners = new Set<ChangeListener>();
    private logListeners = new Set<LogListener>();
    private mode: CopyMode = 'real_real';
    private running = false;
    private unsubBus: (() => void) | null = null;

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

    getMode(): CopyMode {
        return this.mode;
    }

    setMode(mode: CopyMode): void {
        this.mode = mode;
        this.emit();
    }

    isRunning(): boolean {
        return this.running;
    }

    private send(conn: FollowerConn, msg: object): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = conn.reqId++;
            conn.pending.set(id, d => (d.error ? reject(d.error) : resolve(d)));
            if (conn.ws.readyState === WebSocket.OPEN) {
                conn.ws.send(JSON.stringify({ ...msg, req_id: id }));
            } else {
                reject(new Error('WebSocket not open'));
            }
        });
    }

    async addFollower(token: string, ratio = 1): Promise<void> {
        const trimmed = token.trim();
        if (!trimmed || this.followers.some(f => f.token === trimmed)) return;
        if (this.followers.length >= 10) {
            this.log('⚠️ Maximum of 10 follower accounts reached.');
            return;
        }
        const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const follower: Follower = {
            id, token: trimmed, loginid: 'Verifying…', currency: '---',
            balance: 0, is_virtual: false, status: 'pending', ratio, replicated: 0,
        };
        this.followers.push(follower);
        this.emit();

        try {
            const ws = new WebSocket(WS_URL);
            const conn: FollowerConn = { ws, reqId: 1, pending: new Map() };
            this.conns.set(id, conn);

            ws.onmessage = e => {
                const d = JSON.parse(e.data);
                if (d.req_id && conn.pending.has(d.req_id)) {
                    const cb = conn.pending.get(d.req_id)!;
                    conn.pending.delete(d.req_id);
                    cb(d);
                }
                if (d.balance?.balance != null) {
                    this.update(id, { balance: parseFloat(d.balance.balance) });
                }
            };
            ws.onclose = () => this.update(id, { status: 'error', lastError: 'Disconnected' });
            ws.onerror = () => this.update(id, { status: 'error', lastError: 'Connection error' });

            await new Promise<void>((res, rej) => {
                ws.onopen = () => res();
                setTimeout(() => rej(new Error('timeout')), 10000);
            });

            const auth = await this.send(conn, { authorize: trimmed });
            if (!auth.authorize) throw new Error('Invalid token');
            const { loginid, currency, balance, is_virtual, account_list } = auth.authorize;
            // Build structured account_list with clear real/demo labels
            const parsedAccountList: FollowerAccount[] = Array.isArray(account_list)
                ? account_list.map((a: any) => ({
                    loginid: a.loginid,
                    currency: a.currency,
                    is_virtual: !!a.is_virtual,
                }))
                : [];
            this.update(id, {
                loginid, currency, balance: parseFloat(balance || '0'),
                is_virtual: !!is_virtual, status: 'active',
                account_list: parsedAccountList,
            });
            this.send(conn, { balance: 1, subscribe: 1 }).catch(() => {});
            const accountSummary = parsedAccountList.length > 1
                ? ` | ${parsedAccountList.length} accounts linked`
                : '';
            this.log(`✅ Linked ${loginid} (${currency}${is_virtual ? ' · virtual' : ''}${accountSummary})`);
        } catch (err: any) {
            this.update(id, { status: 'error', lastError: err?.message || 'Auth failed' });
            this.log(`❌ Failed to link token: ${err?.message || err}`);
        }
    }

    private update(id: string, patch: Partial<Follower>): void {
        const f = this.followers.find(x => x.id === id);
        if (!f) return;
        Object.assign(f, patch);
        this.emit();
    }

    setRatio(id: string, ratio: number): void {
        this.update(id, { ratio: Math.max(0.01, ratio) });
    }

    removeFollower(id: string): void {
        const conn = this.conns.get(id);
        if (conn) {
            try { conn.ws.close(); } catch { /* noop */ }
            this.conns.delete(id);
        }
        this.followers = this.followers.filter(f => f.id !== id);
        this.emit();
    }

    start(): void {
        if (this.running) return;
        if (!this.followers.some(f => f.status === 'active')) {
            this.log('⚠️ No active follower accounts to copy to.');
            return;
        }
        this.running = true;
        this.unsubBus = subscribeMasterTrades(sig => this.onMasterTrade(sig));
        this.log(`▶ Copy trading started (${this.mode === 'real_real' ? 'Real → Real' : 'Demo → Real'}).`);
        this.emit();
    }

    stop(): void {
        this.running = false;
        if (this.unsubBus) {
            this.unsubBus();
            this.unsubBus = null;
        }
        this.log('⏸ Copy trading stopped.');
        this.emit();
    }

    private onMasterTrade(sig: MasterTradeSignal): void {
        if (!this.running) return;
        const wantSource = this.mode === 'real_real' ? 'real' : 'demo';
        if (sig.source !== wantSource) return;

        this.followers.filter(f => f.status === 'active').forEach(f => {
            const conn = this.conns.get(f.id);
            if (!conn) return;
            const stake = Math.max(0.35, +(sig.stake * f.ratio).toFixed(2));
            const parameters: any = {
                amount: stake,
                basis: 'stake',
                contract_type: sig.contract_type,
                currency: f.currency === '---' ? 'USD' : f.currency,
                duration: sig.duration,
                duration_unit: sig.duration_unit,
                symbol: sig.symbol,
            };
            if (sig.barrier !== undefined) parameters.barrier = String(sig.barrier);
            this.send(conn, { buy: '1', price: stake, parameters })
                .then(() => {
                    this.update(f.id, { replicated: f.replicated + 1 });
                    this.log(`🔁 ${f.loginid}: ${sig.contract_type} @ ${stake} ${f.currency}`);
                })
                .catch(err => this.log(`❌ ${f.loginid}: ${err?.message || 'buy failed'}`));
        });
    }
}

export const copyEngine = new CopyEngine();
