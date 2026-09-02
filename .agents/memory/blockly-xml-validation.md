---
name: Blockly XML validation
description: Structural rules for hand-authored executable Blockly bot XML
---

Hand-authored compact Blockly XML must close each child `value` or `statement` wrapper before closing its containing `block`; balanced tag counts alone are not enough.

**Why:** Inline nesting errors can leave the XML well-shaped enough to look plausible while Blockly rejects or silently drops parts of the bot during loading.

**How to apply:** Parse every new or edited bot with an XML parser, verify the explicit block IDs are unique, and validate the copied `public` and `dist` files after the build.

For mixed digit and Rise/Fall bots, keep the base trade options free of a digit prediction; phase-specific dynamic purchases supply digit barriers while direct CALL/PUT purchases stay barrier-free.

**Why:** A shared digit barrier can leak into a directional API buy and make the mixed strategy unreliable even when the XML itself parses.

**How to apply:** Use `multiple_purchase` prediction overrides for digit phases and plain `purchase` blocks for CALL/PUT phases.