# Pharos Audit-Log Agent: Final Activity Investigation & Remediation Report

**Project Name:** Pharos Audit-Log Agent  
**Repository:** `https://github.com/JimmyOgb/pharos-audit-log-agent`  
**Production URL:** `https://pharos-audit-log-agent-two.vercel.app`  
**Target Wallet:** `0xE4220c4b71877bb94EB173f467ef5c5557017085`  
**Network:** Pharos Atlantic Testnet  
**Chain ID:** `688689`  
**Release Commit:** `316de9d` (superseding `ba0e2ae`)  
**Production Deployment ID:** `dpl_5N4ccCmwvf5u1bGLK6bs4muBEjjS`  
**Status:** ALL PHASES COMPLETE & PRODUCTION VERIFIED  

---

## 1. Project Background & Initial Defect

The Pharos Audit-Log Agent is an on-chain forensic and accounting agent built for the Pharos Atlantic Testnet. In earlier releases, users auditing target wallet `0xE4220c4b71877bb94EB173f467ef5c5557017085` experienced two critical issues:
1. **Auto-Scan Stopping at Block 21,000:** Full-range date scans starting from Genesis (or early 2025) halted scanning after chunk 7 (block 21,000), leaving over 32.4 million blocks uninspected.
2. **Missing Swaps and Transfers:** Even within scanned blocks, genuine decentralized exchange swaps executed via the Pharos TestAMM Router and inbound native transfers were not detected or were misclassified as 100-trillion-unit standalone token transfers.

---

## 2. Root Cause Determination

