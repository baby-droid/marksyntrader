---
name: Marksyntrader tab order
description: DBOT_TABS constants and new page tab order for the Marksyntrader app
---

The tab order in `src/constants/bot-contents.ts` is the source of truth for the main `<Tabs>` children and navigation drawers.

New order:
- 0: DASHBOARD
- 1: AUTO_SIGNALS
- 2: BOT_BUILDER (AHMED_LEARNING alias)
- 3: FREE_BOTS
- 4: AHMED_SCALPER_BOTS
- 5: AUTO_DIGITS
- 6: AUTO_LAB
- 7: DCIRCLES
- 8: SPEEDLAB
- 9: HEDGE
- 10: CHART
- 11: MANUAL_TRADER
- 12: DTRADER
- 13: AUTO_TRADES
- 14: COPY_TRADING
- 15: REPORT
- 16: BULK_TRADE
- 17: ANALYSIS
- 18: TUTORIAL
- 19: TRADING_SOFTWARE

**Why:** Auto-Signals is intentionally positioned after Dashboard, so all later tabs shift by one; Bot Builder remains the Ahmed Learning tab.

**How to apply:** Keep `DBOT_TABS`, `TAB_IDS`, the main `<Tabs>` children, URL hashes, and navigation menus index-aligned. `BOT_BUILDER` must remain an alias for `AHMED_LEARNING` (= 2).
