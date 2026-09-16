---
name: Marksyntrader tab order
description: DBOT_TABS constants and new page tab order for the Marksyntrader app
---

The tab order in `src/constants/bot-contents.ts` is the source of truth for the main `<Tabs>` children and navigation drawers.

New order:
- 0: DASHBOARD
- 1: BOT_BUILDER (AHMED_LEARNING alias)
- 2: FREE_BOTS
- 3: AHMED_SCALPER_BOTS
- 4: AUTO_DIGITS
- 5: DCIRCLES
- 6: SPEEDLAB
- 7: HEDGE
- 8: CHART
- 9: MANUAL_TRADER
- 10: DTRADER
- 11: AUTO_TRADES
- 12: COPY_TRADING
- 13: REPORT
- 14: BULK_TRADE
- 15: ANALYSIS
- 16: TUTORIAL
- 17: TRADING_SOFTWARE

**Why:** Auto-Digits is intentionally positioned directly between Scalper Bots and D-Circles, so every tab after it shifts by one.

**How to apply:** Use `DBOT_TABS` and `TAB_IDS` instead of numeric tab literals. `BOT_BUILDER` must remain an alias for `AHMED_LEARNING` (= 1), because the real Bot Builder is rendered by the Ahmed Learning child.
