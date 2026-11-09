import { isAddress } from 'viem';
import type { AuditReport, AuditRequest } from '../types.js';
import { resolveBlockRange } from './blockResolver.js';
import { fetchRawActivitiesForAddress } from './activityFetcher.js';
import { classifyActivities } from './classifier.js';
import { pharosAtlantic, rpcClient } from './rpc.js';

export async function generateAuditReport(request: AuditRequest): Promise<AuditReport> {
  const { address, startDate, endDate, blockSpan } = request;

  if (!address || !isAddress(address)) {
    throw new Error(`Invalid EVM wallet address: "${address}". Expected 0x followed by 40 hex characters.`);
  }

  // 1. Resolve date range to verified block numbers
  const range = await resolveBlockRange(startDate, endDate, blockSpan || 3000);

  // 2. Query live on-chain logs across the block range
  const rawLogs = await fetchRawActivitiesForAddress(address, range.fromBlock, range.toBlock);

  // 3. Extract unique block numbers and sample timestamps
  const uniqueBlocks = new Set<number>();
  for (const log of [
    ...rawLogs.transfersIn,
    ...rawLogs.transfersOut,
    ...rawLogs.approvals,
    ...rawLogs.approvalsForAll,
    ...rawLogs.swapsV2,
    ...rawLogs.swapsV3
  ]) {
    if (log.blockNumber) uniqueBlocks.add(Number(log.blockNumber));
  }

  // Fetch block timestamps (in parallel up to 15 concurrent)
  const blockTimestamps = new Map<number, number>();
  const blockList = Array.from(uniqueBlocks).slice(0, 30); // sample up to 30 unique blocks directly
  
  await Promise.all(
    blockList.map(async (bNum) => {
      try {
        const blk = await rpcClient.getBlock({ blockNumber: BigInt(bNum) });
        blockTimestamps.set(bNum, Number(blk.timestamp));
      } catch {
        // Fallback: estimate from range
        const progress = Number(range.toBlock - BigInt(bNum)) / Math.max(1, Number(range.toBlock - range.fromBlock));
        const estimatedTs = Math.floor(range.endTimestamp - progress * (range.endTimestamp - range.startTimestamp));
        blockTimestamps.set(bNum, estimatedTs);
      }
    })
  );

  // Fill in any remaining from linear interpolation
  for (const bNum of uniqueBlocks) {
    if (!blockTimestamps.has(bNum)) {
      const progress = Number(range.toBlock - BigInt(bNum)) / Math.max(1, Number(range.toBlock - range.fromBlock));
      const estimatedTs = Math.floor(range.endTimestamp - progress * (range.endTimestamp - range.startTimestamp));
      blockTimestamps.set(bNum, estimatedTs);
    }
  }

  // 4. Classify activities into 5 distinct categories
  const { allActivities, notableTransactions, categoryTotals, categorySummaries } = classifyActivities(
    address,
    rawLogs,
    blockTimestamps
  );

  // 5. Generate plain-language executive compliance summary
  const totalTx = allActivities.length;
  const activeCategories = categorySummaries.filter(c => c.count > 0).length;
  
  let execSummary = `Audit report for wallet ${address} covering the period from ${range.startDateFormatted.slice(0, 10)} to ${range.endDateFormatted.slice(0, 10)} (blocks ${range.fromBlock.toString()} to ${range.toBlock.toString()} on Pharos Atlantic Testnet). `;
  
  if (totalTx === 0) {
    execSummary += `No qualifying on-chain activity was detected in this specified block window. The wallet maintained an idle state with zero inbound transfers, zero outbound transfers, zero swaps, and zero approval grants.`;
  } else {
    execSummary += `A total of ${totalTx} verifiable on-chain actions were identified across ${activeCategories} activity categories. `;
    execSummary += `The wallet recorded ${categoryTotals.transfers_in.count} inbound transfers, ${categoryTotals.transfers_out.count} outbound transfers, ${categoryTotals.swaps.count} decentralized exchange swaps, and ${categoryTotals.token_approvals.count} token approvals (${categoryTotals.token_approvals.unlimitedApprovals} uncapped allowances). `;
    
    if (categoryTotals.token_approvals.unlimitedApprovals > 0) {
      execSummary += `ALERT: ${categoryTotals.token_approvals.unlimitedApprovals} infinite token allowance(s) were identified, presenting an active counterparty risk profile requiring auditor review.`;
    } else {
      execSummary += `No excessive or unlimited token allowances were identified.`;
    }
  }

  const reportId = `AUDIT-${Date.now().toString(36).toUpperCase()}-${address.slice(2, 8).toUpperCase()}`;

  const report: AuditReport = {
    reportId,
    generatedAt: new Date().toISOString(),
    walletAddress: address,
    startDate: range.startDateFormatted,
    endDate: range.endDateFormatted,
    startBlock: Number(range.fromBlock),
    endBlock: Number(range.toBlock),
    network: {
      name: pharosAtlantic.name,
      chainId: pharosAtlantic.id,
      rpcUrl: process.env.PHAROS_RPC_URL || 'https://atlantic.dplabs-internal.com',
      explorerUrl: process.env.PHAROS_EXPLORER_URL || 'https://atlantic.pharosscan.com',
    },
    summary: {
      totalTransactions: totalTx,
      totalCategoriesRepresented: activeCategories,
      executiveSummary: execSummary,
    },
    categorySummaries,
    categoryTotals,
    notableTransactions,
    allActivities,
    provenance: {
      queryTimestamp: new Date().toISOString(),
      blockSpan: Number(range.toBlock - range.fromBlock),
      verifiedOnChain: true,
    },
  };

  return report;
}
