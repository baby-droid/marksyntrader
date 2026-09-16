---
name: Loading screen two-phase design
description: The loading screen has two distinct phases triggered by progress crossing 50%.
---

## Phase 1 (0–50%): Landing page
Current component: `src/components/loading-screen/index.tsx`
Renders the full landing page with ticker, hero text, testimonials, features, and a bottom progress bar.

## Phase 2 (50–100%): AHMED TRADE centered screen
Triggered by `useEffect` watching `progress >= 50 && phase === 1` → sets `setPhase(2)`.
Renders `<Phase2Screen>` with:
- Three left feature cards (Market Analysis, Secure Platform, Fast Execution)
- Center: AT logo ring, AHMED TRADE title, progress bar, phrase
- Three right feature cards (Precise Strategy, Copy Trading, Grow Together)
- Bottom bar with taglines
CSS classes all prefixed `ls2-`.

**Why:** User requested a simpler second loading phase matching the AHMED TRADE branding image (AT logo + title) after the landing page.

**How to apply:** Progress is shared between both phases via the same RAF loop. Phase 2 receives current `progress` and `phraseIdx` as props.
