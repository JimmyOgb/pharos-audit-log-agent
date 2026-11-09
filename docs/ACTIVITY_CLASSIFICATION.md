# Activity Classification Specification

**Project:** Pharos Audit-Log Agent  
**Target Network:** Pharos Atlantic Testnet (`Chain ID: 688689`)  
**Standard:** 5 Non-Overlapping Activity Categories for EVM Wallets

---

## 1. Classification Taxonomy

The Pharos Audit-Log Agent processes raw on-chain transaction receipts, execution logs, and account states into five well-defined categories:

| Category ID | Category Name | Definition & Qualification | Primary Signatures / Topics |
| :--- | :--- | :--- | :--- |
| `transfers_in` | **Transfers In** | Inbound asset transfers where the subject wallet is the recipient (`to` address). Includes ERC-20, ERC-721, ERC-1155 token transfers and direct native transfers. Excludes component transfers belonging to DEX swaps. | `Transfer(address,address,uint256)`: `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` (Topic 2 = Target) |
| `transfers_out` | **Transfers Out** | Outbound asset transfers where the subject wallet is the sender (`from` address). Includes ERC-20 token distributions, NFT transfers, and native transfers. Excludes component transfers belonging to DEX swaps. | `Transfer(address,address,uint256)`: `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` (Topic 1 = Target) |
| `swaps` | **Swaps** | Decentralized exchange trade executions where tokens are exchanged. Identified via standard DEX swap signatures (Uniswap V2, V3, Ambient, Curve) or multi-leg transfer bundles within a single transaction. Internal component transfers are subordinated to the swap. | Uniswap V2 `Swap`: `0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822`<br>Uniswap V3 `Swap`: `0xc42079f94a6350d7e6235f29174924f9d5fb2dfc5b2b1e41c4f519c629447228` |
| `token_approvals` | **Token Approvals** | Explicit ERC-20 token allowances granted by the subject wallet (`owner == target`) to third-party smart contracts (e.g., routers, bridges, lending pools). Includes on-chain allowance verification distinguishing current status. | `Approval(address,address,uint256)`: `0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925` |
| `contract_interactions` | **Contract Interactions** | Direct contract calls initiated by or executing against the subject address that do not fall purely into standalone transfer or approval buckets (e.g. staking, claiming, voting, minting, liquidity provisioning, and NFT `ApprovalForAll` operator delegations). | `ApprovalForAll(address,address,bool)`: `0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31` and direct method invocations. |

---

## 2. Precedence and Deduplication Logic

To prevent double-counting between categories:
1. **Swap Precedence**: When a transaction receipt contains a registered `Swap` event topic and involves the target address, the transaction is classified under **Swaps**. The corresponding internal ERC-20 transfer logs within that transaction are subordinated to the swap record (`isSwapComponent = true`) to avoid inflating transfer metrics.
2. **Approval Precedence**: When an `Approval` event is emitted where `owner == target`, it is classified under **Token Approvals**. Its current on-chain state is actively queried via `eth_call allowance(owner, spender)`.
3. **NFT Operator Delegations**: `ApprovalForAll` events are partitioned into **Contract Interactions** and never counted as ERC-20 token approvals.
4. **Standard Transfer Classification**: Inbound transfers without swap context classify strictly as **Transfers In**; outbound transfers without swap context classify strictly as **Transfers Out**.
5. **Self-Transfer Handling**: When `from == to == target`, the transfer is categorized as an outbound self-transfer and deduplicated to prevent double-counting inbound and outbound legs.
6. **Deduplication Key**: All events are uniquely indexed by `${txHash}-${logIndex}`.

---

## 3. Notable Transaction Criteria

Within the audit report, notable transactions are automatically flagged:
- **High-Value Transfers**: Any single transfer exceeding 1,000 token units.
- **Unlimited Approvals**: Any token approval with an initial allowance $\ge 2^{128}$.
- **Active Infinite Allowances**: Any token approval whose current on-chain allowance remains unrevoked ($\ge 2^{128}$).
- **First-Time Interactors**: Transactions with previously unseen smart contracts during the window.
- **DEX Swaps**: Decentralized exchange trades.

Each notable transaction includes:
- Transaction hash
- Timestamp and block number
- Category classification
- Plain-language explanation of purpose
- Direct deep-link to PharosScan explorer: `https://atlantic.pharosscan.com/tx/{txHash}`.
