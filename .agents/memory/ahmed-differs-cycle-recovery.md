---
name: Ahmed Differs Cycle recovery
description: The Ahmed Differs Cycle must enter a post-loss parity wait instead of resuming its normal Differs route.
---

Every loss resets parity history and enters a waiting state. Count the next three consecutive digits by parity; three evens trigger DIGITODD and three odds trigger DIGITEVEN. Do not allow the normal cycle to run while waiting.

**Why:** Reusing the normal cycle after a loss caused the bot to buy Differs before the requested parity recovery could be observed.

**How to apply:** Keep the executable XML copies synchronized and validate that the recovery branch is guarded by both the waiting state and a streak of at least three. The waiting state is armed on loss; it does not need an initialization setter, and the normal-cycle branch should run for every state except the waiting sentinel so a fresh bot cannot deadlock before its first loss.