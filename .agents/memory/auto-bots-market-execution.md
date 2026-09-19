---
name: Auto Bots market execution
description: Durable rules for Auto Bots authenticated scanning, one-tick selection, and independent market risk.
---

Auto Bots use the authenticated Deriv market feed as a background scanner. Each market is evaluated only when its own tick version advances; a global scanner tick may wake the runner but must not replay unchanged markets. A qualifying strategy dispatches one 1-tick contract immediately and leaves settlement to an asynchronous callback.

**Why:** A shared global candidate list caused the UI to hide watch markets and make execution depend on unrelated market ticks. Waiting for settlement before scanning the next tick silently reduced a live 1-second stream to sequential trades. One-tick contracts also keep displayed probability, entry timing, and settlement semantics aligned.

**How to apply:** Keep the visible market set compact and ranked, show non-qualified live markets as watch cards, prioritize 1-second Volatility, Jump, plain Volatility, Bear, then Bull markets, and dispatch every fresh eligible market without an in-flight settlement gate. Any ranked pair or rotation is display context only and must not prevent a fresh signal on another supported market from trading. TP/SL state belongs to each market in Auto Bots, so one stopped market must not stop the other markets in the same bot run. Digit strategies must explicitly return `shouldTrade: true`; selecting a contract alone is not an entry signal.

The ranked Auto Bot cohort is a small execution scope, but a single validated market is enough to start. The cohort rotates after its configured settled-run count; settlement callbacks update market risk and can reset the cohort when the count is reached.

**Why:** Requiring a second qualifying market made a valid card display READY but never buy when only one market had a fresh signal. Resetting only from the dispatch loop also left the cohort stuck after asynchronous settlements completed.

**How to apply:** Keep the ranked cohort for display and rotation, but never use it as a settlement/concurrency lock. Re-evaluate risk and rotation state when each contract settles.