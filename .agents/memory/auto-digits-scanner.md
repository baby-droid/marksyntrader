---
name: Auto-Digits scanner
description: Design and trading integration rules for the Auto-Digits dashboard
---

Auto-Digits is a scanner-first page, not a second WebSocket or independent trading engine. It uses the authenticated `useDerivTrade` stream, recalculates digits from the live pip size, validates a signal against the next real tick twice, and calls `buyContract` only after the two-step virtual gate passes.

**Why:** The page must trade on the user's already-authorized demo or real account and keep the native Bot Builder transaction surface authoritative.

**How to apply:** Keep page-level analytics and recovery state local, but route every real contract through `useDerivTrade.buyContract` with `metadata.source = 'Auto-Digits'` and a `batch_id` so `transactions-store` receives the normal `bot.contract` events.

When the selected contract type, entry logic, or score threshold changes, invalidate all cached market candidates and the virtual validation key before accepting another entry. Validate the live tick against the resolved contract type and its market-derived barrier, not only the strategy label.

**Why:** A stale candidate can otherwise survive a configuration change and trade an old contract type or barrier under the new UI selection.

**How to apply:** Clear the candidate map and validation state on configuration changes, build the validation key from market + contract type + barrier, and use that same resolved contract data for the live condition check.