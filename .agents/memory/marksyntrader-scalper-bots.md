---
name: Scalper Bots architecture
description: How the built-in AHMED SCALPER BOTS page works
---

The Scalper Bots page (src/pages/scalper-bots) does not implement its own trading loop.
Each of the 38 built-in bots is a generated Blockly XML file (public/bots/scalpers/*.xml,
indexed by manifest.json) loaded into the existing Bot Builder workspace, the same
mechanism the Free Bots page uses (loadStrategyToBuilder / domToWorkspace fallback).

Strategy shape: "Scalper" variants trade once — on win they reset stake and stop
(no trade_again); on loss they multiply stake by martingale (2x) and retry
(trade_again). "Multiple" variants also call trade_again on win, so they repeat
the win-then-stop cycle continuously instead of terminating for good.

**Why:** reusing the interpreter means results automatically flow into the existing
Summary/Transactions/Journal panels and Report page — no custom run/report logic
needed, and behavior stays consistent with every other bot in the app.

**How to apply:** when adding more built-in strategy bots, generate XML from the
existing templates (evenodd.xml, ahmed-over2-killer.xml) rather than writing new
run logic, and add entries to the relevant manifest.json.
