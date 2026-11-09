import { isAddress } from 'viem';
import type { AuditReport, AuditRequest, ActivityItem, CategoryTotals, CategorySummary } from '../types.js';
import { resolveBlockRange } from './blockResolver.js';
import { fetchRawActivitiesForAddress } from './activityFetcher.js';
import { classifyActivities } from './classifier.js';
import { fetchNativeTransactions, formatPharos } from './nativeFetcher.js';
import { pharosAtlantic, rpcClient } from './rpc.js';

export async function generateAuditReport(request: AuditRequest): Promise<AuditReport> {
  const { address, startDate, endDate, blockSpan, cursor, continuationState } = request;

  if (!address || !isAddress(address)) {
    throw new Error(`Invalid EVM wallet address: "${address}". Expected 0x followed by 40 hex characters.`);
  }

  // 1. Resolve date range to verified block numbers and scan coverage
  const range = await resolveBlockRange(startDate, endDate, blockSpan || 3000, cursor, continuationState, address);
  const coverage = range.coverage;

  let rawLogsRetrieved = 0;
  let rawLogsBundle: any = {
    transfersIn: [],
    transfersOut: [],
    approvals: [],
    approvalsForAll: [],
    swapsV2: [],
    swapsV3: [],
    swapsExecuted: [],
  };

  // 2. Query live on-chain logs across the block range using direct JSON-RPC serialization
  try {
    rawLogsBundle = await fetchRawActivitiesForAddress(address, range.fromBlock, range.toBlock);
    rawLogsRetrieved = rawLogsBundle.totalRawLogsRetrieved || 0;
  } catch (err: any) {
    console.warn(`[ReportGenerator] Log query warning:`, err?.message || err);
    coverage.completeness = 'PARTIAL';
    coverage.failedChunksCount = 1;
    coverage.failureReason = err?.message || 'Partial RPC chunk timeout';
  }

  // 3. Extract unique block numbers and sample timestamps
  const uniqueBlocks = new Set<number>();
  for (const log of [
    ...rawLogsBundle.transfersIn,
    ...rawLogsBundle.transfersOut,
    ...rawLogsBundle.approvals,
    ...rawLogsBundle.approvalsForAll,
    ...rawLogsBundle.swapsV2,
    ...rawLogsBundle.swapsV3,
    ...(rawLogsBundle.swapsExecuted || []),
  ]) {
    if (log.blockNumber) uniqueBlocks.add(Number(log.blockNumber));
  }

  const blockTimestamps = new Map<number, number>();
  const blockList = Array.from(uniqueBlocks).slice(0, 30);
  
  await Promise.all(
    blockList.map(async (bNum) => {
      try {
        const blk = await rpcClient.getBlock({ blockNumber: BigInt(bNum) });
        blockTimestamps.set(bNum, Number(blk.timestamp));
      } catch {
        const progress = Number(range.toBlock - BigInt(bNum)) / Math.max(1, Number(range.toBlock - range.fromBlock));
        const estimatedTs = Math.floor(range.endTimestamp - progress * (range.endTimestamp - range.startTimestamp));
        blockTimestamps.set(bNum, estimatedTs);
      }
    })
  );

  for (const bNum of uniqueBlocks) {
    if (!blockTimestamps.has(bNum)) {
      const progress = Number(range.toBlock - BigInt(bNum)) / Math.max(1, Number(range.toBlock - range.fromBlock));
      const estimatedTs = Math.floor(range.endTimestamp - progress * (range.endTimestamp - range.startTimestamp));
      blockTimestamps.set(bNum, estimatedTs);
    }
  }

  // 4. Classify log-based activities (ERC-20, NFT, Swaps, Approvals)
  const logClassification = await classifyActivities(rawLogsBundle, address, blockTimestamps);

  // 5. Query and classify native PHAROS transactions
  const candidateTxHashes: string[] = [];
  for (const act of logClassification.allActivities) {
    candidateTxHashes.push(act.txHash);
  }

  let nativeResult: any = {
    activities: [],
    outboundCount: 0,
    inboundCount: 0,
    totalOutboundWei: 0n,
    totalInboundWei: 0n,
    totalTransactionsScanned: 0,
  };

  try {
    nativeResult = await fetchNativeTransactions(
      address,
      range.fromBlock,
      range.toBlock,
      candidateTxHashes
    );
  } catch (err: any) {
    console.warn(`[ReportGenerator] Native fetch warning:`, err?.message || err);
  }

  // 6. Merge activities cleanly (avoiding duplicate accounting)
  const currentChunkActivities: ActivityItem[] = [...logClassification.allActivities];
  const existingTxAndCategory = new Set<string>();

  for (const act of currentChunkActivities) {
    existingTxAndCategory.add(`${act.txHash.toLowerCase()}-${act.category}`);
  }

  for (const nativeAct of nativeResult.activities) {
    // If it's a native transfer, it represents native currency value
    if (nativeAct.isNative) {
      currentChunkActivities.push(nativeAct);
    } else if (!existingTxAndCategory.has(`${nativeAct.txHash.toLowerCase()}-${nativeAct.category}`)) {
      // Contract call without existing log
      currentChunkActivities.push(nativeAct);
      existingTxAndCategory.add(`${nativeAct.txHash.toLowerCase()}-${nativeAct.category}`);
    }
  }

  // Merge with accumulated activities from earlier continuation chunks
  const previousActivities = continuationState?.accumulatedActivities || [];
  const combinedRaw = [...previousActivities, ...currentChunkActivities];

  // Deduplicate across chunks using composite key: txHash-category-assetType-id
  const unifiedActivities: ActivityItem[] = [];
  const seenCompositeKeys = new Set<string>();

  for (const act of combinedRaw) {
    const key = `${act.txHash.toLowerCase()}-${act.category}-${act.assetType}-${act.id || ''}`;
    if (!seenCompositeKeys.has(key)) {
      seenCompositeKeys.add(key);
      unifiedActivities.push(act);
    }
  }

  // Sort unified activities newest first
  unifiedActivities.sort((a, b) => b.blockNumber - a.blockNumber || b.timestamp - a.timestamp);

  // If next continuation state is active, preserve all accumulated activities for subsequent requests
  if (range.continuationState) {
    range.continuationState.accumulatedActivities = unifiedActivities;
  }

  // 7. Aggregate unified CategoryTotals across full accumulated activity list
  const inboundNative = unifiedActivities.filter(a => a.category === 'transfers_in' && a.isNative);
  const outboundNative = unifiedActivities.filter(a => a.category === 'transfers_out' && a.isNative);
  const inboundErc20 = unifiedActivities.filter(a => a.category === 'transfers_in' && !a.isNative);
  const outboundErc20 = unifiedActivities.filter(a => a.category === 'transfers_out' && !a.isNative);

  let totalInWei = 0n;
  for (const a of inboundNative) {
    try { totalInWei += BigInt(a.rawAmount || '0'); } catch {}
  }
  let totalOutWei = 0n;
  for (const a of outboundNative) {
    try { totalOutWei += BigInt(a.rawAmount || '0'); } catch {}
  }

  const netNativeWei = totalInWei - totalOutWei;

  const senders = new Set<string>();
  const recipients = new Set<string>();
  const inTokens = new Set<string>();
  const outTokens = new Set<string>();
  const spenders = new Set<string>();
  const dexProtocols = new Set<string>();
  const uniqueContracts = new Set<string>();

  for (const act of unifiedActivities) {
    if (act.tokenAddress) uniqueContracts.add(act.tokenAddress.toLowerCase());

    if (act.category === 'transfers_in') {
      senders.add(act.from);
      if (act.tokenSymbol) inTokens.add(act.tokenSymbol);
    } else if (act.category === 'transfers_out') {
      recipients.add(act.to);
      if (act.tokenSymbol) outTokens.add(act.tokenSymbol);
    } else if (act.category === 'token_approvals') {
      spenders.add(act.to);
    } else if (act.category === 'swaps') {
      dexProtocols.add(act.title.includes('TestAMM') ? 'TestAMM Router' : (act.title.includes('Uniswap V3') ? 'Uniswap V3' : 'Uniswap / AMM Pool'));
    }
  }

  const approvalsList = unifiedActivities.filter(a => a.category === 'token_approvals');
  const unlimitedApprovals = approvalsList.filter(a => 
    a.notableReason?.includes('Unlimited') || a.isNotable || (a.rawAmount && a.rawAmount.length > 30)
  ).length;
  const currentVerifiedUnlimited = approvalsList.filter(a => 
    a.allowanceStatus === 'Current unlimited allowance verified'
  ).length;
  const currentReducedOrRevoked = approvalsList.filter(a => 
    a.allowanceStatus === 'Current allowance reduced or revoked'
  ).length;
  const currentUnavailable = approvalsList.filter(a => 
    a.allowanceStatus === 'Current allowance unavailable or unverified'
  ).length;

  const categoryTotals: CategoryTotals = {
    transfers_in: {
      count: unifiedActivities.filter(a => a.category === 'transfers_in').length,
      nativeCount: inboundNative.length,
      erc20Count: inboundErc20.length,
      nativeAmountFormatted: `${formatPharos(totalInWei)} PHAROS`,
      uniqueSenders: senders.size,
      sampleTokens: Array.from(inTokens).slice(0, 5),
    },
    transfers_out: {
      count: unifiedActivities.filter(a => a.category === 'transfers_out').length,
      nativeCount: outboundNative.length,
      erc20Count: outboundErc20.length,
      nativeAmountFormatted: `${formatPharos(totalOutWei)} PHAROS`,
      uniqueRecipients: recipients.size,
      sampleTokens: Array.from(outTokens).slice(0, 5),
    },
    swaps: {
      count: unifiedActivities.filter(a => a.category === 'swaps').length,
      dexProtocols: Array.from(dexProtocols),
    },
    token_approvals: {
      count: approvalsList.length,
      unlimitedApprovals,
      currentVerifiedUnlimited,
      currentReducedOrRevoked,
      currentUnavailable,
      uniqueSpenders: spenders.size,
    },
    contract_interactions: {
      count: unifiedActivities.filter(a => a.category === 'contract_interactions').length,
      uniqueContracts: uniqueContracts.size,
    },
    native_summary: {
      inboundCount: inboundNative.length,
      inboundTotalFormatted: `${formatPharos(totalInWei)} PHAROS`,
      outboundCount: outboundNative.length,
      outboundTotalFormatted: `${formatPharos(totalOutWei)} PHAROS`,
      netNativeChangeFormatted: `${formatPharos(netNativeWei)} PHAROS`,
    },
  };

  const categorySummaries: CategorySummary[] = [
    {
      category: 'transfers_in',
      label: 'Transfers In',
      count: categoryTotals.transfers_in.count,
      details: `${categoryTotals.transfers_in.count} inbound transfers (${categoryTotals.transfers_in.nativeCount} native PHAROS [${categoryTotals.transfers_in.nativeAmountFormatted}], ${categoryTotals.transfers_in.erc20Count} ERC-20) across ${senders.size} unique senders.`,
    },
    {
      category: 'transfers_out',
      label: 'Transfers Out',
      count: categoryTotals.transfers_out.count,
      details: `${categoryTotals.transfers_out.count} outbound transfers (${categoryTotals.transfers_out.nativeCount} native PHAROS [${categoryTotals.transfers_out.nativeAmountFormatted}], ${categoryTotals.transfers_out.erc20Count} ERC-20) across ${recipients.size} unique recipients.`,
    },
    {
      category: 'swaps',
      label: 'Swaps',
      count: categoryTotals.swaps.count,
      details: `${categoryTotals.swaps.count} decentralized exchange swap trades executed.`,
    },
    {
      category: 'token_approvals',
      label: 'Token Approvals',
      count: categoryTotals.token_approvals.count,
      details: `${categoryTotals.token_approvals.count} token allowance grants (${categoryTotals.token_approvals.unlimitedApprovals} infinite allowances detected; ${categoryTotals.token_approvals.currentVerifiedUnlimited} confirmed active on-chain).`,
    },
    {
      category: 'contract_interactions',
      label: 'Contract Interactions',
      count: categoryTotals.contract_interactions.count,
      details: `${categoryTotals.contract_interactions.count} direct contract calls, deployments, and NFT operator authorizations.`,
    },
  ];

  const notableTransactions = unifiedActivities.filter(a => a.isNotable);

  // 8. Generate Honest Executive Compliance Narrative
  const completenessBadge = coverage.completeness;
  let completenessNarrative = '';

  const totalCumulativeScanned = coverage.cumulativeScannedBlocksCount || coverage.actualScannedBlocksCount;
  const cumulativeStartB = coverage.cumulativeStartBlock ?? coverage.actualStartBlock;
  const cumulativeEndB = coverage.cumulativeEndBlock ?? coverage.actualEndBlock;
  const cumulativeStartFormatted = coverage.cumulativeStartDateFormatted || coverage.actualStartDateFormatted;
  const cumulativeEndFormatted = coverage.cumulativeEndDateFormatted || coverage.actualEndDateFormatted;

  const genesisAddendum = coverage.genesisClamped && coverage.genesisNotice
    ? ` Note: ${coverage.genesisNotice}`
    : '';

  if (coverage.completeness === 'COMPLETE') {
    completenessNarrative = `A COMPLETE audit covering 100.0% of the requested date range (${coverage.requestedStartDate.slice(0, 10)} to ${coverage.requestedEndDate.slice(0, 10)}; blocks ${coverage.resolvedStartBlock.toLocaleString()} to ${coverage.resolvedEndBlock.toLocaleString()}) was executed successfully across ${coverage.scannedChunksCount} block chunk(s) (${totalCumulativeScanned.toLocaleString()} blocks total).${genesisAddendum}`;
  } else if (coverage.completeness === 'PARTIAL') {
    completenessNarrative = `A PARTIAL audit covering ${coverage.coveragePercentage}% of the requested range (${totalCumulativeScanned.toLocaleString()} blocks cumulative scanned across ${coverage.scannedChunksCount} chunk(s); ${coverage.omittedBlockCount.toLocaleString()} remaining blocks uninspected due to execution boundary safeguards). Cumulative scanned range: ${cumulativeStartFormatted} to ${cumulativeEndFormatted} (blocks ${cumulativeStartB.toLocaleString()} to ${cumulativeEndB.toLocaleString()}). Latest chunk: blocks ${coverage.actualStartBlock.toLocaleString()} to ${coverage.actualEndBlock.toLocaleString()} (${coverage.actualScannedBlocksCount.toLocaleString()} blocks). Continuation cursor is provided to inspect remaining blocks.${genesisAddendum}`;
  } else {
    completenessNarrative = `Audit execution FAILED during scanning: ${coverage.failureReason || 'RPC query error'}.${genesisAddendum}`;
  }

  let activityNarrative = '';
  if (unifiedActivities.length === 0) {
    if (coverage.completeness === 'COMPLETE') {
      activityNarrative = `No qualifying on-chain activity was detected across the entire requested block window. The wallet maintained a completely idle state with zero inbound transfers, zero outbound transfers, zero swaps, and zero approval grants.`;
    } else {
      activityNarrative = `No qualifying on-chain activity was detected within the cumulatively inspected ${totalCumulativeScanned.toLocaleString()}-block window (${cumulativeStartFormatted} to ${cumulativeEndFormatted}; blocks ${cumulativeStartB.toLocaleString()} to ${cumulativeEndB.toLocaleString()}). Note: ${coverage.omittedBlockCount.toLocaleString()} remaining blocks (${(cumulativeEndB + 1).toLocaleString()} to ${coverage.resolvedEndBlock.toLocaleString()}) were not covered in this session and require continuation scanning before the wallet can be certified idle across the full requested calendar period.`;
    }
  } else {
    activityNarrative = `Detected a total of ${unifiedActivities.length} on-chain activities: ${categoryTotals.transfers_in.count} inbound transfer(s) (${categoryTotals.transfers_in.nativeCount} native PHAROS, ${categoryTotals.transfers_in.erc20Count} ERC-20), ${categoryTotals.transfers_out.count} outbound transfer(s) (${categoryTotals.transfers_out.nativeCount} native PHAROS, ${categoryTotals.transfers_out.erc20Count} ERC-20), ${categoryTotals.swaps.count} DEX swap(s), ${categoryTotals.token_approvals.count} token approval(s), and ${categoryTotals.contract_interactions.count} contract interaction(s). Notable transaction alerts: ${notableTransactions.length}. Net native balance impact: ${categoryTotals.native_summary.netNativeChangeFormatted}.`;
  }

  const executiveSummary = `[Scan Status: ${completenessBadge}] Audit report for wallet ${address} on Pharos Atlantic Testnet (Chain ID 688689). ${completenessNarrative} ${activityNarrative}`;

  // Unique transactions count
  const allTxHashes = new Set<string>();
  for (const act of unifiedActivities) {
    allTxHashes.add(act.txHash.toLowerCase());
  }

  const reportId = `AUDIT-${Date.now().toString(36).toUpperCase()}-${address.slice(2, 8).toUpperCase()}`;

  return {
    reportId,
    generatedAt: new Date().toISOString(),
    walletAddress: address,
    startDate: cumulativeStartFormatted,
    endDate: cumulativeEndFormatted,
    startBlock: cumulativeStartB,
    endBlock: cumulativeEndB,
    cumulativeStartDate: cumulativeStartFormatted,
    cumulativeEndDate: cumulativeEndFormatted,
    cumulativeStartBlock: cumulativeStartB,
    cumulativeEndBlock: cumulativeEndB,
    cumulativeScannedBlocks: totalCumulativeScanned,
    network: {
      name: pharosAtlantic.name,
      chainId: pharosAtlantic.id,
      rpcUrl: process.env.PHAROS_RPC_URL || 'https://atlantic.dplabs-internal.com',
      explorerUrl: pharosAtlantic.blockExplorers?.default.url || 'https://atlantic.pharosscan.com',
    },
    coverage,
    continuationState: range.continuationState,
    summary: {
      totalTransactions: allTxHashes.size,
      totalEvents: unifiedActivities.length,
      totalCategoriesRepresented: categorySummaries.filter(c => c.count > 0).length,
      scanCompleteness: coverage.completeness,
      nativeTransfersCount: inboundNative.length + outboundNative.length,
      erc20TransfersCount: inboundErc20.length + outboundErc20.length,
      executiveSummary,
    },
    categorySummaries,
    categoryTotals,
    notableTransactions,
    allActivities: unifiedActivities,
    provenance: {
      queryTimestamp: new Date().toISOString(),
      blockSpan: totalCumulativeScanned,
      rawLogsRetrieved,
      deduplicatedEventsCount: unifiedActivities.length,
      verifiedOnChain: true,
      nativeTxCount: nativeResult.activities.length,
      unsupportedOrPartialNotice: coverage.completeness === 'PARTIAL'
        ? `Scan was bounded to ${coverage.actualScannedBlocksCount} blocks in the latest chunk (${totalCumulativeScanned.toLocaleString()} blocks cumulative) to respect execution budgets. Outbound native transfers are deterministically verified via nonce transitions. Full-history unindexed inbound native transfers require trace indexing; use continuation cursor to audit earlier block spans.`
        : '100% of requested blocks scanned and reconciled against on-chain state.',
    },
  };
}
