const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const WebSocket = require('ws');
const { Pool } = require('pg');
const {
    cleanStrategy,
    extractBarrier,
    extractDuration,
    hashAccount,
    hashIp,
    parseCookies,
    readTicket,
    signTicket,
} = require('./security');

const PORT = Number(process.env.PORT) || 5001;
const HOST = '0.0.0.0';
const API_PREFIX = '/api/money-print';
const USER_COOKIE = 'mp_user';
const ADMIN_COOKIE = 'mp_admin';
const USER_SESSION_MS = 60 * 60 * 1000;
const ADMIN_SESSION_MS = 30 * 60 * 1000;
const ADMIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_MAX_FAILURES = 5;
const BODY_LIMIT_BYTES = 32 * 1024;
const MAX_CONTRACT_IDS = 25;
const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID;
const derivWsUrl = process.env.NEXT_PUBLIC_DERIV_ENV === 'preview'
    ? 'wss://staging-api.derivws.com/trading/v1/options/ws/public'
    : 'wss://api.derivws.com/trading/v1/options/ws/public';
const DIST_DIR = path.resolve(__dirname, '../dist');
const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, max: 8 })
    : null;

class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

if (pool) {
    pool.on('error', () => console.error('Money Print database pool error.'));
}

function sessionKey() {
    const key = process.env.SESSION_SECRET;
    if (!key) throw new ApiError(503, 'The secure session service is not configured.');
    return key;
}

function requireDatabase() {
    if (!pool) throw new ApiError(503, 'Money Print analytics storage is not configured.');
}

function sendJson(response, status, body, extraHeaders = {}) {
    const payload = JSON.stringify(body);
    response.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        ...extraHeaders,
    });
    response.end(payload);
}

async function readJson(request) {
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
        size += chunk.length;
        if (size > BODY_LIMIT_BYTES) throw new ApiError(413, 'Request is too large.');
        chunks.push(chunk);
    }
    if (size === 0) return {};
    try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body');
        return parsed;
    } catch {
        throw new ApiError(400, 'Request body must be valid JSON.');
    }
}

function getOriginHost(request) {
    const forwardedHost = request.headers['x-forwarded-host'];
    const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
    return host || request.headers.host || '';
}

function hasSameOrigin(request) {
    const origin = request.headers.origin;
    const host = getOriginHost(request);
    if (!origin || !host) return false;
    try {
        return new URL(origin).host.toLowerCase() === String(host).toLowerCase();
    } catch {
        return false;
    }
}

function requireSameOrigin(request) {
    if (!hasSameOrigin(request)) throw new ApiError(403, 'This request is not allowed.');
}

function getBearerToken(request) {
    const authorization = request.headers.authorization || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();
    if (!token || token.length > 8192) throw new ApiError(401, 'A valid connected account is required.');
    return token;
}

function setCookie(request, response, name, value, maxAge, pathName) {
    const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const secure = forwardedProto === 'https' || process.env.NODE_ENV === 'production';
    const cookie = [
        `${name}=${encodeURIComponent(value)}`,
        `Path=${pathName}`,
        `Max-Age=${maxAge}`,
        'HttpOnly',
        'SameSite=Strict',
        ...(secure ? ['Secure'] : []),
    ].join('; ');
    const existing = response.getHeader('Set-Cookie');
    response.setHeader('Set-Cookie', existing ? [...[].concat(existing), cookie] : cookie);
}

function clearCookie(request, response, name, pathName) {
    setCookie(request, response, name, '', 0, pathName);
}

function readSignedCookie(request, name, expectedKind) {
    const ticket = parseCookies(request.headers.cookie)[name];
    const payload = readTicket(ticket, sessionKey());
    if (!payload || payload.kind !== expectedKind) return null;
    return payload;
}

