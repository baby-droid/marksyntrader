---
name: Parity auto cycles
description: Entry semantics and risk controls for the Odd Auto Cycle and Even Auto Cycle bots.
---

ODD AUTO CYCLE buys DIGITODD when the latest digit equals the user-selected weak Even entry, or when the latest three digits are selected Strong Even, selected Strong Even, then any Odd. EVEN AUTO CYCLE mirrors this: selected weak Odd buys DIGITEVEN, or selected Strong Odd twice followed by any Even buys DIGITEVEN.

**Why:** The user-defined weak and strong digits are entry points, while the final opposite-parity digit is the trigger for the strong pattern. Treating both selected strong digits as exact values keeps the cycle deterministic and configurable.

**How to apply:** Cycle bots place one contract per signal, wait for a new digit window, and expose per-bot martingale, take-profit, and stop-loss controls. Keep the shared base stake as the starting stake and preserve the martingale stake when resuming after a loss.