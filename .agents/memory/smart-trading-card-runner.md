---
name: Smart Trading card runner
description: Reliability rules for the Smart Trading Rise/Fall, Even/Odd, Over/Under, and Matches/Differs card loops.
---

Each Smart Trading card run must have a generation token in addition to its stop flag. A stop/start can happen while a proposal, buy, or settlement request is awaiting the authenticated socket; a stale loop must not clear the new run's flag, update its state, or place another order. Normalize exclusive digit barriers before sending them to Deriv: Over accepts 0–8 and Under accepts 1–9.

**Why:** A boolean stop flag alone permits an older async loop to resume after a new run starts, causing duplicate buys and colliding card state. Invalid endpoint barriers fail only when a condition fires, making the card appear to crash instead of trade.

**How to apply:** Keep the execution loop token-scoped, guard every post-await continuation, catch the detached loop promise, and show proposal/buy errors in the card journal. Preserve the condition/action semantics while normalizing only the request boundary.