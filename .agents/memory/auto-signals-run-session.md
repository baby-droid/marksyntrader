---
name: Auto-Signals run session
description: Auto-Signals trade progress and stop monitoring across tab navigation.
---

Auto-Signals run tracking must outlive the Auto-Signals page component. The main Tabs component renders only its active child, so handing a bot to Bot Builder unmounts the scanner page while the trade continues. Keep contract/stop observation in the shared run-session module and let the page subscribe to its snapshot.

**Why:** page-scoped observers and state disappear on the intentional handoff to Bot Builder, losing progress and the Auto-Signals run-limit stop callback.

**How to apply:** if the handoff lifecycle changes, preserve a single observer owner across tab switches; do not move run tracking back into a page-only effect.
