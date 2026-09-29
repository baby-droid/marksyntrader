---
name: Featured bot recovery isolation
description: Compatibility rule for parity recovery in the five featured Free Bots.
---

Keep the featured bots’ sequence-based parity recovery isolated from the generic dominant-parity recovery behavior. Do not change the generic parity block to implement the featured bots’ different entry patterns.

**Why:** The generic recovery block is shared by other bots. Changing its selection rule to satisfy the featured cards would silently alter those bots’ strategies.

**How to apply:** Before changing a shared recovery block, check its XML call sites. Keep the featured behavior opt-in, and keep its public and built XML copies synchronized.