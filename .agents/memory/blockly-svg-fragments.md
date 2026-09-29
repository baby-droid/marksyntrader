---
name: Blockly SVG fragment imports
description: How to handle uploaded Blockly blocks that are rendered SVG rather than workspace XML.
---

Rendered Blockly exports rooted at an SVG `g` element contain visual paths and text, not Blockly `block` nodes. They cannot be passed to the normal workspace loader as-is.

**Why:** Blockly's workspace loader needs executable `<xml><block>...</block></xml>` structure; treating an SVG fragment as bot XML causes blocks to disappear or be registered as unsupported placeholders.

**How to apply:** Reconstruct or convert the fragment into valid DBot XML, keep the original shared-block identifier in a `<data>` element on the corresponding executable root, and validate both the converted XML and the original fragment IDs before loading.