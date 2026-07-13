---
name: Scalper Bots architecture
description: How the built-in AHMED SCALPER BOTS page actually trades (JS engine, not the Blockly interpreter)
---

The terminal log in src/pages/scalper-bots/index.tsx is the SOLE trading engine — its
`startBot` loop calls `useDerivTrade().buyContract()` directly over the WebSocket API.
It also loads the bot's default XML into the shared Bot Builder workspace
(`onPreloadXml`) so the workspace visually shows the "locked" bot, but it must NEVER
call `rp.onRunButtonClick()`/`autoRun()` to actually start the Blockly interpreter —
doing so starts a second, independent trading engine (the interpreter keeps trading
on its own loop once started) that runs in parallel with the JS engine's own
buyContract calls, causing duplicate purchases and apparent "contract type drift"
(a stale interpreter run from a previously-viewed bot keeps trading its own contract
type/stake in the background after you've moved on to a different scalper).

**Why:** this was a real, shipped bug — the loop fired `autoRun(curMarket)` on every
entry signal, so any prior background bot run (from Free Bots, an earlier scalper, or
a stray manual Bot Builder Run) kept executing indefinitely and traded alongside the
terminal's own purchases with a different/stale contract type and default XML stake.

**How to apply:** keep exactly one purchase path (the JS loop's buyContract). Treat
`onPreloadXml`/workspace sync as cosmetic only. If asked to make the terminal "drive"
the real Bot Builder bot, that requires generating dynamic XML matching the terminal's
config (stake, martingale, recovery-limit) — not just clicking Run on a static preset.

Single vs "multiple" bot variants must share the exact same XML file per
contract-type+prediction — manifest.json's `multiple: true` entries were previously
pointing at separate `-multiple-scalper.xml` files (some of which, e.g.
even-multiple-scalper.xml, weren't even valid Blockly XML — a different JSON schema
entirely, silently broken). Fixed by repointing every multiple variant's `xmlFile` to
its single counterpart and deleting the orphaned multiple XML files; the single/multi
behavioral difference lives entirely in the JS runtime (multi-market parallel scan +
`bot.multiple` continuing after a win) — never in the XML.

Recovery-limit semantics: the Strategy Logic (LDP) engine's `evaluateStrategyLogic`
takes an `inRecovery` flag — when true (after a loss, before the next win) each
condition uses `cond.recoveryLimit` instead of `cond.ifLast` as the required
confirming-tick streak length, while `digitsIs`/`digitValue` (i.e. contract
type/barrier) never change. Strategy Logic is now active-by-default for every
category (Over/Under got a `newCondition` mirroring the old hardcoded `checkEntry`
thresholds), not just Even/Odd, so recovery-limit applies uniformly.

Market 2 (`cfg.market2`): a fully independent alternate slot — own market symbol,
stake, martingale, take-profit, barrier — engaged instead of the plain market-list
cycle when the Market-1 consecutive-loss switch limit is hit; a win on Market 2
returns control to Market 1. Contract type is always locked to `bot.contractType`
regardless of which slot/market is active — only stake/martingale/TP/barrier swap.
