---
name: Speed Lab / execution speed modes
description: How Normal/Crazy/Turbo purchase-firing semantics are defined across the app (Speed Lab, AI Assistant auto-trader, etc.)
---

Normal, Crazy, and Turbo add no client-side delay after a successful trade. A sequential mode still waits for its required settlement before starting the next trade; Fast/A-SPEED can dispatch from distinct live ticks and track each result independently. Auto-Signals and 2 Prediction Cycle remain sequential and revalidate before each new entry. Keep per-tick deduplication, contract limits, and API-error backoff.

**Why:** the user wants the automated flows to feel consistently fast with no artificial pause. Deriv tick production, proposal/buy round trips, and settlement still set the real pace, so an end-to-end 100-microsecond purchase cannot be promised.

**How to apply:** remove fixed post-success timers; do not remove settlement waits required by a mode or retry backoff after API errors. Tick-driven loops should wake on feed updates rather than polling, deduplicate tick epochs, and update every settlement independently.
