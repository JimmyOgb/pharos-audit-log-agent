import { formatUnits, type Log } from 'viem';
import type { 
  ActivityItem, 
  ActivityCategory, 
  CategoryTotals, 
  CategorySummary 
} from '../types.js';
import { 
  unpadTopicAddress, 
  type RawLogBundle, 
  TOPIC_APPROVAL, 
  TOPIC_APPROVAL_FOR_ALL, 
  TOPIC_SWAP_V2, 
  TOPIC_SWAP_V3 
} from './activityFetcher.js';

const EXPLORER_BASE = process.env.PHAROS_EXPLORER_URL || 'https://atlantic.pharosscan.com';
const INFINITE_APPROVAL_THRESHOLD = 2n ** 128n;

// Common known testnet tokens for readable symbols
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  '0x4200000000000000000000000000000000000006': { symbol: 'WPHAROS', decimals: 18 },
  '0x524b0b76e5d83c27e8d7bb54c9d5fc1dc78b97d0': { symbol: 'USDT', decimals: 6 },
  '0x72cb25026ff7328bfbb740e5564b735231c618ce': { symbol: 'USDC', decimals: 6 },
};

export function formatTokenAmount(rawHexOrBigInt: string | bigint, decimals: number = 18): string {
  try {
    const val = typeof rawHexOrBigInt === 'bigint' ? rawHexOrBigInt : BigInt(rawHexOrBigInt);
    if (val >= INFINITE_APPROVAL_THRESHOLD) {
      return 'Unlimited (MAX)';
    }
    const formatted = formatUnits(val, decimals);
    const parts = formatted.split('.');
    if (parts.length === 2 && parts[1].length > 4) {
      return `${parts[0]}.${parts[1].slice(0, 4)}`;
    }
    return formatted;
  } catch {
    return '0';
  }
}

