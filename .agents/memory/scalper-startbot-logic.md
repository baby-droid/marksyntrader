---
name: Scalper startBot logic
description: Core trading loop rules fixed in startBot — martingale, win-stop, XML reload, network watchdog, market switch.
---

# Scalper startBot Logic (src/pages/scalper-bots/index.tsx)

## Rules (as of July 2026 fix)

**Martingale stake tracking:**
- `computeNextStake(totalConsLoss, lastBuyPrice)` computes the correct stake for the next trade.
- If Risk Manager is inject+active+onLose: uses `overrideStake * multiplier^(consLoss - activateLimit + 1)`.
- Otherwise: `lastBuyPrice * slotMartingale()` — multiplies the ACTUAL last buy price, not the base stake.
- `lastBuyPrice` is updated from `onSettled.buyPrice` on every settled contract.
- Stake resets to `slotBaseStake()` only after a WIN.

**Stop after every win:**
- ALL scalpers stop after the first successful trade (win). The `bot.multiple` flag is no longer used to decide whether to loop back.
- User presses RUN again to start a fresh scalp cycle.

**Fresh XML reload on every Run:**
- `onPreloadXml(bot)` is now `await`-ed at the start of `startBot` (not fire-and-forget).
- This guarantees the workspace is ready before the first trade fires.

**Force-fresh market feed:**
- `tickUnsubRef` is explicitly unsubscribed and the market is re-subscribed at the start of every Run.
- `lastTickAtRef.current` is reset to `Date.now()` on each Run.

**Network watchdog in scan loop:**
- If no ticks arrive for >8s during the scan, the feed is force-resubscribed.
- Network-related errors in the catch block also trigger a force-resubscribe.

**Market switcher:**
- Trigger: `totalConsLoss >= cfg.switchOnLosses` (uses `switchOnLosses`, NOT `consecutiveLossLimit`).
- Martingale stake CARRIES FORWARD across market switches — does not reset on switch.
- After a win, default market (index 0) is always restored.

**First trade:**
- `firstTradeRef.current` gates an 800ms delay before the first trade so the workspace and feed fully initialise.
- All subsequent trades are tick-driven (zero artificial delay).

**Why:**
- Previous code reset `curStake` to base on every market switch and after force-stop, losing the accumulated martingale.
- `onPreloadXml` was fire-and-forget, so the first trade could fire before the workspace was ready.
- Market switch used `consecutiveLossLimit` instead of `switchOnLosses`, ignoring the dedicated setting.
- Win caused a loop-back to scan for `bot.multiple` bots instead of stopping.
