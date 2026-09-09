---
name: Chart settlement tick semantics
description: Entry-tick inclusion and duplicate-epoch handling for chart contract countdowns
---

## Rule
For chart duration countdowns, use `entryEpoch` only as the anchor: plain/Bear/Bull count the first post-entry quote as T1, while 1HZ and Jump skip that leading quote and start T1 on the next one. Merge live ticks with POC `tick_stream`, keep counts monotonic, and clamp to duration.

**Why:** Deriv documents `entry_spot_time` as the first valid underlying spot and `tick_stream` as the contract stream from entry to end. The market-specific leading quote behavior is observable in settlement: treating it as a numbered tick shifts 1HZ/Jump labels one tick early.

**How to apply:** Start with the buy receipt's `start_time`/`purchase_time` as a temporary anchor, re-anchor to non-zero `entry_spot_time` (legacy `entry_tick_time` fallback), deduplicate epochs, apply `getTickSettlementMode(symbol)`, reconcile from POC `tick_stream`, and keep the visible count clamped to the contract duration.