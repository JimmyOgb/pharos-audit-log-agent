# PHAROS AUDIT-LOG AGENT — FULL-RANGE SCAN REGRESSION TEST REPORT

## 1. Test Suite Overview

- **Test Suite Path**: `tests/auditEngine.test.ts`
- **Total Test Cases**: 38 Automated Test Cases
- **Success Rate**: **100% (38 / 38 Passed)**
- **Test Runner**: Node.js / `tsx`
- **Execution Mode**: Direct on-chain read-only calls against Pharos Atlantic Testnet (Chain ID `688689`)

---

## 2. Test Execution Results by Section

### Section 1: Date-Range Coverage & Completeness (Tests 1 – 7)
- **Test 1**: Short requested range is fully scanned and marked COMPLETE. (Passed)
- **Test 2**: Multi-chunk range within limit calculates correct chunk counts (3 chunks of 900). (Passed)
- **Test 3**: Range exceeding span limit returns PARTIAL and durable continuation cursor. (Passed)
- **Test 4**: Failed chunk is preserved in metadata and prevents COMPLETE status. (Passed)
- **Test 5**: Missing block timestamps handled safely without crashing. (Passed)
- **Test 6**: Requested and actual coverage are strictly separated. (Passed)
- **Test 7**: Zero-event report from incomplete scan labeled PARTIAL. (Passed)

### Section 2: Native PHAROS Transfer Classification (Tests 8 – 16)
- **Test 8**: Inbound native transfer classification under `transfers_in`. (Passed)
- **Test 9**: Outbound native transfer classification under `transfers_out`. (Passed)
- **Test 10**: Zero-value contract call classified as contract interaction, not transfer. (Passed)
- **Test 11**: Reverted transaction flagged and excluded from transfers. (Passed)
- **Test 12**: Contract deployment classified under `contract_interactions`. (Passed)
- **Test 13**: Contract call with value classifies as outbound transfer with call context. (Passed)
- **Test 14**: Deduplication between transaction value and internal logs. (Passed)
- **Test 15**: Distinct accounting for native PHAROS vs. ERC-20 tokens. (Passed)
- **Test 16**: Honest disclosure on internal transfers. (Passed)

### Section 3: Classifier Protections & Resilience (Tests 17 – 25)
- **Test 17**: Canonical ERC-20 Transfer topic accepted. (Passed)
- **Test 18**: Canonical Approval topic accepted. (Passed)
- **Test 19**: Foreign topic0 events rejected. (Passed)
- **Test 20**: Non-matching indexed recipient strictly rejected. (Passed)
- **Test 21**: Malformed payloads handled safely without crashing. (Passed)
- **Test 22**: Duplicate transaction/log pairs deduplicated. (Passed)
- **Test 23**: ApprovalForAll categorized under `contract_interactions`, not `token_approvals`. (Passed)
- **Test 24**: Failed allowance reads remain unverified, not marked zero or revoked. (Passed)
- **Test 25**: Swap component transfers annotated with `isSwapComponent = true`. (Passed)

### Section 4: Exporters Reconciliation (Test 26)
- **Test 26**: Exporters represent identical scan metadata and completeness (`PARTIAL`/`COMPLETE`). (Passed)

### Section 5: Multi-Chunk Continuation & Historical Regression (Tests 27 – 33)
- **Test 27**: Multi-chunk continuation discovers activity and accumulates into report. (Passed)
- **Test 28**: Zero-event chunk does not erase earlier events. (Passed)
- **Test 29**: Duplicate continuation requests do not duplicate events. (Passed)
- **Test 30**: Modified cursor / mismatched address is strictly rejected. (Passed)
- **Test 31**: Historical native transaction outside latest 3,000 blocks detected (Block 32,463,702, 25 PHAROS). (Passed)
- **Test 32**: Positive-control ERC-20 transfer detected (`0x89b97db15f0bc3b12c8a2e4ae8549788c0823838`). (Passed)
- **Test 33**: Honest disclosure on unindexed inbound native transfers. (Passed)

### Section 6: Full-Range Scan Integrity & Genesis Clamping (Tests 34 – 38)
- **Test 34**: Pre-genesis date (`2025-01-02`) successfully clamped to Genesis Block 1 (`1759043784`, `2025-09-28T07:16:24.000Z`) with explanatory notice. (Passed)
- **Test 35**: Strict block cursor continuity verified: Chunk 1 `[..end]` -> Chunk 2 `[end+1..]` with 6,000 cumulative blocks and zero block gaps or overlaps. (Passed)
- **Test 36**: Cumulative range and single-chunk range strictly distinguished in report (`cumulativeScannedBlocks = 6,000`, `actualScannedBlocksCount = 3,000`). (Passed)
- **Test 37**: Markdown and CSV exports successfully incorporate cumulative metrics and genesis disclosures. (Passed)
- **Test 38**: Target wallet full-range audit returns honest partial non-idle report, explicitly refusing to certify idle until entire interval is covered. (Passed)

---

## 3. Regression Conclusion

All 38 test cases passed completely with zero failures or skipped tests, validating that the genesis clamping, cumulative metrics, cursor continuity, and target wallet audit remediation function as intended.
