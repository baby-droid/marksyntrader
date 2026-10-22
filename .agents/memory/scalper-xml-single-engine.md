---
name: Scalper terminal → single XML trading engine
description: How the scalper-bots terminal now triggers real trades, to keep consistent with future changes to startBot/runXmlBotCycle.
---

The scalper terminal (src/pages/scalper-bots/index.tsx) no longer buys contracts
itself via `derivTrade.buyContract`. It only does tick-based entry-signal
detection (`checkEntry`/`evaluateStrategyLogic`), then clicks the REAL Bot
Builder Run button (`store.run_panel.onRunButtonClick()`) so the loaded XML's
`before_purchase`/`after_purchase` blocks place the actual trade and update
stake. There is exactly one buyer now — never re-add a direct-buy path here
without removing this design, or duplicate purchases will happen again.

**Why:** user explicitly required a single XML-driven engine to eliminate the
double-trade risk between the terminal's old direct-buy loop and the visible
Bot Builder bot. The terminal owns the recovery cycle, so scalper XMLs must
keep restart-on-error disabled and must not auto-repeat after a loss.

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

For run errors, distinguish a failed attempt from an unknown open trade:
retry without changing the loss count only when no purchase was sent, and wait
for settlement or stop safely if a purchase was already sent. Never treat a
cycle with no settled contract as a win or loss.

Before starting an XML cycle, require both the RunPanel and api_base to be idle:
RunPanel silently ignores onRunButtonClick while a run or purchase is active.
Wrap the call in Promise.resolve().then(...) so synchronous Blockly/RunPanel
errors reach the cycle's error handler. The XML loader must verify the live
workspace exposes getVariableMap and contains the loaded trade_definition,
before_purchase, and after_purchase blocks before reporting success.

**Why:** a RunPanel no-op or a workspace that has not finished initializing can
look like a valid terminal entry while no purchase is ever sent.

**How to apply:** keep idle-state checks in the shared XML run path, report
purchase_sent/purchase_received explicitly, and fail closed on an unready or
rejected workspace rather than waiting for the trade-stall timeout.
