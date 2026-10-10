---
name: Dependency repair
description: Restoring an empty node_modules tree without unintentionally upgrading the project manifest.
---

When the workspace has no node_modules, restore from the checked-in package manifest and lockfile before changing application code. Replit's package installer may resolve newer versions within semver ranges and rewrite package.json/package-lock.json; keep those changes only when an upgrade is intentional.

For this Rsbuild app, startup and production builds use a lock-protected guard that checks both the Rsbuild binary and its html-rspack-plugin loader. Only when either is missing does it run `npm ci --include=dev --no-audit --no-fund`; ordinary starts do not reinstall.

**Why:** A missing dependency tree can look like widespread source breakage, while an automatic install can create unrelated dependency diffs.

**How to apply:** Route every dev/build/post-merge entry through the guard, keep repairs serialized with an atomic workspace lock, verify the install with a full build and workflow restart, then inspect git status and remove generated/package-file drift before delivery. Fail clearly if the required loader is still absent.

If Replit's Socket Security Policy blocks a locked transitive package, inspect its direct parent and the latest compatible safe versions; update the parent within its existing major and constrain the transitive package only when needed. Never bypass the policy.

**Why:** a lockfile restore can repeatedly fail when it pins a dependency that the package firewall now rejects.

**How to apply:** use package metadata and the package-management flow, keep manifest/lockfile changes narrowly scoped, and retry the normal install guard.