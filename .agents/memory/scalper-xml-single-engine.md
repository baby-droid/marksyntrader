---
name: Scalper terminal → single XML trading engine
description: How the scalper-bots terminal now triggers real trades, to keep consistent with future changes to startBot/runXmlBotCycle.
---

The scalper terminal (src/pages/scalper-bots/index.tsx) no longer buys contracts
itself via `derivTrade.buyContract`. It only does tick-based entry-signal
detection (`checkEntry`/`evaluateStrategyLogic`), then clicks the REAL Bot
Builder Run button (`store.run_panel.onRunButtonClick()`) so the loaded XML's
own `before_purchase`/`after_purchase`/`trade_again` blocks place the actual
trade. There is exactly one buyer now — never re-add a direct-buy path here
without removing this design, or duplicate purchases will happen again.

**Why:** user explicitly required a single XML-driven engine to eliminate the
double-trade risk between the terminal's old direct-buy loop and the visible
Bot Builder bot; also required stop-on-first-win / continue-recovery-on-loss
XML martingale semantics (win branch doesn't call `trade_again`, loss branch
does — confirmed in the scalper XML files, e.g. over-5-scalper.xml).

**How to apply:** `patchWorkspaceParams`/`runXmlBotCycle` (in `BotDetail`)
sync market/stake/martingale/prediction into the already-loaded Blockly
workspace by field name (not by reloading XML) right before firing, then
listen to `globalObserver` events `'bot.contract'` (only process when
`isEnded(contract)` — fires multiple times per contract until settled),
`'bot.stop'`, and `'Error'` — call `store.run_panel.onStopButtonClick()` to
force-stop the XML's internal loop when TP/SL/consecutive-loss-limit trips,
since the XML has no such guard on its own. Confirmed real event names via
grep of `src/external/bot-skeleton` emitters — don't guess these, they're
easy to get subtly wrong (e.g. `'bot.contract'` from broadcast.js, `'bot.stop'`
from interpreter.js, `'Error'` from dbot.js/api-base.ts).
