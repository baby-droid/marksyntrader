---
name: Chart AI entry state machine
description: Durable rules for chart AI confirmation, entry rotation, reverse fallback, and stake progression.
---

## Rule

Chart AI must analyze a 50-tick sample, select an entry point, and confirm three qualifying touches within a bounded five-tick window before firing. It may use a weak reference digit when the market distribution and confirmation rules validate it; weak digits must not be blocked solely by their label.

After a failed confirmation window, retry the entry point; after repeated failures rotate to the next point. If the selected point remains absent through the stale band, switch to a reverse side and require the reverse entry point to confirm before buying. After three successful uses of an entry point, rotate it.

The user's chart stake is the immutable base stake. AI progression is separate: next stake starts from the active AI stake, adds 0.50 above 2, 1.00 above 5, and 2.00 above 10, and never writes the progressed value back into the user's base-stake field.

**Why:** The previous implementation either rejected valid weak Over/Under opportunities, counted only consecutive repeated digits, locked on one entry point, or reset progression to 0.35 / mutated the user's configured stake.

**How to apply:** Keep `aiStake` and `initialStakeRef` separate from the parent `stake`; reset entry-window refs after settlement and recovery; preserve the 50-tick gate before selecting a new signal. Pattern groups use recent-pattern confirmation rather than the Over/Under digit map.