---
name: Fast execution scope
description: Where the shared Fast execution profile is allowed to affect trading behavior.
---

Normal Killer Bot V3 always uses a zero-delay, direct-buy, one-purchase profile regardless of the header toggle. The header Fast toggle is separately effective for Bot Builder, Scalper Bots, and 2 Prediction Cycle. Other Free Bots, Auto Trades, Speed Lab, and other card surfaces retain their own execution pacing.

**Why:** Strategy surfaces have different pacing and purchase semantics. Normal Killer V3 does not use proposals and must not wait on a proposal round-trip; it still has one tracked contract per entry to avoid unsafe fan-out.

For Normal Killer V3, enforce the three-contract limit from pending/open contracts, not the total entry queue. Apply settled outcomes in entry order so martingale progression stays deterministic, but do not let already-settled side entries consume open-contract capacity while an older contract is still open.

**Why:** A total-queue cap can stop new tick entries after three purchases even when some side contracts have settled. Ordered outcome application preserves stake progression without making those completed contracts block capacity.

**How to apply:** Set the active trade context before starting a run. Use the instant-profile check for Normal Killer V3's pacing, direct buy, proposal bypass, and rate-limit retry; use the explicit Fast toggle for other supported pages. Keep the raw toggle check for rendering the control itself. Retain one-entry-per-epoch deduplication, count only pending/open entries toward the cap, and keep settled outcomes ordered.