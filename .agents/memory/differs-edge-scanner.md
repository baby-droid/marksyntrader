---
name: Differs Edge Scanner bot
description: Strategy sequence and recovery behavior for the loadable Differs/Over/Under XML bot
---

## Rule
The Differs Edge Scanner is an XML-driven Bot Builder strategy. It captures the latest digit before each purchase, rotates through Differs (prediction = scanned digit), Over 1, Over 2, Differs, Under 8, and Under 7, then uses Even/Odd recovery after a loss.

**Why:** The user wanted one bot combining the specified digit contracts with a market-entry scan and parity recovery, while preserving the app’s single XML trading engine.

**How to apply:** Keep the XML loadable through both Free Bots and Bot Builder. A win resets stake and advances the main rotation; a loss multiplies stake by 2 and sets recovery phase 6 for an even scanned digit or 7 for an odd scanned digit. Recovery wins return to phase 0.

This scan is a latest-tick heuristic, not a guarantee of profit. It should be described as an entry filter and tested on demo before real trading.