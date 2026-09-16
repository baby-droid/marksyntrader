---
name: Chart AI entry state machine
description: Durable rules for chart AI confirmation, entry rotation, reverse fallback, and stake progression.
---

## Rule

Chart AI supports two independent modes: Ticks · entry points analyzes a 50-tick sample plus a live 10–15-tick flow to choose the best duration from 1–5 ticks; Touches · count hits counts strategy-confirmed barrier-side hits independently before firing. Over/Under entries are derived from the selected barrier, not a hardcoded digit list. Other market groups use type-specific digit, pattern, or price-direction confirmation.

After a failed confirmation window, retry the entry point; after repeated failures rotate to the next point. If the selected point remains absent through the stale band, switch to a reverse side and require the reverse entry point to confirm before buying. After three successful uses of an entry point, rotate it.

Auto Ticks evaluates every duration from 1 through the 5-tick limit and updates the displayed Best ticks automatically; with Auto Ticks off it uses the current selected duration exactly. The first trade in each fresh scan uses the user's configured base stake; later AI progression is separate and never writes back into the base-stake field. After a trade, refresh scanning is five minutes; three consecutive losses force an immediate fresh market scan. Recovery supports best-entry/best-duration Over 3 and Under 6.

**Why:** The previous implementation either rejected valid weak Over/Under opportunities, mixed touch counts with tick-flow confirmation, locked on one entry point, or reset progression to 0.35 / mutated the user's configured stake.

**How to apply:** Keep `aiStake`, `initialStakeRef`, and the user-stake ref separate from parent `stake`; reset flow or touch-hit state after settlement, mode changes, and recovery; preserve the 50-tick gate before selecting a new signal. For 1-second and Jump markets, skip the setup tick before scoring the flow. Start Over with lower winning digits and Under with upper winning digits. Keep the live AI subscription running when run/stop limits finish so the chart triangle continues moving.