---
name: Chart settlement tick semantics
description: Entry-tick inclusion and duplicate-epoch handling for chart contract countdowns
---

## Rule
For chart duration countdowns, use `entryEpoch` as the inclusive anchor: the entry spot is T1 for plain, Bear, Bull, 1HZ, and Jump markets. Merge live ticks with POC `tick_stream`, deduplicate epochs, keep counts monotonic, and clamp to duration.

**Why:** Deriv documents `entry_spot_time` as the first valid underlying spot and `tick_stream` as the contract stream from entry to end. The authenticated live feed can deliver the entry tick before `proposal_open_contract`, so excluding it makes labels visibly late and shifts fast-market counters.

**How to apply:** Start with the buy receipt's `start_time`/`purchase_time` as a temporary anchor, re-anchor to non-zero `entry_spot_time` (legacy `entry_tick_time` fallback), count `epoch >= entryEpoch`, deduplicate epochs, reconcile from POC `tick_stream`, and keep the visible count clamped to the contract duration.