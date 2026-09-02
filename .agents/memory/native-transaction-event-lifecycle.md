---
name: Native transaction event lifecycle
description: Lifecycle rule for showing contracts from non-Bot-Builder trading surfaces in the shared Transactions page.
---

Non-Bot-Builder trade events must be consumed by a listener owned by the long-lived RootStore transaction store, not by a disposable Run Panel reaction bundle.

**Why:** The Run Panel can mount, unmount, and unregister bot listeners while an Auto-Digits or other self-contained trader remains active, silently dropping contracts from the native Transactions tab.

**How to apply:** Keep the browser event bridge registered for the transaction store lifetime; require a contract ID and authenticated active account, and let the existing contract-ID dedupe merge open and settled updates.