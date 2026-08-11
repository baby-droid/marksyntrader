---
name: Chart AI entry state machine
description: Durable rules for chart AI confirmation, entry rotation, reverse fallback, and stake progression.
---

## Rule

Chart AI must analyze a 50-tick sample, select an entry point, and confirm three qualifying touches within a bounded five-tick window before firing. Over/Under entries are derived from the selected barrier, not a hardcoded digit list. Other market groups use type-specific digit, pattern, or price-direction confirmation.

After a failed confirmation window, retry the entry point; after repeated failures rotate to the next point. If the selected point remains absent through the stale band, switch to a reverse side and require the reverse entry point to confirm before buying. After three successful uses of an entry point, rotate it.

Auto Ticks evaluates every duration from 1 through the user's selected limit; with Auto Ticks off it uses the selected duration exactly. The first trade in each fresh scan uses the user's configured base stake; later AI progression is separate and never writes back into the base-stake field.

**Why:** The previous implementation either rejected valid weak Over/Under opportunities, counted only consecutive repeated digits, locked on one entry point, or reset progression to 0.35 / mutated the user's configured stake.

**How to apply:** Keep `aiStake`, `initialStakeRef`, and the user-stake ref separate from parent `stake`; reset entry-window refs after settlement and recovery; preserve the 50-tick gate before selecting a new signal. Pattern groups use their contract type rather than the Over/Under digit map.