function deriveIdentity(authorize) {
    let accountHash;
    try {
        accountHash = hashAccount(authorize?.loginid, sessionKey());
    } catch {
        throw new ApiError(401, 'The connected account could not be verified.');
    }
    const isVirtual = authorize.is_virtual === true || authorize.is_virtual === 1;
    const currency = typeof authorize.currency === 'string' && /^[A-Z0-9]{3,8}$/i.test(authorize.currency)
        ? authorize.currency.toUpperCase()
        : 'UNKNOWN';
    return {
        accountHash,
        accountType: isVirtual ? 'demo' : 'real',
        currency,
    };
}

async function withAuthorizedDeriv(token, task) {
    if (!DERIV_APP_ID || !/^\d+$/.test(DERIV_APP_ID)) {
        throw new ApiError(503, 'Deriv account verification is not configured.');
    }
    const socket = new WebSocket(`${derivWsUrl}?app_id=${encodeURIComponent(DERIV_APP_ID)}`, {
        handshakeTimeout: 8000,
        maxPayload: 1024 * 1024,
    });
    const pending = new Map();
    let requestId = 0;
    let socketError = null;

    socket.on('message', (raw) => {
        let message;
        try {
            message = JSON.parse(raw.toString());
        } catch {
            return;
        }
        const waiter = pending.get(message.req_id);
        if (!waiter) return;
        pending.delete(message.req_id);
        clearTimeout(waiter.timeout);
        if (message.error) {
            waiter.reject(new ApiError(401, 'Deriv could not verify the connected account.'));
        } else {
            waiter.resolve(message);
        }
    });

    socket.on('error', () => {
        socketError = new ApiError(502, 'The Deriv verification service is unavailable.');
        for (const [id, waiter] of pending) {
            clearTimeout(waiter.timeout);
            waiter.reject(socketError);
            pending.delete(id);
        }
    });

    const send = (requestData) => new Promise((resolve, reject) => {
        if (socket.readyState !== WebSocket.OPEN) {
            reject(socketError || new ApiError(502, 'The Deriv verification connection closed.'));
            return;
        }
        const id = ++requestId;
        const timeout = setTimeout(() => {
            pending.delete(id);
            reject(new ApiError(504, 'The Deriv verification request timed out.'));
        }, 12000);
        pending.set(id, { resolve, reject, timeout });
        socket.send(JSON.stringify({ ...requestData, req_id: id }), (error) => {
            if (!error) return;
            clearTimeout(timeout);
            pending.delete(id);
            reject(new ApiError(502, 'The Deriv verification request could not be sent.'));
        });
    });

    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new ApiError(504, 'Deriv did not respond in time.')), 10000);
            socket.once('open', () => {
                clearTimeout(timeout);
                resolve();
            });
            socket.once('error', () => {
                clearTimeout(timeout);
                reject(new ApiError(502, 'The Deriv verification service is unavailable.'));
            });
        });
        const response = await send({ authorize: token });
        if (!response.authorize?.loginid) throw new ApiError(401, 'The connected account could not be verified.');
        return await task(response.authorize, send);
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(502, 'The Deriv verification service is unavailable.');
    } finally {
        for (const waiter of pending.values()) clearTimeout(waiter.timeout);
        pending.clear();
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close();
        }
    }
}

async function savePresence(accountHash, accountType, currency) {
    await pool.query(
        `INSERT INTO money_print_presence (
            account_hash, account_type, currency, analytics_consent, consented_at
         )
         VALUES ($1, $2, $3, TRUE, NOW())
         ON CONFLICT (account_hash) DO UPDATE
         SET account_type = EXCLUDED.account_type,
             currency = EXCLUDED.currency,
             analytics_consent = TRUE,
             consented_at = COALESCE(money_print_presence.consented_at, NOW()),
             last_seen_at = NOW()`,
        [accountHash, accountType, currency],
    );
}

function makeUserTicket(identity) {
    return signTicket({
        kind: 'user',
        accountHash: identity.accountHash,
        currency: identity.currency,
        exp: Date.now() + USER_SESSION_MS,
    }, sessionKey());
}

