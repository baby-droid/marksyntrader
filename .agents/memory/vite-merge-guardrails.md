---
name: Vite merge guardrails
description: Durable lessons for resolving Vite/Rsbuild merge conflicts and third-party CSS build failures.
---

When a merge chooses Vite over Rsbuild, remove stale Rsbuild dependency-repair hooks before regenerating the lockfile. If Vite 8's Lightning CSS rejects malformed CSS emitted by a vendor package, use the non-Lightning CSS build path rather than patching vendor files.

**Why:** A mixed Vite/Rsbuild manifest caused clean-install failures, and the Vite 8 minifier rejected a third-party CSS variable even though development and source transforms were valid.

**How to apply:** Confirm the `dev`, `build`, and `prebuild` scripts match the selected bundler, regenerate `package-lock.json` from that manifest, run a production build, and then verify the preview workflow.