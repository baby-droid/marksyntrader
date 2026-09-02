---
name: Auto-Digits feed lifecycle
description: Recovery and accuracy rules for the Auto-Digits market scanner.
---

The Auto-Digits scanner must attach authenticated live tick callbacks before loading large baselines. Baseline discovery and history are supplementary: cached markets and live ticks must continue when either request is delayed or rate-limited.

**Why:** A reconnect or market-selection change can leave an old async baseline loader alive long enough to attach duplicate subscriptions or overwrite newer live state, making the UI appear stalled.

**How to apply:** Cancel each feed-loader generation during cleanup, use a single guarded retry with exponential backoff, watchdog each selected market by last tick time, preserve raw history until a live authoritative `pip_size` arrives, and deduplicate history/live points by Deriv epoch.

Only label the distribution as a complete 1,000-tick / 100% baseline after the history response itself contains the full sample. Display counts from the actual ten digit buckets; do not infer counts from rounded percentages or from a partial live window.

**Why:** A partial or rate-limited history response can still have live ticks, but presenting that window as a complete baseline makes the percentages and strategy readiness look authoritative when they are not.

**How to apply:** Keep baseline readiness separate from connection readiness, show a loading state for partial windows, and round visible percentages with a correction so the ten labels sum to exactly 100.0%.