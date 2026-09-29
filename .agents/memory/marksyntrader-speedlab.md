---
name: Speed Lab / execution speed modes
description: How Normal/Crazy/Turbo purchase-firing semantics are defined across the app (Speed Lab, AI Assistant auto-trader, etc.)
---

Execution speed has three tiers, plus the app-wide Fast/A-SPEED preset. Every trade-firing loop in the app (Speed Lab, AI Assistant auto-trader, etc.) should implement them consistently:

- **Normal** — buy, `await` full settlement, then fire the next trade. Sequential, human-like pacing.
- **Crazy** — faster than Normal, no waiting for settlement, but pipelined with a small in-flight cap (e.g. 4 concurrent purchases) so it stays clearly slower than Turbo and doesn't blow past Fire-Now trade-count caps before results land.
- **Turbo** — "more than superhuman": fire-and-forget with **zero delay and no concurrency cap**. Loop re-enters and fires the next purchase immediately; settlement is tracked fully in the background. In Speed Lab this uses a persistent `TurboSocket` (raw `ws.send()`) with a prebuilt payload ref instead of the normal request/await cycle.
- **Fast / A-SPEED** — one buy per produced live tick, with settlement tracked independently in the background. It is tick-paced, not an unlimited tight loop, so a 1-second market cannot execute multiple contracts for the same tick.

**Why:** the user explicitly defined this ranking (Turbo > Crazy > Normal, with zero waits/delays in Crazy and Turbo) and it must hold consistently everywhere trades are auto-fired, not just in Speed Lab.

**How to apply:** when adding or auditing any auto-trading loop, check it has distinct paths matching the above — not just a binary "await vs no-await" split. Fast/A-SPEED must use live tick epochs as the dispatch key and deduplicate them; settlement callbacks must update each contract independently. A `firedCount`/in-flight guard is needed for Crazy/Turbo so Fire-Now caps and TP/SL checks aren't blown past before async settlement callbacks resolve.
