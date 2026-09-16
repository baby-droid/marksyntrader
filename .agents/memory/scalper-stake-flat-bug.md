---
name: Scalper flat-stake race condition (stop/run teardown race)
description: Why terminal-computed martingale stakes could stay flat after a loss across all scalper XMLs, and the fix applied centrally in runXmlBotCycle.
---

## Symptom
Transaction history showed several consecutive losing contracts all at the exact same stake — martingale/RM stake escalation computed by the terminal (`scalper-bots/index.tsx`) never reached the actual executed trade.

## Root cause
`globalObserver.emit('bot.stop')` fires from inside bot-skeleton's `terminateSession()` (`services/tradeEngine/utils/interpreter.js`) *before* teardown (unsubscribe, `api_base.is_stopping` reset) finishes. `DBot.stopBot()` (`scratch/dbot.js`) only recreates a fresh interpreter (`this.interpreter = Interpreter()`) *after* that teardown promise resolves.

The terminal's `runXmlBotCycle` resolves its cycle Promise as soon as it observes `bot.stop` (this early-fired event), then immediately patches workspace params and calls `onRunButtonClick()` again for the next trade. This can race the still-in-progress teardown: `DBot.runBot()` no-ops while `api_base.is_stopping` is still true, or reuses a stale/not-yet-reset interpreter — so the freshly patched stake/martingale value silently never reaches the real trade.

**Why:** the whole scalper architecture force-stops the XML bot after every single loss (terminal owns the retry/martingale loop, not the XML's own `trade_again`), so this stop→run cycle repeats on every loss — any race here compounds every consecutive loss.

**How to apply:** `runXmlBotCycle` now polls `api_base.is_stopping` (from `@/external/bot-skeleton`) and waits for it to clear (up to 3s) before patching params and firing the next run. This is a single fix point shared by all 42 scalper XMLs (no per-file XML edits needed) since they all go through this one function. Not yet verified against a live trading session — only checked for build/compile correctness — because there is no way to run real Deriv trades in this environment; ask the user to confirm stake escalation on their next real run.
