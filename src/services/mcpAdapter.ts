import dotenv from 'dotenv';
dotenv.config();

export interface McpToolCallResult {
  toolName: string;
  arguments: Record<string, any>;
  isError: boolean;
  rawText?: string;
  parsedData?: any;
  error?: string;
  timestamp: string;
}

export interface McpSessionState {
  endpoint: string;
  sessionId?: string;
  cookie?: string;
  initialized: boolean;
  serverInfo?: { name: string; version: string };
  instructions?: string;
}

export interface NormalizedMcpLog {
  address: string;
  blockHash: string;
  blockNumber: bigint;
  blockTimestamp?: number;
  data: string;
  logIndex: number;
  removed: boolean;
  topics: string[];
  transactionHash: string;
  transactionIndex: number;
}

export interface NormalizedMcpReceipt {
  transactionHash: string;
  blockNumber: bigint;
  from: string;
  to: string | null;
  status: 'SUCCESS' | 'REVERTED';
  gasUsed: bigint;
  logs: NormalizedMcpLog[];
}

export interface NormalizedMcpBalance {
  address: string;
  balanceWei: bigint;
  balanceFormatted: string;
  symbol: string;
}

const MCP_ENDPOINT = process.env.MCP_ENDPOINT || process.env.PHAROS_MCP_ENDPOINT || 'https://mcp.pharos.xyz/mcp';

// In-memory session tracking and diagnostic log
let sessionState: McpSessionState = {
  endpoint: MCP_ENDPOINT,
  initialized: false
};

const diagnosticLog: McpToolCallResult[] = [];
const MAX_DIAGNOSTIC_ENTRIES = 50;

function recordDiagnostic(entry: McpToolCallResult) {
  diagnosticLog.push(entry);
  if (diagnosticLog.length > MAX_DIAGNOSTIC_ENTRIES) {
    diagnosticLog.shift();
  }
}

export function getMcpDiagnostics(): McpToolCallResult[] {
  return [...diagnosticLog];
}

export function getMcpSessionState(): McpSessionState {
  return { ...sessionState };
}

/**
 * Initialize session with the official Pharos MCP server over SSE/HTTP
 */
export async function initMcpSession(force = false): Promise<McpSessionState> {
  if (sessionState.initialized && !force && sessionState.sessionId) {
    return sessionState;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream'
  };

  try {
    const initRes = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'pharos-audit-log-agent', version: '1.0.0' }
        }
      })
    });

    if (!initRes.ok) {
      throw new Error(`MCP initialization failed with HTTP status ${initRes.status}`);
    }

    const sessionId = initRes.headers.get('mcp-session-id') || undefined;
    const rawCookie = initRes.headers.get('set-cookie');
    const cookie = rawCookie ? rawCookie.split(';')[0].trim() : undefined;
    const initText = await initRes.text();

    let serverInfo: any = undefined;
    let instructions: any = undefined;

    const dataLine = initText.split('\n').find(l => l.startsWith('data: '));
    if (dataLine) {
      try {
        const json = JSON.parse(dataLine.slice(6));
        serverInfo = json.result?.serverInfo;
        instructions = json.result?.instructions;
      } catch {
        // Non-fatal SSE parse warning
      }
    }

    // Send initialized notification as per MCP specification
    const notifHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    };
    if (sessionId) notifHeaders['mcp-session-id'] = sessionId;
    if (cookie) notifHeaders['cookie'] = cookie;

    await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: notifHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {}
      })
    }).catch(err => {
      console.warn('[MCP] Notifications/initialized warning:', err.message);
    });

    sessionState = {
      endpoint: MCP_ENDPOINT,
      sessionId,
      cookie,
      initialized: true,
      serverInfo,
      instructions
    };

    return sessionState;
  } catch (err: any) {
    sessionState.initialized = false;
    throw new Error(`Failed to initialize official Pharos MCP at ${MCP_ENDPOINT}: ${err.message}`);
  }
}

/**
 * Call a tool on the official Pharos MCP server
 */
export async function callMcpTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
  await initMcpSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream'
  };
  if (sessionState.sessionId) headers['mcp-session-id'] = sessionState.sessionId;
  if (sessionState.cookie) headers['cookie'] = sessionState.cookie;

  const reqId = Math.floor(Math.random() * 100000);
  const startTime = new Date().toISOString();

  let res: Response;
  try {
    res = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: reqId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      })
    });
  } catch (netErr: any) {
    const diag: McpToolCallResult = {
      toolName,
      arguments: args,
      isError: true,
      error: `Network failure: ${netErr.message}`,
      timestamp: startTime
    };
    recordDiagnostic(diag);
    throw new Error(`Pharos MCP tool call "${toolName}" network error: ${netErr.message}`);
  }

  const rawText = await res.text();

  // Parse SSE response format
  let parsedPayload: any = null;
  let isError = false;
  let errorMessage: string | undefined = undefined;

  const dataLine = rawText.split('\n').find(l => l.startsWith('data: '));
  if (dataLine) {
    try {
      const json = JSON.parse(dataLine.slice(6));
      if (json.error) {
        isError = true;
        errorMessage = json.error.message || JSON.stringify(json.error);
      } else if (json.result) {
        isError = Boolean(json.result.isError);
        const content = json.result.content;
        if (Array.isArray(content) && content.length > 0) {
          const firstBlock = content[0];
          if (firstBlock.type === 'text' && typeof firstBlock.text === 'string') {
            try {
              parsedPayload = JSON.parse(firstBlock.text);
              if (parsedPayload.error) {
                isError = true;
                errorMessage = parsedPayload.error.message || JSON.stringify(parsedPayload.error);
              }
            } catch {
              parsedPayload = firstBlock.text;
            }
          } else {
            parsedPayload = firstBlock;
          }
        } else if (json.result.structuredContent) {
          parsedPayload = json.result.structuredContent;
        } else {
          parsedPayload = json.result;
        }
      }
    } catch (parseErr: any) {
      isError = true;
      errorMessage = `Failed to parse MCP JSON-RPC response: ${parseErr.message}`;
    }
  } else {
    // Non-SSE fallback (plain JSON)
    try {
      const plainJson = JSON.parse(rawText);
      if (plainJson.error) {
        isError = true;
        errorMessage = plainJson.error.message;
      } else {
        parsedPayload = plainJson.result;
      }
    } catch {
      isError = true;
      errorMessage = `Unexpected non-JSON response from MCP: ${rawText.slice(0, 150)}`;
    }
  }

  const diagEntry: McpToolCallResult = {
    toolName,
    arguments: args,
    isError,
    rawText: rawText.length > 500 ? rawText.slice(0, 500) + '...' : rawText,
    parsedData: parsedPayload,
    error: errorMessage,
    timestamp: startTime
  };
  recordDiagnostic(diagEntry);

  if (isError) {
    throw new Error(`MCP tool "${toolName}" failed: ${errorMessage || 'Unknown tool error'}`);
  }

  return parsedPayload;
}

