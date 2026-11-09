import { createPublicClient, http, defineChain, type Log } from 'viem';
import dotenv from 'dotenv';
dotenv.config();

export const pharosAtlantic = defineChain({
  id: Number(process.env.PHAROS_CHAIN_ID || 688689),
  name: 'Pharos Atlantic Testnet',
  nativeCurrency: {
    name: 'Pharos',
    symbol: 'PHAROS',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.PHAROS_RPC_URL || 'https://atlantic.dplabs-internal.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'PharosScan',
      url: process.env.PHAROS_EXPLORER_URL || 'https://atlantic.pharosscan.com',
    },
  },
});

export const rpcClient = createPublicClient({
  chain: pharosAtlantic,
  transport: http(process.env.PHAROS_RPC_URL || 'https://atlantic.dplabs-internal.com', {
    timeout: 15_000,
    retryCount: 3,
    retryDelay: 1_000,
  }),
});

export const MAX_BLOCK_CHUNK = 900; // Pharos node limit is 1,000 blocks per eth_getLogs

/**
 * Fetch logs across a block range, chunking requests to respect node limits.
 * Uses direct JSON-RPC eth_getLogs serialization to guarantee topics and address
 * filters are transmitted to the RPC node rather than omitted by Viem's getLogs wrapper.
 */
export async function fetchLogsInChunks(
  fromBlock: bigint,
  toBlock: bigint,
  topics: (string | string[] | null)[],
  addressFilter?: string
): Promise<Log[]> {
  const allLogs: Log[] = [];
  let currentFrom = fromBlock;

  while (currentFrom <= toBlock) {
    const currentTo = (currentFrom + BigInt(MAX_BLOCK_CHUNK) - 1n) < toBlock 
      ? currentFrom + BigInt(MAX_BLOCK_CHUNK) - 1n 
      : toBlock;

    const paramsObj: Record<string, any> = {
      fromBlock: `0x${currentFrom.toString(16)}`,
      toBlock: `0x${currentTo.toString(16)}`,
      topics,
    };
    if (addressFilter) {
      paramsObj.address = addressFilter;
    }

    try {
      const rawLogs = await rpcClient.request({
        method: 'eth_getLogs',
        params: [paramsObj],
      }) as any[];

      for (const r of rawLogs) {
        allLogs.push({
          address: r.address.toLowerCase() as `0x${string}`,
          blockHash: r.blockHash,
          blockNumber: typeof r.blockNumber === 'string' ? BigInt(r.blockNumber) : BigInt(r.blockNumber || 0),
          data: r.data,
          logIndex: typeof r.logIndex === 'string' ? parseInt(r.logIndex, 16) : Number(r.logIndex || 0),
          removed: Boolean(r.removed),
          topics: (r.topics || []) as `0x${string}`[],
          transactionHash: r.transactionHash as `0x${string}`,
          transactionIndex: typeof r.transactionIndex === 'string' ? parseInt(r.transactionIndex, 16) : Number(r.transactionIndex || 0),
        } as Log);
      }
    } catch (err: any) {
      console.warn(`[RPC] Chunk [${currentFrom}..${currentTo}] fetch warning:`, err?.message || err);
      // If chunk is rejected due to size, recursively subdivide
      if (currentTo > currentFrom) {
        const mid = currentFrom + (currentTo - currentFrom) / 2n;
        const sub1 = await fetchLogsInChunks(currentFrom, mid, topics, addressFilter);
        const sub2 = await fetchLogsInChunks(mid + 1n, currentTo, topics, addressFilter);
        allLogs.push(...sub1, ...sub2);
      }
    }

    currentFrom = currentTo + 1n;
  }

  return allLogs;
}
