---
name: Auto-Signals run session
description: Auto-Signals trade progress and stop monitoring across tab navigation.
---

Auto-Signals run tracking must outlive the Auto-Signals page component. The main Tabs component renders only its active child, so handing a bot to Bot Builder unmounts the scanner page while the trade continues. Keep contract/stop observation in the shared run-session module and let the page subscribe to its snapshot.

**Why:** page-scoped observers and state disappear on the intentional handoff to Bot Builder, losing progress.

**How to apply:** if the handoff lifecycle changes, preserve a single observer owner across tab switches; do not move run tracking back into a page-only effect. Every action must use the same candidate-recommended cycle count shown on its card, capped by settings. Generated Blockly must continue after wins and losses until the cap; the settlement observer reports progress but must not interrupt the after-purchase flow.

Auto-Signals action bots use one-tick duration across digit, parity, and price-direction contracts. Show historical alignment as context, not as a promise or probability of future wins.

**Why:** the user specified one-tick trades; no signal score can guarantee a winning result in a stochastic market.

**How to apply:** preserve duration 1 tick in generated Auto-Signals bot XML, evaluate Rise/Fall on adjacent ticks, and label historical fit separately from win probability.

The Entry Trade recovery rule is two consecutive Over 4 losses, then Under 5; a win resets the sequence to Over 4.

**Why:** this is the recovery sequence requested for Auto-Signals Entry Trade.

**How to apply:** keep the phase and consecutive-loss state in the generated bot's before/after-purchase logic so it survives the scanner-to-Bot-Builder handoff.

Show each candidate's observed per-window hit rate separately from its alignment score. The latest-20 rate is descriptive history, not a forecast.

**Why:** the supplied analysis distinguishes measured outcomes from predictive probability, and small samples can mislead.

**How to apply:** preserve separate cards for contract/barrier alternatives, label empirical rates by sample window, and do not call them win probabilities.

Auto-Signals candidates require a full 1,000-tick baseline, a 95% Wilson lower bound above the contract's fair-rate baseline, and agreement from at least two longer windows before they can receive a run recommendation. The alignment score maps to a 0–20 run ceiling; it is not a calibrated win probability or payout/EV estimate. Execute one contract per signal cycle with no added post-settlement wait.

**Why:** the supplied strategy specification distinguishes historical observations from calibrated prediction and requires revalidation after each settlement; the app does not have an out-of-sample calibration or payout/EV gate.

**How to apply:** keep the 1,000-tick and multi-window evidence gates, enforce the same 20-cycle maximum in the UI and generated XML, and do not make Fast mode dispatch multiple contracts in one cycle. Preserve one-tick duration, live-signal checks, and per-settlement revalidation.

The Matches family must score only Matches candidates and rescan its cached authenticated tick window once per minute; quote and feed status can continue updating from live ticks between rescans. Entry Trade runs its entry gate inside the generated XML so it survives the Auto-Signals-to-Bot-Builder handoff. Rise uses exactly 2 falls, 2 falls then 1 rise, or 3 falls; Fall uses 3 or 4 rises then 1 fall, or 5 consecutive rises. Over/Under entries choose between 1/8 and 2/9 using recent observed next-tick outcomes.

**Why:** The user requested a one-minute Matches scan, exact tick-sequence entries, and the scanner-selected entry digit to govern the bot after page navigation.

**How to apply:** Re-score the selected family (not AUTO) on its schedule, keep the underlying authenticated feed live, patch the XML entry gate with the selected strategy/digit, and preserve one-tick duration and the XML-owned run limit.

Matches must predict the next target digit conditional on the current entry digit: choose the pair on the first 70% of the 1,000-tick window and validate it on the held-out final 30%. The Matches Trade Only handoff uses Ahmed SYN Even/Odd Market Killer v1.2, sets its exact target barrier, gates every purchase on the selected entry digit, and carries the card's edited suggested run count into the bot's run cap.

**Why:** Marginal digit frequency does not identify which target follows the current digit; the user asked for more accurate Matches predictions and the named bot.

**How to apply:** Keep the training/holdout split, validation threshold, entry digit, target barrier, and suggested run limit synchronized from the Matches card through the generated bot. Label historical results as evidence, not a guarantee.
