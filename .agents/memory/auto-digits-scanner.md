---
name: Auto-Digits scanner
description: Design and trading integration rules for the Auto-Digits dashboard
---

Auto-Digits is a scanner-first page, not a second WebSocket or independent trading engine. It uses the authenticated `useDerivTrade` stream, recalculates digits from the live pip size, validates a signal against the next real tick twice, and calls `buyContract` only after the two-step virtual gate passes.

**Why:** The page must trade on the user's already-authorized demo or real account and keep the native Bot Builder transaction surface authoritative.

**How to apply:** Keep page-level analytics and recovery state local, but route every real contract through `useDerivTrade.buyContract` with `metadata.source = 'Auto-Digits'` and a `batch_id` so `transactions-store` receives the normal `bot.contract` events.