---
name: Speed Lab / execution speed modes
description: How Normal/Crazy/Turbo purchase-firing semantics are defined across the app (Speed Lab, AI Assistant auto-trader, etc.)
---

Execution speed has three tiers, and every trade-firing loop in the app (Speed Lab, AI Assistant auto-trader, etc.) should implement them the same way:

- **Normal** — buy, `await` full settlement, then fire the next trade. Sequential, human-like pacing.
- **Crazy** — faster than Normal, no waiting for settlement, but pipelined with a small in-flight cap (e.g. 4 concurrent purchases) so it stays clearly slower than Turbo and doesn't blow past Fire-Now trade-count caps before results land.
- **Turbo** — "more than superhuman": fire-and-forget with **zero delay and no concurrency cap**. Loop re-enters and fires the next purchase immediately; settlement is tracked fully in the background. In Speed Lab this uses a persistent `TurboSocket` (raw `ws.send()`) with a prebuilt payload ref instead of the normal request/await cycle.

**Why:** the user explicitly defined this ranking (Turbo > Crazy > Normal, with zero waits/delays in Crazy and Turbo) and it must hold consistently everywhere trades are auto-fired, not just in Speed Lab.

**How to apply:** when adding or auditing any auto-trading loop, check it has three distinct code paths matching the above — not just a binary "await vs no-await" split. A `firedCount`/in-flight guard is needed for Crazy/Turbo so Fire-Now caps and TP/SL checks aren't blown past before async settlement callbacks resolve.
