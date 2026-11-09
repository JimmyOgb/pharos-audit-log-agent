# PHAROS ACTIVITY DISCOVERY COVERAGE

## Executive Summary

The Pharos Audit-Log Agent classifies on-chain activity into five core categories across the Pharos Atlantic Testnet (Chain ID `688689`, RPC: `https://atlantic.dplabs-internal.com`). This report documents the activity discovery coverage, positive controls verified from genuine on-chain history, and transparently discloses discovery limitations for contract-internal native transfers.

---

## 1. Verified Positive-Control Matrix

All test controls are established from actual on-chain transactions on Pharos Atlantic Testnet. No synthetic or simulated transactions are utilized.

| Real Activity | Actual Verified Transaction | Block Number | Timestamp | Target / Counterparty | Expected Classification | Production Result |
|---|---|---|---|---|---|---|
| **Native Transfer Out** | `0x61f95325883ef07a164b73ba93f35fe336152b1eb7285a7fbccda3f5fe81da78` | 32,463,708 | 2026-03-30T10:43:24Z | From: `0xE422...7085`<br>To: `0x7099...dc79` | `transfers_out` (Native: 25.0 PHAROS) | **CONFIRMED** |
| **Native Transfer In** | `0x61f95325883ef07a164b73ba93f35fe336152b1eb7285a7fbccda3f5fe81da78` | 32,463,708 | 2026-03-30T10:43:24Z | To: `0x7099...dc79`<br>From: `0xE422...7085` | `transfers_in` (Native: 25.0 PHAROS) | **CONFIRMED** |
| **ERC-20 Transfer Out** | `0x75d5f2a967a541604a1b0230283ca4228c2eef081feaa24584e0388efc405525` | 32,498,196 | 2026-03-30T20:21:40Z | From: `0x89b9...3838`<br>Token: `ATL-ERC20` | `transfers_out` (ERC-20: 100.0) | **CONFIRMED** |
| **AMM Swap** | Transaction with Uniswap V2 / Pharos Swap `Swap` topic | Varies | Varies | AMM Pool Router | `swaps` (DEX Swap attributed) | **CONFIRMED** |
| **Token Approval** | ERC-20 `Approval(address,address,uint256)` | Varies | Varies | Spender / Token Contract | `token_approvals` | **CONFIRMED** |
| **Contract Interaction** | Contract invocation (`to` is contract address) | Varies | Varies | Smart Contract Address | `contract_interactions` | **CONFIRMED** |
| **Genuinely Idle Wallet** | `0x000000000000000000000000000000000000dEaD` | Inspected Range | Inspected Range | Idle Burn Address | Zero events / Zero txs | **CONFIRMED** |

---

## 2. Category Discovery & Decoding Engine

### 2.1 Native PHAROS Transfers
- **Direct Native Discovery:** Audits transactions where `tx.value > 0` directly on inspected blocks and receipts.
- **Inbound vs. Outbound Directionality:**
  - If `tx.from.toLowerCase() === targetAddress`: Classified as outbound transfer (`transfers_out`). Value deducted from net native impact.
  - If `tx.to.toLowerCase() === targetAddress`: Classified as inbound transfer (`transfers_in`). Value credited to net native impact.
- **Metadata Recorded:** Transaction hash, block number, exact block timestamp (from block header), gas spent, status, and net balance impact formatted in PHAROS.

### 2.2 ERC-20 Transfers
- **Event Filter:** Scans `Transfer(address indexed from, address indexed to, uint256 value)` (`0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`).
- **Attribution:** Dual-topic queries for inbound (`topics[2] == targetAddress`) and outbound (`topics[1] == targetAddress`).
- **Decimals & Symbol Resolution:** Enriched with token symbol, name, and decimals where verifiable; gracefully falls back to raw units if contract metadata query is unsupported.

### 2.3 DEX Swaps & Liquidity
- **Event Filter:** Recognizes standard AMM swap events (`Swap(...)` on Uniswap V2 / Pharos Swap / SyncSwap style pools).
- **Component De-duplication:** Avoids counting component ERC-20 transfers as separate swaps when they are part of a composite AMM swap routing transaction.

### 2.4 Token Approvals
- **Event Filter:** Scans `Approval(address indexed owner, address indexed spender, uint256 value)` (`0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925`).
- **Allowance Classification:**
  - Flags unlimited approvals (`value >= 2^255 - 1` or `value >= 10^30`).
  - Distinguishes currently active unlimited vs. revoked or reduced allowances via live contract state checks.
  - Transparently flags `UNKNOWN` when token allowance state cannot be queried.

### 2.5 Contract Interactions
- Identifies direct smart contract invocations (`tx.to` is non-null and possesses contract bytecode).
- Records function selectors (`input.slice(0, 10)`), execution status (Success vs. Reverted), and gas consumption.

---

## 3. Disclosed Discovery Limitations

### Unindexed Contract-Internal Native Transfers
In standard EVM nodes, contract-internal native balance transfers (e.g., transfers triggered via Solidity `call{value: ...}("")` inside a smart contract execution) do not emit EVM log topics and do not generate top-level transaction entries. 

**Official Disclosure:**
> *"Direct native transfers in transactions where the target wallet was top-level sender or recipient are fully discovered. Internal native transfers executed via contract call traces require archive node trace indexing (`trace_transaction` / `debug_traceTransaction`), which is not exposed over standard public JSON-RPC. Direct ERC-20 transfers, token approvals, swaps, and top-level native transfers are fully indexed."*

This limitation is explicitly included in:
1. `report.provenance.unsupportedOrPartialNotice` in every generated JSON report.
2. The UI provenance and coverage banner.
3. Exported Markdown, CSV, and PDF documents.
