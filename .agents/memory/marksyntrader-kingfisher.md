---
name: King Fisher runtime reporting
description: Shared runtime contract for King Fisher market selection, hook telemetry, and Bot Builder journal reporting.
---

King Fisher's Best Market block is a pre-run selector, not a Blockly async action: the authenticated DBot runner reads the enabled block, scans candidate markets, updates the trade-definition symbol, and emits a journal notification before generating bot code.

**Why:** Blockly's interpreter executes generated code synchronously while market history is asynchronous, so scanning inside a generated statement can race the first contract. Pre-run selection keeps the loaded XML and the engine's tick subscription aligned.

**How to apply:** Keep market candidates and digit precision centralized in the King Fisher scanner. Emit live market digits and King Fisher sequence analysis as window events so the shared Bot Builder Journal can display data for any loaded bot without adding a second transaction engine. Keep virtual hooks marked separately so they appear in Transactions without affecting real-contract statistics.

King Fisher scanning must use the fixed barrier read from the loaded bot's trade options; if that barrier is missing or invalid, skip scanning rather than silently using barrier 5. Over 2 and Under 7 recovery bots carry the post-loss stake through three additional trades after the recovery win, and a new loss replaces that carried stake.

**Why:** A generic barrier ranks the wrong market for non-5 contracts, while resetting immediately after the recovery win removes the intended recovery buffer.

**How to apply:** Validate digit barriers as integers from 0 through 9 before calling the scanner. Keep the carry state in generated after-purchase runtime code so all bundled XML templates share the same behavior.