import { rpcClient } from './rpc.js';
import type { ScanCoverage, ScanCompleteness } from '../types.js';

export interface BlockRangeResult {
  fromBlock: bigint;
  toBlock: bigint;
  startTimestamp: number;
  endTimestamp: number;
  startDateFormatted: string;
  endDateFormatted: string;
  coverage: ScanCoverage;
}

export async function resolveBlockRange(
  startDateStr?: string,
  endDateStr?: string,
  blockSpanLimit: number = 3000,
  cursor?: { fromBlock: number; toBlock: number }
): Promise<BlockRangeResult> {
  const latestBlock = await rpcClient.getBlock({ blockTag: 'latest' });
  const latestNumber = latestBlock.number;
  const latestTimestamp = Number(latestBlock.timestamp);
  const nowMs = Date.now();
  const currentUtcDate = new Date(nowMs).toISOString();

  // If a continuation cursor is explicitly provided, use its exact block boundaries
  if (cursor && typeof cursor.fromBlock === 'number' && typeof cursor.toBlock === 'number') {
    const fromB = BigInt(Math.max(0, cursor.fromBlock));
    const toB = BigInt(Math.min(Number(latestNumber), cursor.toBlock));
    const cursorSpan = toB >= fromB ? toB - fromB + 1n : 0n;

    const actualStartTs = latestTimestamp - Number(latestNumber - fromB);
    const actualEndTs = latestTimestamp - Number(latestNumber - toB);

    const coverage: ScanCoverage = {
      requestedStartDate: new Date(actualStartTs * 1000).toISOString(),
      requestedEndDate: new Date(actualEndTs * 1000).toISOString(),
      requestedBlockSpan: Number(cursorSpan),
      resolvedStartBlock: Number(fromB),
      resolvedEndBlock: Number(toB),
      actualStartBlock: Number(fromB),
      actualEndBlock: Number(toB),
      actualScannedBlocksCount: Number(cursorSpan),
      actualStartTimestamp: actualStartTs,
      actualEndTimestamp: actualEndTs,
      actualStartDateFormatted: new Date(actualStartTs * 1000).toISOString().replace('T', ' ').replace(/\..+/, ' UTC'),
      actualEndDateFormatted: new Date(actualEndTs * 1000).toISOString().replace('T', ' ').replace(/\..+/, ' UTC'),
      completeness: 'COMPLETE',
      isComplete: true,
      omittedBlockCount: 0,
      coveragePercentage: 100,
      scannedChunksCount: Math.ceil(Number(cursorSpan) / 900),
      failedChunksCount: 0,
    };

    return {
      fromBlock: fromB,
      toBlock: toB,
      startTimestamp: actualStartTs,
      endTimestamp: actualEndTs,
      startDateFormatted: coverage.actualStartDateFormatted,
      endDateFormatted: coverage.actualEndDateFormatted,
      coverage,
    };
  }

  // 1. Resolve requested end date
  let requestedEndTs: number;
  if (endDateStr) {
    const endStr = endDateStr.includes('T') ? endDateStr : `${endDateStr}T23:59:59.999Z`;
    const parsed = new Date(endStr).getTime();
    requestedEndTs = isNaN(parsed) ? Math.floor(nowMs / 1000) : Math.floor(parsed / 1000);
  } else {
    requestedEndTs = latestTimestamp;
  }

  // Cap to latest block timestamp if future date
  if (requestedEndTs > latestTimestamp) {
    requestedEndTs = latestTimestamp;
  }

  // 2. Resolve requested start date
  let requestedStartTs: number;
  if (startDateStr) {
    const startStr = startDateStr.includes('T') ? startDateStr : `${startDateStr}T00:00:00.000Z`;
    const parsed = new Date(startStr).getTime();
    requestedStartTs = isNaN(parsed) ? requestedEndTs - 86400 : Math.floor(parsed / 1000);
  } else {
    // Default: past 24 hours
    requestedStartTs = requestedEndTs - 86400;
  }

  // Handle start >= end
  if (requestedStartTs >= requestedEndTs) {
    requestedStartTs = requestedEndTs - 3600; // fallback to 1 hour minimum interval
  }

  // 3. Convert timestamps to block heights based on Pharos Atlantic ~1.0s/block
  const secondsFromLatestToEnd = latestTimestamp - requestedEndTs;
  const secondsFromLatestToStart = latestTimestamp - requestedStartTs;

  let resolvedToBlock = latestNumber - BigInt(Math.max(0, secondsFromLatestToEnd));
  let resolvedStartBlock = latestNumber - BigInt(Math.max(0, secondsFromLatestToStart));

  if (resolvedStartBlock < 0n) resolvedStartBlock = 0n;
  if (resolvedToBlock > latestNumber) resolvedToBlock = latestNumber;
  if (resolvedStartBlock > resolvedToBlock) {
    resolvedStartBlock = resolvedToBlock > 100n ? resolvedToBlock - 100n : 0n;
  }

  const requestedSpan = resolvedToBlock - resolvedStartBlock + 1n;
  const limitBig = BigInt(blockSpanLimit);

  // 4. Determine actual scanned range and completeness status
  let actualFromBlock: bigint;
  let actualToBlock: bigint = resolvedToBlock;
  let isComplete: boolean;
  let completeness: ScanCompleteness;
  let omittedBlockCount = 0;
  let coveragePercentage = 100;
  let continuationCursor: { nextFromBlock: number; nextToBlock: number } | undefined = undefined;

  if (requestedSpan <= limitBig) {
    actualFromBlock = resolvedStartBlock;
    isComplete = true;
    completeness = 'COMPLETE';
    omittedBlockCount = 0;
    coveragePercentage = 100;
  } else {
    actualFromBlock = resolvedToBlock - limitBig + 1n;
    if (actualFromBlock < resolvedStartBlock) {
      actualFromBlock = resolvedStartBlock;
    }
    isComplete = false;
    completeness = 'PARTIAL';
    omittedBlockCount = Number(actualFromBlock - resolvedStartBlock);
    coveragePercentage = Math.round((Number(limitBig) / Math.max(1, Number(requestedSpan))) * 1000) / 10;
    continuationCursor = {
      nextFromBlock: Number(resolvedStartBlock),
      nextToBlock: Number(actualFromBlock - 1n),
    };
  }

  const actualScannedCount = Number(actualToBlock - actualFromBlock + 1n);
  const actualEndTs = latestTimestamp - Number(latestNumber - actualToBlock);
  const actualStartTs = latestTimestamp - Number(latestNumber - actualFromBlock);

  const coverage: ScanCoverage = {
    requestedStartDate: new Date(requestedStartTs * 1000).toISOString(),
    requestedEndDate: new Date(requestedEndTs * 1000).toISOString(),
    requestedBlockSpan: Number(requestedSpan),
    resolvedStartBlock: Number(resolvedStartBlock),
    resolvedEndBlock: Number(resolvedToBlock),
    actualStartBlock: Number(actualFromBlock),
    actualEndBlock: Number(actualToBlock),
    actualScannedBlocksCount: actualScannedCount,
    actualStartTimestamp: actualStartTs,
    actualEndTimestamp: actualEndTs,
    actualStartDateFormatted: new Date(actualStartTs * 1000).toISOString().replace('T', ' ').replace(/\..+/, ' UTC'),
    actualEndDateFormatted: new Date(actualEndTs * 1000).toISOString().replace('T', ' ').replace(/\..+/, ' UTC'),
    completeness,
    isComplete,
    omittedBlockCount,
    coveragePercentage,
    scannedChunksCount: Math.ceil(actualScannedCount / 900),
    failedChunksCount: 0,
    continuationCursor,
  };

  return {
    fromBlock: actualFromBlock,
    toBlock: actualToBlock,
    startTimestamp: actualStartTs,
    endTimestamp: actualEndTs,
    startDateFormatted: coverage.actualStartDateFormatted,
    endDateFormatted: coverage.actualEndDateFormatted,
    coverage,
  };
}
