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

---

## Token Normalization Standard

To preserve accounting accuracy:
1. `rawAmount`: Full unsigned integer as string (`"1000000"`).
2. `decimals`: Extracted from token contract via `decimals()` call (`6`).
3. `symbol`: Extracted from token contract via `symbol()` call (`"USDC"`).
4. `formattedAmount`: Decoded string (`"1.000000 USDC"`).
5. Mathematical totals are aggregated by unique token denomination; multiple denominations are never added together into a nonsensical combined sum.
