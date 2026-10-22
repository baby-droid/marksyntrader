---
name: Rise/Fall scalper trade type
description: Keep Rise/Fall scalper entry checks tied to raw price direction and the matching XML contract.
---

Rise uses the CALL contract and Fall uses PUT. The terminal's configured
directional set logic must evaluate the raw tick price window, not last-digit
momentum: Rise's default reversal condition is consecutive falling prices and
Fall's is consecutive rising prices. The loaded XML's contract type and
purchase block must match that terminal-side signal.

**Why:** last digits cannot reliably represent the direction of the underlying
price, and a mismatch between signal and XML would either suppress entries or
buy the opposite contract.

**How to apply:** whenever changing Rise/Fall entry rules, keep `evaluateStrategyLogic`
and `checkEntry` aligned with the CALL/PUT XML pair, then verify both XML contract
type fields and the terminal-to-XML run handoff.
