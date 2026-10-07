---
name: BotBuilder architecture
description: How the Blockly Bot Builder workspace is rendered and positioned in Marksyntrader.
---

# BotBuilder Rendering Architecture

## Rule
There must be exactly ONE `<BotBuilder />` instance — rendered in `src/app/app-content.jsx` at ~line 203. Do NOT add another in `src/pages/main/main.tsx` (or anywhere else).

**Why:** Duplicate instances cause Blockly to attempt double-initialization of the same `#scratch_div` DOM element, which silently fails. The workspace renders but stays hidden behind the opaque tab placeholder div.

## How to apply
- `src/app/app-content.jsx`: renders `<Main />` and `<BotBuilder />` as siblings inside `bot-dashboard`.
- `src/pages/main/main.tsx`: the Bot Builder tab (index 2, hash `ahmed_learning`) content div must be **transparent** — `style={{ height: '100%', background: 'transparent', pointerEvents: 'none' }}`. Never give it a solid background color.
- `src/pages/main/main.scss` `.bot-builder`: use `position: fixed; top: 9rem; width: 100%; z-index: -1;` by default, and `z-index: 10` via `&--active` when `active_tab === DBOT_TABS.BOT_BUILDER`.
- `bot-builder.tsx`: activate the overlay and Builder-only controls through `DBOT_TABS.BOT_BUILDER`, not a numeric tab literal.

## Z-index stack (must be consistent)
| Layer | z-index |
|---|---|
| `.bot-builder--active` | 10 |
| RunPanel drawer (`--zindex-drawer`) | 12 |
| RunPanel (`popover_zindex.RUN_PANEL`) | 20 |
| Modal (`--zindex-modal`) | 13 |
| Snackbar (`--zindex-snackbar`) | 15 |
| BlocklyLoading overlay | 99999 |

**Why:** bot-builder is `position: fixed; z-index: 10`. Everything that must appear ON TOP of it (RunPanel, drawers) must have z-index > 10.

## Tab 2 mapping
`DBOT_TABS.AHMED_LEARNING = 2` is the index for the Bot Builder tab, and `DBOT_TABS.BOT_BUILDER` aliases it. Auto-Signals is tab 1; use the shared constant for Builder checks so the new tab cannot activate the Blockly overlay.

## Reload prevention
`BotStopped` dialog: "Back to Bot" and close-X now call `setWebSocketState(true)` instead of `reloadPage()`. The connection is auto-restored in `main.tsx` — when `connectionStatus === OPENED`, `setWebSocketState(true)` is called automatically.
