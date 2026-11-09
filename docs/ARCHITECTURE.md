# PHAROS AUDIT-LOG AGENT — SYSTEM ARCHITECTURE

## System Overview

The **Pharos Audit-Log Agent** retrieves, normalizes, categorizes, and audits genuine on-chain activity for any wallet on Pharos Atlantic Testnet (or Pacific Mainnet) over a specified date range.

```
                    +------------------------------------+
                    |  Web Dashboard & Compliance UI     |
                    |  - Date Range Picker               |
                    |  - Live Progress Telemetry         |
                    |  - Export Actions (MD, PDF, CSV)   |
                    +-----------------+------------------+
                                      |
                                      v
                    +------------------------------------+
                    |       Audit-Log Agent Core         |
                    |  - Date-to-Block Resolver          |
                    |  - Bounded 900-Block Batch Engine  |
                    +-----------------+------------------+
                                      |
         +----------------------------+----------------------------+
         |                            |                            |
         v                            v                            v
+------------------+         +------------------+         +------------------+
| Transfer Engine  |         |   Swap Engine    |         |  Approval Engine |
| - ERC-20 & Native|         | - Uniswap V2/V3  |         | - ERC-20 Approval|
| - In vs Out Pos. |         | - In/Out Assets  |         | - Spender Audit  |
+--------+---------+         +--------+---------+         +--------+---------+
         |                            |                            |
         +----------------------------+----------------------------+
                                      |
                                      v
                    +------------------------------------+
                    |   Activity Normalizer & Classifier |
                    |   - Decimal Integer Arithmetic     |
                    |   - Event Deduplication            |
                    |   - Notable Transaction Ranker     |
                    +-----------------+------------------+
                                      |
                                      v
                    +------------------------------------+
                    |    Multi-Format Exporter Engine    |
                    |    - Markdown Generator            |
                    |    - PDF Document Builder (PDFKit) |
                    |    - CSV Stream Formatter          |
                    +------------------------------------+
```

---

## Architectural Principles

1. **Deterministic Bounded Extraction**:
   - Dates map directly to target Unix timestamps.
   - Using latest block height and observed block time ($\approx 1.0\text{s}$), the engine identifies start and end block numbers.
   - Requests are batched in intervals of $\le 900$ blocks, satisfying Atlantic RPC's 1,000-block ceiling.
2. **Integer Arithmetic with BigInt**:
   - Token amounts are decoded and formatted using `viem.formatUnits` and integer math to avoid floating-point rounding errors in financial and compliance reporting.
3. **Multi-Format Export Parity**:
   - Markdown, PDF, and CSV are all compiled directly from the single authoritative `AuditReport` data structure, guaranteeing zero discrepancy across export formats.
