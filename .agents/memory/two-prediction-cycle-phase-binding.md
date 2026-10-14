---
name: Two Prediction Cycle phase binding
description: Keep the custom recovery block and visible phase router on the same Blockly state variable.
---

For the 2 Prediction Cycle, resolve the recovery block's phase and paired-loss fields to the canonical `recovery_phase` and `paired_loss_count` workspace variables. Do not trust a stale recovery-block field ID if the canonical cycle variables exist; if a canonical variable is missing, create it and bind the field rather than falling back to an orphaned semantic match.

**Why:** Older workspaces can retain a recovery field pointing at an orphaned `recovery_phase2` variable. The generated bot then fails during after-purchase recovery, after the first contract settles.

**How to apply:** When changing Blockly recovery state resolution, keep it scoped to the paired-cycle workspace signature, create missing canonical variables, and test both the bundled XML and a stale/orphaned phase-field ID.

The intended cycle pairs Over 1 + Over 2 at one entry, then Under 8 + Under 7 at one entry. Each leg uses its own editable stake; winning continues the alternating cycle.

**Why:** The user explicitly confirmed that both contracts in each pair should enter together with their separate stake settings.

**How to apply:** Preserve both per-leg stake bindings and the pair purchase operation when repairing phase routing or martingale behavior; do not collapse a pair into one stake or treat the second order as a duplicate.
