---
name: Chart settlement tick semantics
description: Entry-tick inclusion and duplicate-epoch handling for chart contract countdowns
---

## Rule
For chart duration countdowns, never count the entry spot itself: count every unique live epoch strictly after `entryEpoch`, including the first post-entry quote for `1HZ*`, `JD*`, plain Volatility, Bear, Bull, and other supported markets. The live stream owns the visible badge; POC data anchors entry and settlement but must not jump the badge ahead.

**Why:** The entry quote is not a settlement tick, but the first live quote after entry is T1 for the requested chart behavior. POC updates can arrive after several buffered quotes or report a larger count before the visible stream catches up, which previously made the first badge appear as T3.

**How to apply:** Start with the buy receipt's `start_time`/`purchase_time` as a temporary anchor, re-anchor to non-zero `entry_spot_time` (legacy `entry_tick_time` fallback) by clearing buffered live epochs, count unique live epochs using the purchased symbol's settlement mode, and keep the visible count clamped to the contract duration.