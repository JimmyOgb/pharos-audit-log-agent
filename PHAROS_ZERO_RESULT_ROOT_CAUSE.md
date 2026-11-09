# Pharos Audit-Log Agent — Zero-Result Root Cause Analysis

**Project:** Pharos Audit-Log Agent  
**Repository:** https://github.com/JimmyOgb/pharos-audit-log-agent  
**Production URL:** https://pharos-audit-log-agent-two.vercel.app  
**Audited Wallet (Positive Control):** `0xE4220c4b71877bb94EB173f467ef5c5557017085`  
**Verified Historical On-Chain Transaction:** `0xbc63023089ccd1856d956f23288b58165fda5e8cf9e56f668cfbf0f13f2c9bf9`  
**Block Number:** `32463702` (Timestamp: `1794113444` / `2026-11-08T04:50:44.000Z`)  
**Network:** Pharos Atlantic Testnet (`Chain ID: 688689`)  

---

## 1. Forensic Chain Verification

Before performing root-cause analysis, the historical transaction `0xbc63023089ccd1856d956f23288b58165fda5e8cf9e56f668cfbf0f13f2c9bf9` was independently re-verified against the Pharos Atlantic Testnet RPC (`https://atlantic.dplabs-internal.com`):

- **Sender (`from`):** `0xe4220c4b71877bb94eb173f467ef5c5557017085` (matches audited wallet)
- **Recipient (`to`):** `0x70997970c51812dc3a010c7d01b50e0d17dc79c8`
- **Native Value:** `25000000000000000000` Wei (`25.0000 PHAROS`)
- **Block Height:** `32,463,702`
- **Block Timestamp:** `1794113444` (`2026-11-08T04:50:44.000Z`)
- **Receipt Status:** `success` (`1`)
- **EVM Logs Count:** `0` (pure native PHAROS transfer, no event logs emitted)
- **Account Nonce History:**
  - Nonce at block `32463701` (prior block): `4246`
  - Nonce at block `32463702` (inclusion block): `4247` (incremented by +1)
  - Nonce at latest block `32500668`: `4247` (no further outbound transactions)

This confirms beyond doubt that the audited wallet executed a genuine 25.0000 PHAROS native outbound transfer on November 8, 2026.

---

## 2. Root-Cause Investigation Matrix

| Stage | Expected | Actual | Finding |
| :--- | :--- | :--- | :--- |
| **Request** | Accepts wallet and requested date range (e.g. `2026-11-08` to `2026-11-09` or past 7 days). | Successfully receives `address` and date strings. | Handled correctly by `/api/report`. |
| **Date Resolver** | Accurately converts requested date timestamps to Atlantic block heights using real block cadence. | Assumed fixed `1.0s/block` (`latestNumber - seconds`). Atlantic block time is actually **`~2.17s/block`** (`37,015 blocks / 80,381s`). | **DEFECT 1**: Date-to-block resolution was off by **43,383 blocks** for 24-hour calculations, pointing to block `32,420,319` instead of `32,463,702`. |
| **Chunking** | Serverless bounded chunks (up to 3,000 blocks) should scan either forward from start or safely partition range. | Clamped range to latest 3,000 blocks (`32497000..32500000`). | Block `32463702` is ~37,000 blocks in the past, so the initial window inspected only the most recent ~1.8 hours. |
| **Continuation Cursor** | `continuationCursor` should yield a safe, bounded next chunk (e.g. 3,000 blocks) and preserve session state. | Yielded `nextFromBlock: 32403368, nextToBlock: 32486768` — an unbounded **83,401-block span** in a single cursor. | **DEFECT 2**: Clicking "Scan Next Chunk" attempted to query 83,401 blocks in one HTTP call, triggering Vercel execution timeouts or RPC failures. |
| **Continuation Completeness** | Cursor requests must preserve partial status until the entire requested range is covered. | When `cursor` was provided, `blockResolver.ts` hardcoded `completeness: 'COMPLETE'`, `omittedBlockCount: 0`. | **DEFECT 3**: A continuation chunk falsely claimed 100% complete coverage for only a slice of the audit. |
| **Native Fetcher** | Discovers outbound transfers via account nonce transitions in `[fromBlock, toBlock]`. | Used `endNonce = nonce(toBlock)` and `startNonce = nonce(fromBlock)`. | **DEFECT 4**: `nonce(fromBlock)` includes transactions in `fromBlock`. If `fromBlock == toBlock`, `endNonce - startNonce == 0`. Must query `fromBlock - 1n` to include transactions at `fromBlock`. |
| **Event Fetcher** | Retrieves wallet logs across scanned chunks via direct JSON-RPC serialization. | Fetches ERC-20, NFT, Approval, and Swap topics cleanly. | Topic serialization and filter hygiene function as intended. |
| **Classifier** | Accurately categorizes logs and native transactions. | Preserves canonical topic0, indexed address checks, and allowance verification. | Classifier works properly once genuine records reach it. |
| **Aggregator** | Accumulates activities across successive continuation chunks. | Neither backend nor frontend preserved or merged activities across chunks. | **DEFECT 5**: Running continuation completely erased chunk 1's activities and rendered only chunk 2's data. If chunk 1 or 2 had 0 events, earlier events were lost. |
| **Report** | Distinguishes native PHAROS vs ERC-20 and reports total coverage truthfully. | Shows zero events because the initial 3,000 blocks contained no transactions, continuation was unbounded/unmerged, and block time was inaccurate. | **ROOT CAUSE**: The zero-result report was caused by the combination of block time miscalculation, unbounded continuation chunking, absence of cross-chunk activity accumulation, and off-by-one nonce boundary checking. |
| **UI / Export** | Consistent rendering and export across Web, Markdown, CSV, and PDF. | UI replaces state instead of accumulating; exports only reflect the latest single chunk. | Exporters reflect whatever report is generated; once accumulation is fixed, all exports will accurately reflect the full audit. |

