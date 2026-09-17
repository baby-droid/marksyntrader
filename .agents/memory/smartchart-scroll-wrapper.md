---
name: SmartChart scroll wrapper height rule
description: How to safely add a horizontal-scroll wrapper around SmartChart without breaking chart rendering
---

## Rule
When wrapping `.cw-root` (the SmartChart container) in a scroll shell, **never move the viewport height onto the wrapper** — keep `height: calc(100vh - 110px)` directly on `.cw-root`.

## Why
SmartChart uses a `ResizeObserver` internally to size its canvas. If `cw-root` uses `height: 100%`, it requires its parent (the tab div) to have an explicit height. The tab system in `main.tsx` renders tab content in plain `<div>`s with no height, so `height: 100%` resolves to 0 — SmartChart sees a zero-height container and renders a blank white area.

## How to apply
- `.cw-scroll-wrapper` → thin shell: `overflow-x: auto; overflow-y: hidden;` — **no height property**
- `.cw-root` → keeps `height: calc(100vh - 110px); max-height: calc(100vh - 110px)` — absolute value, independent of parent
- `overflow-y: hidden` on the wrapper is **mandatory**: CSS spec forces `overflow-y` to `auto` whenever `overflow-x` is non-`visible`, which would add a vertical scrollbar and break SmartChart layout
- Never set `overflow-y: visible` on a container that also has `overflow-x: auto` — browsers silently override it to `auto`
