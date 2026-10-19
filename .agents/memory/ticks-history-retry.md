---
name: Tick-history retry scope
description: Back off failed history reads without changing the shared purchase retry path.
---

Apply nonzero exponential backoff only to `ticks_history` request failures. The shared retry wrapper also handles purchase requests, so changing generic retry delays can alter order execution or cause unintended repeated buys. Keep rate-limit handling on its existing path.

Tick-history and OHLC Blockly wrappers must propagate rejected promises. Avoid `new Promise(resolve => request.then(...))` without a reject path; a failed API read otherwise leaves the interpreter awaiting forever. Clear rejected history-promise caches so a later run can retry.

**Why:** a zero-delay history retry can spin during transient feed failures, while broad retry changes risk affecting real orders.

**How to apply:** identify history requests from their message type or echoed request, apply bounded retries only to those failures, propagate errors through Blockly wrappers, and keep purchase retry behavior unchanged.