---

## 3. Detailed Root-Cause Analysis

### Defect 1: Fixed 1.0s/Block Cadence Assumption
Pharos Atlantic Testnet has an empirical block cadence of **2.17 seconds per block**:
- Block `32,463,702`: timestamp `1794113444` (`2026-11-08T04:50:44Z`)
- Block `32,500,717`: timestamp `1794193825` (`2026-11-09T03:10:25Z`)
- Block Delta: `37,015 blocks` over `80,381 seconds` = `2.1716 s/block`.

Assuming `1.0s/block` caused a 24-hour requested window to map to `86,400 blocks` instead of `~39,800 blocks`, causing start block calculations to drift over 43,000 blocks into the distant past and distorting chunk coverage calculations.

### Defect 2: Unbounded Continuation Cursors
When an audit range exceeded `3,000 blocks`, `blockResolver.ts` created a continuation cursor spanning the entire remainder (`resolvedStartBlock` to `actualFromBlock - 1n`), which for a 24-hour or 7-day query is 83,000+ blocks. When submitted, the backend attempted to scan 90+ RPC chunks inside a single serverless invocation, causing timeouts (`504 Gateway Timeout` or `FUNCTION_INVOCATION_TIMEOUT`) or RPC rate-limit failures.

### Defect 3: Nonce Transition Off-by-One Boundary Error
In EVM JSON-RPC:
`eth_getTransactionCount(address, blockNumber)` returns the count of transactions executed up to and including `blockNumber`.
`nativeFetcher.ts` computed:
`outboundTxCount = nonce(toBlock) - nonce(fromBlock)`.
Any transaction executing in `fromBlock` was subtracted away and omitted. If a chunk started at block `32,463,702`, the transaction at block `32,463,702` was invisible. The baseline nonce must be queried at `fromBlock - 1n`.

### Defect 4: Absence of Cross-Chunk Activity Accumulation
Neither the `/api/report` endpoint nor the frontend web application retained previous chunk findings during continuation. When a user clicked "Scan Next Chunk", the newly returned chunk replaced the previous report in its entirety. If the first chunk had 0 events and the second chunk failed, or if an earlier chunk had events that were subsequently overwritten by a zero-event chunk, the user was left with a zero-result display.

### Defect 5: Inbound Native Transfer Infrastructure Disclosure
Standard EVM RPC nodes (`eth_getLogs`, `eth_getTransactionCount`, `eth_getBlockByNumber`) do not provide an indexed method to retrieve incoming native transfers without full-chain transaction scraping or debug/trace APIs. The application must explicitly disclose this infrastructure boundary so auditors know that inbound native transfers are bounded to transactions with associated contract event logs or inspected blocks, avoiding false claims of zero inbound activity.
