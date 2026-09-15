---
name: Auto Bots market execution
description: Durable rules for Auto Bots authenticated scanning, one-tick selection, and independent market risk.
---

Auto Bots use the authenticated Deriv market feed as a background scanner. Each market is evaluated only when its own tick version advances; a global scanner tick may wake the runner but must not replay unchanged markets.

**Why:** A shared global candidate list caused the UI to hide watch markets and made execution depend on unrelated market ticks. One-tick contracts also keep displayed probability, entry timing, and settlement semantics aligned.

**How to apply:** Keep the visible market set compact and ranked, show non-qualified live markets as watch cards, prioritize 1-second Volatility, Jump, plain Volatility, Bear, then Bull markets, and execute up to five fresh eligible markets concurrently. TP/SL state belongs to each market in Auto Bots, so one stopped market must not stop the other markets in the same bot run.

The first four Auto Bots are an intentional exception: they trade a two-market cohort, count five settled validated runs per market, then rotate to the next pair. After a loss, skip the immediate next market tick and require a higher score; after two losses require a strong signal.

**Why:** Pair cohorts make the first four bots compare a stable market sample instead of chasing every fresh signal, while the post-loss gate reduces repeated weak entries without bypassing the existing stake and TP/SL controls.

**How to apply:** Preserve the pair-of-two/five-runs-per-market rule for those first four definitions only. Keep the broader Auto Bots eligible for independent fresh-market execution unless the product requirement explicitly changes.