# Pharos Audit-Log Agent

> Production-ready on-chain compliance activity auditor and report generator for the Pharos Atlantic Testnet.

**Live Application:** [https://pharos-audit-log-agent-two.vercel.app](https://pharos-audit-log-agent-two.vercel.app)  
**GitHub Repository:** [https://github.com/JimmyOgb/pharos-audit-log-agent](https://github.com/JimmyOgb/pharos-audit-log-agent)  
**Network:** Pharos Atlantic Testnet (Chain ID: `688689`)

---

## Features

- **Date Range to Block Resolution**: Deterministically translates user-specified calendar date ranges into verified Pharos Atlantic block bounds using live block timestamps.
- **5-Category Activity Partitioning**: Categorizes 100% of detected events into five non-overlapping activity classes:
  1. **Transfers In**: Inbound ERC-20, NFT, and native transfers.
  2. **Transfers Out**: Outbound ERC-20, NFT, and native distributions.
  3. **Swaps**: Decentralized exchange trades (Uniswap V2 / V3 / AMM) with automated transfer deduplication.
  4. **Token Approvals**: Smart contract allowance grants with infinite-approval risk detection.
  5. **Contract Interactions**: Direct contract invocations and state executions.
- **Totals & Risk Highlights**: Aggregates activity counts, unique counterparties, and flags notable transactions (whale-scale transfers, unlimited approvals) with direct links to the PharosScan explorer.
- **Triple Export Formats**: Instant multi-format reporting with zero simulation:
  - **Markdown (`.md`)**: Structured compliance document with tables and links.
  - **PDF (`.pdf`)**: Formatted executive report with letterhead, metrics, and clickable explorer hyperlinks.
  - **CSV (`.csv`)**: Normalized RFC 4180 audit ledger ready for spreadsheet import.
- **Zero Simulation / Zero Mock Data**: All metrics are derived from live logs on Pharos Atlantic Testnet.
- **Strictly Read-Only**: Zero wallet connection required, zero private keys, zero gas expenditure.

---

## Architecture

```
                  ┌────────────────────────────────────────┐
                  │        Pharos Audit-Log Agent UI       │
                  │   (Address & Date Range Input / Web)   │
                  └───────────────────┬────────────────────┘
                                      │ HTTP POST /api/report
                                      ▼
                  ┌────────────────────────────────────────┐
                  │             Express Server             │
                  └──────┬──────────────────────────┬──────┘
                         │                          │
        ┌────────────────▼─────────┐      ┌─────────▼────────────────┐
        │   Block Resolver Service │      │ Activity Fetcher (Viem)  │
        │  (Timestamp -> Heights)  │      │ (Chunked 900-block logs) │
        └────────────────┬─────────┘      └─────────┬────────────────┘
                         │                          │
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

## Network Configuration

| Parameter | Configuration |
| :--- | :--- |
| **Network** | Pharos Atlantic Testnet |
| **Chain ID** | `688689` |
| **RPC Endpoint** | `https://atlantic.dplabs-internal.com` |
| **Explorer** | `https://atlantic.pharosscan.com` |
| **MCP Server** | `https://mcp.pharos.xyz/mcp` |

---

## API Reference

### 1. Health Check
```http
GET /api/health
```
Returns system status, active chain ID, and RPC configuration.

### 2. Generate Audit Report
```http
POST /api/report
Content-Type: application/json

{
  "address": "0x299ce4113abf88f4997737184aa8a7a3d58ac15c",
  "startDate": "2026-11-01",
  "endDate": "2026-11-08",
  "blockSpan": 3000
}
```

### 3. Export Endpoints
- `GET /api/export/markdown`: Download audit report formatted in Markdown (`.md`).
- `GET /api/export/pdf`: Download executive compliance report in PDF format (`.pdf`).
- `GET /api/export/csv`: Download tabular ledger in CSV format (`.csv`).

---

## Installation & Local Development

### Prerequisites
- Node.js >= 20.0.0
- npm >= 9.0.0

### Setup
```bash
# Clone the repository
git clone https://github.com/JimmyOgb/pharos-audit-log-agent.git
cd pharos-audit-log-agent

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Run automated tests
npm test

# Start local development server
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## Automated Verification & Testing

The test suite validates input sanitization, deterministic block resolution, classification priority rules, infinite allowance detection, and exports in Markdown, PDF, and CSV:

```bash
npm test
```

Test coverage includes:
- [x] EVM address validation and injection prevention
- [x] Block range translation against live Pharos Atlantic timestamps
- [x] Deduplication between DEX swaps and underlying token transfers
- [x] Infinite allowance detection ($\ge 2^{128}$ threshold)
- [x] Generation of Markdown, RFC 4180 CSV, and valid binary PDF documents
- [x] Live RPC integration testing on active Atlantic testnet addresses

---

## License

MIT License. Designed and engineered for the Pharos ecosystem.
