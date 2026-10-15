---
name: Fast execution scope
description: Where the shared Fast execution profile is allowed to affect trading behavior.
---

Normal Killer Bot V3 always uses zero-delay direct buys. Fast removes client-added waits in Bot Builder, Auto-Signals, Auto Trades, Speed Lab, Scalper Bots, and supported Free Bot flows. Fast permits up to three distinct purchases on one tick where supported; Auto-Signals uses that burst per validated signal cycle, with configured stake applied to each purchase. V3 reserves each entry and caps pending/open contracts at three. 2 Prediction Cycle and A-SPEED remain one-at-a-time.

**Why:** The user requested three Auto-Signals purchases per eligible tick while preserving cycle-level revalidation. Each purchase uses the configured stake, so Fast can raise per-cycle exposure to three times that amount. Deriv and network latency mean a 0.0001-second purchase guarantee is not possible.

For Normal Killer V3, enforce the three-contract limit from pending/open contracts, not the total entry queue. Apply settled outcomes in entry order so martingale progression stays deterministic, but do not let already-settled side entries consume open-contract capacity while an older contract is still open.

**Why:** A total-queue cap can stop new tick entries after three purchases even when some side contracts have settled. Ordered outcome application preserves stake progression without making those completed contracts block capacity.

**How to apply:** Set the active trade context before starting a run. Keep V3 Fast entries unique by market/epoch slot, count only pending/open entries toward the three-contract cap, and apply settled outcomes in order. Gate Auto-Signals' three-purchase burst behind Fast and retain its signal/tick checks between cycles; keep 2 Prediction Cycle and A-SPEED sequential.

Normal Killer Bot V3 must not use Virtual Hook settings; its dedicated tick-wise acceleration block configures the runtime pipeline from the bot's stake and risk variables. The user-set martingale is applied after each loss, wins reset to base stake, and the visible stake must stay synchronized with pipeline state. Name its custom blocks with the `normal_killer_` prefix: `king_fisher_` block types activate unrelated King Fisher-specific after-purchase handling.

**Why:** The user explicitly requested hook-free tick acceleration and the configured loss multiplier to determine subsequent real purchase amounts; the King Fisher block prefix also selects additional interpreter behavior.

**How to apply:** Keep the XML hook-free, use `normal_killer_` block types, preserve the three-open-contract ceiling and per-tick deduplication, and pass the workspace multiplier into the pipeline. Fast and A-SPEED remove app-added pacing only; neither can guarantee a network/API purchase time of 0.0001 seconds.