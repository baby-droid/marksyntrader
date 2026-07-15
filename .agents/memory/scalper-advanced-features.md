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
