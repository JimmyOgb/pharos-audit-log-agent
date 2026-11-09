# Pharos Audit-Log Agent

> Production-ready on-chain compliance activity auditor and report generator for the Pharos Atlantic Testnet.

**Live Application:** [https://pharos-audit-log-agent-two.vercel.app](https://pharos-audit-log-agent-two.vercel.app)  
**GitHub Repository:** [https://github.com/JimmyOgb/pharos-audit-log-agent](https://github.com/JimmyOgb/pharos-audit-log-agent)  
**Network:** Pharos Atlantic Testnet (Chain ID: `688689`)  
**RPC Endpoint:** `https://atlantic.dplabs-internal.com`  
**Explorer:** [https://atlantic.pharosscan.com](https://atlantic.pharosscan.com)  

---

## Features

- **Honest Date Range & Completeness Reporting**:
  - Deterministically maps calendar dates to Atlantic block heights.
  - Distinguishes **requested dates/blocks** from **actual scanned coverage**.
  - Clearly flags report completeness: `COMPLETE` (100% covered), `PARTIAL` (bounded by serverless execution limits), or `FAILED`.
  - Provides a durable **continuation cursor** to audit earlier block chunks without timeout or silent truncation.
- **Native PHAROS & ERC-20 Transfer Detection**:
  - **Native PHAROS**: Discovers inbound and outbound native transfers using on-chain transaction data, nonce state transitions, and verified receipts. Correctly formats native balances (18 decimals).
  - **ERC-20 & Tokens**: Decodes token transfers, metadata, and scaled values with BigInt safety.
  - **Zero-Value Contract Invocations**: Distinctly separated from asset transfers under *Contract Interactions*.
  - **Reverted Transactions**: Flagged as `REVERTED` and strictly excluded from successful transfer metrics.
- **5-Category Activity Partitioning**:
  1. **Transfers In**: Inbound native PHAROS and ERC-20 transfers.
  2. **Transfers Out**: Outbound native PHAROS distributions and ERC-20 transfers.
  3. **Swaps**: Decentralized exchange trades (Uniswap V2 / V3 / AMM) with automated internal transfer deduplication (`isSwapComponent = true`).
  4. **Token Approvals**: Smart contract allowance grants with infinite-approval detection ($\ge 2^{128}$) and live on-chain status verification (`allowance(owner, spender)`).
  5. **Contract Interactions**: Direct contract invocations, contract deployments, and NFT operator approvals (`ApprovalForAll`).
- **Triple Export Formats**:
  - **Markdown (`.md`)**: Structured compliance document with completeness badges, coverage statistics, and PharosScan hyperlinks.
  - **PDF (`.pdf`)**: Executive compliance statement generated via PDFKit with letterhead, partial scan warnings, and clickable explorer links.
  - **CSV (`.csv`)**: Normalized RFC 4180 audit ledger ready for spreadsheet import with `Asset_Type`, `Is_Native`, `Scan_Completeness`, and `Status` columns.
- **Zero Simulation / Zero Mock Data**: 100% of event receipts, nonces, and transactions are queried directly from the live Pharos Atlantic RPC.
- **Strictly Read-Only**: Zero wallet connection required, zero private keys, zero gas expenditure.

---

## Architecture

```
                  ┌────────────────────────────────────────┐
                  │        Pharos Audit-Log Agent UI       │
                  │ (Address, Date Range, & Continuation)  │
                  └───────────────────┬────────────────────┘
                                      │ HTTP POST /api/report
                                      ▼
                  ┌────────────────────────────────────────┐
                  │             Express Server             │
                  └──────┬──────────────────────────┬──────┘
                         │                          │
        ┌────────────────▼─────────┐      ┌─────────▼────────────────┐
        │   Block Resolver Service │      │  Activity Fetcher (RPC)  │
        │  (UTC Date Bounds & Span)│      │  (Direct JSON-RPC Logs)  │
        └────────────────┬─────────┘      └─────────┬────────────────┘
                         │                          │
                         │                ┌─────────▼────────────────┐
                         │                │ Native Fetcher (Nonces)  │
                         │                │ (18-dec PHAROS, Receipts)│
                         │                └─────────┬────────────────┘
                         └───────────┬──────────────┘
                                     ▼
                  ┌────────────────────────────────────────┐
                  │      Activity Classifier Engine        │
                  │ (5 Categories, Priority & Deduplication│
                  └──────────────────┬─────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   ┌───────────────┐         ┌───────────────┐         ┌───────────────┐
   │Markdown Export│         │  PDF Exporter │         │  CSV Exporter │
   │  Service (.md)│         │ (PDFKit Engine│         │   (RFC 4180)  │
   └───────────────┘         └───────────────┘         └───────────────┘
```

---

## Date Range Resolution & Completeness Contract

1. **UTC Date Normalization**:
   - Start dates resolve to `00:00:00.000 UTC`; end dates resolve to `23:59:59.999 UTC`.
   - On Pharos Atlantic, block intervals are ~1.0 second per block. A 24-hour window spans ~86,400 blocks.
2. **Serverless Execution Boundaries**:
   - To prevent serverless execution timeouts and respect public RPC rate limits (`cu limit exceeded`), single invocations query up to a configurable block span (default: 3,000 blocks).
   - If the requested span exceeds the budget, the scan covers the latest blocks and reports `completeness: 'PARTIAL'`.
   - The response includes `continuationCursor: { nextFromBlock, nextToBlock }` allowing the client to continue auditing earlier intervals.
3. **Completeness States**:
   - `COMPLETE`: 100% of the requested block range was successfully queried and reconciled.
   - `PARTIAL`: The scan was bounded by execution limits; uninspected earlier blocks are explicitly listed.
   - `FAILED`: An unrecoverable RPC error or node timeout occurred.

---

## Native PHAROS Transfer Detection Contract

- **Outbound Native Transfers**: Deterministically discovered by evaluating monotonic account `nonce` state changes between `fromBlock` and `toBlock`. When `nonce(toBlock) > nonce(fromBlock)`, binary search pinpoints the exact transaction blocks, extracting `value`, `to`, and `receipt.status`.
- **Inbound Native Transfers**: Extracted from confirmed block transaction receipts where `tx.to === target` and `tx.value > 0n`.
- **Internal Execution Traces**: Standard EVM JSON-RPC nodes do not index un-emitted internal contract transfers without debug trace endpoints. Outbound transfers are 100% verified via account state; unindexed third-party inbound transfers across multi-month historical ranges require an archive trace indexer and are disclosed in report provenance.

---

## API Reference

### 1. Health Check
```http
GET /api/health
```

### 2. Generate Audit Report
```http
POST /api/report
Content-Type: application/json

{
  "address": "0x89b97db15f0bc3b12c8a2e4ae8549788c0823838",
  "startDate": "2026-11-08",
  "endDate": "2026-11-09",
  "blockSpan": 3000,
  "cursor": {
    "fromBlock": 32490000,
    "toBlock": 32495000
  }
}
```

### 3. Multi-Format Exporters
- `GET /api/export/markdown`: Formatted Markdown audit document.
- `GET /api/export/csv`: Normalized RFC 4180 audit ledger with `Asset_Type` and `Scan_Completeness`.
- `GET /api/export/pdf`: Binary PDF executive compliance statement.