export function classifyActivities(
  targetAddress: string,
  bundle: RawLogBundle,
  blockTimestamps: Map<number, number>
): {
  allActivities: ActivityItem[];
  notableTransactions: ActivityItem[];
  categoryTotals: CategoryTotals;
  categorySummaries: CategorySummary[];
} {
  const normTarget = targetAddress.toLowerCase();
  const allActivities: ActivityItem[] = [];
  const swapTxHashes = new Set<string>();

  // 1. Mark transactions containing Swap events
  for (const log of [...bundle.swapsV2, ...bundle.swapsV3]) {
    if (log.transactionHash) {
      swapTxHashes.add(log.transactionHash.toLowerCase());
    }
  }

  // 2. Process Swaps
  for (const log of [...bundle.swapsV2, ...bundle.swapsV3]) {
    const txHash = log.transactionHash || '0x';
    const blockNum = Number(log.blockNumber || 0n);
    const timestamp = blockTimestamps.get(blockNum) || Math.floor(Date.now() / 1000);
    const isV3 = log.topics[0] === TOPIC_SWAP_V3;
    const protocolName = isV3 ? 'Uniswap V3 / DEX' : 'Uniswap V2 / DEX';

    allActivities.push({
      id: `${txHash}-${log.logIndex}`,
      txHash,
      blockNumber: blockNum,
      timestamp,
      dateFormatted: new Date(timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      category: 'swaps',
      categoryLabel: 'Swaps',
      title: `DEX Swap Execution on ${protocolName}`,
      description: `Automated Market Maker swap order executed involving pool contract ${log.address}.`,
      from: log.address.toLowerCase(),
      to: normTarget,
      tokenAddress: log.address.toLowerCase(),
      tokenSymbol: 'LP-POOL',
      isNotable: true,
      notableReason: `DEX liquidity swap execution on ${protocolName}`,
      explorerUrl: `${EXPLORER_BASE}/tx/${txHash}`,
    });
  }

  // 3. Process Approvals
  for (const log of [...bundle.approvals, ...bundle.approvalsForAll]) {
    const txHash = log.transactionHash || '0x';
    const blockNum = Number(log.blockNumber || 0n);
    const timestamp = blockTimestamps.get(blockNum) || Math.floor(Date.now() / 1000);
    const isForAll = log.topics[0] === TOPIC_APPROVAL_FOR_ALL;
    const spender = log.topics[2] ? unpadTopicAddress(log.topics[2]) : 'Unknown Spender';
    
    let isUnlimited = false;
    let formattedAmt = 'All Tokens (NFT)';

    if (!isForAll && log.data) {
      try {
        const val = BigInt(log.data);
        if (val >= INFINITE_APPROVAL_THRESHOLD) {
          isUnlimited = true;
          formattedAmt = 'Unlimited';
        } else {
          formattedAmt = formatTokenAmount(val, 18);
        }
      } catch {
        formattedAmt = 'Custom';
      }
    } else if (isForAll) {
      isUnlimited = true;
    }

    const tokenMeta = KNOWN_TOKENS[log.address.toLowerCase()] || { symbol: 'ERC-20', decimals: 18 };

    allActivities.push({
      id: `${txHash}-${log.logIndex}`,
      txHash,
      blockNumber: blockNum,
      timestamp,
      dateFormatted: new Date(timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      category: 'token_approvals',
      categoryLabel: 'Token Approvals',
      title: `Token Allowance Grant (${tokenMeta.symbol})`,
      description: `Target wallet approved ${spender.slice(0, 8)}...${spender.slice(-6)} to spend ${formattedAmt} of ${tokenMeta.symbol}.`,
      from: normTarget,
      to: spender,
      tokenAddress: log.address.toLowerCase(),
      tokenSymbol: tokenMeta.symbol,
      formattedAmount: formattedAmt,
      isNotable: isUnlimited,
      notableReason: isUnlimited ? 'Infinite allowance granted to third-party contract (compliance risk)' : undefined,
      explorerUrl: `${EXPLORER_BASE}/tx/${txHash}`,
    });
  }

  // 4. Process Transfers In
  for (const log of bundle.transfersIn) {
    const txHash = log.transactionHash || '0x';
    if (swapTxHashes.has(txHash.toLowerCase())) {
      // Subordinated to swap record
      continue;
    }
    const blockNum = Number(log.blockNumber || 0n);
    const timestamp = blockTimestamps.get(blockNum) || Math.floor(Date.now() / 1000);
    const fromAddr = log.topics[1] ? unpadTopicAddress(log.topics[1]) : 'Unknown Sender';
    const tokenMeta = KNOWN_TOKENS[log.address.toLowerCase()] || { symbol: 'TOKEN', decimals: 18 };
    
    let rawVal = 0n;
    if (log.data && log.data !== '0x') {
      try {
        rawVal = BigInt(log.data);
      } catch {
        rawVal = 0n;
      }
    }
    const formattedAmt = formatTokenAmount(rawVal, tokenMeta.decimals);
    const isWhale = rawVal > 1000n * (10n ** BigInt(tokenMeta.decimals));

    allActivities.push({
      id: `${txHash}-${log.logIndex}`,
      txHash,
      blockNumber: blockNum,
      timestamp,
      dateFormatted: new Date(timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      category: 'transfers_in',
      categoryLabel: 'Transfers In',
      title: `Inbound Transfer (${formattedAmt} ${tokenMeta.symbol})`,
      description: `Received ${formattedAmt} ${tokenMeta.symbol} from ${fromAddr.slice(0, 8)}...${fromAddr.slice(-6)}.`,
      from: fromAddr,
      to: normTarget,
      tokenAddress: log.address.toLowerCase(),
      tokenSymbol: tokenMeta.symbol,
      rawAmount: rawVal.toString(),
      formattedAmount: formattedAmt,
      isNotable: isWhale,
      notableReason: isWhale ? `Large inbound transfer of ${formattedAmt} ${tokenMeta.symbol}` : undefined,
      explorerUrl: `${EXPLORER_BASE}/tx/${txHash}`,
    });
  }

  // 5. Process Transfers Out
  for (const log of bundle.transfersOut) {
    const txHash = log.transactionHash || '0x';
    if (swapTxHashes.has(txHash.toLowerCase())) {
      // Subordinated to swap record
      continue;
    }
    const blockNum = Number(log.blockNumber || 0n);
    const timestamp = blockTimestamps.get(blockNum) || Math.floor(Date.now() / 1000);
    const toAddr = log.topics[2] ? unpadTopicAddress(log.topics[2]) : 'Unknown Recipient';
    const tokenMeta = KNOWN_TOKENS[log.address.toLowerCase()] || { symbol: 'TOKEN', decimals: 18 };

    let rawVal = 0n;
    if (log.data && log.data !== '0x') {
      try {
        rawVal = BigInt(log.data);
      } catch {
        rawVal = 0n;
      }
    }
    const formattedAmt = formatTokenAmount(rawVal, tokenMeta.decimals);
    const isWhale = rawVal > 1000n * (10n ** BigInt(tokenMeta.decimals));

    allActivities.push({
      id: `${txHash}-${log.logIndex}`,
      txHash,
      blockNumber: blockNum,
      timestamp,
      dateFormatted: new Date(timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      category: 'transfers_out',
      categoryLabel: 'Transfers Out',
      title: `Outbound Transfer (${formattedAmt} ${tokenMeta.symbol})`,
      description: `Sent ${formattedAmt} ${tokenMeta.symbol} to ${toAddr.slice(0, 8)}...${toAddr.slice(-6)}.`,
      from: normTarget,
      to: toAddr,
      tokenAddress: log.address.toLowerCase(),
      tokenSymbol: tokenMeta.symbol,
      rawAmount: rawVal.toString(),
      formattedAmount: formattedAmt,
      isNotable: isWhale,
      notableReason: isWhale ? `Large outbound transfer of ${formattedAmt} ${tokenMeta.symbol}` : undefined,
      explorerUrl: `${EXPLORER_BASE}/tx/${txHash}`,
    });
  }

  // Sort activities newest first
  allActivities.sort((a, b) => b.blockNumber - a.blockNumber || b.timestamp - a.timestamp);

  // Compute category totals
  const senders = new Set<string>();
  const recipients = new Set<string>();
  const inTokens = new Set<string>();
  const outTokens = new Set<string>();
  const spenders = new Set<string>();
  let unlimitedApprovals = 0;
  const dexProtocols = new Set<string>();

  for (const act of allActivities) {
    if (act.category === 'transfers_in') {
      senders.add(act.from);
      if (act.tokenSymbol) inTokens.add(act.tokenSymbol);
    } else if (act.category === 'transfers_out') {
      recipients.add(act.to);
      if (act.tokenSymbol) outTokens.add(act.tokenSymbol);
    } else if (act.category === 'token_approvals') {
      spenders.add(act.to);
      if (act.formattedAmount === 'Unlimited') unlimitedApprovals++;
    } else if (act.category === 'swaps') {
      dexProtocols.add('Uniswap / DEX Router');
    }
  }

  // If there are contract interactions not covered by transfers/approvals/swaps, add them to contract_interactions
  const categoryTotals: CategoryTotals = {
    transfers_in: {
      count: allActivities.filter(a => a.category === 'transfers_in').length,
      uniqueSenders: senders.size,
      sampleTokens: Array.from(inTokens).slice(0, 5),
    },
    transfers_out: {
      count: allActivities.filter(a => a.category === 'transfers_out').length,
      uniqueRecipients: recipients.size,
      sampleTokens: Array.from(outTokens).slice(0, 5),
    },
    swaps: {
      count: allActivities.filter(a => a.category === 'swaps').length,
      dexProtocols: Array.from(dexProtocols),
    },
    token_approvals: {
      count: allActivities.filter(a => a.category === 'token_approvals').length,
      unlimitedApprovals,
      uniqueSpenders: spenders.size,
    },
    contract_interactions: {
      count: allActivities.filter(a => a.category === 'contract_interactions').length,
      uniqueContracts: 0,
    },
  };

  const categorySummaries: CategorySummary[] = [
    {
      category: 'transfers_in',
      label: 'Transfers In',
      count: categoryTotals.transfers_in.count,
      details: `${categoryTotals.transfers_in.count} inbound transactions from ${categoryTotals.transfers_in.uniqueSenders} unique senders (${categoryTotals.transfers_in.sampleTokens.join(', ') || 'None'})`,
    },
    {
      category: 'transfers_out',
      label: 'Transfers Out',
      count: categoryTotals.transfers_out.count,
      details: `${categoryTotals.transfers_out.count} outbound transactions to ${categoryTotals.transfers_out.uniqueRecipients} unique recipients (${categoryTotals.transfers_out.sampleTokens.join(', ') || 'None'})`,
    },
    {
      category: 'swaps',
      label: 'Swaps',
      count: categoryTotals.swaps.count,
      details: `${categoryTotals.swaps.count} decentralized exchange trades executed across liquidity pools`,
    },
    {
      category: 'token_approvals',
      label: 'Token Approvals',
      count: categoryTotals.token_approvals.count,
      details: `${categoryTotals.token_approvals.count} token allowances granted across ${categoryTotals.token_approvals.uniqueSpenders} spenders (${categoryTotals.token_approvals.unlimitedApprovals} unlimited)`,
    },
    {
      category: 'contract_interactions',
      label: 'Contract Interactions',
      count: categoryTotals.contract_interactions.count,
      details: `${categoryTotals.contract_interactions.count} direct smart contract calls`,
    },
  ];

  const notableTransactions = allActivities.filter(a => a.isNotable).slice(0, 20);

  return {
    allActivities,
    notableTransactions,
    categoryTotals,
    categorySummaries,
  };
}
