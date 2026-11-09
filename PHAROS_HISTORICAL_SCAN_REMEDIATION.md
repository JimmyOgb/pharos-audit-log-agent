# Pharos Audit-Log Agent — Historical Scan & Multi-Chunk Continuation Remediation

**Project:** Pharos Audit-Log Agent  
**Repository:** https://github.com/JimmyOgb/pharos-audit-log-agent  
**Production URL:** https://pharos-audit-log-agent-two.vercel.app  
**Audited Wallet (Positive Control):** `0xE4220c4b71877bb94EB173f467ef5c5557017085`  
**Network:** Pharos Atlantic Testnet (`Chain ID: 688689`)  
**RPC:** `https://atlantic.dplabs-internal.com`  
**Explorer:** https://atlantic.pharosscan.com  

---

## 1. Remediation Scope & Architectural Solution

This remediation resolves the zero-result regression where audits of historical date ranges displayed zero events due to block time drift, unbounded continuation cursors, nonce off-by-one boundary conditions, and absence of cross-chunk accumulation.

### Key Architectural Fixes
1. **Dynamic Empirical Block Cadence**:
   - Replaced the hardcoded `1.0s/block` assumption with dynamic sampling of reference blocks (`getEmpiricalSecondsPerBlock`), measuring the actual testnet cadence (`~2.18s/block`).
   - For any date range (e.g. `2026-11-08`), start and end blocks map accurately to the real on-chain timeline without 40,000+ block drift.
2. **Deterministic Outbound Native Transfer Boundary Fix**:
   - Corrected account nonce baseline query in `nativeFetcher.ts` from `fromBlock` to `fromBlock - 1n`.
   - Prevents transactions executed at the starting block boundary from being subtracted out and missed.
3. **Bounded Continuation State & Anti-Tampering Binding**:
   - Replaced unbounded cursors (which previously tried to query 80,000+ blocks in one request) with safely bounded 3,000-block continuation chunks.
   - Tied continuation state to `originalTargetAddress`, rejecting tampered or mismatched wallet requests.
4. **Cross-Chunk Activity Accumulation**:
   - In `reportGenerator.ts`, newly scanned chunk activities are merged with `accumulatedActivities` from prior chunks.
   - Deduplicated using composite key `${txHash}-${category}-${assetType}-${id}`.
   - A subsequent zero-event chunk never erases or overwrites previously discovered events.
   - All category totals, native balance summaries, and executive narratives reflect the cumulative multi-chunk audit.
5. **Interactive UI with Auto-Scan**:
   - Enhanced web dashboard with live progress indicator (`scannedBlocks / totalRequestedBlocks`).
   - Provided both single-chunk continuation (`Scan Next Chunk`) and autonomous multi-chunk resolution (`Auto-Scan Remaining`).
6. **Mutually Reconciled Exporters**:
   - Markdown, CSV, and PDF exports all consume the accumulated multi-chunk report dataset.
   - CSV outputs RFC 4180 headers with `Scan_Completeness` and an informative record even when a scanned window is completely idle.

---

## 2. Code Changes Summary

| File | Nature of Changes |
| :--- | :--- |
| `src/types.ts` | Added `ContinuationState` interface; updated `ScanCoverage`, `AuditReport`, and `AuditRequest` to support continuation state. |
| `src/services/blockResolver.ts` | Implemented `getEmpiricalSecondsPerBlock()`; resolved timestamps dynamically; bounded continuation chunks to `blockSpanLimit`; updated forward scan. |
| `src/services/nativeFetcher.ts` | Fixed nonce off-by-one boundary check (`fromBlock > 0n ? fromBlock - 1n : 0n`); added explicit provenance boundary disclosure. |
| `src/services/reportGenerator.ts` | Integrated `continuationState`; merged and deduplicated activities across chunks; recomputed totals from unified list; preserved accumulated state. |
| `src/server.ts` | Updated `POST /api/report` to parse and pass `continuationState`. |
| `src/views.ts` | Added continuation state tracking; updated partial audit notice; added `autoScanAll()` loop; ensured zero-data-loss rendering. |
| `src/services/exporters.ts` | Reconciled CSV export with `Scan_Completeness` and idle wallet support. |
| `tests/auditEngine.test.ts` | Expanded QA suite from 26 to 33 automated tests covering all Phase G regression requirements. |

---

## 3. Automated Regression Suite (33 Tests)

```
--- SECTION 1: Date-Range Coverage & Completeness ---
Test 1: Short requested range is fully scanned and marked COMPLETE (PASS)
Test 2: Multi-chunk range within limit calculates correct chunk counts (PASS)
Test 3: Range exceeding span limit returns PARTIAL and durable continuation cursor (PASS)
Test 4: Failed chunk is preserved in metadata and prevents COMPLETE status (PASS)
Test 5: Missing block timestamps handled safely without crashing (PASS)
Test 6: Requested and actual coverage are strictly separated (PASS)
Test 7: Zero-event report from incomplete scan labeled PARTIAL (PASS)

--- SECTION 2: Native PHAROS Transfer Classification ---
Test 8: Inbound native transfer classification (PASS)
Test 9: Outbound native transfer classification (PASS)
Test 10: Zero-value contract call classified as contract interaction (PASS)
Test 11: Reverted transaction flagged and excluded from transfers (PASS)
Test 12: Contract deployment classified under contract_interactions (PASS)
Test 13: Contract call with value classifies as outbound transfer (PASS)
Test 14: Deduplication between transaction value and internal logs (PASS)
Test 15: Distinct accounting for native PHAROS vs ERC-20 tokens (PASS)
Test 16: Honest disclosure on internal transfers (PASS)

--- SECTION 3: Existing Classifier Protections ---
Test 17: Canonical ERC-20 Transfer topic accepted (PASS)
Test 18: Canonical Approval topic accepted (PASS)
Test 19: Foreign topic0 events rejected (PASS)
Test 20: Wrong-wallet indexed addresses rejected (PASS)
Test 21: Malformed payloads handled safely without crashing (PASS)
Test 22: Duplicate transaction/log pairs deduplicated (PASS)
Test 23: ApprovalForAll categorized under contract_interactions (PASS)
Test 24: Failed allowance reads remain unverified (PASS)
Test 25: Swap component transfers annotated and excluded from duplicates (PASS)

--- SECTION 4: Exporters Verification ---
Test 26: Exporters represent identical scan metadata and completeness (PASS)

--- SECTION 5: Multi-Chunk Continuation & Historical Regression ---
Test 27: Multi-chunk continuation and activity accumulation (PASS)
Test 28: Zero-event chunk does not erase earlier events (PASS)
Test 29: Duplicate continuation requests do not duplicate events (PASS)
Test 30: Modified cursor / mismatched address is strictly rejected (PASS)
Test 31: Historical native transaction outside latest 3,000 blocks detected (PASS)
Test 32: Positive-control ERC-20 transfer detected (PASS)
Test 33: Honest disclosure on unindexed inbound native transfers (PASS)

Result: ALL 33 TESTS PASSED (100% Pass Rate).
```
