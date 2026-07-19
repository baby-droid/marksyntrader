---
name: Copy-trading source detection and replication bugs
description: Root causes and fixes for copy-trading not mirroring master trades to followers.
---

# Copy-trading replication bugs

## Bug 1 — source detection (fixed in prior session)
`api_base.account_info.is_virtual` was undefined because `account_type` was computed AFTER `account_info` was assigned.
All signals carried `source: 'real'`, so demo-mode copies were silently dropped.

**Fix:** Use `getMasterSource()` from `trade-bus.ts` everywhere (reads `localStorage.account_type` set by api-base after auth).

## Bug 2 — `subscribeMasterTransactions` wrong callback argument (critical)
`api.onMessage().subscribe(callback)` passes the **raw parsed WS object** directly as the argument — NOT wrapped in `{ data }`.

Bad:
```js
api.onMessage().subscribe(({ data: d }) => { ... })
// d is always undefined → every transaction silently skipped
```

Good:
```js
api.onMessage().subscribe((msg: any) => {
    if (!msg?.transaction) return;
    // msg IS the WS data
})
```

## Bug 3 — wrong transaction field name (critical)
Deriv docs: transaction stream uses `action`, not `action_type`.

Bad: `if (txn.action_type !== 'buy') return;`
Good: `if (txn.action !== 'buy') return;`

## Bug 4 — duplicate transaction subscription
`api_base.ts` already subscribes to `transaction` on startup.
Sending another `{ transaction: 1, subscribe: 1 }` causes `AlreadySubscribed` error from Deriv.
Solution: remove the extra `api.send({ transaction: 1, subscribe: 1 })` — just attach `onMessage()` listener; events already flow.

## Bug 5 — two-step proposal→buy too slow for tick contracts
The original follower buy used `proposal` → get ID → `buy` (two round-trips).
For 1–5 tick contracts this races the expiry.

**Fix:** Use `buy: "1"` with inline `parameters` — single round-trip:
```js
{ buy: '1', price: stake, parameters: { amount, basis, contract_type, currency, duration, duration_unit, underlying_symbol, barrier? } }
```
`buy:"1"` is valid per Deriv buy request schema `^(?:[\w-]{32,128}|1)$`.

## Signal flow
Master trade → `publishMasterTrade` (hooks + copy-trade-bridge) → `onMasterTrade` → follower WS buy.
Backup: `api.onMessage()` catches `transaction.action==="buy"` → POC fetch → `publishMasterTrade` (deduped by contract_id).

**Why:**
- `'real'`/`'demo'` source must match `masterSourceFor(mode)` or the signal is dropped by the mode filter.
- Direct hook publish is the fast path (all params available immediately).
- Transaction stream backup catches trades from any UI path that bypasses hooks.

**How to apply:**
- Never use `api_base.account_info.is_virtual` for source — use `getMasterSource()`.
- Never send a `{ transaction: 1, subscribe: 1 }` separately — api_base handles it; just listen with `onMessage()`.
- Always check Deriv docs for field names (action not action_type, underlying_symbol not symbol in proposals).
