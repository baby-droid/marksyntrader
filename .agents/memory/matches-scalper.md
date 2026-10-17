---
name: Matches Scalper behavior
description: User-confirmed scan, entry, retry, session-win and speed-mode rules for the two Matches Scalper bots.
---

Matches Scalper has exactly two lanes: Match 0–5 and Match 6–9. Rank observed target digits using the newest 20 ticks and newest 10 ticks; try at most three targets, with three attempts for the first and two for each following target. Random entry evaluates the latest five digits; selected entry waits for the most-active digit from the opposite entry range to touch in that five-tick window.

For accurate history, wait for an authenticated live tick's authoritative `pip_size`, decode raw history prices with that precision, and deduplicate history/live ticks by epoch. After a winning match, refresh the target ranking and keep the session running; celebrate at the second session win without interrupting trading. Respect configured take-profit, stop-loss, VPS, and other risk controls. Fast modes reduce client-side waits only and must not bypass entry rules.

**Why:** The user specified the two-lane behavior and wants the Matches bots to behave like the existing scalpers while continuing after wins.

**How to apply:** Preserve these rules when changing Matches scanning, entry selection, retry counts, celebration, VPS behavior, or execution-speed handling.
