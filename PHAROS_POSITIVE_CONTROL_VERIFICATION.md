# Positive-Control Matrix: Read-Only Blockchain Verification

**Target Wallet:** `0xE4220c4b71877bb94EB173f467ef5c5557017085`  
**Network:** Pharos Atlantic Testnet (Chain ID `688689`)  
**RPC URL:** `https://atlantic.dplabs-internal.com`  
**Production URL:** `https://pharos-audit-log-agent-two.vercel.app`  
**Verification Date:** November 9, 2026  

---

## Positive-Control Matrix

All positive controls below were established using genuine on-chain history from the target wallet. No fabricated transactions or synthetic test mocks were used. Every control was verified directly against the live Pharos Atlantic RPC and confirmed detected on the production deployment.

| Real Activity | Actual Verified Transaction Hash | Block | Timestamp (UTC) | Expected Classification | Production Result | Status |
|---|---|---|---|---|---|---|
| **Native Transfer Out** | `0xbc63023089ccd1856d956f23288b58165fda5e8cf9e56f668cfbf0f13f2c9bf9` | `32463702` | 2026-11-08 04:50:44 | `transfers_out` | Detected: `25.0000 PHAROS` sent to `0x709979...dc79c8` | **VERIFIED** |
| **Native Transfer In** | `0xa3df2f7c5f17ce80ad099c3d65f08236003ab7016fa5d49ce783664e8908ecc4` | `16115924` | 2026-03-14 15:27:48 | `transfers_in` | Detected: `0.0100 PHAROS` received from `0x196fc6...6b1493` | **VERIFIED** |
| **ERC-20 Transfer Out (Swap Leg)** | `0x1123d411185a0d5d3120eb7895ebad3a6718f78cd3a2d8f022b16f1bc3e0675a` (Log 0) | `31674475` | 2026-10-20 20:24:42 | `transfers_out` | Detected: `100.0000 TKA` transferred to TestAMM Router | **VERIFIED** |
| **ERC-20 Transfer In (Swap Leg)** | `0x1123d411185a0d5d3120eb7895ebad3a6718f78cd3a2d8f022b16f1bc3e0675a` (Log 1) | `31674475` | 2026-10-20 20:24:42 | `transfers_in` | Detected: `100.0000 TKB` received from TestAMM Router (18 dec) | **VERIFIED** |
| **Successful AMM Swap** | `0x1123d411185a0d5d3120eb7895ebad3a6718f78cd3a2d8f022b16f1bc3e0675a` (Log 2) | `31674475` | 2026-10-20 20:24:42 | `swaps` | Detected: `TestAMM 1:1 Swap (100.0000 TKA → 100.0000 TKB)` | **VERIFIED** |

---

## Detailed Evidence Records

### 1. Control 1: Outbound Native PHAROS Transfer
- **Transaction Hash:** `0xbc63023089ccd1856d956f23288b58165fda5e8cf9e56f668cfbf0f13f2c9bf9`
- **Block Number:** `32463702`
- **Timestamp:** `1794113444` (`2026-11-08 04:50:44 UTC`)
- **From:** `0xE4220c4b71877bb94EB173f467ef5c5557017085` (Target Wallet)
- **To:** `0x70997970c51812dc3a010c7d01b50e0d17dc79c8`
- **Value (Wei):** `25000000000000000000` (25.0 PHAROS)
- **Status:** Success (`status: 1`)
- **Production API Output:**
  ```json
  {
    "id": "0xbc63023089ccd1856d956f23288b58165fda5e8cf9e56f668cfbf0f13f2c9bf9-native-out",
    "category": "transfers_out",
    "title": "Outbound Native Transfer (25.0000 PHAROS)",
    "formattedAmount": "25.0000 PHAROS",
    "isNative": true,
    "status": "SUCCESS"
  }
  ```

