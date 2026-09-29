---
name: AI cycle pattern detector
description: Shared route and one-tick pattern rules for the Chart AI cycle detector
---

## Rule
The cycle detector scans Over 2 → Under 7 → Over 1 → Under 2. A trigger requires two setup-side digits, one cross through the barrier, then a return to the barrier/setup side; the return is a one-tick entry.

**Why:** The requested strategy is a continuously searching cycle, not a fixed-duration signal or a second direct-buy engine.

**How to apply:** Keep route advancement and the barrier-return predicate in the shared cycle-pattern utility. The run-panel detector is telemetry; Chart AI remains the purchase owner and uses the existing authenticated buy callback.