---
name: Chart AI Over/Under entry map
description: The reference-based strong entry digits and their scope in chart AI.
---

The chart AI uses the reference map as an ordered entry-point preference for Over/Under contracts: Strong Over = 3, 4, 1, 8; weak fallback Over = 7, 0; Strong Under = 9, 6, 2; weak fallback Under = 5. Weak points can trigger after the market distribution and three-touch confirmation pass. The shield digit is optional and receives a confidence bonus when it is the strongest winning-side digit.

**Why:** A hard strong-digit/shield gate prevented valid qualifying markets from ever reaching the entry-point confirmation loop.

**How to apply:** Preserve the ordered entry-point preference alongside the 50-tick distribution and historical-duration scoring. A qualifying chart distribution must not be vetoed by a noisy historical backtest; do not apply this map to unrelated groups such as Rise/Fall or Even/Odd.