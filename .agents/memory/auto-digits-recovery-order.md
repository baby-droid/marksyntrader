---
name: Auto-Digits recovery order
description: Ordered recovery behavior and payout-target sizing for Auto-Digits.
---

Recovery must stay linear across markets: Over 1, Over 2, Over 3, Under 8, Under 7, Under 6, then the safe parity/direction steps. After two cumulative losses (including loss → win → loss), use three one-tick runs limited to Even/Odd or Only Ups/Only Downs before returning to the barrier plan. Every market evaluates the same current step; the highest-scoring market may win only after the normal entry-condition and virtual-validation gates pass.

**Why:** Ranking every recovery plan simultaneously causes the engine to mix barriers and markets, making recovery unpredictable and skipping the intended sequence.

**How to apply:** Use one tick for the lower-risk digit and direction contracts (Even, Odd, Over, Under, Differs, Matches, Only Ups, Only Downs) at baseline; after a loss, shift their next duration up by the loss count (capped at five ticks), while the two-loss safe phase returns to one tick. Advance the plan index only after a real Deriv contract ID, keep recovery active while any deficit remains (including after partial wins), and size the next stake as the higher of the user multiplier floor or the remaining-deficit target using the configured 80% payout assumption while respecting reserve and loss limits.