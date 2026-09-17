---
name: Boot error recovery
description: How the static boot fallback distinguishes failed app resources from runtime API errors.
---

The static boot fallback should only switch to its reload message for failed scripts, chunk/module loading failures, or syntax errors during boot. It must ignore WebSocket, API, and other resource-level errors that can occur after the app has started.

**Why:** The staging Deriv WebSocket can report connection errors while the app is still usable. Treating every window error or rejected promise as a boot failure incorrectly replaces the landing/app UI with “The preview could not start.”

**How to apply:** Keep the filter in both the source and built HTML entrypoints aligned. Match script targets and chunk/module failure messages; do not use an unconditional window `error` or `unhandledrejection` handler for the boot screen.