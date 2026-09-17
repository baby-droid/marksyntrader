---
name: Differs cycle XML validation
description: Structural rules for the two phase-cycle bot definitions and their generated copies.
---

Keep the Differs Edge Scanner phase machine free of `previous_parity` and `parity_streak` state. Its six main phases must be followed by explicit Odd/Even recovery phases selected from the captured loss digit; do not use an out-of-range fallback that silently skips a phase.

**Why:** parity-history initialization was added to the wrong bot and a malformed XML nesting error was not caught until the bot-specific test ran, allowing the AI load-and-run path to fail before trading.

**How to apply:** whenever either Differs cycle XML changes, parse both `public/bots/*.xml` definitions, verify the exact phase purchase order, and keep the corresponding `dist/bots/*.xml` copy synchronized. The Ahmed bot intentionally retains its own three-parity recovery state.