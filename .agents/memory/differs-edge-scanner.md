---
name: Differs Edge Scanner bot
description: Strategy sequence and recovery behavior for the loadable Differs/Over/Under XML bot
---

## Rule
The Differs Edge Scanner is an XML-driven Bot Builder strategy. It captures the latest digit before each purchase, rotates through Differs (prediction = scanned digit), Over 1, Over 2, Differs, Under 8, and Under 7, then uses Even/Odd recovery after a loss.

**Why:** The user wanted one bot combining the specified digit contracts with a market-entry scan and parity recovery, while preserving the app’s single XML trading engine.

**How to apply:** Keep the XML loadable through both Free Bots and Bot Builder. A win resets stake and advances the main rotation; a loss multiplies stake by 2 and sets recovery phase 6 for an even scanned digit or 7 for an odd scanned digit. Recovery wins return to phase 0.

This scan is a latest-tick heuristic, not a guarantee of profit. It should be described as an entry filter and tested on demo before real trading.

## Risk controls
The bot tracks each contract's profit with `read_details` index 4 in `session_profit`. It stops by omitting `trade_again` when session profit reaches `take_profit` (default 5) or falls to `-stop_loss` (default -20).

**Why:** The Bot Builder engine's normal stop pattern is conditional continuation, not a separate native stop block.

**How to apply:** Keep the TP/SL check after win/loss state updates and before `trade_again`; changing the thresholds only requires editing the initialization values.

## Multiple contract block
The supported multi-contract UI is a `Multiple Purchase` block in the Purchase Conditions toolbox. It exposes Over, Under, Even, Odd, Matches, and Differs slots; the first selected contract is tracked and later selections are independent same-tick purchases.

**Why:** The standard engine has one tracked `purchase` lifecycle, so a custom block must preserve that lifecycle while routing optional side contracts through the existing purchase API.

**How to apply:** Use the block for phase routing instead of inventing a second trade-definition category. Keep the trade definition on the API-supported digits category and select the contract family in each Multiple Purchase slot.

## Validator compatibility
Workspace validation treats `purchase` and `multiple_purchase` as interchangeable purchase-entry blocks, while still requiring the standard `before_purchase` container.

**Why:** XML bots that use only the custom multi-purchase block must not be rejected as missing the legacy mandatory Purchase block.

**How to apply:** Preserve the OR rule in required-block and disabled-block checks when adding other purchase-entry block variants.