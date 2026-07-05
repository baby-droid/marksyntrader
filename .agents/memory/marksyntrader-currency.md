---
name: Currency display (KSH) pattern
description: How P/L, stake, and payout values must be handled so KSH display mode stays consistent app-wide.
---

All profit/loss/stake/payout values traded through the Deriv API are always in
the account's real currency (typically USD). The app also supports a KSH
"display currency" toggle (`src/utils/currency-display.ts`: `fromUsd`,
`toUsd`, `getDisplayCurrency`, `subscribeCurrency`).

**Rule:** any UI that renders a money amount coming from the API/account
(balance, profit, payout, contract stake results) must run it through
`fromUsd()` before display, and subscribe to `subscribeCurrency()` so it
updates live when the user flips the KSH toggle. Never hardcode a currency
string or use the raw API number directly.

**The trap (double-conversion):** several screens (Speed Lab, AI Assistant)
let the user *type* stake/take-profit/stop-loss values directly in the
display currency (input label reads "(KSH)"). Those typed values are
already in display units — do NOT run them through `fromUsd()` again for
display (that double-converts), and DO run them through `toUsd()` before
sending them to the trading API or comparing against a real USD P/L figure
(sending the raw KSH number as the USD `amount` causes buy calls to fail or
wildly over/under trade).

**How to apply:** keep two clearly separate helpers per component — one for
values that are already real USD (from the API) needing `fromUsd()` for
display, and one for values the user typed in display currency needing
`toUsd()` before use and plain formatting (no conversion) for display.

**Why:** this exact double-conversion bug caused unreliable/erroring buys in
Speed Lab and the AI Assistant, and inconsistent KSH totals in
Transactions/Summary/Journal (some screens used `Money`/`formatMoney`
directly against the account currency instead of the shared KSH-aware
component). Shared component: `src/components/shared_ui/ksh-money/ksh-money.tsx`
(`KshMoney` component + `formatKshAmount` helper) — reuse it instead of
re-implementing the conversion inline.
