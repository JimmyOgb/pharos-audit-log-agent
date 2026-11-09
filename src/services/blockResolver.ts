import { rpcClient } from './rpc.js';
import type { ScanCoverage, ScanCompleteness, ContinuationState } from '../types.js';

export interface BlockRangeResult {
  fromBlock: bigint;
  toBlock: bigint;
  startTimestamp: number;
  endTimestamp: number;
  startDateFormatted: string;
  endDateFormatted: string;
  coverage: ScanCoverage;
  continuationState?: ContinuationState;
}

/**
 * Derives empirical block time dynamically from recent testnet block timestamps.
 * Prevents drift and inaccuracies on non-1s/block networks.
 */
export async function getEmpiricalSecondsPerBlock(latestBlockNum?: bigint, latestBlockTimestamp?: number): Promise<number> {
  try {
    const latestNum = latestBlockNum !== undefined ? latestBlockNum : (await rpcClient.getBlock({ blockTag: 'latest' })).number;
    const latestTs = latestBlockTimestamp !== undefined ? latestBlockTimestamp : Number((await rpcClient.getBlock({ blockTag: 'latest' })).timestamp);
    const sampleBlockNum = latestNum > 30000n ? latestNum - 30000n : 0n;
    const sampleBlock = await rpcClient.getBlock({ blockNumber: sampleBlockNum });
    const deltaSec = Number(latestTs - Number(sampleBlock.timestamp));
    const deltaBlocks = Number(latestNum - sampleBlockNum);
    if (deltaBlocks > 0 && deltaSec > 0) {
      return deltaSec / deltaBlocks;
    }
  } catch (err) {
    console.warn('[BlockResolver] Block time sampling warning, fallback to 2.18s:', err);
  }
  return 2.18;
}

