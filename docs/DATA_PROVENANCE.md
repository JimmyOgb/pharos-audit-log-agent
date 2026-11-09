# PHAROS AUDIT-LOG AGENT — DATA PROVENANCE & NORMALIZATION SPECIFICATION

## Data Provenance Contract

Every transaction or event record extracted by the Audit-Log Agent contains an immutable provenance object ensuring zero simulation and full traceability:

```typescript
export interface DataProvenance {
  sourceService: 'atlantic-rpc' | 'pacific-rpc' | 'pharos-mcp';
  chainId: number;
  blockNumber: number;
  blockTimestamp: number;
  blockDateUtc: string;
  transactionHash: string;
  logIndex?: number;
  rawCalldataOrLogData?: string;
}
```

### Report-Level Provenance Metrics
Each generated audit report includes explicit provenance metadata:
```typescript
provenance: {
  queryTimestamp: string;
  blockSpan: number;
  rawLogsRetrieved: number;
  deduplicatedEventsCount: number;
  verifiedOnChain: boolean;
}
```
This guarantees an auditor can immediately verify that:
1. `rawLogsRetrieved` matches the exact count of RPC log receipts returned by the node.
2. `deduplicatedEventsCount` reflects the exact number of verified distinct events after priority filtering.
3. `verifiedOnChain` confirms that all data originated from live JSON-RPC calls on Pharos Atlantic testnet (`Chain ID: 688689`).

---

## Token Normalization Standard

To preserve accounting accuracy:
1. `rawAmount`: Full unsigned integer as string (`"1000000"`).
2. `decimals`: Extracted from token contract via `decimals()` call (`6`).
3. `symbol`: Extracted from token contract via `symbol()` call (`"USDC"`).
4. `formattedAmount`: Decoded string (`"1.000000 USDC"`).
5. Mathematical totals are aggregated by unique token denomination; multiple denominations are never added together into a nonsensical combined sum.

---

## Direct JSON-RPC Filter Serialization

To guarantee that the RPC node performs precise log filtering:
- Log queries bypass high-level client wrappers and transmit raw `topics` arrays:
  ```json
  {
    "method": "eth_getLogs",
    "params": [
      {
        "fromBlock": "0x1ef97b0",
        "toBlock": "0x1ef9b34",
        "topics": [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          null,
          "0x000000000000000000000000299ce4113abf88f4997737184aa8a7a3d58ac15c"
        ]
      }
    ]
  }
  ```
- Downstream defensive validation verifies that topic0 and indexed addresses match the target before admission into the audit ledger.
