# PHAROS AUDIT-LOG AGENT — FULL-RANGE SCAN FAILURE INVESTIGATION & ROOT-CAUSE ANALYSIS

## 1. Executive Summary

During full-range wallet audits spanning extended historical intervals (specifically `2025-01-02` through `2026-11-09` for target wallet `0xE4220c4b71877bb94EB173f467ef5c5557017085`), the web dashboard and API responses exhibited severe scan discrepancies:
1. **Genesis Boundary Desynchronization**: The requested start date (`2025-01-02`) significantly preceded the actual genesis launch of the Pharos Atlantic Testnet (`2025-09-28T07:16:24.000Z`, Block 1).
2. **Synthetic Timestamp Hallucination**: Linear extrapolation formulas (`latestTimestamp - (latestNumber - bNum) * 2.18`) generated synthetic dates (e.g. `2025-01-03 06:52:07 UTC`) for blocks that actually occurred eleven months later (December 6, 2025), presenting a false temporal timeline to auditors.
3. **Chunk vs. Cumulative Semantic Mismatch**: The report header and subtitle displayed only the single chunk's span (`3,000 blocks` and a 2-hour window) while the partial notice banner showed `54,000 blocks cumulative`, creating an apparent contradiction.
4. **Auto-Scan Boundary Safeguard & State Volatility**: In-browser auto-scanning stopped at 54,000 blocks due to client-side loop caps without error recovery, and browser refreshes completely wiped accumulated progress because state was held exclusively in memory.

---

## 2. On-Chain Ledger & Genesis Forensics

### 2.1 Genesis Verification
Direct JSON-RPC inspection of Pharos Atlantic Testnet (`https://atlantic.dplabs-internal.com`, Chain ID `688689`) confirmed the exact block 1 genesis parameters:
- **Block 1 Height**: `1` (`0x1`)
- **Block 1 Timestamp**: `1759043784`
- **Block 1 ISO UTC**: `2025-09-28T07:16:24.000Z`
- **Latest Block Height**: `32,501,818+`
- **Latest Timestamp**: `1794195757` (`2026-11-09T03:45:10.000Z`)

### 2.2 Forensic Flaw in Mathematical Extrapolation
Prior code calculated historical block heights via:
```ts
const secondsFromLatestToStart = latestTimestamp - requestedStartTs;
const blocksFromLatestToStart = BigInt(Math.floor(secondsFromLatestToStart / avgSecondsPerBlock));
let resolvedStartBlock = latestNumber - blocksFromLatestToStart;
```
For `2025-01-02` (`1735776000`), `secondsFromLatestToStart` was `58,419,757` seconds.
At an assumed cadence of `2.18 s/block`, the formula computed `26,798,053` blocks back from the tip:
$$\text{resolvedStartBlock} = 32,552,516 - 26,801,123 = 5,751,393$$

However, direct on-chain query of block `5,751,393` revealed:
- **Block 5,751,393 Real Timestamp**: `1765044602`
- **Block 5,751,393 Real Date**: **`2025-12-06T18:10:02.000Z` (December 6, 2025)**

The application then computed a synthetic timestamp for display:
$$\text{actualStartTs} = \text{latestTimestamp} - (\text{latestNumber} - 5,751,393) \times 2.18 = 1735887127 \rightarrow \text{2025-01-03 06:52:07 UTC}$$

This manufactured a fictitious date disconnected from the real on-chain block ledger by over 11 months.

---

## 3. Wallet Nonce & Historical Distribution Forensics

Querying target wallet `0xE4220c4b71877bb94EB173f467ef5c5557017085`:
- **Current Nonce**: `4,247`
- **Current Balance**: `28,059.123562 PHAROS`

Historical nonce distribution across block heights:
| Block Height | Nonce | Real Block Timestamp (UTC) | Wallet State |
| :--- | :--- | :--- | :--- |
| **Block 1** | 0 | 2025-09-28 07:16:24 | Inactive (Pre-creation) |
| **Block 1,000,000** | 0 | 2025-10-21 06:30:36 | Inactive |
| **Block 5,000,000** | 0 | 2025-11-29 01:01:44 | Inactive |
| **Block 5,751,393** | 0 | 2025-12-06 18:10:02 | Inactive |
| **Block 10,000,000** | 0 | 2026-01-17 18:29:50 | Inactive |
| **Block 20,000,000** | 4,218 | 2026-04-27 01:01:24 | Highly Active |
| **Block 30,000,000** | 4,218 | 2026-09-13 18:28:57 | Active |
| **Block 32,000,000** | 4,246 | 2026-10-28 20:52:21 | Active |
| **Block 32,463,702** | 4,246 | 2026-11-08 04:08:14 | Native Outbound Transfer (25 PHAROS) |
| **Block 32,501,818** | 4,247 | 2026-11-09 03:45:10 | Active |

### Why the 54,000-Block Scan Discovered Zero Events
When the scan started at block `5,751,393` and progressed forward across 18 chunks of 3,000 blocks (totaling 54,000 blocks up to block `5,805,392`), it was inspecting blocks from **December 6, 2025**.
During that era, the target wallet's nonce was `0` and it had no event logs.
Because the scan had `26,696,426` remaining blocks to traverse before reaching blocks 20,000,000+ where the wallet's transactions were recorded, inspecting only the first 54,000 blocks accurately found zero activity for that specific historical window.
However, claiming the wallet was "idle" over the requested 2025–2026 calendar period was premature because only 0.2% of the requested block span had been traversed.

---

## 4. Root Causes Identified

1. **Pre-Genesis Date Clamping Missing**: Dates preceding chain launch (`2025-09-28`) were not clamped to Genesis Block 1, leading to wildly inaccurate backward extrapolation.
2. **Synthetic Timestamp Hallucination**: Linear mathematical formulas were used instead of querying real block timestamps via `eth_getBlockByNumber`.
3. **Cumulative vs. Chunk Reporting Ambiguity**: Single-chunk bounds and cumulative scanned metrics were mixed in the dashboard header, misleading users.
4. **Browser Volatility**: Browser state was entirely in-memory with no `localStorage` persistence, causing page reloads to discard scan progress.
5. **Auto-Scan Cutoff**: A hard safety limit of 50 chunks without pause/resume controls or retry logic caused auto-scans to halt prematurely.
