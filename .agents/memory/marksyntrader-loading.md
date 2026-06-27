---
name: Marksyntrader initialization loading screen
description: Understanding the "Initializing Deriv Bot account..." loading state
---

The app always shows "Initializing Deriv Bot account..." on startup. This is controlled by `is_loading` in `src/app/app-content.jsx`.

Flow:
1. API connects → `is_api_initialized = true`
2. `init()` + `changeActiveSymbolLoadingState()` are called
3. `is_loading = true`
4. `retrieveActiveSymbols()` resolves → `is_loading = false`
5. Main UI renders

**Why:** Active symbols must be fetched before the Blockly workspace and contract panels work correctly.

**How to apply:** Do not mistake the loading screen for a broken app. It resolves in a few seconds after the DerivAPI WebSocket connects. If it never resolves, check `ApiHelpers.instance.active_symbols`.
