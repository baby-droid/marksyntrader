---
name: Interpreter-safe generated code
description: Runtime constraints for JavaScript generated and evaluated by the DBot interpreter.
---

Generated Blockly code runs inside the embedded JavaScript interpreter, not the browser's full JavaScript environment. Do not rely on browser globals such as an unqualified `CustomEvent` or static built-ins such as `Number.isFinite`; use primitive-compatible checks and expose browser-only behavior through host methods on the Bot interface.

**Why:** Missing interpreter built-ins surface as vague “undefined is not a function” failures at run time, often before the first contract is purchased.

**How to apply:** Audit any new generated code for browser APIs and modern static helpers. Keep event construction, UI notifications, and other browser-only work in host-side bridge functions.