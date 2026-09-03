---
name: Auto Trades batch manager
description: Deriv batch execution boundaries and settlement tracking for same-account Smart Trading batches
---

Same-account batch trading must use concurrent authenticated WebSocket proposal→buy requests, not Deriv's REST bulk-purchase endpoint. The REST endpoint is designed for applying one contract across multiple accounts with per-account PATs.

**Why:** Concurrent buys improve same-signal timing but do not guarantee identical execution timestamps or entry/exit spots. Each contract can settle independently, so copying the first result across a batch produces incorrect P/L and win/loss counts.

**How to apply:** Give each batch a unique batch ID and each position an order ID. Track buy/contract IDs as responses arrive, subscribe to each contract's settlement, update each transaction independently, and aggregate batch wins, losses, total stake, and P/L from the real settlements. Clean up every optimistic batch row if the request fails before settlement. When a UI toggle controls the execution branch, pass the rendered config into the start handler as well as maintaining a ref; an effect-only ref can lag one click and silently run one trade instead of the requested batch.