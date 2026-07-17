---
name: Scalper TP/SL, Deactivate Limit, and ALL_MARKETS
description: Key architecture decisions for scalper stop conditions and market list expansion.
---

## TP/SL always enforced
`tpGuard: true` is always passed in the `runXmlBotCycle` params (not `cfg.tpGuard`). The UI toggle still exists for user feedback but the actual enforcement is unconditional. Both TP and SL checks use `sessionPnlRef.current` (the running session total shown in Summary).

**Why:** User wants the Summary P/L panel to be the source of truth for TP/SL. If `tpGuard` was optional, users with it OFF would have no protection.

## Conservative losses (loss_limit) stops VPS too
When `cycle.reason === 'loss_limit'` fires, we `break` the OUTER run loop immediately — same as TP/SL. VPS auto-restart does NOT fire (the outer loop is what VPS calls). Previously it fell through to loss handling and VPS would restart.

## Deactivate Limit checks BOTH wins and losses
After each cycle settles, check: `if (winsRef.current >= cfg.riskManager.deactivateLimit || lossesRef.current >= cfg.riskManager.deactivateLimit)`. This stops trading when EITHER wins OR losses hit the threshold. Old behavior was only consecutive-loss RM check in `computeNextStake`.

**Why:** User wants deactivate limit to mean "stop trading once session reaches N wins OR N losses in total".

## symbolToSubmarket helper
Added `symbolToSubmarket(sym)` utility function before `patchXmlContent`. Rules:
- `JD*` → `jump_index`
- `BOOM*`, `CRASH*` → `daily_reset_index`
- `RDBEAR`, `RDBULL` → `daily_reset_index`
- `STPX` → `step_index`
- `RB*` → `range_break_index`
- else → `random_index` (Volatility 1s and plain)

Used in BOTH `patchXmlContent` and `patchWorkspaceParams` wherever SUBMARKET_LIST is set.

## ALL_MARKETS expansion
Added to scalper ALL_MARKETS constant (and pro-hedge MARKETS): RDBEAR, RDBULL, BOOM300N, BOOM500, BOOM1000, CRASH300N, CRASH500, CRASH1000, STPX, RB100, RB200.
