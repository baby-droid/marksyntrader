---
name: Auto-Digits active symbols API
description: Compatibility rule for loading the market list used by Auto-Digits.
---

The current Deriv options WebSocket accepts `active_symbols: 'full'` but rejects a `product_type` property on the same request.

**Why:** Sending the otherwise-common `product_type: 'basic'` field returns `InputValidationFailed` and aborts Auto-Digits before it requests history or subscribes to live ticks.

**How to apply:** Keep the active-symbols request limited to the supported fields; normalize current responses from `underlying_symbol` and `underlying_symbol_name` because those fields may replace `symbol` and `display_name`.