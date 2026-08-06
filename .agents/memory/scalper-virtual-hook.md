---
name: Virtual Hook + Stealth Mode
description: VirtualHookConfig pre-trade filter and stealthMode terminal obfuscation in scalper bots.
---

# Virtual Hook + Stealth Mode

## Virtual Hook

### Types
- `VirtualHookConfig { enabled, hookLoss, hookWin }` added to `BotConfig` and `TxRecord.virtual?: boolean`
- Default: `{ enabled: false, hookLoss: 3, hookWin: 1 }` via `DEFAULT_VH`
- Helper setter: `vhSet()` in BotDetail component

### State machine (lives as local vars inside `startBot`)
```
let vPhase: 'loss' | 'win' = 'loss';
let vLossCount = 0;
let vWinCount  = 0;
```

### Gate location
Inserted in `startBot` immediately after:
`addLog('⚡ ENTRY_SIGNAL: DETECTED — EXECUTING TRADE', 'entry');`
and before the WA signal dispatch + XML bot call.

### Logic
- Loss phase: count consecutive virtual losses until `hookLoss` reached
  - win during this phase → reset vLossCount (streak broken)
  - reaches hookLoss: if hookWin===0 → unlock real trade; else switch to 'win' phase
- Win phase: count consecutive virtual wins until `hookWin` reached
  - loss during this phase → reset all back to 'loss' phase
  - reaches hookWin → unlock real trade, reset all
- When pattern not met: `continue` back to outer scan loop (no real trade)
- When pattern met: fall through to the real XML bot execution

### Virtual outcome simulation
Waits `cfg.duration` ticks via `tickSignalRef`, then evaluates:
- Digit contracts: check `digitWindowRef.current[0]` against prediction/barrier
- CALL/PUT: compare `priceWindowRef.current[0]` vs `priceWindowRef.current[min(vTicks, len-1)]`

### Transactions tab
Virtual rows have `virtual: true` — shown with purple [VIRTUAL] badge, strikethrough stake, italic (sim) P/L.
CSS classes: `.sb-tx-virtual`, `.sb-virtual-badge`, `.sb-tx-virtual-stake`, `.sb-result-virtual`, `.sb-tx-virtual-pnl`

## Stealth Mode
- `stealthMode: boolean` in `BotConfig` (default false)
- UI: "🛡 Stealth Mode" accordion with status pills
- Effect: in `subscribeMarket` tick handler, masks middle digits of price:
  `rawPrice.slice(0, 2) + '***' + rawPrice.slice(-2)` when stealthMode is on
- `runHackerStartup` now shows 22 messages including TOR relay, JA3 spoof, jitter, session rotation

**Why:** Virtual hook prevents real money from trading on untested conditions; stealth mode reduces terminal pattern visibility from screenshots/screen shares.
**How to apply:** Both are per-bot settings. vHook gate fires on every entry signal when enabled. Stealth only affects log display, not market data accuracy.
