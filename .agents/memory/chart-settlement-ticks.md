---
name: Chart settlement tick semantics
description: Entry-tick inclusion and duplicate-epoch handling for chart contract countdowns
---

## Rule
For chart duration countdowns, never count the entry spot itself: count unique epochs strictly after `entryEpoch`. For `1HZ*` and `JD*` markets, skip the first unique post-entry epoch; plain Volatility, Bear, Bull, and other markets include it. Use the public ticks feed for low-latency display and reconcile against POC `tick_count`/`tick_stream`.

**Why:** The entry quote is not a settlement tick for the requested chart behavior, while 1-second Volatility and Jump contracts have an additional first-quote offset. The public stream can arrive before or after POC updates, and replayed messages can otherwise advance a counter twice.

**How to apply:** Start with the buy receipt's `start_time`/`purchase_time` as a temporary anchor, re-anchor to non-zero `entry_spot_time` (legacy `entry_tick_time` fallback), count unique live epochs using the purchased symbol's settlement mode, and keep reconciliation monotonic and clamped to the contract duration.