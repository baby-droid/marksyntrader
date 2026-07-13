---
name: Scalper bots terminal entry logic
description: How the scalper bots detect entry signals and subscribe to live ticks for the terminal scanner.
---

## Entry signal detection (`checkEntry`)
Located in `src/pages/scalper-bots/index.tsx`. Checks last 10 digits in `digitWindowRef.current`:
- **DIGITEVEN**: ≥3 consecutive ODD digits → bet EVEN (contrarian)
- **DIGITODD**: ≥3 consecutive EVEN digits → bet ODD (contrarian)
- **DIGITOVER N**: ≥2 consecutive digits ≤ N → bet OVER (reversal)
- **DIGITUNDER N**: ≥2 consecutive digits > N → bet UNDER (reversal)
- fallback: ≥3 ticks accumulated → always enter

**Why:** Contrarian streak logic mimics the bot's original PDF configuration where entry is triggered after consecutive opposing outcomes.

## Dual ref+state pattern for digit window
`digitWindowRef` (ref) is used inside the `startBot` async loop for instant access without stale closure issues.
`digitDisplay` (state) is updated in the same tick callback to trigger React re-renders for the UI strip.
Both are reset when `subscribeMarket()` is called.

**How to apply:** Any component that needs live tick data both in an async loop AND in the render output must use this dual pattern.

## Market switching
When `cfg.useMarketSwitch` is true and consecutive losses reach `cfg.consecutiveLossLimit`, `startBot` calls `subscribeMarket(nextMarket)` and resets the loss counter and stake. The market list cycles round-robin through `cfg.markets`.

## Hacker terminal messages
The `HACK_SCAN_MSGS` array contains cosmetic/hacker-style messages shown every 8 scan iterations. They use the `hack` CSS kind (dark gray color). `entry` kind is cyan/bold, `switch` kind is purple.
