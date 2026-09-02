---
name: Auto-Digits feed lifecycle
description: Recovery and accuracy rules for the Auto-Digits market scanner.
---

The Auto-Digits scanner must attach authenticated live tick callbacks before loading large baselines. Baseline discovery and history are supplementary: cached markets and live ticks must continue when either request is delayed or rate-limited.

**Why:** A reconnect or market-selection change can leave an old async baseline loader alive long enough to attach duplicate subscriptions or overwrite newer live state, making the UI appear stalled.

**How to apply:** Cancel each feed-loader generation during cleanup, use a single guarded retry with exponential backoff, watchdog each selected market by last tick time, preserve raw history until a live authoritative `pip_size` arrives, and deduplicate history/live points by Deriv epoch.