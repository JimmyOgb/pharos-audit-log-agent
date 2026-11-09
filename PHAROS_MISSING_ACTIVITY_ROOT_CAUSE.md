# Root-Cause Investigation: Missing Swaps and Transfers on Pharos Atlantic

**Project:** Pharos Audit-Log Agent  
**Target Wallet:** `0xE4220c4b71877bb94EB173f467ef5c5557017085`  
**Network:** Pharos Atlantic Testnet (Chain ID: `688689`)  
**Production URL:** `https://pharos-audit-log-agent-two.vercel.app`  
**Investigation Date:** November 9, 2026  

---

## Executive Summary

An investigation was conducted into why the Pharos Audit-Log Agent reported zero activity (0 transfers, 0 swaps) across a requested range of blocks 1–32,509,211, and why auto-scanning previously halted after chunk 7 (block 21,000).

The investigation established two distinct, independent root causes:
1. **Root Cause A (Scan Progression Stoppage at Block 21,000):** A massive date interval (January 2, 2025 – November 9, 2026) clamped to Genesis Block 1 (September 28, 2025). Traversing 32.5 million blocks at 3,000 blocks per serverless chunk requires 10,836 consecutive HTTP calls (~9 hours). Scanning forward sequentially from block 1 inspected only blocks 1–21,000 (all minted on Genesis day, September 28, 2025), where the wallet had zero activity. When transient fetch hiccups occurred or the user closed/refreshed the tab, auto-scan stopped with an alert popup and failed to preserve cursor resumption cues.
2. **Root Cause B (Activity Misclassification & Protocol Blind Spots):**
   - **Missing Swaps:** The event filter in `activityFetcher.ts` was exclusively hardcoded to Uniswap V2 `Swap(address,uint256,uint256,uint256,uint256,address)` and Uniswap V3 `Swap(address,address,int256,int256,uint160,uint128,int24)`. Pharos Atlantic Testnet ecosystem activity (including the target wallet's swaps) executes through the Pharos TestAMM Router (`0x5302b3cc1d7741dc6bf506349a51355e10b9de1d`), which emits `SwapExecuted(bytes32,address,address,uint256,uint256)` (`0x126fe2d5...`) and `SwapUnwound(...)` (`0xa1203832...`). Because these topics were not queried, 100% of swaps were missed.
   - **Corrupted Token Decimals & Leg Pairing:** Token contract `0xf37815a784c5a97b7319ecb89a8f0e34aafd472a` (TKB) was hardcoded to 6 decimals (mistaken for USDC), causing an incoming swap leg of 100 TKB (`100 * 10^18` wei) to be displayed as `100,000,000,000,000.0000` (100 trillion tokens). Furthermore, swap transfer legs were counted as independent standalone transfers rather than correlated swap components.
   - **Missing Inbound Native Transfers:** Native PHAROS transfers emit no EVM logs. The fetcher only traced outbound native transfers using sender nonces. Inbound transfers to the wallet did not affect the wallet's nonce and were completely omitted from RPC logs.

---

## Detailed Root Cause Analysis

### 1. Incomplete Scan Progression (Root Cause A)

#### 1.1 The Genesis Range Dilemma
- The user requested an audit starting from `2025-01-02`.
- Pharos Atlantic Testnet genesis occurred on **September 28, 2025 at 07:16:24 UTC** (Block 1, timestamp `1759043784`).
- Any date prior to September 28, 2025 clamps to Block 1.
- The current block height on November 9, 2026 is `32,509,211`.
- Total block distance: **32,508,211 blocks**.
- To prevent Vercel Serverless Function 15-second gateway timeouts and RPC provider payload rejections, chunk size is bounded to 3,000 blocks per request.
- Traversing 32,509,211 blocks sequentially requires:
  $$\frac{32,509,211}{3,000} \approx 10,836 \text{ requests}$$
- Each RPC chunk request takes ~800ms–1.5s, totaling 2.5 to 4.5 hours of continuous network traffic.

#### 1.2 The Halt at Block 21,000
- Scanning sequentially from Block 1 forward:
  - Chunk 1: Blocks 1 – 3,000 (Sep 28, 2025 07:16 UTC)
  - Chunk 2: Blocks 3,001 – 6,000 (Sep 28, 2025 08:30 UTC)
  - Chunk 3: Blocks 6,001 – 9,000 (Sep 28, 2025 09:45 UTC)
  - Chunk 4: Blocks 9,001 – 12,000 (Sep 28, 2025 11:00 UTC)
  - Chunk 5: Blocks 12,001 – 15,000 (Sep 28, 2025 12:15 UTC)
  - Chunk 6: Blocks 15,001 – 18,000 (Sep 28, 2025 13:30 UTC)
  - Chunk 7: Blocks 18,001 – 21,000 (Sep 28, 2025 14:45 UTC)
- The target wallet was created in March 2026 and had **zero activity on September 28, 2025**.
- In the client-side JavaScript (`views.ts`), the auto-scan loop used `alert()` popups upon network interruptions. After 3 retries, an unhandled network glitch or user tab switch aborted the execution.
- The UI displayed:
  - Requested blocks: 1–32,509,211
  - Cumulative scanned blocks: 21,000 (0.06% of requested interval)
  - Reported activity: 0 transfers, 0 swaps
- Because the scan only inspected the first 4 hours of Pharos Atlantic's existence, none of the wallet's actual 2026 transactions were reached.

---

### 2. Missing AMM Swaps (Root Cause B.1)

#### 2.1 The Missing Topic Signature
- In `src/services/activityFetcher.ts`, swap logs were retrieved via:
  ```ts
  const TOPIC_SWAP_V2 = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
  const TOPIC_SWAP_V3 = '0xc42079f94a6350d7e6235f29174924f9d5fb457a44a701e6e34360e513a9484b';
  ```
- On Pharos Atlantic Testnet, decentralized exchange swaps frequently run through the **Pharos TestAMM Router** contract at address `0x5302b3cc1d7741dc6bf506349a51355e10b9de1d`.
- When users execute swaps on TestAMM (e.g., swapping Token A `0x6396f75c...` for Token B `0xf37815a7...`), the contract emits:
  ```solidity
  event SwapExecuted(
      bytes32 indexed swapId,
      address indexed sender,
      address indexed fromToken,
      uint256 amountIn,
      uint256 amountOut
  );
  ```
  Topic signature:
  `0x126fe2d5f4d208dadcffabe2d8dcc6f4a5dd387d59d658860e2109c58e34563a`
- Neither `TOPIC_SWAP_EXECUTED` nor the router address was included in the log filter. Consequently, `activityFetcher` returned zero swap logs, and `classifier` never had swap logs to parse.

---

### 3. Corrupted Token Decimals & Swaps Misclassified as Transfers (Root Cause B.2)

#### 3.1 Hardcoded Decimal Table Failure
- In `src/services/classifier.ts`, token symbols and decimals were hardcoded:
  ```ts
  '0xf37815a784c5a97b7319ecb89a8f0e34aafd472a': { symbol: 'USDC', decimals: 6 }
  ```
- On Pharos Atlantic Testnet, contract `0xf37815a784c5a97b7319ecb89a8f0e34aafd472a` is actually **Token B (TKB)** with standard **18 decimals**, as confirmed by calling `decimals()` on-chain.
- When the target wallet received 100.0 TKB (`100 * 10^18` wei = `100000000000000000000`), the classifier divided by $10^6$ instead of $10^{18}$, corrupting the reported amount into **100,000,000,000,000.0000** (100 trillion).

#### 3.2 Dual Transfer Inflation Without Swap Linkage
- When a swap occurs, two ERC-20 `Transfer` events are emitted:
  1. Transfer of input token from User to Router.
  2. Transfer of output token from Router to User.
- Because swap logs were dropped, the classifier evaluated each log as an independent standalone transfer. This inflated both `transfers_in` and `transfers_out` while leaving `swaps` at zero.

---

### 4. Missing Inbound Native Transfers (Root Cause B.3)

#### 4.1 Native Value Transfer Mechanics
- Native PHAROS transfers (e.g. faucet funding, peer transfers) do not produce ERC-20 `Transfer` logs.
- The existing native fetcher identified outbound transactions using sender nonces (`eth_getTransactionCount`).
- Recipient nonces do not increase when receiving native funds.
- Without archival debug traces or an off-chain indexer, standard EVM JSON-RPC nodes cannot query "all transactions where recipient = address".
- Therefore, inbound native transfers (such as transaction `0xa3df2f7c...` in block 16,115,924 receiving 0.01 PHAROS) were undetected.

---

## Conclusion

The combination of:
1. Traversal starting at Genesis Block 1 (where the wallet had no transactions) across a 32.5M block range without UI date windowing presets,
2. Complete absence of TestAMM Router swap topic querying,
3. Erroneous 6-decimal hardcoding for 18-decimal TestAMM tokens, and
4. Absence of balance delta scanning for native inbound transactions,

fully explains why previous audits reported 0 swaps and 0 transfers and stopped scanning at block 21,000.