function makeAdminTicket() {
    const pin = process.env.MONEY_PRINT_ADMIN_PIN;
    return signTicket({
        kind: 'admin',
        pinVersion: crypto.createHmac('sha256', sessionKey()).update(`pin-version:${pin}`).digest('hex'),
        exp: Date.now() + ADMIN_SESSION_MS,
    }, sessionKey());
}

function hasValidAdminSession(request) {
    if (!process.env.MONEY_PRINT_ADMIN_PIN) return false;
    const ticket = readSignedCookie(request, ADMIN_COOKIE, 'admin');
    if (!ticket) return false;
    const currentVersion = crypto.createHmac('sha256', sessionKey())
        .update(`pin-version:${process.env.MONEY_PRINT_ADMIN_PIN}`)
        .digest('hex');
    return ticket.pinVersion === currentVersion;
}

function getClientIp(request) {
    const forwarded = request.headers['x-forwarded-for'];
    const first = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0];
    return String(first || request.socket.remoteAddress || 'unknown').trim().slice(0, 128);
}

async function isAdminIpLocked(ipHash) {
    const result = await pool.query(
        'SELECT locked_until FROM money_print_admin_attempts WHERE ip_hash = $1',
        [ipHash],
    );
    return Boolean(result.rows[0]?.locked_until && new Date(result.rows[0].locked_until).getTime() > Date.now());
}

