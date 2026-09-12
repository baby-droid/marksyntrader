---
name: Dependency repair
description: Restoring an empty node_modules tree without unintentionally upgrading the project manifest.
---

When the workspace has no node_modules, restore from the checked-in package manifest and lockfile before changing application code. Replit's package installer may resolve newer versions within semver ranges and rewrite package.json/package-lock.json; keep those changes only when an upgrade is intentional.

**Why:** A missing dependency tree can look like widespread source breakage, while an automatic install can create unrelated dependency diffs.

**How to apply:** Verify the install with a full build and workflow restart, then inspect git status and remove package-file drift before delivery.