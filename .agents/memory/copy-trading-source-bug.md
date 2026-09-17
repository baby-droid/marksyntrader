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

**Fix:** Use `buy: "1"` with inline `parameters` — single round-trip (primary); auto-fall back to proposal→buy only if server rejects:
```js
// Primary (1 RTT):
{ buy: '1', price: stake * 2, parameters: { amount, basis, contract_type, currency, duration, duration_unit, underlying_symbol, barrier? } }
// Fallback (2 RTTs): proposal → buy: pid
```
`buy:"1"` is valid per Deriv buy request schema `^(?:[\w-]{32,128}|1)---
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

.
The `DerivAPIBasic` library rejects `buy:"1"` with params — raw OTP WS does NOT. Followers use raw WS (`wsSend`).
`price` must be set to a permissive value (e.g. `stake * 2`) — actual charge for binary options is always the stake.

## Bug 6 — wrong tick_count field name
`proposal_open_contract` response uses `tick_count` (not `ticks_count`, not `duration`) for tick contracts.
Both `copy-trade-bridge.ts` and `copy-trading.ts` transaction fallback had `ticks_count` which is undefined → fell through to `?? 5` hardcoded default.
**Fix:** `contract.tick_count ?? contract.duration ?? 1` in both files.

## Bug 7 — transaction backup path was self-defeating
`subscribeMasterTransactions` added `contract_id` to `mirroredContracts` BEFORE calling `publishMasterTrade`.
`onMasterTrade` then saw it as "already mirrored" and skipped — backup never placed follower trades.
**Fix:** use a LOCAL `txnSeen` set inside `subscribeMasterTransactions` for event-level dedup; let `onMasterTrade` own `mirroredContracts`.

## Bug 8 — global restore never ran off the copy-trading page
`restoreState()` was only called in the copy-trading page `useEffect`. Refreshing on any other tab = engine dead.
**Fix:** `main.tsx` `AppWrapper` calls `copyEngine.restoreState()` + `mirrorEngine.restoreState()` in a mount-only `useEffect`. Added `restoring` flag to `CopyEngine` to prevent concurrent double-restore.

## Bug 9 — signal published too late (after master's full buy round-trip)
Signal was published after master's buy was confirmed (2 RTTs elapsed). Follower then added 1 more RTT = entered 1 tick late.
**Fix:** publish signal right after proposal accepted (before buy) — follower and master buy requests are in-flight simultaneously. Engine deduplicates via 5-second fingerprint window (`recentSignals` map keyed by `symbol|contract_type|duration|barrier`).

## Expiry
All persistence is now 72 h (`EXPIRE_MS = 72 * 60 * 60 * 1000`) in both `copy-trading.ts` and `copy-trading/index.tsx`.

## Signal flow (current)
1. Master sends proposal → proposal accepted
2. `publishMasterTrade` fires immediately (no contract_id) → `onMasterTrade` → followers fire direct buy (1 RTT)
3. Master sends buy (simultaneously) → buy confirmed
4. Transaction stream backup: POC fetch → `publishMasterTrade` (with contract_id) → `onMasterTrade` → fingerprint dedup skips it (same trade within 5 s)

**Dedup layers in `onMasterTrade`:**
- Layer 1: `mirroredContracts.has(contract_id)` — catches confirmed signals with known contract_id
- Layer 2: `recentSignals` fingerprint (`symbol|contract_type|duration|barrier`) within 5 s — catches early signals without contract_id

**How to apply:**
- Never use `api_base.account_info.is_virtual` for source — use `getMasterSource()`.
- Never send `{ transaction: 1, subscribe: 1 }` separately — api_base handles it; just listen with `onMessage()`.
- Never add to `mirroredContracts` outside of `onMasterTrade` — that breaks the backup path.
- Publish signal after proposal (not after buy) for same-tick entry.
