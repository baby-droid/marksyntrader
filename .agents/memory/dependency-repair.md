---
name: Dependency repair
description: Restoring an empty node_modules tree without unintentionally upgrading the project manifest.
---

When the workspace has no node_modules, restore from the checked-in package manifest and lockfile before changing application code. Replit's package installer may resolve newer versions within semver ranges and rewrite package.json/package-lock.json; keep those changes only when an upgrade is intentional.

For this Rsbuild app, startup and production builds use a lightweight guard that checks both the Rsbuild binary and its html-rspack-plugin loader. Only when either is missing does it run `npm ci --include=dev --no-audit --no-fund`; ordinary starts do not reinstall.

**Why:** A missing dependency tree can look like widespread source breakage, while an automatic install can create unrelated dependency diffs.

**How to apply:** Verify the install with a full build and workflow restart, then inspect git status and remove package-file drift before delivery. Keep the guard lockfile-based and fail clearly if the required loader is still absent.