---
name: Blockly fallback execution
description: Why imported unsupported Blockly blocks need generator registrations as well as visual stubs.
---

Unknown Blockly blocks must be registered in two places: the workspace definition keeps the XML loadable, and the JavaScript generator fallback keeps bot compilation from failing. Statement blocks should compile to a no-op; value blocks should compile to a neutral value.

**Why:** A visual placeholder alone lets an imported strategy appear in Bot Builder but fails later when the interpreter generates JavaScript.

**How to apply:** When adding or changing imported third-party bot support, update the shared XML loader and the Bot Builder pre-scan consistently, then validate both workspace loading and generated code.