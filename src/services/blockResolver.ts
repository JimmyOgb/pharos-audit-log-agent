import { rpcClient } from './rpc.js';
import { validateAndNormalizeAddress } from './addressValidator.js';
import type { ScanCoverage, ScanCompleteness, ContinuationState } from '../types.js';

export const PHAROS_GENESIS_BLOCK = 1n;
export const PHAROS_GENESIS_TIMESTAMP = 1759043784; // 2025-09-28T07:16:24.000Z
export const PHAROS_GENESIS_DATE_ISO = '2025-09-28T07:16:24.000Z';

export function formatUtcDate(timestampSec: number): string {
  return new Date(timestampSec * 1000).toISOString().replace('T', ' ').replace(/\..+/, ' UTC');
}

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

/**
 * Accurately finds the block number for a given timestamp using binary interpolation search.
 */
export async function findBlockForTimestamp(
  targetTs: number,
  latestBlockNum: bigint,
  latestBlockTs: number
): Promise<bigint> {
  if (targetTs <= PHAROS_GENESIS_TIMESTAMP) return PHAROS_GENESIS_BLOCK;
  if (targetTs >= latestBlockTs) return latestBlockNum;

  let low = PHAROS_GENESIS_BLOCK;
  let high = latestBlockNum;
  let lowTs = PHAROS_GENESIS_TIMESTAMP;
  let highTs = latestBlockTs;

  for (let i = 0; i < 5; i++) {
    if (high <= low + 100n) break;
    const ratio = Math.max(0, Math.min(1, (targetTs - lowTs) / Math.max(1, (highTs - lowTs))));
    let est = low + BigInt(Math.floor(ratio * Number(high - low)));
    if (est <= low) est = low + 1n;
    if (est >= high) est = high - 1n;

    try {
      const b = await rpcClient.getBlock({ blockNumber: est });
      const bTs = Number(b.timestamp);
      if (bTs <= targetTs) {
        low = est;
        lowTs = bTs;
      } else {
        high = est;
        highTs = bTs;
      }
    } catch {
      break;
    }
  }

  return low;
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
      try {
        const normTarget = validateAndNormalizeAddress(targetAddress);
        const normOriginal = validateAndNormalizeAddress(continuationState.originalTargetAddress);
        if (normTarget !== normOriginal) {
          throw new Error(
            `Continuation state address mismatch: cursor was created for ${normOriginal}, but request targeted ${normTarget}`
          );
        }
      } catch (err: any) {
        if (err.message.includes('Continuation state address mismatch')) throw err;
        if (targetAddress.toLowerCase() !== continuationState.originalTargetAddress.toLowerCase()) {
          throw new Error(
            `Continuation state address mismatch: cursor was created for ${continuationState.originalTargetAddress}, but request targeted ${targetAddress}`
          );
        }
      }
    }

    const fromB = BigInt(Math.max(1, continuationState.nextFromBlock));
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

    // Query real on-chain block timestamps for current chunk bounds
    const [startBlk, endBlk] = await Promise.all([
      rpcClient.getBlock({ blockNumber: fromB }).catch(() => null),
      rpcClient.getBlock({ blockNumber: toB }).catch(() => null),
    ]);
    const actualStartTs = startBlk 
      ? Number(startBlk.timestamp) 
      : latestTimestamp - Math.floor(Number(latestNumber - fromB) * (continuationState.empiricalSecondsPerBlock || 2.18));
    const actualEndTs = endBlk 
      ? Number(endBlk.timestamp) 
      : latestTimestamp - Math.floor(Number(latestNumber - toB) * (continuationState.empiricalSecondsPerBlock || 2.18));

    const cumulativeStartBlock = continuationState.cumulativeStartBlock ?? continuationState.resolvedStartBlock ?? Number(fromB);
    const cumulativeEndBlock = Number(toB);
    const cumulativeStartDateFormatted = continuationState.cumulativeStartDateFormatted ?? formatUtcDate(actualStartTs);
    const cumulativeEndDateFormatted = formatUtcDate(actualEndTs);

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
      cumulativeStartBlock,
      cumulativeEndBlock,
      cumulativeStartTimestamp: continuationState.cumulativeStartTimestamp ?? actualStartTs,
      cumulativeEndTimestamp: actualEndTs,
      cumulativeStartDateFormatted,
      cumulativeEndDateFormatted,
      genesisClamped: continuationState.genesisClamped,
      genesisNotice: continuationState.genesisNotice,
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
      actualStartDateFormatted: formatUtcDate(actualStartTs),
      actualEndDateFormatted: formatUtcDate(actualEndTs),
      cumulativeStartBlock,
      cumulativeEndBlock,
      cumulativeScannedBlocksCount: newTotalScanned,
      cumulativeStartDateFormatted,
      cumulativeEndDateFormatted,
      currentChunkStartBlock: Number(fromB),
      currentChunkEndBlock: Number(toB),
      currentChunkBlocksCount: currentChunkSpan,
      currentChunkStartDateFormatted: formatUtcDate(actualStartTs),
      currentChunkEndDateFormatted: formatUtcDate(actualEndTs),
      remainingBlocksCount: omittedBlockCount,
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
      genesisClamped: continuationState.genesisClamped,
      genesisNotice: continuationState.genesisNotice,
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
    const fromB = BigInt(Math.max(1, cursor.fromBlock));
    const targetToB = BigInt(Math.min(Number(latestNumber), cursor.toBlock));
    const maxChunkToB = fromB + limitBig - 1n;
    const toB = maxChunkToB < targetToB ? maxChunkToB : targetToB;
    const cursorSpan = toB >= fromB ? toB - fromB + 1n : 0n;

    const isComplete = toB >= targetToB;
    const completeness: ScanCompleteness = isComplete ? 'COMPLETE' : 'PARTIAL';
    const omittedBlockCount = isComplete ? 0 : Math.max(0, Number(targetToB - toB));
    const totalSpan = targetToB >= fromB ? targetToB - fromB + 1n : 1n;
    const coveragePercentage = Math.min(100, Math.round((Number(cursorSpan) / Number(totalSpan)) * 1000) / 10);

    const [startBlk, endBlk] = await Promise.all([
      rpcClient.getBlock({ blockNumber: fromB }).catch(() => null),
      rpcClient.getBlock({ blockNumber: toB }).catch(() => null),
    ]);
    const actualStartTs = startBlk ? Number(startBlk.timestamp) : latestTimestamp - Number(latestNumber - fromB);
    const actualEndTs = endBlk ? Number(endBlk.timestamp) : latestTimestamp - Number(latestNumber - toB);

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
      actualStartDateFormatted: formatUtcDate(actualStartTs),
      actualEndDateFormatted: formatUtcDate(actualEndTs),
      cumulativeStartBlock: Number(fromB),
      cumulativeEndBlock: Number(toB),
      cumulativeScannedBlocksCount: Number(cursorSpan),
      cumulativeStartDateFormatted: formatUtcDate(actualStartTs),
      cumulativeEndDateFormatted: formatUtcDate(actualEndTs),
      currentChunkStartBlock: Number(fromB),
      currentChunkEndBlock: Number(toB),
      currentChunkBlocksCount: Number(cursorSpan),
      currentChunkStartDateFormatted: formatUtcDate(actualStartTs),
      currentChunkEndDateFormatted: formatUtcDate(actualEndTs),
      remainingBlocksCount: omittedBlockCount,
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
  // CASE 3: Initial Date-Range Scan with Genesis Clamping & Empirical Cadence
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

  // 3. Genesis boundary check & clamping
  let isGenesisClamped = false;
  let genesisNotice: string | undefined = undefined;
  let effectiveStartTs = requestedStartTs;

  if (requestedStartTs < PHAROS_GENESIS_TIMESTAMP) {
    isGenesisClamped = true;
    effectiveStartTs = PHAROS_GENESIS_TIMESTAMP;
    genesisNotice = `Pharos Atlantic Testnet genesis occurred on ${PHAROS_GENESIS_DATE_ISO} (Block 1). Requested start date (${startDateStr}) was clamped to Genesis Block 1.`;
  }

  // 4. Resolve block heights accurately using binary interpolation search
  const [resolvedStartBlock, resolvedToBlock] = await Promise.all([
    isGenesisClamped
      ? Promise.resolve(PHAROS_GENESIS_BLOCK)
      : findBlockForTimestamp(effectiveStartTs, latestNumber, latestTimestamp),
    requestedEndTs >= latestTimestamp
      ? Promise.resolve(latestNumber)
      : findBlockForTimestamp(requestedEndTs, latestNumber, latestTimestamp),
  ]);

  let safeStartBlock = resolvedStartBlock < PHAROS_GENESIS_BLOCK ? PHAROS_GENESIS_BLOCK : resolvedStartBlock;
  let safeToBlock = resolvedToBlock > latestNumber ? latestNumber : resolvedToBlock;
  if (safeStartBlock > safeToBlock) {
    safeStartBlock = safeToBlock > 100n ? safeToBlock - 100n : PHAROS_GENESIS_BLOCK;
  }

  const requestedSpan = safeToBlock - safeStartBlock + 1n;

  // 5. Determine initial chunk boundaries
  let actualFromBlock: bigint;
  let actualToBlock: bigint;
  let isComplete: boolean;
  let completeness: ScanCompleteness;
  let omittedBlockCount = 0;
  let coveragePercentage = 100;
  let initialContinuationState: ContinuationState | undefined = undefined;

  if (requestedSpan <= limitBig) {
    actualFromBlock = safeStartBlock;
    actualToBlock = safeToBlock;
    isComplete = true;
    completeness = 'COMPLETE';
    omittedBlockCount = 0;
    coveragePercentage = 100;
  } else {
    // Scan forward chronologically from the start of the audit range
    actualFromBlock = safeStartBlock;
    actualToBlock = safeStartBlock + limitBig - 1n;
    if (actualToBlock > safeToBlock) {
      actualToBlock = safeToBlock;
    }
    isComplete = false;
    completeness = 'PARTIAL';
    omittedBlockCount = Number(safeToBlock - actualToBlock);
    coveragePercentage = Math.round((Number(limitBig) / Math.max(1, Number(requestedSpan))) * 1000) / 10;

    initialContinuationState = {
      originalTargetAddress: targetAddress || '',
      requestedStartDate: new Date(requestedStartTs * 1000).toISOString(),
      requestedEndDate: new Date(requestedEndTs * 1000).toISOString(),
      resolvedStartBlock: Number(safeStartBlock),
      resolvedEndBlock: Number(safeToBlock),
      totalRequestedBlocks: Number(requestedSpan),
      scannedBlockRanges: [{ fromBlock: Number(actualFromBlock), toBlock: Number(actualToBlock) }],
      totalScannedBlocks: Number(actualToBlock - actualFromBlock + 1n),
      accumulatedActivities: [],
      nextFromBlock: Number(actualToBlock + 1n),
      nextToBlock: Number(safeToBlock),
      isComplete: false,
      empiricalSecondsPerBlock: avgSecondsPerBlock,
      cumulativeStartBlock: Number(actualFromBlock),
      cumulativeEndBlock: Number(actualToBlock),
      cumulativeStartTimestamp: 0,
      cumulativeEndTimestamp: 0,
      cumulativeStartDateFormatted: '',
      cumulativeEndDateFormatted: '',
      genesisClamped: isGenesisClamped,
      genesisNotice,
    };
  }

  const actualScannedCount = Number(actualToBlock - actualFromBlock + 1n);

  // Query real on-chain block timestamps
  const [startBlockData, endBlockData] = await Promise.all([
    rpcClient.getBlock({ blockNumber: actualFromBlock }).catch(() => null),
    rpcClient.getBlock({ blockNumber: actualToBlock }).catch(() => null),
  ]);

  const actualStartTs = startBlockData 
    ? Number(startBlockData.timestamp) 
    : (actualFromBlock === PHAROS_GENESIS_BLOCK ? PHAROS_GENESIS_TIMESTAMP : latestTimestamp - Math.floor(Number(latestNumber - actualFromBlock) * avgSecondsPerBlock));
  const actualEndTs = endBlockData 
    ? Number(endBlockData.timestamp) 
    : latestTimestamp - Math.floor(Number(latestNumber - actualToBlock) * avgSecondsPerBlock);

  const actualStartDateFormatted = formatUtcDate(actualStartTs);
  const actualEndDateFormatted = formatUtcDate(actualEndTs);

  if (initialContinuationState) {
    initialContinuationState.cumulativeStartTimestamp = actualStartTs;
    initialContinuationState.cumulativeEndTimestamp = actualEndTs;
    initialContinuationState.cumulativeStartDateFormatted = actualStartDateFormatted;
    initialContinuationState.cumulativeEndDateFormatted = actualEndDateFormatted;
  }

  const coverage: ScanCoverage = {
    requestedStartDate: new Date(requestedStartTs * 1000).toISOString(),
    requestedEndDate: new Date(requestedEndTs * 1000).toISOString(),
    requestedBlockSpan: Number(requestedSpan),
    resolvedStartBlock: Number(safeStartBlock),
    resolvedEndBlock: Number(safeToBlock),
    actualStartBlock: Number(actualFromBlock),
    actualEndBlock: Number(actualToBlock),
    actualScannedBlocksCount: actualScannedCount,
    actualStartTimestamp: actualStartTs,
    actualEndTimestamp: actualEndTs,
    actualStartDateFormatted,
    actualEndDateFormatted,
    cumulativeStartBlock: Number(actualFromBlock),
    cumulativeEndBlock: Number(actualToBlock),
    cumulativeScannedBlocksCount: actualScannedCount,
    cumulativeStartDateFormatted: actualStartDateFormatted,
    cumulativeEndDateFormatted: actualEndDateFormatted,
    currentChunkStartBlock: Number(actualFromBlock),
    currentChunkEndBlock: Number(actualToBlock),
    currentChunkBlocksCount: actualScannedCount,
    currentChunkStartDateFormatted: actualStartDateFormatted,
    currentChunkEndDateFormatted: actualEndDateFormatted,
    remainingBlocksCount: omittedBlockCount,
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
    genesisClamped: isGenesisClamped,
    genesisNotice,
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
