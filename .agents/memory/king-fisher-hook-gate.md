---
name: King Fisher hook purchase gate
description: The required relationship between King Fisher entry detection, Virtual Hook confirmation, and the real purchase.
---

The King Fisher Virtual Hook must be the direct condition controlling the real purchase. Its nested entry signal starts the simulated hook, and its confirmation result authorizes the real trade.

**Why:** The entry streak can be true on the signal tick but false on the next tick when the hook settles. Wrapping the hook in `entry AND virtual_hook` therefore drops valid confirmations and produces “logic met” without a real purchase.

**How to apply:** Keep each bundled King Fisher before-purchase XML as `controls_if -> king_fisher_virtual_hook -> nested king_fisher_entry -> purchase`. Keep virtual hook results separate from real contract statistics, and persist hook rows in the Bot Builder transaction feed.