async function recordAdminFailure(ipHash) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO money_print_admin_attempts (ip_hash, failure_count, window_started_at)
             VALUES ($1, 0, NOW())
             ON CONFLICT (ip_hash) DO NOTHING`,
            [ipHash],
        );
        const selected = await client.query(
            'SELECT failure_count, window_started_at FROM money_print_admin_attempts WHERE ip_hash = $1 FOR UPDATE',
            [ipHash],
        );
        const row = selected.rows[0];
        const expired = Date.now() - new Date(row.window_started_at).getTime() >= ADMIN_WINDOW_MS;
        const failures = expired ? 1 : Number(row.failure_count) + 1;
        await client.query(
            `UPDATE money_print_admin_attempts
             SET failure_count = $2,
                 window_started_at = CASE WHEN $3 THEN NOW() ELSE window_started_at END,
                 locked_until = CASE WHEN $2 >= $4 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
             WHERE ip_hash = $1`,
            [ipHash, failures, expired, ADMIN_MAX_FAILURES],
        );
        await client.query('COMMIT');
        return failures >= ADMIN_MAX_FAILURES;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

async function getVerifiedTransactions(send, contractIds) {
    const wanted = new Set(contractIds);
    const found = new Map();
    const pageSize = 500;
    const maxPages = 10;
    for (let page = 0; page < maxPages && found.size < wanted.size; page += 1) {
        const response = await send({
            profit_table: 1,
            description: 1,
            limit: pageSize,
            offset: page * pageSize,
            sort: 'DESC',
        });
        const transactions = response.profit_table?.transactions || [];
        for (const transaction of transactions) {
            const id = String(transaction.contract_id || '');
            if (wanted.has(id) && transaction.sell_time) found.set(id, transaction);
        }
        if (transactions.length < pageSize) break;
    }
    return found;
}

function cleanContractIds(value) {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CONTRACT_IDS) {
        throw new ApiError(400, `Send between 1 and ${MAX_CONTRACT_IDS} settled contract IDs.`);
    }
    const deduped = new Map();
    for (const item of value) {
        const id = String(item?.id ?? '');
        if (!/^\d{1,18}$/.test(id) || BigInt(id) <= 0n) continue;
        deduped.set(id, cleanStrategy(item?.strategyMode));
    }
    if (!deduped.size) throw new ApiError(400, 'No valid contract IDs were provided.');
    return deduped;
}

function getTradeFacts(transaction) {
    const buyPrice = Number(transaction.buy_price);
    const sellPrice = Number(transaction.sell_price);
    const purchaseTime = Number(transaction.purchase_time);
    const sellTime = Number(transaction.sell_time);
    if (!Number.isFinite(buyPrice) || buyPrice <= 0 || !Number.isFinite(sellPrice) || !Number.isFinite(sellTime)) {
        return null;
    }
    const profit = sellPrice - buyPrice;
    const duration = extractDuration(transaction);
    return {
        market: String(transaction.underlying_symbol || 'Unknown').slice(0, 32),
        contractType: String(transaction.contract_type || 'UNKNOWN').slice(0, 32),
        barrier: extractBarrier(transaction),
        duration: Number.isInteger(duration.duration) && duration.duration > 0 ? duration.duration : null,
        durationUnit: duration.durationUnit,
        stake: buyPrice,
        profit,
        outcome: profit > 0 ? 'WIN' : profit < 0 ? 'LOSS' : 'BREAKEVEN',
        purchasedAt: Number.isFinite(purchaseTime) && purchaseTime > 0 ? new Date(purchaseTime * 1000) : null,
        settledAt: new Date(sellTime * 1000),
    };
}

async function syncVerifiedTrades(request) {
    requireDatabase();
    requireSameOrigin(request);
    const cookie = readSignedCookie(request, USER_COOKIE, 'user');
    if (!cookie || !cookie.accountHash) throw new ApiError(401, 'Reconnect your Deriv account to sync trades.');
    const body = await readJson(request);
    const contractIds = cleanContractIds(body.contracts);
    const token = getBearerToken(request);

    return withAuthorizedDeriv(token, async (authorize, send) => {
        const identity = deriveIdentity(authorize);
        if (identity.accountHash !== cookie.accountHash) {
            throw new ApiError(403, 'The active account changed. Reconnect before syncing trades.');
        }
        const consent = await pool.query(
            'SELECT analytics_consent FROM money_print_presence WHERE account_hash = $1',
            [identity.accountHash],
        );
        if (consent.rows[0]?.analytics_consent !== true) {
            throw new ApiError(403, 'Opt in to anonymous activity sharing before syncing trade records.');
        }
        await savePresence(identity.accountHash, identity.accountType, identity.currency);
        const verified = await getVerifiedTransactions(send, [...contractIds.keys()]);
        const client = await pool.connect();
        let stored = 0;
        try {
            await client.query('BEGIN');
            for (const [contractId, strategyMode] of contractIds.entries()) {
                const transaction = verified.get(contractId);
                if (!transaction || String(transaction.contract_id) !== contractId) continue;
                const facts = getTradeFacts(transaction);
                if (!facts) continue;
                await client.query(
                    `INSERT INTO money_print_trades (
                        account_hash, contract_id, currency, market, contract_type,
                        strategy_mode, barrier, duration, duration_unit, stake,
                        profit, outcome, purchased_at, settled_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    ON CONFLICT (account_hash, contract_id) DO UPDATE SET
                        currency = EXCLUDED.currency,
                        market = EXCLUDED.market,
                        contract_type = EXCLUDED.contract_type,
                        strategy_mode = COALESCE(EXCLUDED.strategy_mode, money_print_trades.strategy_mode),
                        barrier = EXCLUDED.barrier,
                        duration = EXCLUDED.duration,
                        duration_unit = EXCLUDED.duration_unit,
                        stake = EXCLUDED.stake,
                        profit = EXCLUDED.profit,
                        outcome = EXCLUDED.outcome,
                        purchased_at = EXCLUDED.purchased_at,
                        settled_at = EXCLUDED.settled_at`,
                    [
                        identity.accountHash,
                        contractId,
                        identity.currency,
                        facts.market,
                        facts.contractType,
                        strategyMode,
                        facts.barrier,
                        facts.duration,
                        facts.durationUnit,
                        facts.stake,
                        facts.profit,
                        facts.outcome,
                        facts.purchasedAt,
                        facts.settledAt,
                    ],
                );
                stored += 1;
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
        return { stored, checked: contractIds.size };
    });
}

async function loadRankings(expression) {
    const result = await pool.query(
        `SELECT ${expression} AS label,
                currency,
                COUNT(*)::INTEGER AS trades,
                COUNT(*) FILTER (WHERE outcome = 'WIN')::INTEGER AS wins,
                COUNT(*) FILTER (WHERE outcome = 'LOSS')::INTEGER AS losses,
                COALESCE(SUM(profit), 0)::FLOAT8 AS net_profit,
                CASE WHEN COUNT(*) = 0 THEN NULL
                     ELSE ROUND(COUNT(*) FILTER (WHERE outcome = 'WIN')::NUMERIC * 100 / COUNT(*), 1)::FLOAT8
                END AS win_rate
         FROM money_print_trades
         WHERE settled_at >= NOW() - INTERVAL '30 days'
           AND account_hash IN (
               SELECT account_hash FROM money_print_presence WHERE analytics_consent = TRUE
           )
         GROUP BY ${expression}, currency
         HAVING COUNT(DISTINCT account_hash) >= 5
         ORDER BY win_rate DESC NULLS LAST, COUNT(*) DESC
         LIMIT 5`,
    );
    return result.rows.map((row) => ({
        label: String(row.label),
        currency: String(row.currency),
        trades: Number(row.trades),
        wins: Number(row.wins),
        losses: Number(row.losses),
        netProfit: Number(row.net_profit),
        winRate: row.win_rate == null ? null : Number(row.win_rate),
    }));
}

async function loadAdminAnalytics() {
    requireDatabase();
    const [
        presence,
        totals,
        profitByCurrency,
        bestMarkets,
        bestStrategies,
        bestTradeTypes,
        bestBarriers,
        bestDurations,
    ] = await Promise.all([
        pool.query(
            `SELECT COUNT(*)::INTEGER AS total,
                    COUNT(*) FILTER (WHERE account_type = 'demo')::INTEGER AS demo,
                    COUNT(*) FILTER (WHERE account_type = 'real')::INTEGER AS real
             FROM money_print_presence
             WHERE analytics_consent = TRUE
               AND last_seen_at >= NOW() - INTERVAL '10 minutes'`,
        ),
        pool.query(
            `SELECT COUNT(*)::INTEGER AS trades,
                    COUNT(*) FILTER (WHERE outcome = 'WIN')::INTEGER AS wins,
                    COUNT(*) FILTER (WHERE outcome = 'LOSS')::INTEGER AS losses,
                    COUNT(DISTINCT account_hash)::INTEGER AS accounts
             FROM money_print_trades
             WHERE settled_at >= NOW() - INTERVAL '30 days'
               AND account_hash IN (
                   SELECT account_hash FROM money_print_presence WHERE analytics_consent = TRUE
               )`,
        ),
        pool.query(
            `SELECT currency,
                    COALESCE(SUM(profit), 0)::FLOAT8 AS net_profit,
                    COUNT(DISTINCT account_hash)::INTEGER AS accounts
             FROM money_print_trades
             WHERE settled_at >= NOW() - INTERVAL '30 days'
               AND account_hash IN (
                   SELECT account_hash FROM money_print_presence WHERE analytics_consent = TRUE
               )
             GROUP BY currency
             HAVING COUNT(DISTINCT account_hash) >= 5
             ORDER BY currency`,
        ),
        loadRankings('market'),
        loadRankings(`COALESCE(strategy_mode, 'Not recorded')`),
        loadRankings('contract_type'),
        loadRankings(`COALESCE(barrier, 'Unspecified')`),
        loadRankings(`CASE WHEN duration IS NULL THEN 'Unspecified'
                           ELSE duration::TEXT || COALESCE(duration_unit, 't') END`),
    ]);

    const active = presence.rows[0] || {};
    const tradeTotals = totals.rows[0] || {};
    const activeAccounts = Number(active.total || 0);
    const demoAccounts = Number(active.demo || 0);
    const realAccounts = Number(active.real || 0);
    const tradeAccountCount = Number(tradeTotals.accounts || 0);
    const activeSuppressed = activeAccounts < 5;
    const tradesSuppressed = tradeAccountCount < 5;
    return {
        activeAccounts10m: activeSuppressed ? null : activeAccounts,
        demoAccounts10m: demoAccounts < 5 ? null : demoAccounts,
        realAccounts10m: realAccounts < 5 ? null : realAccounts,
        settledTrades: tradesSuppressed ? null : Number(tradeTotals.trades || 0),
        wins: tradesSuppressed ? null : Number(tradeTotals.wins || 0),
        losses: tradesSuppressed ? null : Number(tradeTotals.losses || 0),
        privacySuppressed: activeSuppressed || tradesSuppressed
            || demoAccounts < 5 || realAccounts < 5,
        netProfitByCurrency: profitByCurrency.rows.map((row) => ({
            currency: String(row.currency),
            netProfit: Number(row.net_profit),
        })),
        bestMarkets,
        bestStrategies,
        bestTradeTypes,
        bestBarriers,
        bestDurations,
        updatedAt: new Date().toISOString(),
    };
}

async function handleApi(request, response, url) {
    const { pathname } = url;

    if (pathname === '/api/healthz' && request.method === 'GET') {
        let database = 'unavailable';
        if (pool) {
            try {
                await pool.query('SELECT 1');
                database = 'ready';
            } catch {
                database = 'unavailable';
            }
        }
        return sendJson(response, 200, { ok: true, database });
    }

    if (pathname === `${API_PREFIX}/presence` && request.method === 'POST') {
        requireDatabase();
        requireSameOrigin(request);
        const body = await readJson(request);
        if (body.analyticsConsent !== true) {
            throw new ApiError(400, 'Explicit analytics consent is required.');
        }
        const token = getBearerToken(request);
        return withAuthorizedDeriv(token, async (authorize) => {
            const identity = deriveIdentity(authorize);
            await savePresence(identity.accountHash, identity.accountType, identity.currency);
            setCookie(
                request,
                response,
                USER_COOKIE,
                makeUserTicket(identity),
                Math.floor(USER_SESSION_MS / 1000),
                API_PREFIX,
            );
            return sendJson(response, 200, { ok: true });
        });
    }

    if (pathname === `${API_PREFIX}/consent` && request.method === 'DELETE') {
        requireDatabase();
        requireSameOrigin(request);
        const token = getBearerToken(request);
        return withAuthorizedDeriv(token, async (authorize) => {
            const identity = deriveIdentity(authorize);
            await pool.query('DELETE FROM money_print_presence WHERE account_hash = $1', [identity.accountHash]);
            clearCookie(request, response, USER_COOKIE, API_PREFIX);
            return sendJson(response, 200, { ok: true, deleted: true });
        });
    }

    if (pathname === `${API_PREFIX}/trades` && request.method === 'POST') {
        const result = await syncVerifiedTrades(request);
        return sendJson(response, 200, { ok: true, ...result });
    }

    if (pathname === `${API_PREFIX}/admin/unlock` && request.method === 'POST') {
        requireDatabase();
        requireSameOrigin(request);
        const configuredPin = process.env.MONEY_PRINT_ADMIN_PIN;
        if (!configuredPin) throw new ApiError(503, 'The admin lock has not been configured in workspace Secrets.');
        const ipHash = hashIp(getClientIp(request), sessionKey());
        if (await isAdminIpLocked(ipHash)) {
            throw new ApiError(429, 'Too many failed attempts. Try again after 15 minutes.');
        }
        const body = await readJson(request);
        const pin = typeof body.pin === 'string' ? body.pin : '';
        const { constantTimeStringEqual } = require('./security');
        if (!constantTimeStringEqual(pin, configuredPin)) {
            const locked = await recordAdminFailure(ipHash);
            throw new ApiError(locked ? 429 : 401, locked
                ? 'Too many failed attempts. Try again after 15 minutes.'
                : 'The PIN was not accepted.');
        }
        await pool.query('DELETE FROM money_print_admin_attempts WHERE ip_hash = $1', [ipHash]);
        setCookie(
            request,
            response,
            ADMIN_COOKIE,
            makeAdminTicket(),
            Math.floor(ADMIN_SESSION_MS / 1000),
            `${API_PREFIX}/admin`,
        );
        return sendJson(response, 200, { ok: true });
    }

    if (pathname === `${API_PREFIX}/admin/lock` && request.method === 'POST') {
        requireSameOrigin(request);
        clearCookie(request, response, ADMIN_COOKIE, `${API_PREFIX}/admin`);
        return sendJson(response, 200, { ok: true });
    }

    if (pathname === `${API_PREFIX}/admin/analytics` && request.method === 'GET') {
        requireDatabase();
        if (!hasValidAdminSession(request)) throw new ApiError(401, 'Unlock Admin Insights to continue.');
        const analytics = await loadAdminAnalytics();
        return sendJson(response, 200, analytics);
    }

    if (pathname.startsWith('/api/')) {
        return sendJson(response, 404, { error: 'API route not found.' });
    }
    return false;
}

function contentType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    return ({
        '.css': 'text/css; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.ico': 'image/x-icon',
        '.jpeg': 'image/jpeg',
        '.jpg': 'image/jpeg',
        '.js': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
    })[extension] || 'application/octet-stream';
}

function serveStatic(request, response, url) {
    if (process.env.SERVE_STATIC === 'false' || !['GET', 'HEAD'].includes(request.method)) {
        return sendJson(response, 404, { error: 'Not found.' });
    }
    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        return sendJson(response, 400, { error: 'Invalid path.' });
    }
    const requestedPath = path.resolve(DIST_DIR, `.${pathname}`);
    const relativePath = path.relative(DIST_DIR, requestedPath);
    if (
        relativePath === '..' ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
    ) {
        return sendJson(response, 400, { error: 'Invalid path.' });
    }
    let filePath = requestedPath;
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        if (path.extname(pathname)) return sendJson(response, 404, { error: 'Not found.' });
        filePath = path.join(DIST_DIR, 'index.html');
    }
    if (!fs.existsSync(filePath)) return sendJson(response, 503, { error: 'The app has not been built yet.' });
    const isHtml = filePath.endsWith('.html');
    response.writeHead(200, {
        'content-type': contentType(filePath),
        'cache-control': isHtml ? 'no-store' : 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
    });
    if (request.method === 'HEAD') return response.end();
    return fs.createReadStream(filePath).pipe(response);
}

function createServer() {
    return http.createServer(async (request, response) => {
        const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
        try {
            const handled = await handleApi(request, response, url);
            if (handled !== false) return;
            return serveStatic(request, response, url);
        } catch (error) {
            const status = error instanceof ApiError ? error.status : 500;
            if (status === 500) console.error(`Money Print API request failed: ${url.pathname}`);
            return sendJson(response, status, {
                error: error instanceof ApiError ? error.message : 'The request could not be completed.',
            });
        }
    });
}

if (require.main === module) {
    const server = createServer();
    server.listen(PORT, HOST, () => {
        console.log(`Money Print server listening on ${PORT}`);
    });
    const shutdown = () => {
        server.close(() => {
            if (pool) pool.end().finally(() => process.exit(0));
            else process.exit(0);
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

module.exports = { createServer, getTradeFacts, loadAdminAnalytics };
