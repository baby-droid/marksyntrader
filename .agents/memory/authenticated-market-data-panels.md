---
name: Authenticated market data panels
description: Connection rule for AI scanner and digit-analysis market data after Deriv token login.
---

Market-data panels that are part of the logged-in trading app must use `api_base.api` and the connection-status observable, not standalone public Deriv WebSockets with hard-coded app IDs.

**Why:** Separate public sockets can appear connected while bypassing the app's token/account lifecycle, so history and live tick data remain empty or become stale after a user authorizes a token.

**How to apply:** Wait/retry until the shared API is open, request history through `api_base.api.send`, subscribe through `api_base.api.subscribe`, and send `forget` plus unsubscribe on market changes, account changes, and unmount. Capture live `tick.pip_size` before calculating digit statistics.