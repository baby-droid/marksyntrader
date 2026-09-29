---
name: Fast execution scope
description: Where the shared Fast execution profile is allowed to affect trading behavior.
---

The header Fast toggle is intentionally effective only for Bot Builder and Scalper Bots. Auto Trades, Free Bots, Speed Lab, and other card surfaces retain their own execution pacing and speed controls.

**Why:** Those surfaces have separate strategy and pacing semantics; applying a zero-delay shared profile to all of them can create duplicate requests or override their intended behavior.

**How to apply:** Set the active trade context before starting a run and use the context-aware Fast check for purchase pacing, direct-buy selection, rate-limit handling, and latency metrics. Keep the raw toggle check for rendering the control itself.