### 2. Control 2: Inbound Native PHAROS Transfer
- **Transaction Hash:** `0xa3df2f7c5f17ce80ad099c3d65f08236003ab7016fa5d49ce783664e8908ecc4`
- **Block Number:** `16115924`
- **Timestamp:** `1773502068` (`2026-03-14 15:27:48 UTC`)
- **From:** `0x196fc6aab375e4999dd5f23522bc8ece986b1493`
- **To:** `0xE4220c4b71877bb94EB173f467ef5c5557017085` (Target Wallet)
- **Value (Wei):** `10000000000000000` (0.01 PHAROS)
- **Status:** Success (`status: 1`)
- **Production API Output:**
  ```json
  {
    "id": "0xa3df2f7c5f17ce80ad099c3d65f08236003ab7016fa5d49ce783664e8908ecc4-native-in",
    "category": "transfers_in",
    "title": "Inbound Native Transfer (0.0100 PHAROS)",
    "formattedAmount": "0.0100 PHAROS",
    "isNative": true,
    "status": "SUCCESS"
  }
  ```

### 3. Control 3 & 4: ERC-20 Dual-Leg Transfers (Swap Components)
- **Transaction Hash:** `0x1123d411185a0d5d3120eb7895ebad3a6718f78cd3a2d8f022b16f1bc3e0675a`
- **Block Number:** `31674475`
- **Timestamp:** `1792527882` (`2026-10-20 20:24:42 UTC`)
- **Log 0 (Outbound Transfer):**
  - Contract: `0x6396f75c03bbc44503f9c155e834dda30c947036` (Token A - TKA)
  - Sender: `0xE4220c4b71877bb94EB173f467ef5c5557017085`
  - Recipient: `0x5302b3cc1d7741dc6bf506349a51355e10b9de1d` (TestAMM Router)
  - Amount: `100000000000000000000` (100.0000 TKA)
  - Label: `[Swap Leg] Outbound Token Transfer (100.0000 TKA)`
- **Log 1 (Inbound Transfer):**
  - Contract: `0xf37815a784c5a97b7319ecb89a8f0e34aafd472a` (Token B - TKB)
  - Sender: `0x5302b3cc1d7741dc6bf506349a51355e10b9de1d` (TestAMM Router)
  - Recipient: `0xE4220c4b71877bb94EB173f467ef5c5557017085`
  - Decoded On-Chain Decimals: `18`
  - Amount: `100000000000000000000` (100.0000 TKB)
  - Label: `[Swap Leg] Inbound Token Transfer (100.0000 TKB)`

### 4. Control 5: AMM Swap Execution
- **Transaction Hash:** `0x1123d411185a0d5d3120eb7895ebad3a6718f78cd3a2d8f022b16f1bc3e0675a`
- **Block Number:** `31674475`
- **Log Index:** 2
- **Contract:** `0x5302b3cc1d7741dc6bf506349a51355e10b9de1d` (Pharos TestAMM Router)
- **Topic 0:** `0x126fe2d5f4d208dadcffabe2d8dcc6f4a5dd387d59d658860e2109c58e34563a` (`SwapExecuted`)
- **Sender:** `0xE4220c4b71877bb94EB173f467ef5c5557017085`
- **Trade Pair:** Swapped 100.0000 TKA for 100.0000 TKB
- **Production API Output:**
  ```json
  {
    "id": "0x1123d411185a0d5d3120eb7895ebad3a6718f78cd3a2d8f022b16f1bc3e0675a-2",
    "category": "swaps",
    "title": "TestAMM 1:1 Swap (100.0000 TKA → 100.0000 TKB)",
    "description": "Executed AMM trade on TestAMM Router (0x5302b3cc1d7741dc6bf506349a51355e10b9de1d). Swapped 100.0000 TKA for 100.0000 TKB.",
    "formattedAmount": "100.0000 TKA → 100.0000 TKB",
    "status": "SUCCESS"
  }
  ```

---

## Additional Verified Swap

A second verified swap was identified and confirmed on-chain for the target wallet:
- **Transaction Hash:** `0x084fc19a8f4219ce639e4cbf66e0001beaac391d3f396f367c177b4e4145b2f7`
- **Block Number:** `31672180`
- **Timestamp:** `1792523292` (`2026-10-20 19:08:12 UTC`)
- **Protocol:** Pharos TestAMM Router (`0x5302b3cc1d7741dc6bf506349a51355e10b9de1d`)
- **Trade:** 100.0000 TKB swapped for 100.0000 TKA
- **Status:** SUCCESS

All 5 positive controls are 100% verified.
