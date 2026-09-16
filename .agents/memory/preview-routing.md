---
name: Development preview routing
description: The local preview URL can omit the static-build environment flag
---

## Rule
Treat `/bot/preview` as preview mode based on the pathname as well as `NEXT_PUBLIC_APP_BUILD=true`.

**Why:** The Replit development workflow serves the preview under `/bot/preview` without injecting the static-build flag, so relying only on the flag makes React Router render its error page.

**How to apply:** Keep the pathname detection aligned with `PREVIEW_BASE_PATH`; production static builds still use the environment flag and standalone root deployments remain outside preview mode. Do not let the PWA service worker control localhost or `.replit.dev` previews; unregister stale workers and clear their caches there.