---
name: NDP moved into Algorithm dropdown + VPS restart fix
description: NDP is now a per-condition Algorithm option (not a global accordion); VPS auto-restart was silently broken by a stale DOM selector.
---

## NDP as an Algorithm option
- `NDP` was originally a separate always-visible accordion (`cfg.ndp` global config) gating entry on top of whatever the strategy logic decided.
- Moved to be a value in `ALGORITHM_OPTIONS` (alongside LDP, Market Percentage, Sequence Radar, Complex Patterns, Entry Point Pattern) in `src/pages/scalper-bots/index.tsx`, so it's selected per-condition like any other algorithm, with its own `ldpWindow`/`ndpWindow` fields on `StrategyCondition` (not global `BotConfig.ndp` — that field/type was removed entirely).
- `checkNDP()` no longer reads a `NdpConfig` object; it takes `ldpWindow`/`ndpWindow` directly and is invoked from `evaluateSingleCondition` via an optional `ctx: { prices, contractType, prediction }` param (added to `evaluateSingleCondition`/`evaluateStrategyLogic` signatures) since NDP needs price data for CALL/PUT that other algorithms don't.

**Why:** user wants NDP to behave like a first-class selectable strategy, not an always-on secondary gate stacked on every other algorithm.

**Update:** user later asked for NDP to use the exact same fields as LDP (If Last / Digits Is / Strict / Recovery Limit), not its own ldpWindow/ndpWindow pair. NDP's evaluation is now folded into the same switch-case as LDP in `evaluateSingleCondition` (identical strict/majority streak logic) — it's kept as a separate algorithm value purely so a user can add it as a second AND condition alongside an LDP condition in one OR group; the group's existing `every()` AND-logic already enforces "both LDP and NDP must be met to enter." The old two-window `checkNDP()` helper and its ctx-based special case were deleted as dead code.

## VPS auto-restart DOM-selector bug
- `VpsMode`'s auto-restart called `document.querySelector('.sb-run-btn')` to re-click Run — but no element in the scalper bot UI ever had that class (the real button is `.sb-detail__start-btn` calling the component's own `startBot()`). The restart silently no-op'd.
- Fixed by calling `startBot()` directly from the `onRequestRestart` callback in `index.tsx` instead of a DOM query.

**Why:** DOM-selector-based "click the button" patterns are fragile in this codebase — prefer calling the underlying handler function directly when it's in scope.
