---
name: Chart settlement tick semantics
description: Entry-tick inclusion and duplicate-epoch handling for chart contract countdowns
---

## Rule
For chart duration countdowns, the Deriv entry tick is T1: count ticks with `epoch >= entryEpoch`, while ignoring only ticks before entry. Deduplicate epochs per contract, use the public ticks feed for low-latency display, and reconcile against POC `tick_count`/`tick_stream`.

**Why:** Deriv documents `entry_spot_time` as the first valid underlying spot and `tick_stream` as the contract stream from entry to end. The public stream can arrive before or after POC updates, while replayed messages can advance a counter twice.

**How to apply:** Start with the buy receipt's `start_time`/`purchase_time` as a temporary anchor, re-anchor to non-zero `entry_spot_time` (legacy `entry_tick_time` fallback), count unique live epochs, and clamp/reconcile with the contract-side count. Validate 1s and Jump behavior against a live settled POC stream.