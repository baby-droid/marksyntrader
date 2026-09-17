---
name: Deriv tick observable teardown
description: Non-obvious lifecycle behavior for authenticated live tick streams.
---

The DerivAPIBasic observable sends the matching `forget` for a subscription when its RxJS subscription is unsubscribed. Do not send a second manual `forget` during normal teardown.

**Why:** Duplicate cleanup requests add noise and can hit Deriv request-rate limits, especially while a shared socket is reconnecting.

**How to apply:** On reconnect, stale-stream recovery, symbol changes, and component unmount, unsubscribe the stream and let the API wrapper perform cleanup. Use connection-status transitions and a last-tick heartbeat to recreate streams whose RxJS object remains truthy after a socket replacement.