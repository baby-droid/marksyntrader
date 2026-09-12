---
name: Auto Bots market execution
description: Durable rules for Auto Bots authenticated scanning, one-tick selection, and independent market risk.
---

Auto Bots use the authenticated Deriv market feed as a background scanner. Each market is evaluated only when its own tick version advances; a global scanner tick may wake the runner but must not replay unchanged markets.

**Why:** A shared global candidate list caused the UI to hide watch markets and made execution depend on unrelated market ticks. One-tick contracts also keep displayed probability, entry timing, and settlement semantics aligned.

**How to apply:** Keep the visible market set compact and ranked, show non-qualified live markets as watch cards, execute the highest-probability fresh market by default, and execute multiple markets only when all selected signals are strong. TP/SL state belongs to each market, so one stopped market must not stop the other markets in the same bot run.