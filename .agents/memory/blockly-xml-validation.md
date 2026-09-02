---
name: Blockly XML validation
description: Structural rules for hand-authored executable Blockly bot XML
---

Hand-authored compact Blockly XML must close each child `value` or `statement` wrapper before closing its containing `block`; balanced tag counts alone are not enough.

**Why:** Inline nesting errors can leave the XML well-shaped enough to look plausible while Blockly rejects or silently drops parts of the bot during loading.

**How to apply:** Parse every new or edited bot with an XML parser, verify the explicit block IDs are unique, and validate the copied `public` and `dist` files after the build.