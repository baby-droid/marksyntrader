---
name: BOT_BUILDER tab constant bug
description: Why DBOT_TABS.BOT_BUILDER must equal AHMED_LEARNING, not a sentinel value
---

The Tabs component (src/components/shared_ui/tabs/tabs.tsx) renders a child's
content only when its position index matches active_tab_index; every other
child renders undefined. There is no fallback or clamping.

DBOT_TABS.BOT_BUILDER was previously set to 99 (intended as "the Bot Builder tab",
which is actually AHMED_LEARNING at index 1) as if it were a distinct sentinel.
Since no Tabs child sits at index 99, calling setActiveTab(DBOT_TABS.BOT_BUILDER)
blanked the entire tab content area — this broke the Dashboard's Bot Builder card,
Quick Strategy card, My Computer/Google Drive loaders, saved-bot list clicks,
tutorial tours, and announcement "switch tab" actions simultaneously, since they
all reference the same constant.

**Why:** DBOT_TABS.BOT_BUILDER is used purely as an alias for "navigate to the
Bot Builder tab" throughout the codebase (8+ call sites) — it was never meant to
be a separate tab.

**How to apply:** keep DBOT_TABS.BOT_BUILDER numerically equal to
DBOT_TABS.AHMED_LEARNING. If Bot Builder is ever split into its own visible tab
in the Tabs list, BOT_BUILDER must be updated to that tab's real position index,
not left as an arbitrary large number.
