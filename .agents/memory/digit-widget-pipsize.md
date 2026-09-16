---
name: Digit widget pip_size bug
description: Why the digit % widget showed digit-0 at 99%+ for Jump/1s markets, and the correct fix pattern.
---

## The bug

The Deriv `ticks_history` WebSocket response delivers the history batch **before** the first live tick. The widget was immediately computing `getLastDigit(price, pipSizeRef.current)` using a static default pip_size from the `MARKETS` array.

Several markets had wrong static pip sizes:
- `1HZ25V` (Volatility 25 (1s)): was 3, should be 2
- `JD25` (Jump 25): was 3, should be 2

With `pipSize=3` but actual 2-decimal prices (e.g. `113322.02`), `toFixed(3)` yields `"113322.020"` — last character is always `"0"`, so digit 0 accumulates 99%+ of the count.

## The fix (two-layer)

**Layer 1 — fix static defaults** in the `MARKETS` array in `digit-percent-widget.tsx`:
- `1HZ25V`: 2, `JD25`: 2, `JD100`: 2, `1HZ100V`: 2 (all confirmed by API prices)

**Layer 2 — deferred history rendering** (`src/components/digit-percent-widget/digit-percent-widget.tsx`):
- Add `rawHistoryRef` (stores raw price numbers from history batch)
- Add `pipSizeConfirmedRef` (false until first live tick arrives)
- On history message: store raw prices in ref, do NOT call `setTicks` yet
- On first live tick: read `data.tick.pip_size`, set `pipSizeConfirmedRef = true`, retroactively compute digits from `rawHistoryRef` using the confirmed pip_size, call `setTicks`
- On subsequent ticks: update `pipSizeRef.current` from `data.tick.pip_size` normally

**Why:** `useRef` initial value only applies on first render. Switching markets resets refs in the useEffect cleanup, but the history-arrives-before-tick race is always present on every new subscription.

## Correct static pip sizes
- R_10: 3, R_25: 3, R_50: 4, R_75: 4, R_100: 2
- 1HZ10V: 3, 1HZ25V: **2**, 1HZ50V: 4, 1HZ75V: 4, 1HZ100V: **2**
- JD10: 3, JD25: **2**, JD50: 4, JD75: 4, JD100: **2**
- CRASH/BOOM/stpRNG: 2, RDBEAR/RDBULL/RBREAKOUT: 4
