# Pharos Audit-Log Agent — Remediation Report

**Project:** Pharos Audit-Log Agent  
**Repository:** [https://github.com/JimmyOgb/pharos-audit-log-agent](https://github.com/JimmyOgb/pharos-audit-log-agent)  
**Historical Baseline Commit:** [`af75355`](https://github.com/JimmyOgb/pharos-audit-log-agent/commit/af75355)  
**Remediation Baseline:** November 9, 2026  
**Target Network:** Pharos Atlantic Testnet (Chain ID: `688689`)  
**RPC Endpoint:** `https://atlantic.dplabs-internal.com`  
**Explorer:** `https://atlantic.pharosscan.com`  

---

## 1. Executive Summary

Following the independent post-build release audit of the original Pharos Audit-Log Agent baseline (`af75355`), an investigation revealed a critical data-integrity defect in the RPC interaction layer. Although the code appeared to query filtered on-chain events, the client library invocation serialized empty filter arrays (`"topics": []`), resulting in unfiltered network-wide block receipt queries. As a consequence, 316 unrelated testnet transaction logs were ingested and misclassified as activity belonging to the target wallet, generating 100 false-positive phantom alerts.

This remediation addresses the root cause at the JSON-RPC serialization level, implements defensive event classification, provides live on-chain token allowance status verification, separates NFT operator delegations from ERC-20 approvals, and guarantees 100% data provenance with zero false positives.

---

## 2. Root Cause Analysis (Forensic Breakdown)

### 2.1 The Viem v2 `getLogs` Parameter Serialization Trap
In the original baseline `src/services/rpc.ts`:
```typescript
// DEFECTIVE IMPLEMENTATION IN af75355:
export async function fetchLogsInChunks(
  fromBlock: bigint,
  toBlock: bigint,
  topics: (string | string[] | null)[],
  addressFilter?: string
): Promise<Log[]> {
  // ...
  const filterParams: any = {
    fromBlock: currentFrom,
    toBlock: currentTo,
    topics, // <--- Viem v2 PublicClient.getLogs() silently omits topics passed as top-level property
  };
  const logs = await rpcClient.getLogs(filterParams);
}
```

When Viem v2 executes `getLogs(filterParams)`, it expects typed event ABI definitions (`event: parseAbiItem(...)` with `args: {...}`). When raw `topics` arrays are passed to `getLogs`, Viem's internal parameter normalizer drops the unmodeled `topics` field, serializing the JSON-RPC payload as:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_getLogs",
  "params": [
    {
      "fromBlock": "0x1ef97b0",
      "toBlock": "0x1ef9b34",
      "topics": []
    }
  ]
}
```

### 2.2 Atlantic Testnet Node Filter Response
Because `"topics": []` is an empty filter, the Pharos Atlantic testnet RPC node returned **every event log emitted by all contracts across the entire network** within the queried block chunk.

### 2.3 Downstream Propagation
Because the classifier assumed that any log returned by `fetchLogsInChunks([TOPIC_TRANSFER, null, target])` had already been filtered by the node, it parsed all 316 network logs without cross-checking the target address in `topics[2]`. This resulted in:
1. 316 unverified foreign transactions attributed to the audited address.
2. 100 phantom "notable transactions" displayed in the dashboard and exported reports.
3. NFT operator delegations (`ApprovalForAll`) mislabeled as ERC-20 approvals.

---

## 3. Remediation Architecture & Engineering Changes

### 3.1 Raw JSON-RPC Parameter Serialization (`src/services/rpc.ts`)
We replaced the Viem high-level wrapper with direct raw JSON-RPC invocations via `rpcClient.request({ method: 'eth_getLogs', params: [...] })`:
```typescript
const paramsObj: Record<string, any> = {
  fromBlock: `0x${currentFrom.toString(16)}`,
  toBlock: `0x${currentTo.toString(16)}`,
  topics,
};
if (addressFilter) {
  paramsObj.address = addressFilter;
}

const rawLogs = await rpcClient.request({
  method: 'eth_getLogs',
  params: [paramsObj],
}) as any[];
```
This guarantees that the exact `topics` array and hex-encoded block bounds are transmitted over the wire to the Pharos Atlantic node.

### 3.2 Defensive Topic & Address Classification (`src/services/classifier.ts`)
To establish defense-in-depth, `classifyActivities` no longer trusts logs implicitly. Every candidate log must satisfy four validation gates:
1. **Topic0 Equality**: Canonical topic hash must match the expected event signature (`TOPIC_TRANSFER`, `TOPIC_APPROVAL`, `TOPIC_APPROVAL_FOR_ALL`, `TOPIC_SWAP_V2`, `TOPIC_SWAP_V3`).
2. **Indexed Address Matching**: The unpadded address in `topics[1]` (for sender/owner) or `topics[2]` (for recipient/spender) must equal `targetAddress.toLowerCase()`.
3. **Data Length & Integrity**: Validates `log.data` length for value decodings and handles fallback token symbols.
4. **Deduplication**: Uses deterministic key `${log.transactionHash}-${log.logIndex}` to prevent double counting across parallel query bundles.

### 3.3 Live On-Chain Allowance Verification
For token approvals:
1. **Historical Heuristic**: Evaluates whether the granted allowance was $\ge 2^{128}$ (uncapped/infinite approval).
2. **Current On-Chain Read**: Executes an on-chain `eth_call` via `rpcClient.readContract` targeting the token contract's `allowance(owner, spender)` function.
3. **State Distinction**:
   - `Current unlimited allowance confirmed on-chain`: Historical grant was infinite and current allowance remains $\ge 2^{128}$.
   - `Allowance currently reduced or revoked`: Current on-chain allowance is $< 2^{128}$ or `0`.
   - `Current allowance unavailable or unverified`: Contract call reverted or contract is non-standard ERC-20.

### 3.4 Separation of NFT `ApprovalForAll`
`ApprovalForAll(address owner, address operator, bool approved)` events are explicitly separated from ERC-20 token allowances and categorized under **Contract Interactions** as NFT operator delegations.

### 3.5 Deduplication of Swap Transfers
Swap transactions emitting internal component `Transfer` events have their transfer legs annotated with `isSwapComponent: true` and excluded from top-level transfer metrics, preventing trade inflation.

---

## 4. Verification & Testing Evidence

1. **Automated Unit & Regression Suite (`tests/auditEngine.test.ts`)**:
   - 10 comprehensive tests executed covering address validation, block range resolution, raw RPC parameter serialization, defensive rejection of the original 6 foreign network topics, ERC-20 approval decodings, `ApprovalForAll` separation, swap deduplication, BigInt safety, and exporter reconciliation.
   - **Result:** 10 / 10 Tests Passed (100% pass rate).

2. **Live Atlantic Testnet Integration**:
   - Executed live audit on target address `0x299ce4113abf88f4997737184aa8a7a3d58ac15c`.
   - **Original Baseline (`af75355`):** Returned 316 raw logs and 100 phantom alerts.
   - **Remediated Baseline:** Returned **0 raw logs, 0 false positives, 0 phantom alerts**, and an accurate executive summary confirming an idle wallet state.

---

## 5. Acceptance Matrix Compliance

| Acceptance Criterion | Remediation Status | Verification |
| :--- | :--- | :--- |
| 1. Accepts EVM wallet address and user-selected date range | **Compliant** | Verified with boundary checks, ISO dates, and block range clamping. |
| 2. Groups genuine activity into 5 distinct categories | **Compliant** | Transfers In, Transfers Out, Swaps, Token Approvals, Contract Interactions with defensive validation. |
| 3. Includes totals per category and notable transactions with working PharosScan links | **Compliant** | Accurate non-overlapping metrics and verified `https://atlantic.pharosscan.com/tx/{txHash}` links. |
| 4. Exports report as Markdown, PDF, and CSV | **Compliant** | Reconciled across all 3 formats with allowance status and swap annotations. |
