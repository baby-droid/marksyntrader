---
name: Run panel float-above-everything
description: Why the Run/Speed control panel silently reverts to overlapping headers instead of floating above the whole app.
---

`src/pages/main/main.tsx` renders two separate run-control UIs globally on every page:

1. `<FloatingRunButton />` — the correct one, `position: fixed`, high z-index, stays put regardless of scroll or page.
2. An older inline panel (`RunStrategy` / `TradeAnimation`, wrapped in `.main__run-strategy-wrapper` in `src/pages/main/main.scss`) — this one used `position: absolute` with a low z-index, so it scrolled with page content and visually collided with page headers/nav (e.g. Reports page "Summary | Transactions | Journal" nav).

**Why:** both components are mounted unconditionally, so fixing only one (or assuming `FloatingRunButton` is the only run panel) leaves the second, older panel still colliding with headers on pages where it renders.

**How to apply:** if "the run panel isn't floating above everything" recurs, check `.main__run-strategy-wrapper` (and any sibling `.dashboard__run-strategy-wrapper` — currently dead/unused CSS, safe to ignore) for `position: fixed` + a z-index above header stacking (headers top out ~10060 for things like the account-switcher; the run-strategy-wrapper was set to 9995, one tier below FloatingRunButton's 9990... actually above header z-index but below account-switcher — adjust upward if it still gets covered by a specific header dropdown).
