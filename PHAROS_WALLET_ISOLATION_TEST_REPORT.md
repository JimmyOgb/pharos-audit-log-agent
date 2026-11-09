# PHAROS WALLET ISOLATION TEST REPORT

## Overview

A critical flaw in legacy audit implementations was the presence of a global cache variable (`latestReportCache`), which caused requests for `/api/report/latest` or export endpoints to return the results of whatever wallet happened to be scanned last. Furthermore, continuation cursors could previously be applied across differing wallet addresses.

This report details the architectural changes and test suite results proving **strict wallet-specific session and cache isolation**.

---

## 1. Architectural Isolation Measures

### 1.1 Server Cache Isolation (`src/server.ts`)
- **Elimination of Global Report State:** The single `latestReportCache` variable has been completely removed.
- **Partitioned Memory Store:** Replaced with `latestReportByWallet: Map<string, AuditReport>`, keyed by canonical lowercase address.
- **Strict Query Enforcement on `/api/report/latest`:**
  - Query parameter `?address=0x...` is strictly required. Missing parameter returns `400 Bad Request`.
  - The requested address is validated and normalized.
  - If no report exists in memory for that specific wallet, the endpoint returns `404 Not Found`. It never falls back to another wallet.

### 1.2 Continuation Session Isolation (`src/services/blockResolver.ts` & `src/server.ts`)
- Every `ContinuationState` object encapsulates `originalTargetAddress`.
- On initiating continuation (`POST /api/report` with `continuationState`):
  ```typescript
  if (continuationState && continuationState.originalTargetAddress) {
    const origClean = validateAndNormalizeAddress(continuationState.originalTargetAddress);
    if (origClean !== cleanAddress) {
      return res.status(400).json({
        success: false,
        error: `Continuation session mismatch: continuation belongs to "${origClean}", but request targeted "${cleanAddress}". Wallet-specific scan sessions are strictly isolated.`
      });
    }
  }
  ```
- Any attempt to feed wallet A's continuation cursor into a request for wallet B is immediately aborted with a 400 error.

### 1.3 Export Endpoint Isolation (`/api/export/:format`)
- Supports `?address=0x...` query parameter or body payload.
- In-memory fallback resolves strictly against `latestReportByWallet.get(address.toLowerCase())`.
- Cross-wallet fallback is strictly prevented; requesting an export for a wallet without a generated report returns a descriptive error rather than serving another wallet's audit data.

### 1.4 Client-Side Partitioning (`src/views.ts`)
- Browser storage keys are partitioned per wallet: `pharos_audit_session_${addr.toLowerCase()}`.
- Switching wallet address in the input field immediately triggers `handleAddressChange()`, which resets `window.currentReport` and `window.continuationState`, preventing cross-wallet continuation chaining.

---

## 2. Test Verification Matrix

All isolation mechanisms are verified in the automated test suite (Tests 51–53) and verified live on production:

| Test Case | Scenario | Expected Behavior | Verification Status |
|---|---|---|---|
| **Test 51: Continuation Cross-Wallet Tampering** | Pass Target Wallet cursor into Counterparty scan request | Rejects with `Continuation session mismatch` (HTTP 400) | **PASS** |
| **Test 52a: Independent Report IDs** | Generate reports for Counterparty and Token User | Unique report IDs generated (`AUDIT-MW-0x7099...` vs `AUDIT-MW-0x89B9...`) | **PASS** |
| **Test 52b: In-Memory Cache Isolation** | Query `/api/report/latest?address=0x7099...` vs `?address=0x0000...dead` | Each returns solely its own wallet report; no leakage | **PASS** |
| **Test 52c: Missing Address Parameter** | Query `GET /api/report/latest` without `?address=` | Rejects with `400 Bad Request` | **PASS (Status 400)** |
| **Test 53: Multi-Wallet Exporter Isolation** | Export Markdown/CSV/PDF for Counterparty vs Zero-Activity | Content contains only the corresponding wallet's transactions | **PASS (Status 200)** |

---

## 3. Live Production Verification Log

Executed against `https://pharos-audit-log-agent-two.vercel.app`:

```powershell
# Query 1: Counterparty cached report
GET /api/report/latest?address=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Response: 200 OK -> WalletAddress: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

# Query 2: Zero Activity cached report
GET /api/report/latest?address=0x000000000000000000000000000000000000dead
Response: 200 OK -> WalletAddress: 0x000000000000000000000000000000000000dEaD

# Query 3: Missing address parameter
GET /api/report/latest
Response: 400 Bad Request -> "Missing required query parameter: 'address'"
```

**Conclusion:** Cross-wallet session contamination and cache leakage have been completely eliminated.
