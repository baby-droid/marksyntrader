---
name: Hedge independent martingale per leg
description: Pro Hedge (pro-hedge/index.tsx) uses per-leg running stake refs for independent martingale — a winning leg resets to base, a losing leg multiplies independently.
---

## Rule
Leg A and Leg B each have their own `runningStakeARef` / `runningStakeBRef` useRefs. On each settled hedge pair, if `resA.won` (or `profit > 0`) → reset A to `stakeA` base; if lost → multiply by `martA`. Same independently for B. Never use a shared martingale.

**Why:** Even/Odd hedge: if Even wins and Odd loses, only Odd should multiply — otherwise the winning leg is over-staked unnecessarily, wiping out the hedge advantage.

**How to apply:** `runningStakeARef.current` is what gets passed to `buyContract`. The `stakeA` state is the USER-SET BASE; always reset to it on a win. Display current running stake via `displayStakeA` state that mirrors the ref for the LegCard preview. Keep refs in sync with base stake via `useEffect(() => { runningStakeARef.current = stakeA; ... }, [stakeA])`.

Result detection: check `resA.profit > 0 || resA.won === true || resA.status === 'won'` (covers multiple API shapes from `useDerivTrading`).
