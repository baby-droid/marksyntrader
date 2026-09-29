---
name: King Fisher continuation
description: Why King Fisher bots need explicit after-purchase continuation.
---

King Fisher's generated after-purchase function must return true and emit `Bot.isTradeAgain(true)` after every settled contract. Do not rely only on a nested `trade_again` block: TP/SL control-flow branches can bypass that block and make the interpreter exit after one run.

**Why:** The DBot interpreter repeats only when `BinaryBotPrivateAfterPurchase` returns true; the run-panel listener also stops the bot when it receives a false trade-again event.

**How to apply:** Preserve the user's explicit Stop action, but make King Fisher continuation unconditional if the strategy is intended to run through both wins and losses. Keep stake/martingale updates in the workspace flow.