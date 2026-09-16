---
name: Copy-trading timing — pre-signal to sync entry ticks
description: Why master and follower settle on different exit digits, and the fix
---

## Rule
Publish `publishMasterTrade` **before** sending the buy (after the proposal), not after the buy confirmation. This is the "pre-signal" path already designed into the copy engine.

**Why:** With post-signal (after buy confirmation), the follower's buy is delayed by 2+ RTTs (~200-400ms). On 1-second tick markets (V10, V75 1s), this is 1-2 ticks. Master and follower then settle on DIFFERENT exit ticks → opposite win/loss results, creating the apparent "inversion after first 2 trades" bug.

**How to apply (chart-trade-panel.tsx buy()):**
1. Get proposal → have `proposalId` and `askPrice`.
2. Call `publishMasterTrade(...)` WITHOUT `contract_id` → pre-signal path (Layer 2 in engine, fingerprint dedup).
3. Send buy immediately after → get `contractId`.
4. Call `publishMasterTrade({ ..., contract_id: contractId })` WITH contract_id → registers in `mirroredContracts`, blocking the transaction-backup path from duplicating the follower purchase.

**Engine handling:**
- Pre-signal (no contract_id): Layer 2 → stores `preSignaledFps.set(fp, now)` → follower buys.
- Post-signal (with contract_id): Layer 1 → finds fingerprint in `preSignaledFps` → skips buy but registers `mirroredContracts.add(contract_id)`.
- Transaction backup (with same contract_id): Layer 1 → `mirroredContracts.has(id)` → blocked.

No double-purchase, both signals are needed.
