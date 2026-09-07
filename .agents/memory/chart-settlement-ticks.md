---
name: Chart settlement tick semantics
description: Entry-tick inclusion and duplicate-epoch handling for chart contract countdowns
---

## Rule
For chart duration countdowns, count unique live epochs strictly after `entryEpoch`; `1HZ*` and `JD*` skip the first post-entry quote, while plain Volatility, Bear, and Bull count it as T1. The live stream owns the visible badge; POC data anchors entry and settlement but must not jump it ahead.

**Why:** 1-second and Jump contracts expose a leading post-entry quote before their numbered settlement sequence, while plain/Bear/Bull contracts do not. POC updates can arrive after buffered live quotes or report a larger count before the visible stream catches up.

**How to apply:** Start with the buy receipt's `start_time`/`purchase_time` as a temporary anchor, re-anchor to non-zero `entry_spot_time` (legacy `entry_tick_time` fallback) without discarding buffered live epochs, apply the purchased symbol's settlement mode, and keep the visible count clamped to the contract duration.