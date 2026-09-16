---
name: Auto Trades Even/Odd condition
description: The Even/Odd smart-trade card’s visible condition controls and authenticated execution gate.
---

The Even/Odd smart-trade condition is streak-based: the latest selected number of digits must all be Even or all Odd. The Then selection directly chooses DIGITEVEN or DIGITODD.

**Why:** The reference design describes “the last N digits” and shows a current streak, so a probability threshold would make the displayed rule and actual entry behavior disagree.

**How to apply:** Keep the number-of-digits and parity dropdowns synchronized with the execution predicate; preserve the existing authenticated proposal → buy → settlement flow for both demo and real sessions.