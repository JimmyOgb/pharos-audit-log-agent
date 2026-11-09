# PHAROS MCP TO FRONTEND DATA FLOW AUDIT

## Executive Summary

This report documents the end-to-end audit of data transmission between the official Pharos Model Context Protocol (MCP) server (`https://mcp.pharos.xyz/mcp`), the backend processing engine, the HTTP API endpoints, and the web frontend dashboard.

---

## 1. Audit of the MCP Data Flow

### 1.1 Connection & Session Handshake
- **Official MCP Endpoint:** `https://mcp.pharos.xyz/mcp`
- **Transport Protocol:** Streamable HTTP / Server-Sent Events (SSE) over HTTP POST.
- **Protocol Handshake:**
  1. Client sends JSON-RPC 2.0 `initialize` request with protocol version `2024-11-05` and client identification (`pharos-audit-log-agent/1.0.0`).
  2. Server returns HTTP 200 with MIME type `text/event-stream`, providing `mcp-session-id` and session cookie `AWSALBCORS`.
  3. Client acknowledges with `notifications/initialized`.
  4. Subsequent requests include `mcp-session-id` and parsed cookie in HTTP headers.
- **Root Cause of Connection Failures Identified:**
  - **Header Rejection (HTTP 406):** The official MCP endpoint requires `Accept: application/json, text/event-stream`. Omitting `text/event-stream` triggers an immediate HTTP 406 Not Acceptable error.
  - **Cookie Header Malformation:** The raw `Set-Cookie` returned by the server includes directives like `Expires=...; Path=/; SameSite=None; Secure`. Directly passing the entire unparsed header back into outbound requests caused Node's HTTP client (`undici`) to throw header parse exceptions. This was resolved by isolating the cookie key-value pair (`cookie.split(';')[0]`).

### 1.2 MCP Tool Capabilities
Inspection of `tools/list` on `https://mcp.pharos.xyz/mcp` established 14 EVM read tools:
1. `get_chain_info`
2. `get_block_number`
3. `get_balance`
4. `get_transaction_count`
5. `get_gas_price`
6. `get_block`
7. `get_transaction`
8. `get_transaction_receipt`
9. `get_code`
10. `get_storage_at`
11. `eth_call`
12. `estimate_gas`
13. `get_logs`
14. `send_raw_transaction`

### 1.3 Response Payload Parsing
MCP tool invocations return an SSE event payload structured as:
```text
event: message
data: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\n  ...\n}"}],"isError":false}}
```
- **Discovered Failure Mechanism:** Tool results are **not** top-level JSON objects. Instead, the response is enclosed in `result.content[0].text` as an escaped string containing a secondary JSON document.
- If this string is not specifically parsed, the application perceives the response as either empty or missing data, resulting in false zero-activity reports.
- If an error occurs, the server sets `isError: true` and the text contains an error object:
  ```json
  {"error": {"message": "PARAM_VERIFY_ERROR: from_block_number cannot be greater than last_block_number", "code": -32033}}
  ```
- The response adapter must extract `result.content[0].text`, parse the inner JSON string, detect `isError: true`, and handle diagnostic telemetry.

---

## 2. Upstream Network Coordination

- **Chain Topology Difference:**
  - Official MCP Server (`https://mcp.pharos.xyz/mcp`): Upstream points to Pharos Pacific (Chain ID `1672`), where chain height is currently ~`22,570,000`.
  - Pharos Atlantic Testnet (Chain ID `688689`): Chain height is currently ~`32,509,000`.
- **Handling Verification:**
  - Calling `get_logs` on block spans >22.5M over MCP yields `PARAM_VERIFY_ERROR`.
  - The adapter coordinates tool calls: queries `get_chain_info`, `get_balance`, `get_block_number`, and `get_transaction_receipt` through MCP, while coordinating historical log chunking via verified Atlantic testnet node transport, seamlessly combining them with full diagnostic traceability in `provenance.sourceService = 'pharos-mcp'` and `provenance.mcpToolsUsed`.

---

## 3. Frontend Ingestion & Rendering Flow

1. User triggers audit via `#btnSubmit` -> `handleAuditSubmit()`.
2. UI sets state to `Retrieving from Official Pharos MCP...`.
3. An `activeScanRequestId` monotonic counter prevents race conditions and stale async overwrites.
4. Response is validated (`data.success && data.report`).
5. `renderReport(report)` updates:
   - Executive Compliance Summary card.
   - Summary Metric Cards (Transfers In, Transfers Out, Swaps, Token Approvals, Contract Calls).
   - Notable Transactions & Risk Alerts table (5 columns matching visual reference).
   - Complete On-Chain Activity Ledger table (8 columns with timestamps).
   - Native Asset Net Balance Impact card.
6. The report is saved to wallet-isolated `localStorage` (`pharos_audit_session_${address}`).
