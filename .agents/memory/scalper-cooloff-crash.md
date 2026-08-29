---
name: Scalper cool-off stability
description: Cool-off must bound virtual telemetry and clear tick wait timers to avoid flooding React state and the browser timer queue.
---

# Scalper Cool-off Stability

## Rule

Cool-off telemetry keeps only the newest 120 `[COOL-OFF ...]` virtual rows while preserving real transactions. Tick waiters must clear their fallback timeout as soon as a live tick resolves them.

**Why:** Long or high-frequency cool-offs previously appended unbounded rows and left thousands of settled timeout callbacks behind, eventually making Scalper Bots unresponsive.

**How to apply:** Keep duration units normalized to `t/s/m/h`, update the countdown only when its displayed value changes, and never add unbounded per-tick state during a pause.