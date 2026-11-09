import { rpcClient } from './rpc.js';

export interface BlockRangeResult {
  fromBlock: bigint;
  toBlock: bigint;
  startTimestamp: number;
  endTimestamp: number;
  startDateFormatted: string;
  endDateFormatted: string;
}

export async function resolveBlockRange(
  startDateStr?: string,
  endDateStr?: string,
  blockSpanLimit: number = 5000
): Promise<BlockRangeResult> {
  const latestBlock = await rpcClient.getBlock({ blockTag: 'latest' });
  const latestNumber = latestBlock.number;
  const latestTimestamp = Number(latestBlock.timestamp);

  let startTimestamp: number;
  let endTimestamp: number;

  const nowMs = Date.now();

  if (endDateStr) {
    const parsedEnd = new Date(endDateStr.includes('T') ? endDateStr : `${endDateStr}T23:59:59Z`).getTime();
    endTimestamp = isNaN(parsedEnd) ? Math.floor(nowMs / 1000) : Math.floor(parsedEnd / 1000);
  } else {
    endTimestamp = latestTimestamp;
  }

  // Cap endTimestamp to latest block timestamp
  if (endTimestamp > latestTimestamp) {
    endTimestamp = latestTimestamp;
  }

  if (startDateStr) {
    const parsedStart = new Date(startDateStr.includes('T') ? startDateStr : `${startDateStr}T00:00:00Z`).getTime();
    startTimestamp = isNaN(parsedStart) ? endTimestamp - 86400 : Math.floor(parsedStart / 1000);
  } else {
    // Default to past 24 hours
    startTimestamp = endTimestamp - 86400;
  }

  if (startTimestamp >= endTimestamp) {
    startTimestamp = endTimestamp - 3600; // fallback to 1 hour minimum
  }

  // On Atlantic testnet, block time is ~1.0 second per block
  const secondsFromLatestToEnd = latestTimestamp - endTimestamp;
  const secondsFromLatestToStart = latestTimestamp - startTimestamp;

  let calculatedToBlock = latestNumber - BigInt(Math.max(0, secondsFromLatestToEnd));
  let calculatedFromBlock = latestNumber - BigInt(Math.max(0, secondsFromLatestToStart));

  if (calculatedFromBlock < 0n) {
    calculatedFromBlock = 0n;
  }
  if (calculatedToBlock > latestNumber) {
    calculatedToBlock = latestNumber;
  }
  if (calculatedFromBlock > calculatedToBlock) {
    calculatedFromBlock = calculatedToBlock > 100n ? calculatedToBlock - 100n : 0n;
  }

  // Safety clamp block span to protect serverless function limits
  const span = calculatedToBlock - calculatedFromBlock;
  if (span > BigInt(blockSpanLimit)) {
    calculatedFromBlock = calculatedToBlock - BigInt(blockSpanLimit);
  }

  return {
    fromBlock: calculatedFromBlock,
    toBlock: calculatedToBlock,
    startTimestamp,
    endTimestamp,
    startDateFormatted: new Date(startTimestamp * 1000).toISOString(),
    endDateFormatted: new Date(endTimestamp * 1000).toISOString(),
  };
}
