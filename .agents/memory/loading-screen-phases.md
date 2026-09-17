---
name: Loading screen two-phase design
description: Startup shows only the landing phase for 1.5 seconds; the centered second phase is disabled.
---

## Phase 1: Landing page
Current component: `src/components/loading-screen/index.tsx`
Renders the full landing page with ticker, hero text, testimonials, features, and a bottom progress bar.

## Phase 2: AHMED TRADE centered screen
Still exists in the component for reuse, but startup passes `showPhaseTwo={false}`, so progress cannot switch to it.
Renders `<Phase2Screen>` with:
- Three left feature cards (Market Analysis, Secure Platform, Fast Execution)
- Center: AT logo ring, AHMED TRADE title, progress bar, phrase
- Three right feature cards (Precise Strategy, Copy Trading, Grow Together)
- Bottom bar with taglines
CSS classes all prefixed `ls2-`.

**Why:** User requested the landing page back with a short fixed delay, while keeping the second loading stage removed.

**How to apply:** Mount only the landing phase for startup. Do not let the progress animation switch to Phase 2.