| Defect Area | Mechanism | Root Cause |
|---|---|---|
| **Scan Progression Halt** | Clamped to Genesis Block 1 (Sep 28, 2025) across 32.5M blocks. | At 3,000 blocks/chunk, full coverage required 10,836 consecutive HTTP calls. Scanning forward from block 1 traversed only blocks 1–21,000 (all from the network's launch day, when the wallet had no transactions). Browser alert popups and unhandled timeouts aborted the loop without persistent resume prompts. |
| **Missing Swaps** | Event filters queried only Uniswap V2/V3 topics. | Pharos Atlantic ecosystem trades run through TestAMM Router (`0x5302b3cc1d7741dc6bf506349a51355e10b9de1d`) emitting `SwapExecuted` (`0x126fe2d5...`). Missing this topic signature excluded 100% of swaps. |
| **100-Trillion Token Inflation** | Erroneous hardcoded decimal table in classifier. | Token B (`0xf37815a7...`) has 18 decimals on-chain, but was hardcoded to 6 decimals (mistaken for USDC). 100 TKB was divided by $10^6$ instead of $10^{18}$, corrupting the output to 100 trillion tokens. |
| **Missing Native Inbound Transfers** | Native transfers emit no EVM logs; only sender nonces were tracked. | Standard JSON-RPC does not index incoming transactions. Nonce-based search discovers only outbound transactions. Inbound funding transactions were omitted. |

---

## 3. Engineering Remediations Implemented

1. **TestAMM Router Swap Integration (`activityFetcher.ts` & `classifier.ts`):**
   - Ingested `TOPIC_SWAP_EXECUTED` (`0x126fe2d5...`) and `TOPIC_SWAP_UNWOUND` (`0xa1203832...`).
   - Implemented ABI decoding for `SwapExecuted` (swapId, sender, fromToken, toToken, amountIn, amountOut).
   - Added synthetic dual-leg AMM trade correlation to automatically pair outbound and inbound token legs within the same transaction receipt.
   - Tagged swap token transfers with `isSwapComponent = true` and `[Swap Leg]` titles so transfer volumes are not double-counted.

2. **Dynamic On-Chain Token Metadata Resolution (`classifier.ts`):**
   - Replaced fragile hardcoded tables with dynamic `decimals()` and `symbol()` contract calls with memory caching.
   - Correctly resolved `0xf37815a7...` as 18 decimals (`TKB`), eliminating amount corruption and correctly displaying `100.0000 TKB`.

3. **Inbound Native Transfer Discovery (`nativeFetcher.ts`):**
   - Implemented balance delta analysis (`eth_getBalance`) between `fromBlock - 1` and `toBlock`.
   - Used binary search over balance increases to pinpoint the exact funding block, followed by block transaction inspection.

4. **UI Resiliency & Presets (`views.ts`):**
   - Added quick date presets ("Active Window Oct–Nov 2026" vs "Genesis Full Range").
   - Implemented non-blocking status notifications and exponential backoff retry.
   - Enabled local storage persistence with a "Resume Prior Scan" button.

---

## 4. Positive-Control Matrix: Read-Only Verification

All 5 positive controls were verified 100% on-chain and against the live production deployment:

| Activity Type | Tx Hash | Block | Timestamp | Expected Category | Live Production Result |
|---|---|---|---|---|---|
| **Native Transfer Out** | `0xbc63023089ccd1856d956f23288b58165fda5e8cf9e56f668cfbf0f13f2c9bf9` | `32463702` | 2026-11-08 04:50:44 UTC | `transfers_out` | **25.0000 PHAROS** sent to `0x709979...dc79c8` |
| **Native Transfer In** | `0xa3df2f7c5f17ce80ad099c3d65f08236003ab7016fa5d49ce783664e8908ecc4` | `16115924` | 2026-03-14 15:27:48 UTC | `transfers_in` | **0.0100 PHAROS** received from `0x196fc6...6b1493` |
| **ERC-20 Transfer Out (Swap Leg)** | `0x1123d411185a0d5d3120eb7895ebad3a6718f78cd3a2d8f022b16f1bc3e0675a` | `31674475` | 2026-10-20 20:24:42 UTC | `transfers_out` | **100.0000 TKA** sent to TestAMM Router (marked Swap Leg) |
| **ERC-20 Transfer In (Swap Leg)** | `0x1123d411185a0d5d3120eb7895ebad3a6718f78cd3a2d8f022b16f1bc3e0675a` | `31674475` | 2026-10-20 20:24:42 UTC | `transfers_in` | **100.0000 TKB** received from TestAMM Router (18 dec) |
| **AMM Swap** | `0x1123d411185a0d5d3120eb7895ebad3a6718f78cd3a2d8f022b16f1bc3e0675a` | `31674475` | 2026-10-20 20:24:42 UTC | `swaps` | **TestAMM 1:1 Swap (100.0000 TKA → 100.0000 TKB)** |

---

## 5. Production Release Verification

- **Repository:** `https://github.com/JimmyOgb/pharos-audit-log-agent`
- **Pushed Commit:** `316de9d` (`main`)
- **Vercel Deployment ID:** `dpl_5N4ccCmwvf5u1bGLK6bs4muBEjjS`
- **Production URL:** `https://pharos-audit-log-agent-two.vercel.app`
- **Automated Tests:** 44/44 passed
- **Live Endpoint Checks:**
  - `GET /api/health`: 200 OK (Chain ID 688689, Pharos Atlantic Testnet)
  - `POST /api/report`: 200 OK (Detected swaps, inbound/outbound native transfers)
  - `POST /api/export/markdown`: 200 OK
  - `POST /api/export/csv`: 200 OK
  - `POST /api/export/pdf`: 200 OK

---

## 6. Prohibited Action Compliance Statement

In strict adherence to instructions:
- No new repositories or Vercel projects were created.
- Pushed only to the authorized repository (`JimmyOgb/pharos-audit-log-agent`) and deployed to the existing project (`pharos-audit-log-agent-two.vercel.app`).
- Zero state-changing transactions were signed or broadcasted.
- Zero gas was spent and no paid APIs were utilized.
- No submissions were made to Pharos Agent Arena and no video files were published.
- All blockchain and explorer investigations were 100% read-only.
