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
- `src/pages/main/main.tsx`: the Bot Builder tab (index 1, hash `ahmed_learning`) content div must be **transparent** — `style={{ height: '100%', background: 'transparent', pointerEvents: 'none' }}`. Never give it a solid background color.
- `src/pages/main/main.scss` `.bot-builder`: use `position: fixed; top: 9rem; width: 100%; z-index: -1;` by default, and `z-index: 10` via `&--active` when `active_tab === 1`.
- `bot-builder.tsx` line 213: activates via `'bot-builder--active': active_tab === 1 && !is_preview_on_popup`.

## Tab 1 mapping
`DBOT_TABS.AHMED_LEARNING = 1` is the index for the Bot Builder tab. `DBOT_TABS.BOT_BUILDER = 99` is a sentinel meaning "never a visible tab index". The BotBuilder overlay checks `active_tab === 1`.
