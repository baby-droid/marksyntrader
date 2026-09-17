---
name: SmartChart adapter init — retry until the authenticated API is ready
description: SmartChart must wait for api_base.api and never create or fall back to the legacy public chart WebSocket
---

## Rule
The adapter init effect must poll with `setTimeout` until the authenticated `api_base.api` is available, not rely on the API being ready on the first render. SmartChart transport, history, live subscriptions, and cleanup must all use this same connection.

**Why:** `api_base.api` is populated asynchronously (after the authenticated WebSocket handshake). On initial page load it is `null`. The old separate `chart_api` path created a public chart WebSocket and could make chart data use a different connection from the rest of the trading UI.

**Fix pattern:**
```ts
const tryInit = () => {
    if (cancelled) return;
if (!api_base.api) { retryTimeoutRef.current = setTimeout(tryInit, 500); return; }
    // build adapter, setAdapterInitialized(true)
};
tryInit();
return () => { cancelled = true; clearTimeout(retryTimeoutRef.current); };
```

Also set `debug: false` in adapter options in production — `debug: true` logs every tick to console, causing performance issues.
