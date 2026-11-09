# Pharos Audit-Log Agent — Deployment Verification Report

**Production URL:** [https://pharos-audit-log-agent-two.vercel.app](https://pharos-audit-log-agent-two.vercel.app)  
**GitHub Repository:** [https://github.com/JimmyOgb/pharos-audit-log-agent](https://github.com/JimmyOgb/pharos-audit-log-agent)  
**Deployment ID:** `dpl_9qjvVQQquJT9CujGD4W1Kb2M7f4p`  
**Target Environment:** Vercel Serverless (iad1 / Washington, D.C.)  
**Node.js Runtime:** Node.js 22.x / TypeScript 5.9.3  
**Network:** Pharos Atlantic Testnet (`Chain ID: 688689`)  
**Remediation Date:** November 9, 2026  

---

## 1. Release Identification

| Entity | Baseline | Remediation Release | Status |
| :--- | :--- | :--- | :--- |
| **Local HEAD** | `af75355` | `d51550e` | Clean working tree |
| **Remote HEAD** | `af75355` | `d51550e` | Synchronized with `origin/main` |
| **Vercel Build Target** | `main` | `main` | Production Alias Active |
| **Deployment ID** | `dpl_F9za5GrkwK162awkuma4bMCnetee` | `dpl_9qjvVQQquJT9CujGD4W1Kb2M7f4p` | Production Active |
| **Network** | Atlantic (`688689`) | Atlantic (`688689`) | Verifiably Connected |

---

## 2. Serverless Function Verification

| Route | HTTP Method | Expected Output | Remediation Production Status |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | HTML Web Dashboard | `200 OK` (Rendered with interactive controls) |
| `/api/health` | `GET` | JSON RPC & network health | `200 OK` (Atlantic Testnet active) |
| `/api/report` | `POST` | Audit report computation | `200 OK` (Zero false positives, defensive filtering) |
| `/api/export/markdown` | `GET` | Formatted Markdown file | `200 OK` (Clean markdown ledger) |
| `/api/export/csv` | `GET` | Tabular RFC 4180 CSV | `200 OK` (Includes Allowance_Status & Is_Swap_Component) |
| `/api/export/pdf` | `GET` | Binary PDF document | `200 OK` (3,334 bytes PDF stream) |

---

## 3. Operational Integrity & Security Guarantees

- **Defensive JSON-RPC Serialization**: Directly transmits raw `topics` arrays via `rpcClient.request({ method: 'eth_getLogs', params: [...] })`, bypassing Viem v2 top-level topic omission.
- **Zero Simulation / Zero Mock Data**: The service issues live JSON-RPC calls directly to `https://atlantic.dplabs-internal.com`.
- **Zero False Positives**: Validated against live on-chain queries; unrelated network logs are filtered out by both node RPC query boundaries and internal topic0 / recipient cross-checks.
- **Strictly Read-Only**: The backend has zero private keys, sends zero transactions, and consumes zero gas.
- **Node-Compliant Chunking**: Log requests respect the Atlantic testnet limit of 1,000 blocks per call via 900-block window chunking.
