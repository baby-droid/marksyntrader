---
name: Chart settlement tick semantics
description: Entry-tick inclusion and duplicate-epoch handling for chart contract countdowns
---

## Rule
For chart duration countdowns, the Deriv entry tick is T1: count ticks with `epoch >= entryEpoch`, while ignoring only ticks before entry. Deduplicate epochs per contract.

**Why:** Using `entry_spot_time` first together with `epoch > entryEpoch` made fast Jump and 1s markets appear to skip two labels instead of the expected single pre-entry tick. Replayed stream messages can also advance a counter twice.

**How to apply:** Prefer the non-zero `entry_tick_time`, fall back to `entry_spot_time`, buffer ticks until the entry epoch arrives, then merge/count unique epochs and continue one count per unseen live epoch.