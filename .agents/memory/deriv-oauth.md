---
name: Deriv OAuth endpoint and live-app state
description: Production OAuth uses the Deriv /oauth2/auth route and a Deriv app must be live before login can complete
---

Use `https://auth.deriv.com/oauth2/auth` for the production authorization request and `/oauth2/token` for code exchange; `/oauth2/authorize` is not the current route. A configured callback can still fail before user authentication when Deriv reports that the OAuth app is not live.

**Why:** The provider documentation identifies `/auth` as the authorization endpoint, and probing the configured app returned “This app isn’t live yet” rather than completing the login flow.

**How to apply:** Verify the callback URL is exactly registered in Deriv’s app dashboard, make the app live there, and only then perform an interactive login test with a real Deriv session.