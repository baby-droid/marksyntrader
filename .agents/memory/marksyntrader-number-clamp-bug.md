---
name: Marksyntrader numeric input clamp-on-keystroke bug
description: A recurring bug across pages where numeric text inputs snap back to min/max on every keystroke, blocking clear+retype; how it was fixed.
---

Multiple pages in this codebase implement numeric inputs as fully-controlled
`<input type='number'>` fields that clamp on every `onChange`
(e.g. `setValue(Math.max(min, Math.min(max, +e.target.value)))`). Clearing the
field evaluates `+''` as `0`, which the clamp immediately snaps back to `min`,
so the user can never actually clear and retype a value.

**Why:** first discovered in the Scalper Bots detail page (stake, duration,
risk-manager limits, etc.) and then found again independently in Manual
Trader (tick duration) and Bulk Trade (contracts count) — it's a copy-pasted
pattern, not a one-off, so any page with numeric config inputs should be
checked.

**How to apply:** use the shared `src/components/number-field` component
(`NumberField`) instead of a raw clamped `<input type='number'>`. It buffers
the raw text locally while focused (allowing empty/partial input) and only
parses + clamps + commits on blur/Enter. When touching any page with numeric
inputs, grep for `type='number'` combined with `Math.max`/`Math.min` in the
same `onChange` to spot this pattern before it's reported again.
