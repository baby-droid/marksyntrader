---
name: Fast execution scope
description: Where the shared Fast execution profile is allowed to affect trading behavior.
---

The header Fast toggle is effective for Bot Builder and Scalper Bots, plus the specifically supported Free Bots Normal Killer Bot V3 and 2 Prediction Cycle. Other Free Bots, Auto Trades, Speed Lab, and other card surfaces retain their own execution pacing.

**Why:** Strategy surfaces have different pacing and purchase semantics. Only bots with verified tick-synchronized purchase handling should opt into the shared Fast profile.

**How to apply:** Set the active trade context before starting a run and use the context-aware Fast check for purchase pacing, direct-buy selection, rate-limit handling, and latency metrics. Keep the raw toggle check for rendering the control itself; do not enable Fast for every Free Bot.