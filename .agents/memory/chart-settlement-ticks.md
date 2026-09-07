---
name: Chart settlement tick semantics
description: Entry-tick inclusion and duplicate-epoch handling for chart contract countdowns
---

## Rule
For chart duration countdowns, count unique contract epochs at or after `entryEpoch`; the entry spot is T1 for every market and contract type. Merge the live stream with POC `tick_stream` reconciliation, keeping the visible count monotonic and clamped to the requested duration.

**Why:** Deriv documents `entry_spot_time` as the first valid underlying spot and `tick_stream` as the contract stream from entry to end. Excluding the entry or relying only on public ticks makes fast-market labels fall behind and can miss ticks during stream timing gaps.

**How to apply:** Start with the buy receipt's `start_time`/`purchase_time` as a temporary anchor, re-anchor to non-zero `entry_spot_time` (legacy `entry_tick_time` fallback), deduplicate epochs, reconcile from POC `tick_stream`, and keep the visible count clamped to the contract duration.