/**
 * Adapter: Normalize hex/decimal values from MCP get_logs response
 */
export function normalizeMcpLog(log: any): NormalizedMcpLog {
  const parseHexOrDec = (val: any): bigint => {
    if (typeof val === 'bigint') return val;
    if (typeof val === 'number') return BigInt(val);
    if (typeof val === 'string') {
      if (val.startsWith('0x')) return BigInt(val);
      return BigInt(parseInt(val, 10) || 0);
    }
    return 0n;
  };

  const parseNum = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      if (val.startsWith('0x')) return parseInt(val, 16);
      return parseInt(val, 10) || 0;
    }
    return 0;
  };

  return {
    address: String(log.address || '').toLowerCase(),
    blockHash: String(log.blockHash || ''),
    blockNumber: parseHexOrDec(log.blockNumber),
    blockTimestamp: log.blockTimestamp ? parseNum(log.blockTimestamp) : undefined,
    data: String(log.data || '0x'),
    logIndex: parseNum(log.logIndex),
    removed: Boolean(log.removed),
    topics: Array.isArray(log.topics) ? log.topics.map((t: any) => String(t).toLowerCase()) : [],
    transactionHash: String(log.transactionHash || ''),
    transactionIndex: parseNum(log.transactionIndex)
  };
}

/**
 * Retrieve EVM logs via official MCP tool "get_logs"
 */
export async function getMcpLogs(
  fromBlock: bigint | number,
  toBlock: bigint | number,
  topics?: (string | string[] | null)[],
  address?: string | string[]
): Promise<NormalizedMcpLog[]> {
  const args: Record<string, any> = {
    fromBlock: Number(fromBlock),
    toBlock: Number(toBlock)
  };

  if (topics && topics.length > 0) {
    args.topics = topics;
  }
  if (address) {
    args.address = address;
  }

  const rawResult = await callMcpTool('get_logs', args);

  let rawLogsList: any[] = [];
  if (Array.isArray(rawResult)) {
    rawLogsList = rawResult;
  } else if (rawResult && Array.isArray(rawResult.logs)) {
    rawLogsList = rawResult.logs;
  }

  return rawLogsList.map(normalizeMcpLog);
}

/**
 * Retrieve native balance via official MCP tool "get_balance"
 */
export async function getMcpBalance(address: string): Promise<NormalizedMcpBalance> {
  const result = await callMcpTool('get_balance', { address });

  let balanceWei = 0n;
  let balanceFormatted = '0.0000 PROS';
  let symbol = 'PROS';

  if (result) {
    if (result.balanceWei) {
      balanceWei = BigInt(result.balanceWei);
    } else if (result.balanceHex) {
      balanceWei = BigInt(result.balanceHex);
    }
    if (result.balance) {
      balanceFormatted = `${result.balance} ${result.symbol || 'PROS'}`;
    }
    if (result.symbol) {
      symbol = result.symbol;
    }
  }

  return {
    address,
    balanceWei,
    balanceFormatted,
    symbol
  };
}

/**
 * Retrieve transaction receipt via official MCP tool "get_transaction_receipt"
 */
export async function getMcpTransactionReceipt(hash: string): Promise<NormalizedMcpReceipt | null> {
  const result = await callMcpTool('get_transaction_receipt', { hash });
  if (!result) return null;

  const rawLogs: any[] = Array.isArray(result.logs) ? result.logs : [];
  const normalizedLogs = rawLogs.map(normalizeMcpLog);

  const isSuccess = result.status === '0x1' || result.status === 1 || result.status === 'SUCCESS';

  return {
    transactionHash: String(result.transactionHash || hash),
    blockNumber: BigInt(result.blockNumber || 0),
    from: String(result.from || '').toLowerCase(),
    to: result.to ? String(result.to).toLowerCase() : null,
    status: isSuccess ? 'SUCCESS' : 'REVERTED',
    gasUsed: BigInt(result.gasUsed || 0),
    logs: normalizedLogs
  };
}

/**
 * Retrieve latest block number via official MCP tool "get_block_number"
 */
export async function getMcpBlockNumber(): Promise<bigint> {
  const result = await callMcpTool('get_block_number', {});
  if (result) {
    if (result.blockNumberHex) {
      return BigInt(result.blockNumberHex);
    }
    if (result.blockNumber) {
      return BigInt(result.blockNumber);
    }
  }
  return 0n;
}

/**
 * Retrieve chain information via official MCP tool "get_chain_info"
 */
export async function getMcpChainInfo(): Promise<any> {
  return await callMcpTool('get_chain_info', {});
}
