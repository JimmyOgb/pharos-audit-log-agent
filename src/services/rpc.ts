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
 * Fetch logs across a block range, chunking requests to respect node limits
 */
export async function fetchLogsInChunks(
  fromBlock: bigint,
  toBlock: bigint,
  topics: (string | string[] | null)[]
): Promise<Log[]> {
  const allLogs: Log[] = [];
  let currentFrom = fromBlock;

  while (currentFrom <= toBlock) {
    const currentTo = (currentFrom + BigInt(MAX_BLOCK_CHUNK) - 1n) < toBlock 
      ? currentFrom + BigInt(MAX_BLOCK_CHUNK) - 1n 
      : toBlock;

    try {
      const logs = await rpcClient.getLogs({
        fromBlock: currentFrom,
        toBlock: currentTo,
        // @ts-ignore
        topics,
      });
      allLogs.push(...logs);
    } catch (err: any) {
      console.warn(`[RPC] Chunk [${currentFrom}..${currentTo}] fetch warning:`, err?.message || err);
      // If chunk is still too large, subdivide by half
      if (currentTo > currentFrom) {
        const mid = currentFrom + (currentTo - currentFrom) / 2n;
        try {
          const sub1 = await rpcClient.getLogs({
            fromBlock: currentFrom,
            toBlock: mid,
            // @ts-ignore
            topics,
          });
          const sub2 = await rpcClient.getLogs({
            fromBlock: mid + 1n,
            toBlock: currentTo,
            // @ts-ignore
            topics,
          });
          allLogs.push(...sub1, ...sub2);
        } catch (innerErr) {
          console.error(`[RPC] Subdivided chunk failed:`, innerErr);
        }
      }
    }

    currentFrom = currentTo + 1n;
  }

  return allLogs;
}
