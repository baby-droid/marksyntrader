---
name: King Fisher XML fallback loader
description: Blockly fallback blocks must match the connection shape implied by imported XML.
---

Unknown Blockly XML blocks must be registered with only the connection type their XML position can accept: value blocks get an output connection, while statement/root blocks get previous and next connections. Register the helper through the scratch barrel so dashboard imports use the same implementation.

**Why:** Blockly rejects a block that exposes output and statement connections at the same time, producing the generic unsupported-XML error before the workspace can load.

**How to apply:** When adding or changing XML import paths, pre-scan both `block` and `shadow` nodes, infer value/statement placement from their parent, and keep generator fallbacks as safe no-ops or neutral values.