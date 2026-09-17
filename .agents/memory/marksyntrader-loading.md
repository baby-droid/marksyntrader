---
name: Marksyntrader initialization loading screen
description: Understanding the "Initializing Deriv Bot account..." loading state
---

The pre-change startup flow uses the colored-bar ChunkLoader while the store/API and lazy route initialize. AppContent keeps the branded LoadingScreen for its own existing loading branch, with the prior 1.2-second minimum and 7-second API fallback.

Flow:
1. The outer route suspense uses ChunkLoader with the connection message.
2. AppRoot waits for the store and API initialization before rendering AppContent.
3. AppRoot suspense uses ChunkLoader with the Loading message.
4. AppContent keeps its previous minimum-delay and API fallback behavior.

**Why:** The branded full-screen loading page was introduced by a later change; restoring the previous behavior prevents the pulled loading-screen changes from altering startup UX.

**How to apply:** Keep route/API suspense on ChunkLoader and do not replace it with LoadingScreen unless the user explicitly asks to restore the newer branded startup flow.
