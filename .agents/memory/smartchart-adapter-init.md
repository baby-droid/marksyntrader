---
name: SmartChart adapter init — retry until chart_api.api is ready
description: Adapter init silently no-ops if chart_api.api is null on mount; needs a poll/retry
---

## Rule
The adapter init effect must poll with `setTimeout` until `chart_api.api` is available, not rely on `!adapterInitialized && chart_api.api` being true on first render.

**Why:** `chart_api.api` is populated asynchronously (after the WebSocket handshake). On initial page load it is `null`. The original `useEffect(() => { if (!adapterInitialized && chart_api.api) { ... } }, [adapterInitialized])` only runs once — `chart_api.api` is NOT in the dependency array, so if it was null on mount, the adapter is never built. SmartChart stays in "Retrieving Chart Data" indefinitely.

**Fix pattern:**
```ts
const tryInit = () => {
    if (cancelled) return;
    if (!chart_api.api) { retryTimeoutRef.current = setTimeout(tryInit, 500); return; }
    // build adapter, setAdapterInitialized(true)
};
tryInit();
return () => { cancelled = true; clearTimeout(retryTimeoutRef.current); };
```

Also set `debug: false` in adapter options in production — `debug: true` logs every tick to console, causing performance issues.
