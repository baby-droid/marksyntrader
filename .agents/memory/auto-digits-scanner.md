---
name: Auto-Digits scanner
description: Design and trading integration rules for the Auto-Digits dashboard
---

Auto-Digits is a scanner-first page, not a second WebSocket or independent trading engine. It uses the authenticated `useDerivTrade` stream, loads its market selector from Deriv's active-symbols response, recalculates digits from the live pip size, validates a signal against the next real tick twice, and calls `buyContract` only after the two-step virtual gate passes.

**Why:** The page must trade on the user's already-authorized demo or real account and keep the native Bot Builder transaction surface authoritative.

**How to apply:** Keep page-level analytics and recovery state local, but route every real contract through `useDerivTrade.buyContract` with `metadata.source = 'Auto-Digits'` and a `batch_id` so `transactions-store` receives the normal `bot.contract` events.

When the selected contract type, entry logic, or score threshold changes, invalidate all cached market candidates and the virtual validation key before accepting another entry. Validate the live tick against the resolved contract type and its market-derived barrier, not only the strategy label.

**Why:** A stale candidate can otherwise survive a configuration change and trade an old contract type or barrier under the new UI selection.

**How to apply:** Clear the candidate map and validation state on configuration changes, build the validation key from market + contract type + barrier, and use that same resolved contract data for the live condition check.

In AUTO mode, score every supported concrete strategy (parity, digit, barrier, direction, and tick/range) for each subscribed market, then select the highest score that clears the configured threshold. A selected market subscribes only to that symbol; scan-all subscribes to the open symbols returned by active_symbols.

**Why:** The user expects AUTO to find whichever strategy is currently qualified instead of routing through a partial hardcoded heuristic or silently ignoring the chosen market.

**How to apply:** Keep the active-symbol request and tick subscriptions on the existing authenticated hook; never open a second public WebSocket for Auto-Digits.

AUTO execution ranks live candidates rather than forcing a fixed rotation. After a loss, recovery is limited to Over/Under, Even/Odd, Rise/Fall; Matches is normal-mode only and needs an exceptional score.

**Why:** Matches has a low hit rate and compounding it during recovery can rapidly consume the account; fixed rotation also sends stale or weak contracts.

**How to apply:** Re-rank after every settlement, use the live score as the primary selector, use the configured order only for ties, and keep the recovery contract allowlist fail-closed.

Auto-Digits risk controls should treat the manual stake as the base, cap each order by available balance and reserve percentage, enforce a session loss limit, and scale auto-stake down as take-profit progress increases.

**Why:** Martingale recovery must not be allowed to consume the account, and nearing the target is a reason to reduce exposure rather than increase it.

**How to apply:** Require an authoritative balance before real execution, stop at the reserve/take-profit/loss floors, activate auto-stake only after the warm-up run count, and reduce recovery stake after wins.