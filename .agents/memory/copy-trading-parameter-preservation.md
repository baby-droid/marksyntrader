---
name: Copy-trading parameter preservation
description: Deriv payload-shape and follower-grouping rules needed to replay accumulator and scaled trades accurately.
---

Deriv's `proposal_open_contract` response can represent accumulator limit orders as nested objects such as `take_profit.order_amount`, while proposal/buy requests use plain numeric values. Normalize the response before publishing a fallback signal or replaying it to a follower.

**Why:** Replaying only the contract type and stake silently changes accumulator behavior; using one bulk request for mixed currencies or custom stake ratios silently changes the follower's purchase.

**How to apply:** Keep `growth_rate` and normalized `limit_order` on every signal. Use bulk-purchase only for ratio-1 followers, and partition bulk requests by follower currency; use the individual socket path for custom ratios.