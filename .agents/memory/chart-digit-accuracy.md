---
name: Chart digit accuracy — pip_size, dedup, server-side forget
description: Root causes and fixes for wrong digit stats on chart page tick subscription
---

## Rule
Never compute pip_size from history price string length (`dotIdx`). Always use `tick.pip_size` from the first live tick.

**Why:** History prices like `9378` (integer) give `dotIdx = -1` → `ps = 0` → all digits compute as 0, polluting stats until a live tick arrives and corrects it. String-length detection also breaks for prices with varying decimal places.

**How to apply:**
1. Subscribe to live ticks FIRST.
2. On the first live tick, capture `tick.pip_size` into `pipSizeRef`.
3. Only then fetch `ticks_history` and compute digits using the captured `pipSizeRef.current`.
4. Deduplicate history vs live stream using epoch timestamps stored in a `Set<number>`.

## Server-side subscription forget
RxJS `.unsubscribe()` only cancels the local observer — it does NOT send a `forget` to the Deriv server. The server keeps streaming ticks, which pile up as stale callbacks on the next symbol subscription.

**Fix:** Track `res.subscription.id` from the first live message. On effect cleanup, send `api.send({ forget: subscriptionId })`.

## Retry pattern
If `api_base.api` is null on mount, use a `setTimeout(startSub, 500)` retry loop inside the effect. Keep an `alive` flag and clear the timer in the effect's cleanup so it doesn't fire after unmount.

## Buffer pattern for pre-history live ticks
Between "start subscription" and "history arrives", live ticks come in with no baseline array. Push them into `liveDigitsBuffer: number[]`. When history arrives, merge: `[...filteredHistory, ...liveDigitsBuffer].slice(-1000)`.
