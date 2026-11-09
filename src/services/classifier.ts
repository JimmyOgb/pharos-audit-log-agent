import { type Log } from 'viem';
import { 
  type ActivityItem, 
  type CategoryTotals, 
  type CategorySummary,
  type AllowanceStatus,
  type AssetType
} from '../types.js';
import { 
  type RawLogBundle,
  TOPIC_TRANSFER,
  TOPIC_APPROVAL,
  TOPIC_APPROVAL_FOR_ALL,
  TOPIC_SWAP_V2,
  TOPIC_SWAP_V3,
  unpadTopicAddress
} from './activityFetcher.js';
import { rpcClient, pharosAtlantic } from './rpc.js';

export const INFINITE_APPROVAL_THRESHOLD = 2n ** 128n;
const EXPLORER_BASE = pharosAtlantic.blockExplorers?.default.url || 'https://atlantic.pharosscan.com';

const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  '0x6db622c53f0904e4a177cd87703be1ae8e4bad1e': { symbol: 'ATL-ERC20', decimals: 18 },
  '0x41040230bce1bb36248fb799d968f6fa087606e0': { symbol: 'WPHAROS', decimals: 18 },
  '0xf37815a784c5a97b7319ecb89a8f0e34aafd472a': { symbol: 'USDC-TEST', decimals: 6 },
  '0xb691f00682feef63bc73f41c380ff648d73c6a2c': { symbol: 'ATL-TEST', decimals: 18 },
};

export function formatTokenAmount(raw: bigint, decimals: number = 18): string {
  if (raw === 0n) return '0.0000';
  const isNegative = raw < 0n;
  const abs = isNegative ? -raw : raw;
  const divisor = 10n ** BigInt(decimals);
  const integerPart = abs / divisor;
  const fractionalPart = abs % divisor;
  const fracStr = fractionalPart.toString().padStart(decimals, '0').slice(0, 4);
  return `${isNegative ? '-' : ''}${integerPart.toString()}.${fracStr}`;
}

export async function checkCurrentAllowance(
  tokenAddress: `0x${string}`,
  owner: string,
  spender: string,
  historicalUnlimited: boolean
): Promise<{ status: AllowanceStatus; currentRaw?: string }> {
  try {
    const rawAllowance = await rpcClient.readContract({
      address: tokenAddress,
      abi: [
        {
          name: 'allowance',
          type: 'function',
          stateMutability: 'view',
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
          ],
          outputs: [{ name: '', type: 'uint256' }],
        }
      ],
      functionName: 'allowance',
      args: [owner as `0x${string}`, spender as `0x${string}`],
    }) as bigint;

    if (rawAllowance >= INFINITE_APPROVAL_THRESHOLD) {
      return { status: 'Current unlimited allowance verified', currentRaw: rawAllowance.toString() };
    } else {
      return { status: 'Current allowance reduced or revoked', currentRaw: rawAllowance.toString() };
    }
  } catch {
    return {
      status: historicalUnlimited 
        ? 'Historical unlimited approval observed' 
        : 'Current allowance unavailable or unverified'
    };
  }
}

