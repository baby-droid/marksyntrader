---
name: Auto-Signals run session
description: Auto-Signals trade progress and stop monitoring across tab navigation.
---

Auto-Signals run tracking must outlive the Auto-Signals page component. The main Tabs component renders only its active child, so handing a bot to Bot Builder unmounts the scanner page while the trade continues. Keep contract/stop observation in the shared run-session module and let the page subscribe to its snapshot.

**Why:** page-scoped observers and state disappear on the intentional handoff to Bot Builder, losing progress.

**How to apply:** if the handoff lifecycle changes, preserve a single observer owner across tab switches; do not move run tracking back into a page-only effect. Enforce the configured run limit in the generated Blockly after-purchase flow; the settlement observer reports progress but must not interrupt that flow at the limit.

Auto-Signals action bots use one-tick duration across digit, parity, and price-direction contracts. Show historical alignment as context, not as a promise or probability of future wins.

**Why:** the user specified one-tick trades; no signal score can guarantee a winning result in a stochastic market.

**How to apply:** preserve duration 1 tick in generated Auto-Signals bot XML, evaluate Rise/Fall on adjacent ticks, and label historical fit separately from win probability.

The Entry Trade recovery rule is two consecutive Over 4 losses, then Under 5; a win resets the sequence to Over 4.

**Why:** this is the recovery sequence requested for Auto-Signals Entry Trade.

**How to apply:** keep the phase and consecutive-loss state in the generated bot's before/after-purchase logic so it survives the scanner-to-Bot-Builder handoff.

Show each candidate's observed per-window hit rate separately from its alignment score. The latest-20 rate is descriptive history, not a forecast.

**Why:** the supplied analysis distinguishes measured outcomes from predictive probability, and small samples can mislead.

**How to apply:** preserve separate cards for contract/barrier alternatives, label empirical rates by sample window, and do not call them win probabilities.
