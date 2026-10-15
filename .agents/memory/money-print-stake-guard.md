---
name: Money Print stake guard
description: Stake defaults and safe behavior when balance-based risk is below Deriv's minimum.
---

Money Print defaults to a fixed $0.35 base stake, with balance-based auto stake disabled until the user chooses it. If a user's risk percentage calculates below the minimum, block execution and let them deliberately switch to fixed stake; never raise the stake above their selected risk cap silently. Migrate only untouched legacy defaults and preserve user-customized settings.

**Why:** A $10 balance at 0.5% risk produces $0.05, below the configured minimum trade size. Rounding up would violate the user's risk limit, while blocking every new demo account would make testing confusing.

**How to apply:** Keep the risk cap authoritative in Money Print's stake calculator and settings migration. If the account minimum or currency-specific rule changes, update the minimum and tests without adding an automatic floor.
