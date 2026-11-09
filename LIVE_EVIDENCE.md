# Pharos Audit-Log Agent — Live Evidence & Verification Log

**Audited Application:** [https://pharos-audit-log-agent-two.vercel.app](https://pharos-audit-log-agent-two.vercel.app)  
**GitHub Repository:** [https://github.com/JimmyOgb/pharos-audit-log-agent](https://github.com/JimmyOgb/pharos-audit-log-agent)  
**Deployment Identifier:** `dpl_F9za5GrkwK162awkuma4bMCnetee`  
**Network:** Pharos Atlantic Testnet  
**Chain ID:** `688689`  
**RPC Endpoint:** `https://atlantic.dplabs-internal.com`  
**Explorer:** `https://atlantic.pharosscan.com`  
**Verification Date:** November 9, 2026

---

## 1. Live Deployment & Endpoint Health

### GET `/api/health`
```json
{
  "status": "ok",
  "agent": "Pharos Audit-Log Agent",
  "network": "Pharos Atlantic Testnet",
  "chainId": 688689,
  "rpcUrl": "https://atlantic.dplabs-internal.com",
  "explorer": "https://atlantic.pharosscan.com",
  "timestamp": "2026-11-09T01:10:37.684Z"
}
```

---

## 2. Live On-Chain Audit Execution

### Target Address: `0x299ce4113abf88f4997737184aa8a7a3d58ac15c`
**Request Payload:**
```json
{
  "address": "0x299ce4113abf88f4997737184aa8a7a3d58ac15c",
  "blockSpan": 500
}
```

**Live Production Response:**
```json
{
  "success": true,
  "report": {
    "reportId": "AUDIT-MW8KEK4Q-299CE4",
    "generatedAt": "2026-11-09T01:10:42.518Z",
    "walletAddress": "0x299ce4113abf88f4997737184aa8a7a3d58ac15c",
    "startDate": "2026-11-08T01:10:42.000Z",
    "endDate": "2026-11-09T01:10:42.000Z",
    "startBlock": 32496947,
    "endBlock": 32497447,
    "network": {
      "name": "Pharos Atlantic Testnet",
      "chainId": 688689,
      "rpcUrl": "https://atlantic.dplabs-internal.com",
      "explorerUrl": "https://atlantic.pharosscan.com"
    },
    "summary": {
      "totalTransactions": 316,
      "totalCategoriesRepresented": 2,
      "executiveSummary": "Audit report for wallet 0x299ce4113abf88f4997737184aa8a7a3d58ac15c covering the period from 2026-11-08 to 2026-11-09 (blocks 32496947 to 32497447 on Pharos Atlantic Testnet). A total of 316 verifiable on-chain actions were identified across 2 activity categories. The wallet recorded 0 inbound transfers, 0 outbound transfers, 158 decentralized exchange swaps, and 158 token approvals (100 uncapped allowances). ALERT: 100 infinite token allowance(s) were identified, presenting an active counterparty risk profile requiring auditor review."
    },
    "categoryTotals": {
      "transfers_in": { "count": 0, "uniqueSenders": 0, "sampleTokens": [] },
      "transfers_out": { "count": 0, "uniqueRecipients": 0, "sampleTokens": [] },
      "swaps": { "count": 158, "dexProtocols": ["Uniswap / DEX Router"] },
      "token_approvals": { "count": 158, "unlimitedApprovals": 100, "uniqueSpenders": 1 },
      "contract_interactions": { "count": 0, "uniqueContracts": 0 }
    }
  }
}
```

---

## 3. The 5 Mandatory Categories Live Verification

1. **Transfers In**: Evaluated using ERC-20 `Transfer` signatures where `to == targetAddress`. Deduplicated against internal swap hops.
2. **Transfers Out**: Evaluated using ERC-20 `Transfer` signatures where `from == targetAddress`. Deduplicated against internal swap hops.
3. **Swaps**: 158 verified DEX swap transactions detected across blocks 32,496,947 through 32,497,447.
4. **Token Approvals**: 158 verified approval transactions detected, with 100 infinite approvals correctly identified ($\ge 2^{128}$ threshold) and highlighted as high-priority compliance risks.
5. **Contract Interactions**: Subordinated or standalone contract executions tracked without double-counting.

---

## 4. Notable Transactions & PharosScan Links

Sample verified notable transactions identified by the agent:

| Transaction Hash | Block | Finding | PharosScan Link |
| :--- | :--- | :--- | :--- |
| `0xe57e0dbfdfa76551f4eed3d9862d92a4c455977cdb699f4c84fc196c9363231d` | 32,496,980 | DEX Liquidity Swap on Uniswap V2 / V3 | [View on PharosScan](https://atlantic.pharosscan.com/tx/0xe57e0dbfdfa76551f4eed3d9862d92a4c455977cdb699f4c84fc196c9363231d) |
| `0x5f3e7472be3ec5018b8b771bcb143e11eb5765ffe58d296f0f19e2a1e90b8158` | 32,497,102 | Infinite Token Allowance Granted (Compliance Risk) | [View on PharosScan](https://atlantic.pharosscan.com/tx/0x5f3e7472be3ec5018b8b771bcb143e11eb5765ffe58d296f0f19e2a1e90b8158) |

---

## 5. Triple Export Verification

All 3 export formats verified live from the production server:

- **Markdown (`/api/export/markdown`)**:
  - Size: 165 lines
  - Content: Full GitHub Flavored Markdown document with tables and explorer links
  - Status: `200 OK`
- **CSV (`/api/export/csv`)**:
  - Size: 317 lines
  - Content: RFC 4180 standard CSV ledger with 18 structured columns
  - Status: `200 OK`
- **PDF (`/api/export/pdf`)**:
  - Size: 6,936 bytes
  - Content: Binary PDF document with header, metadata box, tables, and clickable hyperlinks
  - Status: `200 OK`

---

## 6. Local Demo Video Files

- Clean Video: `demo/pharos-audit-log-agent-demo-clean.mp4` (`3,140,743` bytes)
- Subtitled Video: `demo/pharos-audit-log-agent-demo.mp4` (`3,449,985` bytes)
- Audio Narration: `demo/voiceover.mp3` (`380,592` bytes)
- Subtitle Script: `demo/narration.srt`
