---
name: Marksyntrader initialization loading screen
description: Understanding the "Initializing Deriv Bot account..." loading state
---

The app shows the landing-style startup screen for a fixed 1.5 seconds, then renders the app shell. API initialization and active-symbol retrieval continue in the background.

Flow:
1. The landing screen mounts as soon as app content is available.
2. A fixed 1.5-second timer reveals the app shell; it does not wait for the API.
3. API initialization updates `is_api_initialized` when the connection opens or timeout fallback fires.
4. `init()` and `changeActiveSymbolLoadingState()` run without extending the landing delay.
5. `retrieveActiveSymbols()` populates market data in the background.

**Why:** The user wants the branded landing page restored briefly, without API handshakes extending startup or reintroducing the second loading stage.

**How to apply:** Preserve the fixed 1.5-second landing delay and keep the second phase disabled. Do not tie the delay to API or active-symbol initialization; keep contextual loaders for page-specific operations.
