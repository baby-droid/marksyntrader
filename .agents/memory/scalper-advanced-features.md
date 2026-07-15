---
name: Scalper advanced features — NDP, VPS, multi-contract, XML duration/market sync
description: NDP next-digit prediction, VPS mode auto-restart, 3-contract multiple bots, XML patching
---

## NDP (Next Digit Prediction)
- `checkNDP(digits, prices, contractType, prediction, ndpConfig)` in `index.tsx` after `getLastDigit`.
- NdpConfig: `{ enabled, ldpWindow (older digits confirming streak), ndpWindow (newest digits for reversal) }`.
- Default: `{ enabled: false, ldpWindow: 7, ndpWindow: 2 }`.
- Wired in `startBot` scan loop: `entry = checkEntry(...) && checkNDP(...)`.
- UI accordion "🔮 NDP — Next Digit Prediction" in the settings sidebar.
- Per contract type: OVER/UNDER/EVEN/ODD/MATCH/DIFF/CALL/PUT all have specific LDP+NDP logic.

**Why:** Secondary confirmation layer — LDP fires first (streak of opposite digits), NDP checks reversal has started.

## TRADE_STALL after a loss (any XML) — dead trade_again block
All 41 scalper XMLs in `public/bots/scalpers/` had a `trade_again` block queued in the `after_purchase` loss (ELSE) branch, right after updating the martingale stake variable. The terminal (`index.tsx`) is the sole owner of the retry/martingale loop and force-stops the XML bot via `onStopButtonClick()` on every loss — but if the XML's own `trade_again` fired before that stop landed, the bot engine could re-enter a purchase with stale state, leaving the terminal's next `onRunButtonClick()` call to never produce a `bot.contract`/`bot.stop` event — surfacing as a 45s `TRADE_STALL`. It didn't reproduce on every loss (race timing), which made it look tied to a specific loss count. Fixed by stripping `<next><block type="trade_again">...</block></next>` from every scalper XML.

**Why:** dual ownership of "what happens after a loss" (terminal force-stop AND XML self-retry) is a race condition by construction.

**How to apply:** any new/edited scalper XML's `after_purchase` loss branch must only update the martingale stake variable — never include a `trade_again` block. Grep `public/bots/scalpers/*.xml` for `trade_again` to confirm none exist.

## VPS Mode
- `VpsMode.tsx` at `src/pages/scalper-bots/VpsMode.tsx`.
- Props: `enabled, settings (numRuns/takeProfit/stopLoss), running, authorized, lastTickAtRef, sessionPnlRef, vpsRuns, vpsPnl, onToggle, onSettingsChange, onRequestRestart, onDone`.
- Monitors: account connection (authorized prop), internet (fetch HEAD to Deriv API with timing), terminal health (lastTickAtRef staleness > 40s).
- Auto-restart: detects `running` going false → checks limits → delays 1.5s → calls `onRequestRestart`.
- `onRequestRestart` in BotDetail: increments vpsRuns, snapshots vpsPnl, resets sessionPnlRef, clicks `.sb-run-btn`.
- Done popup: `VpsDonePopup` overlay (vps-done-overlay/vps-done-modal CSS classes) with reason + P/L.
- VPS done popup triggers `setVpsDonePopup` state in BotDetail.

## Multiple contracts (3 trades per entry for multiple bots)
- `cfg.multiTradeCount` in BotConfig (default 3 for `bot.multiple`, 1 otherwise).
- In startBot: `const tradeCount = bot.multiple ? Math.max(1, cfg.multiTradeCount||1) : 1`.
- Loop runs `tradeCount` cycles sequentially, 250ms gap between contracts.
- Each cycle's `onSettled` records `type: contractLabel(bot) + " #N/tradeCount"` for multiple bots.
- UI: "📊 Multiple Contracts" accordion, only shown when `bot.multiple === true`.

## XML duration + market patching
- `patchXmlContent(xml, market?, duration?)` pure function using DOMParser/XMLSerializer.
- `handlePreloadXml(bot, opts?: { market?, duration? })` now patches XML before loading into Blockly.
- `patchWorkspaceParams` accepts `duration` and patches `DURATIONTYPE_LIST → 't'` + DURATION NUM block.
- Called with `{ market: curMarket, duration: cfg.duration }` on: bot start, scan timeout switch, loss-triggered market switch, market2 switch.

## WA signal dispatch from scalper
```js
window.dispatchEvent(new CustomEvent('wa:signal', { detail: {
  market: curMarket, action: contractLabel(bot),
  stake: `$${curStake.toFixed(2)}`, ticks: cfg.duration, confidence: 82+Math.floor(Math.random()*16)
}}));
```
Dispatched after entry detected (`setEntryReady(true)`) in startBot scan loop.
