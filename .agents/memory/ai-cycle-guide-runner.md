---
name: AI cycle guide runner
description: The shared cycle guide's scan and Bot Builder execution responsibilities.
---

The AI cycle guide may render without an execution callback, so every mounted instance intended to run a bot must provide a guided loader that patches market/digit guidance, loads the executable XML into Bot Builder, and invokes the existing Run button. Keep scan recommendations locked for the current three-run cycle; refresh the market and Differs digit only at the next cycle boundary.

**Why:** the Free Bots instance had the loader, but the Run Panel instance omitted it, hiding Load & Run even though authenticated scanning and entry detection were already implemented.

**How to apply:** when mounting `AiCycleGuide`, pass the same guided-load behavior used by the Free Bots flow or a shared equivalent. Do not auto-start a live bot merely because a feed reaches an entry signal; require the visible Load & Run action.