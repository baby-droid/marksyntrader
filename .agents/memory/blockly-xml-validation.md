---
name: Blockly XML validation
description: Structural rules for hand-authored executable Blockly bot XML
---

Hand-authored compact Blockly XML must close each child `value` or `statement` wrapper before closing its containing `block`; balanced tag counts are not enough. In nested inline comparisons, close the arithmetic block, its value wrapper, then the parent comparison value wrapper.

**Why:** Inline nesting errors can leave the XML well-shaped enough to look plausible while Blockly rejects or silently drops parts of the bot during loading.

**How to apply:** Prefer multiline XML for new assets; parse every new or edited bot, verify explicit block IDs are unique, and validate copied `public` and `dist` files after the build.

Compact hand-authored XML is especially prone to missing one closing `block` around the final item in an initialization `next` chain, or to closing a nested arithmetic block before its `value` wrapper.

**Why:** These defects repeatedly survived visual inspection and only surfaced when a parser reached a later section of the asset.

**How to apply:** Keep initialization and nested trade-definition chains expanded across lines, then run parser validation before relying on the application build.

When several bot files are repaired together, validate each file independently rather than stopping at the first parser failure; the same missing terminal `</block>` can recur in multiple initialization or loss-state `next` chains.

**Why:** A batch parser that aborts on the first error can falsely suggest the remaining files are healthy, while compact XML makes the same structural mistake easy to repeat.

**How to apply:** Report every target’s parse result, then validate both `public/bots` and the generated `dist/bots` copies after building.

For digit bots, the Trade Parameters `TYPE_LIST` must be `both`; `DIGITODD` and `DIGITEVEN` belong in purchase blocks, not the trade-definition dropdown.

**Why:** The contract-type dropdown is populated from the `evenodd` trade category and rejects individual parity purchase codes, leaving the first trade-parameter controls blank when loaded.

**How to apply:** Keep the trade definition broad (`both`) and select the actual parity contract in the `purchase` or `multiple_purchase` block.

For mixed digit and Rise/Fall bots, keep the base trade options free of a digit prediction; phase-specific dynamic purchases supply digit barriers while direct CALL/PUT purchases stay barrier-free.

**Why:** A shared digit barrier can leak into a directional API buy and make the mixed strategy unreliable even when the XML itself parses.

**How to apply:** Use `multiple_purchase` prediction overrides for digit phases and plain `purchase` blocks for CALL/PUT phases.

The trade-definition dropdowns need safe canonical fallback options during XML import; live API options can replace them after the authenticated metadata loads.

**Why:** These fields initially contain only an empty option, so Blockly discards saved XML values when active-symbols or contracts-for data is still loading. The bot then appears to contain only an empty Trade Parameters block.

**How to apply:** Keep the fallback values limited to valid persisted XML values (`synthetic_index`, `random_index`, the supported symbol IDs, `digits`, `evenodd`, and `both`); do not use fallbacks to introduce invalid contract selections.