export async function resolveBlockRange(
  startDateStr?: string,
  endDateStr?: string,
  blockSpanLimit: number = 3000,
  cursor?: { fromBlock: number; toBlock: number },
  continuationState?: ContinuationState,
  targetAddress?: string
): Promise<BlockRangeResult> {
  const latestBlock = await rpcClient.getBlock({ blockTag: 'latest' });
  const latestNumber = latestBlock.number;
  const latestTimestamp = Number(latestBlock.timestamp);
  const nowMs = Date.now();
  const limitBig = BigInt(blockSpanLimit);

  // --------------------------------------------------------------------------
  // CASE 1: Bounded Continuation State Provided
  // --------------------------------------------------------------------------
  if (continuationState && typeof continuationState === 'object') {
    // Validate target address binding to prevent session tampering
    if (targetAddress && continuationState.originalTargetAddress) {
      if (targetAddress.toLowerCase() !== continuationState.originalTargetAddress.toLowerCase()) {
        throw new Error(
          `Continuation state address mismatch: cursor was created for ${continuationState.originalTargetAddress}, but request targeted ${targetAddress}`
        );
      }
    }

    const fromB = BigInt(Math.max(0, continuationState.nextFromBlock));
    const targetToB = BigInt(continuationState.resolvedEndBlock);
    const maxChunkToB = fromB + limitBig - 1n;
    const toB = maxChunkToB < targetToB ? maxChunkToB : targetToB;
    const currentChunkSpan = toB >= fromB ? Number(toB - fromB + 1n) : 0;

    const previousScanned = continuationState.totalScannedBlocks || 0;
    const newTotalScanned = previousScanned + currentChunkSpan;
    const totalRequested = continuationState.totalRequestedBlocks || Math.max(1, newTotalScanned);
    const isComplete = toB >= targetToB;
    const completeness: ScanCompleteness = isComplete ? 'COMPLETE' : 'PARTIAL';
    const omittedBlockCount = isComplete ? 0 : Math.max(0, Number(targetToB - toB));
    const coveragePercentage = Math.min(100, Math.round((newTotalScanned / totalRequested) * 1000) / 10);

    const actualStartTs = latestTimestamp - Math.floor(Number(latestNumber - fromB) * (continuationState.empiricalSecondsPerBlock || 2.18));
    const actualEndTs = latestTimestamp - Math.floor(Number(latestNumber - toB) * (continuationState.empiricalSecondsPerBlock || 2.18));

    const nextContinuation: ContinuationState | undefined = isComplete ? undefined : {
      originalTargetAddress: continuationState.originalTargetAddress,
      requestedStartDate: continuationState.requestedStartDate,
      requestedEndDate: continuationState.requestedEndDate,
      resolvedStartBlock: continuationState.resolvedStartBlock,
      resolvedEndBlock: continuationState.resolvedEndBlock,
      totalRequestedBlocks: continuationState.totalRequestedBlocks,
      scannedBlockRanges: [...(continuationState.scannedBlockRanges || []), { fromBlock: Number(fromB), toBlock: Number(toB) }],
      totalScannedBlocks: newTotalScanned,
      accumulatedActivities: continuationState.accumulatedActivities || [],
      nextFromBlock: Number(toB + 1n),
      nextToBlock: continuationState.resolvedEndBlock,
      isComplete: false,
      empiricalSecondsPerBlock: continuationState.empiricalSecondsPerBlock,
    };

    const coverage: ScanCoverage = {
      requestedStartDate: continuationState.requestedStartDate,
      requestedEndDate: continuationState.requestedEndDate,
      requestedBlockSpan: continuationState.totalRequestedBlocks,
      resolvedStartBlock: continuationState.resolvedStartBlock,
      resolvedEndBlock: continuationState.resolvedEndBlock,
      actualStartBlock: Number(fromB),
      actualEndBlock: Number(toB),
      actualScannedBlocksCount: currentChunkSpan,
      actualStartTimestamp: actualStartTs,
      actualEndTimestamp: actualEndTs,
      actualStartDateFormatted: new Date(actualStartTs * 1000).toISOString().replace('T', ' ').replace(/\..+/, ' UTC'),
      actualEndDateFormatted: new Date(actualEndTs * 1000).toISOString().replace('T', ' ').replace(/\..+/, ' UTC'),
      completeness,
      isComplete,
      omittedBlockCount,
      coveragePercentage,
      scannedChunksCount: (continuationState.scannedBlockRanges?.length || 0) + 1,
      failedChunksCount: 0,
      continuationCursor: nextContinuation ? {
        nextFromBlock: nextContinuation.nextFromBlock,
        nextToBlock: nextContinuation.nextToBlock,
      } : undefined,
      continuationState: nextContinuation,
    };

    return {
      fromBlock: fromB,
      toBlock: toB,
      startTimestamp: actualStartTs,
      endTimestamp: actualEndTs,
      startDateFormatted: coverage.actualStartDateFormatted,
      endDateFormatted: coverage.actualEndDateFormatted,
      coverage,
      continuationState: nextContinuation,
    };
  }

  // --------------------------------------------------------------------------
  // CASE 2: Legacy Cursor { fromBlock, toBlock } (Safe Bounding Enforced)
  // --------------------------------------------------------------------------
  if (cursor && typeof cursor.fromBlock === 'number' && typeof cursor.toBlock === 'number') {
    const fromB = BigInt(Math.max(0, cursor.fromBlock));
    const targetToB = BigInt(Math.min(Number(latestNumber), cursor.toBlock));
    const maxChunkToB = fromB + limitBig - 1n;
    const toB = maxChunkToB < targetToB ? maxChunkToB : targetToB;
    const cursorSpan = toB >= fromB ? toB - fromB + 1n : 0n;

    const isComplete = toB >= targetToB;
    const completeness: ScanCompleteness = isComplete ? 'COMPLETE' : 'PARTIAL';
    const omittedBlockCount = isComplete ? 0 : Math.max(0, Number(targetToB - toB));
    const totalSpan = targetToB >= fromB ? targetToB - fromB + 1n : 1n;
    const coveragePercentage = Math.min(100, Math.round((Number(cursorSpan) / Number(totalSpan)) * 1000) / 10);

    const actualStartTs = latestTimestamp - Number(latestNumber - fromB);
    const actualEndTs = latestTimestamp - Number(latestNumber - toB);

    const nextCursor = isComplete ? undefined : {
      nextFromBlock: Number(toB + 1n),
      nextToBlock: Number(targetToB),
    };

    const coverage: ScanCoverage = {
      requestedStartDate: new Date(actualStartTs * 1000).toISOString(),
      requestedEndDate: new Date(actualEndTs * 1000).toISOString(),
      requestedBlockSpan: Number(totalSpan),
      resolvedStartBlock: Number(fromB),
      resolvedEndBlock: Number(targetToB),
      actualStartBlock: Number(fromB),
      actualEndBlock: Number(toB),
      actualScannedBlocksCount: Number(cursorSpan),
      actualStartTimestamp: actualStartTs,
      actualEndTimestamp: actualEndTs,
      actualStartDateFormatted: new Date(actualStartTs * 1000).toISOString().replace('T', ' ').replace(/\..+/, ' UTC'),
      actualEndDateFormatted: new Date(actualEndTs * 1000).toISOString().replace('T', ' ').replace(/\..+/, ' UTC'),
      completeness,
      isComplete,
      omittedBlockCount,
      coveragePercentage,
      scannedChunksCount: Math.ceil(Number(cursorSpan) / 900),
      failedChunksCount: 0,
      continuationCursor: nextCursor,
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

  // --------------------------------------------------------------------------
  // CASE 3: Initial Date-Range Scan with Empirical Block Cadence
  // --------------------------------------------------------------------------
  const avgSecondsPerBlock = await getEmpiricalSecondsPerBlock(latestNumber, latestTimestamp);

  // 1. Resolve requested end date
  let requestedEndTs: number;
  if (endDateStr) {
    const endStr = endDateStr.includes('T') ? endDateStr : `${endDateStr}T23:59:59.999Z`;
    const parsed = new Date(endStr).getTime();
    requestedEndTs = isNaN(parsed) ? Math.floor(nowMs / 1000) : Math.floor(parsed / 1000);
  } else {
    requestedEndTs = latestTimestamp;
  }

  // Cap to latest block timestamp if in future
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

  // 3. Convert timestamps to block heights based on empirical block cadence
  const secondsFromLatestToEnd = latestTimestamp - requestedEndTs;
  const secondsFromLatestToStart = latestTimestamp - requestedStartTs;

  const blocksFromLatestToEnd = BigInt(Math.max(0, Math.floor(secondsFromLatestToEnd / avgSecondsPerBlock)));
  const blocksFromLatestToStart = BigInt(Math.max(0, Math.floor(secondsFromLatestToStart / avgSecondsPerBlock)));

  let resolvedToBlock = latestNumber - blocksFromLatestToEnd;
  let resolvedStartBlock = latestNumber - blocksFromLatestToStart;

  if (resolvedStartBlock < 0n) resolvedStartBlock = 0n;
  if (resolvedToBlock > latestNumber) resolvedToBlock = latestNumber;
  if (resolvedStartBlock > resolvedToBlock) {
    resolvedStartBlock = resolvedToBlock > 100n ? resolvedToBlock - 100n : 0n;
  }

  const requestedSpan = resolvedToBlock - resolvedStartBlock + 1n;

  // 4. Determine initial chunk boundaries
  let actualFromBlock: bigint;
  let actualToBlock: bigint;
  let isComplete: boolean;
  let completeness: ScanCompleteness;
  let omittedBlockCount = 0;
  let coveragePercentage = 100;
  let initialContinuationState: ContinuationState | undefined = undefined;

  if (requestedSpan <= limitBig) {
    actualFromBlock = resolvedStartBlock;
    actualToBlock = resolvedToBlock;
    isComplete = true;
    completeness = 'COMPLETE';
    omittedBlockCount = 0;
    coveragePercentage = 100;
  } else {
    // Scan forward chronologically from the start of the audit range
    actualFromBlock = resolvedStartBlock;
    actualToBlock = resolvedStartBlock + limitBig - 1n;
    if (actualToBlock > resolvedToBlock) {
      actualToBlock = resolvedToBlock;
    }
    isComplete = false;
    completeness = 'PARTIAL';
    omittedBlockCount = Number(resolvedToBlock - actualToBlock);
    coveragePercentage = Math.round((Number(limitBig) / Math.max(1, Number(requestedSpan))) * 1000) / 10;

    initialContinuationState = {
      originalTargetAddress: targetAddress || '',
      requestedStartDate: new Date(requestedStartTs * 1000).toISOString(),
      requestedEndDate: new Date(requestedEndTs * 1000).toISOString(),
      resolvedStartBlock: Number(resolvedStartBlock),
      resolvedEndBlock: Number(resolvedToBlock),
      totalRequestedBlocks: Number(requestedSpan),
      scannedBlockRanges: [{ fromBlock: Number(actualFromBlock), toBlock: Number(actualToBlock) }],
      totalScannedBlocks: Number(actualToBlock - actualFromBlock + 1n),
      accumulatedActivities: [],
      nextFromBlock: Number(actualToBlock + 1n),
      nextToBlock: Number(resolvedToBlock),
      isComplete: false,
      empiricalSecondsPerBlock: avgSecondsPerBlock,
    };
  }

  const actualScannedCount = Number(actualToBlock - actualFromBlock + 1n);
  const actualEndTs = latestTimestamp - Math.floor(Number(latestNumber - actualToBlock) * avgSecondsPerBlock);
  const actualStartTs = latestTimestamp - Math.floor(Number(latestNumber - actualFromBlock) * avgSecondsPerBlock);

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
    continuationCursor: initialContinuationState ? {
      nextFromBlock: initialContinuationState.nextFromBlock,
      nextToBlock: initialContinuationState.nextToBlock,
    } : undefined,
    continuationState: initialContinuationState,
  };

  return {
    fromBlock: actualFromBlock,
    toBlock: actualToBlock,
    startTimestamp: actualStartTs,
    endTimestamp: actualEndTs,
    startDateFormatted: coverage.actualStartDateFormatted,
    endDateFormatted: coverage.actualEndDateFormatted,
    coverage,
    continuationState: initialContinuationState,
  };
}
