---
name: Money Print Neural Link
description: Scope and safety boundary for Money Print challenge analysis and match-route recommendations.
---

Until a model provider is deliberately connected, Neural Link reports are local quantitative analysis: the free-text challenge is included in the report, while route ranking uses authenticated tick history and the local settled-trade journal. Do not present this as natural-language model reasoning or send Deriv credentials/account identifiers to a model.

**Why:** No external model connection is configured, and a fabricated AI response or accidental credential transfer would mislead users and expose account data.

**How to apply:** Keep the disclosure visible. Use local evidence and live proposal checks for execution; if adding a model later, call it server-side with only necessary non-secret context and keep the deterministic loss lock and risk gates authoritative.

The Neural Link surfaces only its single best qualified digit-pair route at a time, and a DIGITMATCH route displays one target digit.

**Why:** A Deriv DIGITMATCH contract accepts one target digit per order; presenting several at once can be mistaken for one multi-digit contract.

**How to apply:** Keep the top-ranked validated route, its entry digit, and its single target digit synchronized in the match list, report, and order parameters.
