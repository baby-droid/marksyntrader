---
name: Chart settlement tick semantics
description: Entry-tick inclusion and duplicate-epoch handling for chart contract countdowns
---

## Rule
For chart duration countdowns, never count the entry spot itself: count every unique epoch strictly after `entryEpoch`, including the first post-entry quote for `1HZ*`, `JD*`, plain Volatility, Bear, Bull, and other supported markets. Use the public ticks feed for low-latency display and reconcile against POC `tick_count`/`tick_stream`.

**Why:** The entry quote is not a settlement tick, but the first quote after entry is T1 for the requested chart behavior. The public stream can arrive before or after POC updates, and replayed messages can otherwise advance a counter twice.

**How to apply:** Start with the buy receipt's `start_time`/`purchase_time` as a temporary anchor, re-anchor to non-zero `entry_spot_time` (legacy `entry_tick_time` fallback), count unique live epochs using the purchased symbol's settlement mode, and keep reconciliation monotonic and clamped to the contract duration.