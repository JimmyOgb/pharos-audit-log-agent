# Production Redeployment Report

**Project:** Pharos Audit-Log Agent  
**Repository:** `https://github.com/JimmyOgb/pharos-audit-log-agent`  
**Git Commit:** `316de9d` (`fix(audit): resolve missing swaps, token decimals and inbound native transfer detection`)  
**Previous Baseline Commit:** `ba0e2ae`  
**Previous Baseline Deployment:** `dpl_3fzAhiRytXLZqUCsWeWWGUCGTfzV`  
**New Production Deployment ID:** `dpl_5N4ccCmwvf5u1bGLK6bs4muBEjjS`  
**Production URL:** `https://pharos-audit-log-agent-two.vercel.app`  
**Direct Deployment URL:** `https://pharos-audit-log-agent-gpuixnr6f-jamism123.vercel.app`  
**Deployment Timestamp:** November 9, 2026, 08:27:41 UTC  
**Target Wallet:** `0xE4220c4b71877bb94EB173f467ef5c5557017085`  
**Network:** Pharos Atlantic Testnet (Chain ID `688689`)  

---

## 1. Deployment Build & Status

- **Build Engine:** Vercel CLI 65.11.0 / Node.js
- **TypeScript Compilation:** `tsc` exit code 0 (clean build, 0 errors)
- **Deployment State:** `READY`
- **Target:** Production
- **Alias:** `https://pharos-audit-log-agent-two.vercel.app`

---

## 2. Automated Quality Assurance Results

The full automated regression test suite was executed against the project:
- **Test File:** `tests/auditEngine.test.ts`
- **Total Tests:** 44
- **Passed:** 44
- **Failed:** 0
- **Execution Output:**
  ```text
  🧪 Starting Pharos Audit-Log Agent Automated Quality Assurance Suite...
  --- SECTION 1: Date-Range Coverage & Completeness (Tests 1-7) ---
  ✔ All 7 passed.
  --- SECTION 2: Native PHAROS Transfer Classification (Tests 8-16) ---
  ✔ All 9 passed.
  --- SECTION 3: Existing Classifier Protections (Tests 17-25) ---
  ✔ All 9 passed.
  --- SECTION 4: Exporters Verification (Test 26) ---
  ✔ Passed.
  --- SECTION 5: Multi-Chunk Continuation & Historical Regression (Tests 27-33) ---
  ✔ All 7 passed.
  --- SECTION 6: Full-Range Scan Integrity & Genesis Clamping (Tests 34-38) ---
  ✔ All 5 passed.
  --- SECTION 7: Missing Swap & Positive Control Remediation (Tests 39-44) ---
  ✔ All 6 passed.
  🎉 ALL 44 REGRESSION & QUALITY ASSURANCE TESTS PASSED!
  ```

---

## 3. Live Production Endpoint Verification

### 3.1 Health Check (`GET /api/health`)
- **Status:** `200 OK`
- **Response Payload:**
  ```json
  {
    "status": "ok",
    "agent": "Pharos Audit-Log Agent",
    "network": "Pharos Atlantic Testnet",
    "chainId": 688689,
    "rpcUrl": "https://atlantic.dplabs-internal.com",
    "explorer": "https://atlantic.pharosscan.com",
    "timestamp": "2026-11-09T08:28:02.772Z"
  }
  ```

### 3.2 Live Swap Detection (`POST /api/report`)
- **Block Range Tested:** `31674470` – `31674480` (covers positive-control swap in block `31674475`)
- **Status:** `200 OK`
- **Result:**
  - `categoryTotals.swaps.count`: `1`
  - `categoryTotals.swaps.dexProtocols`: `["TestAMM Router"]`
  - Swap Activity ID: `0x1123d411185a0d5d3120eb7895ebad3a6718f78cd3a2d8f022b16f1bc3e0675a-2`
  - Title: `TestAMM 1:1 Swap (100.0000 TKA → 100.0000 TKB)`
  - Formatted Amount: `100.0000 TKA → 100.0000 TKB`
  - Inbound Leg: `100.0000 TKB` (18 decimals verified, no 100-trillion corruption)
  - Outbound Leg: `100.0000 TKA`

### 3.3 Live Native Inbound Detection (`POST /api/report`)
- **Block Range Tested:** `16115920` – `16115930` (covers inbound native transfer in block `16115924`)
- **Status:** `200 OK`
- **Result:**
  - `categoryTotals.transfers_in.nativeCount`: `1`
  - Activity ID: `0xa3df2f7c5f17ce80ad099c3d65f08236003ab7016fa5d49ce783664e8908ecc4-native-in`
  - Title: `Inbound Native Transfer (0.0100 PHAROS)`
  - Formatted Amount: `0.0100 PHAROS`
  - Sender: `0x196fc6aab375e4999dd5f23522bc8ece986b1493`

### 3.4 Live Native Outbound Detection (`POST /api/report`)
- **Block Range Tested:** `32463700` – `32463710` (covers outbound transfer in block `32463702`)
- **Status:** `200 OK`
- **Result:**
  - `categoryTotals.transfers_out.nativeCount`: `1`
  - Activity ID: `0xbc63023089ccd1856d956f23288b58165fda5e8cf9e56f668cfbf0f13f2c9bf9-native-out`
  - Title: `Outbound Native Transfer (25.0000 PHAROS)`
  - Formatted Amount: `25.0000 PHAROS`
  - Recipient: `0x70997970c51812dc3a010c7d01b50e0d17dc79c8`

### 3.5 Live Report Exporter Verification
- **Markdown Export (`POST /api/export/markdown`):** `200 OK`, 4,226 bytes generated, contains verified TestAMM swap details.
- **CSV Export (`POST /api/export/csv`):** `200 OK`, 2,999 bytes generated, contains TKA/TKB columns and `Asset_Type`.
- **PDF Export (`POST /api/export/pdf`):** `200 OK`, 3,568 bytes binary PDF generated, formatted with audit header and ledger tables.

---

## 4. Production Conclusion

The release has been deployed to the existing Vercel project, verified against the live Pharos Atlantic testnet, and confirmed to successfully classify the target wallet's swaps, transfers, and token interactions without regressions.
