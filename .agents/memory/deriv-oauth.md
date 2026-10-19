---
name: Deriv OAuth and authenticated WebSocket lifecycle
description: Production OAuth endpoint, account-bound options trading sockets, and the authenticated callback flow
---

Use `https://auth.deriv.com/oauth2/auth` for production authorization and `/oauth2/token` for code exchange; `/oauth2/authorize` is not the current route. A configured callback can still fail before user authentication when Deriv reports that the OAuth app is not live.

Authenticated Options trading requires `POST /trading/v1/options/accounts/{accountId}/otp` with a Bearer token, then a new WebSocket connection to the returned one-time URL. The public `/ws/public` endpoint is only for unauthenticated market data. Treat OTP URLs as account-bound: reconnect after login/account switching, and do not silently fall back to the public socket if an active account's token or OTP request fails.

**Why:** Deriv’s current documentation separates public market-data sockets from authenticated trading sockets; silent fallback can leave account requests unanswered and hide account-selection errors. The OAuth app must also be live before an interactive callback test can succeed.

**How to apply:** Verify the callback URL is registered in Deriv’s app dashboard; use the current OAuth access token and selected account ID to obtain OTP; create a fresh socket on account changes. Test the flow with mocked endpoints and never place a live trade just to verify connectivity.