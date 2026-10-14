---
name: Deriv tick observable teardown
description: Non-obvious lifecycle behavior for authenticated live tick streams.
---

DerivAPIBasic observable streams send their matching `forget` on RxJS unsubscribe; do not duplicate it. Blockly `TicksService` uses raw `ticks_history` subscriptions, so it must retain each returned subscription ID and forget only those IDs. Never use broad `forget_all` for routine bot teardown.

**Why:** Broad or duplicate cleanup requests can hit Deriv rate limits; an unhandled cleanup rejection can also prevent a bot's next tick feed from starting.

**How to apply:** Let the wrapper clean up observable streams. For raw bot history subscriptions, save the response ID and call `forget` for that ID only; if rate-limited, retain it for a later cleanup and keep the error from escaping as an unhandled rejection. Use connection-status transitions and a last-tick heartbeat to recreate observable streams whose RxJS object remains truthy after a socket replacement.