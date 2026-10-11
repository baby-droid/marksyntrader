---
name: Fast execution scope
description: Where the shared Fast execution profile is allowed to affect trading behavior.
---

Normal Killer Bot V3 always uses zero-delay direct buys. Fast permits up to three distinct purchases on one tick in supported flows; V3 reserves each entry and still caps pending/open contracts at three. Auto-Signals, 2 Prediction Cycle, and A-SPEED stay sequential.

**Why:** The user requested three purchases per tick for Fast, while Auto-Signals must revalidate between trades and V3 needs bounded, ordered settlement handling. Deriv and network latency mean a 0.0001-second purchase guarantee is not possible.

For Normal Killer V3, enforce the three-contract limit from pending/open contracts, not the total entry queue. Apply settled outcomes in entry order so martingale progression stays deterministic, but do not let already-settled side entries consume open-contract capacity while an older contract is still open.

**Why:** A total-queue cap can stop new tick entries after three purchases even when some side contracts have settled. Ordered outcome application preserves stake progression without making those completed contracts block capacity.

**How to apply:** Set the active trade context before starting a run. Keep V3 Fast entries unique by market/epoch slot, count only pending/open entries toward the three-contract cap, and apply settled outcomes in order. Leave Auto-Signals and 2 Prediction Cycle at one purchase per tick; keep A-SPEED one-at-a-time.