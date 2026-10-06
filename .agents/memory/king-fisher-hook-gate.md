---
name: King Fisher hook purchase gate
description: The required relationship between King Fisher entry detection, Virtual Hook confirmation, and the real purchase.
---

The King Fisher Virtual Hook must be the direct condition controlling the real purchase. Its nested entry signal starts the simulated hook; the default timing sets a one-cycle authorization for the next before-purchase pass. A bot can explicitly select immediate purchase to trade on the tick its configured hook result is confirmed.

**Why:** The entry streak can be true on the signal tick but false on the next tick when the hook settles. Wrapping the hook in `entry AND virtual_hook` therefore drops valid confirmations. Immediate mode must consume confirmation in the same pass to avoid a redundant market-tick wait without leaving a reusable authorization that could trigger a duplicate.

**How to apply:** Keep each bundled King Fisher before-purchase XML as `controls_if -> king_fisher_virtual_hook -> nested king_fisher_entry -> purchase`. Keep virtual hook results separate from real contract statistics, and persist hook rows in the Bot Builder transaction feed. Preserve next-tick as the default; only use immediate mode when the bot should buy on the confirmation tick. In immediate mode, return true directly and leave no pending authorization.