export async function classifyActivities(
  bundle: RawLogBundle,
  targetAddress: string,
  blockTimestamps: Map<number, number> = new Map()
): Promise<{
  allActivities: ActivityItem[];
  categoryTotals: CategoryTotals;
  categorySummaries: CategorySummary[];
  notableTransactions: ActivityItem[];
}> {
  const normTarget = targetAddress.toLowerCase();
  const allActivities: ActivityItem[] = [];
  const processedEventKeys = new Set<string>();
  const swapTxHashes = new Set<string>();

  // 1. Process Genuine Swaps (Uniswap V2 / V3)
  const validSwapLogs: Log[] = [];
  for (const log of [...bundle.swapsV2, ...bundle.swapsV3]) {
    const txHash = String(log.transactionHash || '0x');
    const eventKey = `${txHash.toLowerCase()}-${log.logIndex}`;
    if (processedEventKeys.has(eventKey)) continue;

    const topic0 = (log.topics[0] || '').toLowerCase();
    const isV2 = topic0 === TOPIC_SWAP_V2.toLowerCase();
    const isV3 = topic0 === TOPIC_SWAP_V3.toLowerCase();

    if (!isV2 && !isV3) continue;

    const sender = log.topics[1] ? unpadTopicAddress(log.topics[1]) : '';
    const recipient = log.topics[2] ? unpadTopicAddress(log.topics[2]) : '';

    if (sender !== normTarget && recipient !== normTarget) continue;

    processedEventKeys.add(eventKey);
    validSwapLogs.push(log);
    swapTxHashes.add(txHash.toLowerCase());

    const blockNum = Number(log.blockNumber || 0n);
    const timestamp = blockTimestamps.get(blockNum) || Math.floor(Date.now() / 1000);
    const protocolName = isV3 ? 'Uniswap V3 Pool' : 'Uniswap V2 Pool';

    allActivities.push({
      id: eventKey,
      txHash,
      blockNumber: blockNum,
      timestamp,
      dateFormatted: new Date(timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      category: 'swaps',
      categoryLabel: 'Swaps',
      title: `DEX Swap Execution on ${protocolName}`,
      description: `Automated Market Maker swap order involving pool contract ${log.address}.`,
      from: sender || log.address.toLowerCase(),
      to: recipient || normTarget,
      assetType: 'ERC20',
      isNative: false,
      isContractCall: true,
      status: 'SUCCESS',
      tokenAddress: log.address.toLowerCase(),
      tokenSymbol: 'LP-POOL',
      isNotable: true,
      notableReason: `DEX liquidity swap execution on ${protocolName}`,
      explorerUrl: `${EXPLORER_BASE}/tx/${txHash}`,
    });
  }

  // 2. Process Genuine ERC-20 Approvals
  let unlimitedApprovals = 0;
  let currentVerifiedUnlimited = 0;
  let currentReducedOrRevoked = 0;
  let currentUnavailable = 0;

  for (const log of bundle.approvals) {
    const txHash = String(log.transactionHash || '0x');
    const eventKey = `${txHash.toLowerCase()}-${log.logIndex}`;
    if (processedEventKeys.has(eventKey)) continue;

    const topic0 = (log.topics[0] || '').toLowerCase();
    if (topic0 !== TOPIC_APPROVAL.toLowerCase()) continue;

    const owner = log.topics[1] ? unpadTopicAddress(log.topics[1]) : '';
    if (owner !== normTarget) continue;

    const spender = log.topics[2] ? (unpadTopicAddress(log.topics[2]) as `0x${string}`) : ('0x0' as `0x${string}`);
    if (spender === '0x0' || spender.length !== 42) continue;

    processedEventKeys.add(eventKey);

    const blockNum = Number(log.blockNumber || 0n);
    const timestamp = blockTimestamps.get(blockNum) || Math.floor(Date.now() / 1000);

    let rawVal = 0n;
    if (log.data && log.data !== '0x') {
      try { rawVal = BigInt(log.data); } catch { rawVal = 0n; }
    }

    const isHistoricalUnlimited = rawVal >= INFINITE_APPROVAL_THRESHOLD;
    if (isHistoricalUnlimited) unlimitedApprovals++;

    const tokenMeta = KNOWN_TOKENS[log.address.toLowerCase()] || { symbol: 'ERC-20', decimals: 18 };
    const formattedAmt = isHistoricalUnlimited ? 'Unlimited' : formatTokenAmount(rawVal, tokenMeta.decimals);

    const allowanceCheck = await checkCurrentAllowance(
      log.address.toLowerCase() as `0x${string}`,
      normTarget,
      spender,
      isHistoricalUnlimited
    );

    if (allowanceCheck.status === 'Current unlimited allowance verified') {
      currentVerifiedUnlimited++;
    } else if (allowanceCheck.status === 'Current allowance reduced or revoked') {
      currentReducedOrRevoked++;
    } else {
      currentUnavailable++;
    }

    const isNotable = isHistoricalUnlimited;
    const notableReason = isHistoricalUnlimited 
      ? `${allowanceCheck.status}: infinite allowance granted to ${spender.slice(0, 8)}...${spender.slice(-6)}`
      : undefined;

    allActivities.push({
      id: eventKey,
      txHash,
      blockNumber: blockNum,
      timestamp,
      dateFormatted: new Date(timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      category: 'token_approvals',
      categoryLabel: 'Token Approvals',
      title: `Token Allowance Grant (${tokenMeta.symbol})`,
      description: `Target wallet approved spender ${spender.slice(0, 8)}...${spender.slice(-6)} for ${formattedAmt} ${tokenMeta.symbol}. [${allowanceCheck.status}]`,
      from: normTarget,
      to: spender,
      assetType: 'ERC20',
      isNative: false,
      isContractCall: true,
      status: 'SUCCESS',
      tokenAddress: log.address.toLowerCase(),
      tokenSymbol: tokenMeta.symbol,
      rawAmount: rawVal.toString(),
      formattedAmount: formattedAmt,
      allowanceStatus: allowanceCheck.status,
      currentAllowanceRaw: allowanceCheck.currentRaw,
      isNotable,
      notableReason,
      explorerUrl: `${EXPLORER_BASE}/tx/${txHash}`,
    });
  }

  // 3. Process ApprovalForAll (NFT Operator Delegations under Contract Interactions)
  for (const log of bundle.approvalsForAll) {
    const txHash = String(log.transactionHash || '0x');
    const eventKey = `${txHash.toLowerCase()}-${log.logIndex}`;
    if (processedEventKeys.has(eventKey)) continue;

    const topic0 = (log.topics[0] || '').toLowerCase();
    if (topic0 !== TOPIC_APPROVAL_FOR_ALL.toLowerCase()) continue;

    const owner = log.topics[1] ? unpadTopicAddress(log.topics[1]) : '';
    if (owner !== normTarget) continue;

    const operator = log.topics[2] ? unpadTopicAddress(log.topics[2]) : 'Unknown Operator';
    processedEventKeys.add(eventKey);

    const blockNum = Number(log.blockNumber || 0n);
    const timestamp = blockTimestamps.get(blockNum) || Math.floor(Date.now() / 1000);

    allActivities.push({
      id: eventKey,
      txHash,
      blockNumber: blockNum,
      timestamp,
      dateFormatted: new Date(timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      category: 'contract_interactions',
      categoryLabel: 'Contract Interactions',
      title: `NFT Operator Approval (ERC-721/1155)`,
      description: `Target authorized operator ${operator.slice(0, 8)}...${operator.slice(-6)} on contract ${log.address}.`,
      from: normTarget,
      to: operator,
      assetType: 'ERC721',
      isNative: false,
      isContractCall: true,
      status: 'SUCCESS',
      tokenAddress: log.address.toLowerCase(),
      tokenSymbol: 'NFT',
      formattedAmount: 'Full Collection Authorization',
      isNotable: true,
      notableReason: `Full NFT operator authorization granted to ${operator.slice(0, 8)}...${operator.slice(-6)}`,
      explorerUrl: `${EXPLORER_BASE}/tx/${txHash}`,
    });
  }

  // 4. Process Genuine Inbound ERC-20 Transfers
  for (const log of bundle.transfersIn) {
    const txHash = String(log.transactionHash || '0x');
    const eventKey = `${txHash.toLowerCase()}-${log.logIndex}`;
    if (processedEventKeys.has(eventKey)) continue;

    const topic0 = (log.topics[0] || '').toLowerCase();
    if (topic0 !== TOPIC_TRANSFER.toLowerCase()) continue;

    const toAddr = log.topics[2] ? unpadTopicAddress(log.topics[2]) : '';
    if (toAddr !== normTarget) continue;

    const fromAddr = log.topics[1] ? unpadTopicAddress(log.topics[1]) : '0x0';
    processedEventKeys.add(eventKey);

    const isSwapComp = swapTxHashes.has(txHash.toLowerCase());
    const blockNum = Number(log.blockNumber || 0n);
    const timestamp = blockTimestamps.get(blockNum) || Math.floor(Date.now() / 1000);
    const tokenMeta = KNOWN_TOKENS[log.address.toLowerCase()] || { symbol: 'TOKEN', decimals: 18 };

    let rawVal = 0n;
    if (log.data && log.data !== '0x') {
      try { rawVal = BigInt(log.data); } catch { rawVal = 0n; }
    }
    const formattedAmt = formatTokenAmount(rawVal, tokenMeta.decimals);
    const isWhale = rawVal > 1000n * (10n ** BigInt(tokenMeta.decimals));
    const isSelfTransfer = fromAddr.toLowerCase() === normTarget;

    allActivities.push({
      id: eventKey,
      txHash,
      blockNumber: blockNum,
      timestamp,
      dateFormatted: new Date(timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      category: 'transfers_in',
      categoryLabel: isSelfTransfer ? 'Self-Transfer (Inbound)' : 'Transfers In',
      title: isSelfTransfer ? `Self-Transfer Inbound (${formattedAmt} ${tokenMeta.symbol})` : `Inbound Transfer (${formattedAmt} ${tokenMeta.symbol})`,
      description: isSelfTransfer
        ? `Self-transfer of ${formattedAmt} ${tokenMeta.symbol} within target wallet.`
        : `Received ${formattedAmt} ${tokenMeta.symbol} from ${fromAddr.slice(0, 8)}...${fromAddr.slice(-6)}.`,
      from: fromAddr,
      to: normTarget,
      assetType: 'ERC20',
      isNative: false,
      isContractCall: false,
      status: 'SUCCESS',
      tokenAddress: log.address.toLowerCase(),
      tokenSymbol: tokenMeta.symbol,
      rawAmount: rawVal.toString(),
      formattedAmount: formattedAmt,
      isSwapComponent: isSwapComp,
      isNotable: isWhale && !isSwapComp,
      notableReason: isWhale ? `Large inbound transfer of ${formattedAmt} ${tokenMeta.symbol}` : undefined,
      explorerUrl: `${EXPLORER_BASE}/tx/${txHash}`,
    });
  }

  // 5. Process Genuine Outbound ERC-20 Transfers
  for (const log of bundle.transfersOut) {
    const txHash = String(log.transactionHash || '0x');
    const eventKey = `${txHash.toLowerCase()}-${log.logIndex}`;
    if (processedEventKeys.has(eventKey)) continue;

    const topic0 = (log.topics[0] || '').toLowerCase();
    if (topic0 !== TOPIC_TRANSFER.toLowerCase()) continue;

    const fromAddr = log.topics[1] ? unpadTopicAddress(log.topics[1]) : '';
    if (fromAddr !== normTarget) continue;

    const toAddr = log.topics[2] ? unpadTopicAddress(log.topics[2]) : '0x0';
    processedEventKeys.add(eventKey);

    const isSwapComp = swapTxHashes.has(txHash.toLowerCase());
    const blockNum = Number(log.blockNumber || 0n);
    const timestamp = blockTimestamps.get(blockNum) || Math.floor(Date.now() / 1000);
    const tokenMeta = KNOWN_TOKENS[log.address.toLowerCase()] || { symbol: 'TOKEN', decimals: 18 };

    let rawVal = 0n;
    if (log.data && log.data !== '0x') {
      try { rawVal = BigInt(log.data); } catch { rawVal = 0n; }
    }
    const formattedAmt = formatTokenAmount(rawVal, tokenMeta.decimals);
    const isWhale = rawVal > 1000n * (10n ** BigInt(tokenMeta.decimals));
    const isSelfTransfer = toAddr.toLowerCase() === normTarget;

    allActivities.push({
      id: eventKey,
      txHash,
      blockNumber: blockNum,
      timestamp,
      dateFormatted: new Date(timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      category: 'transfers_out',
      categoryLabel: isSelfTransfer ? 'Self-Transfer (Outbound)' : 'Transfers Out',
      title: isSelfTransfer ? `Self-Transfer Outbound (${formattedAmt} ${tokenMeta.symbol})` : `Outbound Transfer (${formattedAmt} ${tokenMeta.symbol})`,
      description: isSelfTransfer
        ? `Self-transfer of ${formattedAmt} ${tokenMeta.symbol} within target wallet.`
        : `Sent ${formattedAmt} ${tokenMeta.symbol} to ${toAddr.slice(0, 8)}...${toAddr.slice(-6)}.`,
      from: normTarget,
      to: toAddr,
      assetType: 'ERC20',
      isNative: false,
      isContractCall: false,
      status: 'SUCCESS',
      tokenAddress: log.address.toLowerCase(),
      tokenSymbol: tokenMeta.symbol,
      rawAmount: rawVal.toString(),
      formattedAmount: formattedAmt,
      isSwapComponent: isSwapComp,
      isNotable: isWhale && !isSwapComp,
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
  const dexProtocols = new Set<string>();
  const uniqueContracts = new Set<string>();
  const uniqueTxHashes = new Set<string>();

  for (const act of allActivities) {
    uniqueTxHashes.add(act.txHash.toLowerCase());
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
      dexProtocols.add('Uniswap / AMM Pool');
    }
  }

  const categoryTotals: CategoryTotals = {
    transfers_in: {
      count: allActivities.filter(a => a.category === 'transfers_in').length,
      nativeCount: 0,
      erc20Count: allActivities.filter(a => a.category === 'transfers_in').length,
      nativeAmountFormatted: '0.0000 PHAROS',
      uniqueSenders: senders.size,
      sampleTokens: Array.from(inTokens).slice(0, 5),
    },
    transfers_out: {
      count: allActivities.filter(a => a.category === 'transfers_out').length,
      nativeCount: 0,
      erc20Count: allActivities.filter(a => a.category === 'transfers_out').length,
      nativeAmountFormatted: '0.0000 PHAROS',
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
      currentVerifiedUnlimited,
      currentReducedOrRevoked,
      currentUnavailable,
      uniqueSpenders: spenders.size,
    },
    contract_interactions: {
      count: allActivities.filter(a => a.category === 'contract_interactions').length,
      uniqueContracts: uniqueContracts.size,
    },
    native_summary: {
      inboundCount: 0,
      inboundTotalFormatted: '0.0000 PHAROS',
      outboundCount: 0,
      outboundTotalFormatted: '0.0000 PHAROS',
      netNativeChangeFormatted: '0.0000 PHAROS',
    },
  };

  const categorySummaries: CategorySummary[] = [
    {
      category: 'transfers_in',
      label: 'Transfers In',
      count: categoryTotals.transfers_in.count,
      details: `${categoryTotals.transfers_in.count} inbound transfers across ${senders.size} unique senders.`,
    },
    {
      category: 'transfers_out',
      label: 'Transfers Out',
      count: categoryTotals.transfers_out.count,
      details: `${categoryTotals.transfers_out.count} outbound transfers across ${recipients.size} unique recipients.`,
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
      details: `${categoryTotals.token_approvals.count} token allowance grants (${unlimitedApprovals} infinite allowances detected; ${currentVerifiedUnlimited} confirmed active on-chain).`,
    },
    {
      category: 'contract_interactions',
      label: 'Contract Interactions',
      count: categoryTotals.contract_interactions.count,
      details: `${categoryTotals.contract_interactions.count} direct contract invocations and NFT operator authorizations.`,
    },
  ];

  const notableTransactions = allActivities.filter(a => a.isNotable);

  return {
    allActivities,
    categoryTotals,
    categorySummaries,
    notableTransactions,
  };
}
