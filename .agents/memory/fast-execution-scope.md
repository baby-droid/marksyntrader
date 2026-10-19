---
name: Fast execution scope
description: Where the shared Fast execution profile is allowed to affect trading behavior.
---

Normal Killer Bot V3 always uses zero-delay direct buys. Fast removes client-added waits in supported trading flows and sends one purchase per strategy-eligible market tick; it must not create same-tick duplicate contracts. Auto-Signals also requires a validated live signal and keeps one contract in flight. V3 may retain up to three pending/open contracts only across distinct tick entries. 2 Prediction Cycle and A-SPEED remain one-at-a-time.

**Why:** The user clarified that Fast should accelerate one distinct eligible tick entry rather than duplicate three contracts on that tick. Deriv and network latency mean a 0.0001-second purchase guarantee is not possible.

For Normal Killer V3, enforce the three-contract limit from pending/open contracts, not the total entry queue. Apply settled outcomes in entry order so martingale progression stays deterministic, but do not let already-settled side entries consume open-contract capacity while an older contract is still open.

**Why:** A total-queue cap can stop new tick entries after three purchases even when some side contracts have settled. Ordered outcome application preserves stake progression without making those completed contracts block capacity.

**How to apply:** Set the active trade context before starting a run. Deduplicate purchases by market/epoch and keep Fast at one order per eligible tick; only purpose-built pipelines may overlap orders from distinct ticks, with their existing in-flight and risk caps. In Auto-Signals retain signal/risk revalidation and one in-flight contract. Never force a trade when the strategy says the tick is not eligible. Keep 2 Prediction Cycle and A-SPEED sequential.

Normal Killer Bot V3 must not use Virtual Hook settings; its dedicated tick-wise acceleration block configures the runtime pipeline from the bot's stake and risk variables. The user-set martingale is applied after each loss, wins reset to base stake, and the visible stake must stay synchronized with pipeline state. Name its custom blocks with the `normal_killer_` prefix: `king_fisher_` block types activate unrelated King Fisher-specific after-purchase handling.

**Why:** The user explicitly requested hook-free tick acceleration and the configured loss multiplier to determine subsequent real purchase amounts; the King Fisher block prefix also selects additional interpreter behavior.

**How to apply:** Keep the XML hook-free, use `normal_killer_` block types, preserve the three-open-contract ceiling and per-tick deduplication, and pass the workspace multiplier into the pipeline. Fast and A-SPEED remove app-added pacing only; neither can guarantee a network/API purchase time of 0.0001 seconds.

Respect Deriv's current shared request budget for `proposal`, `proposal_open_contract`, `buy`, and `sell`; do not let accelerated modes bypass all local buy pacing. Use bounded exponential backoff on rate-limit errors and cap high-speed purchase retries.

**Why:** the documented trade-request budget is shared across prices, contract updates, buys, and sells; 5–100 ms retries or unpaced bursts can keep orders over budget and make otherwise valid buys fail.

**How to apply:** Recheck Deriv's current published limits before changing concurrency. Keep a buy-rate ceiling with headroom for proposal/contract calls, count retries independently of delay, and surface terminal async errors; preserve any accepted contract's settlement feed before stopping.

Purchase retry limits need an attempt counter separate from the backoff index. When an async Blockly block rejects, stop the run panel instead of leaving it at PURCHASE_SENT; if a contract was accepted, preserve its feed until settlement before stopping.

**Why:** a fixed backoff index can leave retries unbounded, while an unhandled async-block error can strand the panel at PURCHASE_SENT.

**How to apply:** Count every retry independently of its delay. On terminal async errors, show the error and halt the strategy; defer halting until an already-open contract settles.