---
name: Marksyntrader tab order
description: DBOT_TABS constants and new page tab order for the Marksyntrader app
---

The tab order in `src/constants/bot-contents.ts` was updated from the original 5-tab layout to a 12-tab layout.

New order:
- 0: FREE_BOTS
- 1: DASHBOARD
- 2: BOT_BUILDER
- 3: DCIRCLES
- 4: SPEED_LAB
- 5: PRO_HEDGE
- 6: CHART
- 7: MANUAL_TRADER
- 8: TUTORIAL
- 9: BOT_LIBRARY
- 10: COPY_TRADING
- 11: REPORTS

**Why:** User requested these 7 new pages added to navigation in a specific order.

**How to apply:** Any code that hardcodes tab indices (like `setActiveTab(0)` for dashboard) must use `DBOT_TABS.DASHBOARD` (= 1) instead of `0`. The `DASHBOARD` constant is no longer 0.
