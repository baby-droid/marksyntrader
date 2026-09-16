---
name: Copy-trading follower connections
description: Why follower WebSocket connections in copy-trading.ts must use the app's own app_id.
---

`src/utils/copy-trading.ts` opens a **separate** authorized WebSocket
connection per follower account (the master trades on the app's own
connection; `subscribeMasterTrades` fans the signal out to followers, which
then send their own `authorize` + `buy` calls).

**Rule:** the follower connection's `app_id` (`WS_URL` in copy-trading.ts)
must match `NEXT_PUBLIC_DERIV_APP_ID` — the same app id the main app/
`api-token-login-modal` authorizes under — not a hardcoded generic/demo app
id like 1089.

**Why:** a mismatched app id means the follower's `authorize`/`buy` calls run
under a different app's registered scopes/permissions than the rest of the
platform, which caused followers to fail to link or to reciprocate trades
unreliably even though the token itself was valid.

**How to apply:** any new WebSocket connection opened for a secondary/
follower account in this codebase should reuse `process.env.NEXT_PUBLIC_DERIV_APP_ID`
for its `app_id`, falling back to a constant only if the env var is unset.
