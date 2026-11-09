import { rpcClient, pharosAtlantic } from './rpc.js';
import type { ActivityItem } from '../types.js';

export function formatPharos(amountWei: bigint): string {
  const isNegative = amountWei < 0n;
  const abs = isNegative ? -amountWei : amountWei;
  const whole = abs / 10n ** 18n;
  const fraction = abs % 10n ** 18n;
  const fracStr = fraction.toString().padStart(18, '0').slice(0, 4);
  return `${isNegative ? '-' : ''}${whole.toString()}.${fracStr}`;
}

export interface NativeFetchResult {
  activities: ActivityItem[];
  outboundCount: number;
  inboundCount: number;
  totalOutboundWei: bigint;
  totalInboundWei: bigint;
  totalTransactionsScanned: number;
}

/**
 * Deterministically discovers outbound native transactions via nonce state transition binary search,
 * and extracts inbound/outbound native transfers and contract calls from verified block receipts.
 */
export async function fetchNativeTransactions(
  targetAddress: string,
  fromBlock: bigint,
  toBlock: bigint,
  additionalTxHashes: string[] = []
): Promise<NativeFetchResult> {
  const target = targetAddress.toLowerCase();
  const explorerUrl = pharosAtlantic.blockExplorers?.default.url || 'https://atlantic.pharosscan.com';
  const activities: ActivityItem[] = [];
  const processedTxHashes = new Set<string>();

  let outboundCount = 0;
  let inboundCount = 0;
  let totalOutboundWei = 0n;
  let totalInboundWei = 0n;

  // 1. Check Nonce Transition for Outbound Transactions
  let startNonce = 0;
  let endNonce = 0;
  try {
    // Query fromBlock - 1n so that transactions executed at fromBlock are included
    const queryFromBlock = fromBlock > 0n ? fromBlock - 1n : 0n;
    const [startNonceRes, endNonceRes] = await Promise.all([
      rpcClient.getTransactionCount({ address: target as `0x${string}`, blockNumber: queryFromBlock }),
      rpcClient.getTransactionCount({ address: target as `0x${string}`, blockNumber: toBlock }),
    ]);
    startNonce = Number(startNonceRes);
    endNonce = Number(endNonceRes);
  } catch (err) {
    console.warn(`[NativeFetcher] Nonce check error for ${target}:`, err);
  }

  const outboundTxCount = Math.max(0, endNonce - startNonce);
  const discoveredTxBlocks: { blockNumber: bigint; nonce: number }[] = [];

  // Binary search to pinpoint exact block for each outbound transaction
  if (outboundTxCount > 0 && outboundTxCount <= 100) {
    for (let targetNonce = startNonce + 1; targetNonce <= endNonce; targetNonce++) {
      let low = fromBlock;
      let high = toBlock;
      let blockFound = toBlock;

      while (low <= high) {
        const mid = low + (high - low) / 2n;
        try {
          const n = await rpcClient.getTransactionCount({
            address: target as `0x${string}`,
            blockNumber: mid,
          });
          if (n >= targetNonce) {
            blockFound = mid;
            high = mid - 1n;
          } else {
            low = mid + 1n;
          }
        } catch {
          low = mid + 1n;
        }
      }
      discoveredTxBlocks.push({ blockNumber: blockFound, nonce: targetNonce });
    }
  }

  // 2. Fetch full blocks for discovered outbound transitions
  const blocksToFetch = new Set<bigint>();
  for (const item of discoveredTxBlocks) {
    blocksToFetch.add(item.blockNumber);
  }

  // Also include any blocks from additional candidate hashes
  for (const blockNum of blocksToFetch) {
    try {
      const blk = await rpcClient.getBlock({ blockNumber: blockNum, includeTransactions: true });
      const blockTimestamp = Number(blk.timestamp);
      const dateFormatted = new Date(blockTimestamp * 1000).toISOString().replace('T', ' ').replace(/\..+/, ' UTC');

      for (const rawTx of blk.transactions) {
        if (typeof rawTx !== 'object') continue;
        const tx = rawTx as any;
        const txHash = String(tx.hash || '0x');
        if (processedTxHashes.has(txHash.toLowerCase())) continue;

        const isSender = tx.from && tx.from.toLowerCase() === target;
        const isRecipient = tx.to && tx.to.toLowerCase() === target;

        if (!isSender && !isRecipient) continue;

        processedTxHashes.add(txHash.toLowerCase());

        // Fetch receipt to verify status
        let isSuccess = true;
        let isReverted = false;
        try {
          const receipt = await rpcClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
          isSuccess = receipt.status === 'success';
          isReverted = receipt.status === 'reverted';
        } catch {
          // If receipt unavailable, assume confirmed inclusion
        }

        const valueWei = BigInt(tx.value || 0n);
        const hasValue = valueWei > 0n;
        const hasCalldata = tx.input && tx.input !== '0x' && tx.input.length > 2;
        const isContractCreation = !tx.to || tx.to === '0x';

        // A. Outbound Native Transfer (Wallet is Sender)
        if (isSender) {
          if (isReverted) {
            // Reverted outbound transaction
            activities.push({
              id: `${txHash}-native-reverted`,
              txHash,
              blockNumber: Number(blockNum),
              timestamp: blockTimestamp,
              dateFormatted,
              category: 'contract_interactions',
              categoryLabel: 'Contract Interactions',
              title: 'Reverted Transaction',
              description: `Outbound transaction to ${tx.to ? tx.to.slice(0, 10) + '...' : 'Contract'} reverted on-chain. Zero value transferred.`,
              from: tx.from,
              to: tx.to || '0x',
              assetType: 'NATIVE_PHAROS',
              isNative: true,
              isContractCall: hasCalldata,
              status: 'REVERTED',
              rawAmount: '0',
              formattedAmount: '0.0000 PHAROS',
              isNotable: true,
              notableReason: 'Reverted execution (Status: Reverted)',
              explorerUrl: `${explorerUrl}/tx/${txHash}`,
            });
          } else if (isContractCreation) {
            // Contract creation
            activities.push({
              id: `${txHash}-contract-creation`,
              txHash,
              blockNumber: Number(blockNum),
              timestamp: blockTimestamp,
              dateFormatted,
              category: 'contract_interactions',
              categoryLabel: 'Contract Interactions',
              title: 'Contract Creation',
              description: `Deployed new smart contract${hasValue ? ` with ${formatPharos(valueWei)} PHAROS endowment` : ''}.`,
              from: tx.from,
              to: 'Contract Creation',
              assetType: 'NATIVE_PHAROS',
              isNative: hasValue,
              isContractCall: true,
              status: 'SUCCESS',
              rawAmount: valueWei.toString(),
              formattedAmount: `${formatPharos(valueWei)} PHAROS`,
              isNotable: true,
              notableReason: 'Smart contract deployment',
              explorerUrl: `${explorerUrl}/tx/${txHash}`,
            });
          } else if (hasValue) {
            // Successful outbound transfer
            outboundCount++;
            totalOutboundWei += valueWei;
            const formatted = formatPharos(valueWei);
            const isWhale = valueWei >= 1_000n * 10n ** 18n;

            activities.push({
              id: `${txHash}-native-out`,
              txHash,
              blockNumber: Number(blockNum),
              timestamp: blockTimestamp,
              dateFormatted,
              category: 'transfers_out',
              categoryLabel: 'Transfers Out',
              title: hasCalldata ? `Outbound Native Transfer & Call (${formatted} PHAROS)` : `Outbound Native Transfer (${formatted} PHAROS)`,
              description: `Transferred ${formatted} PHAROS to ${tx.to.slice(0, 8)}...${tx.to.slice(-6)}${hasCalldata ? ' with contract invocation' : ''}.`,
              from: tx.from,
              to: tx.to,
              assetType: 'NATIVE_PHAROS',
              isNative: true,
              isContractCall: hasCalldata,
              status: 'SUCCESS',
              tokenSymbol: 'PHAROS',
              rawAmount: valueWei.toString(),
              formattedAmount: `${formatted} PHAROS`,
              isNotable: isWhale,
              notableReason: isWhale ? `High-value native transfer (${formatted} PHAROS)` : undefined,
              explorerUrl: `${explorerUrl}/tx/${txHash}`,
            });
          } else if (hasCalldata) {
            // Zero-value contract call
            activities.push({
              id: `${txHash}-contract-call`,
              txHash,
              blockNumber: Number(blockNum),
              timestamp: blockTimestamp,
              dateFormatted,
              category: 'contract_interactions',
              categoryLabel: 'Contract Interactions',
              title: 'Direct Contract Invocation',
              description: `Invoked contract at ${tx.to.slice(0, 8)}...${tx.to.slice(-6)} (Zero native value transferred).`,
              from: tx.from,
              to: tx.to,
              assetType: 'NATIVE_PHAROS',
              isNative: false,
              isContractCall: true,
              status: 'SUCCESS',
              rawAmount: '0',
              formattedAmount: '0.0000 PHAROS',
              isNotable: false,
              explorerUrl: `${explorerUrl}/tx/${txHash}`,
            });
          }
        } else if (isRecipient && hasValue && isSuccess) {
          // B. Inbound Native Transfer (Wallet is Recipient)
          inboundCount++;
          totalInboundWei += valueWei;
          const formatted = formatPharos(valueWei);
          const isWhale = valueWei >= 1_000n * 10n ** 18n;

          activities.push({
            id: `${txHash}-native-in`,
            txHash,
            blockNumber: Number(blockNum),
            timestamp: blockTimestamp,
            dateFormatted,
            category: 'transfers_in',
            categoryLabel: 'Transfers In',
            title: `Inbound Native Transfer (${formatted} PHAROS)`,
            description: `Received ${formatted} PHAROS from ${tx.from.slice(0, 8)}...${tx.from.slice(-6)}.`,
            from: tx.from,
            to: tx.to,
            assetType: 'NATIVE_PHAROS',
            isNative: true,
            isContractCall: hasCalldata,
            status: 'SUCCESS',
            tokenSymbol: 'PHAROS',
            rawAmount: valueWei.toString(),
            formattedAmount: `${formatted} PHAROS`,
            isNotable: isWhale,
            notableReason: isWhale ? `High-value inbound transfer (${formatted} PHAROS)` : undefined,
            explorerUrl: `${explorerUrl}/tx/${txHash}`,
          });
        }
      }
    } catch (err) {
      console.warn(`[NativeFetcher] Block ${blockNum} fetch warning:`, err);
    }
  }

  // 3. Inspect any additional transaction hashes passed in
  for (const h of additionalTxHashes) {
    if (processedTxHashes.has(h.toLowerCase())) continue;
    try {
      const tx = await rpcClient.getTransaction({ hash: h as `0x${string}` });
      if (!tx) continue;
      const txHash = tx.hash;
      processedTxHashes.add(txHash.toLowerCase());

      const isSender = tx.from && tx.from.toLowerCase() === target;
      const isRecipient = tx.to && tx.to.toLowerCase() === target;
      if (!isSender && !isRecipient) continue;

      const receipt = await rpcClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
      const isSuccess = receipt.status === 'success';
      const isReverted = receipt.status === 'reverted';
      const valueWei = BigInt(tx.value || 0n);
      const hasValue = valueWei > 0n;
      const blockNum = Number(tx.blockNumber || 0n);
      const blk = await rpcClient.getBlock({ blockNumber: BigInt(blockNum) });
      const blockTimestamp = Number(blk.timestamp);
      const dateFormatted = new Date(blockTimestamp * 1000).toISOString().replace('T', ' ').replace(/\..+/, ' UTC');

      if (isSender && hasValue && isSuccess) {
        outboundCount++;
        totalOutboundWei += valueWei;
        const formatted = formatPharos(valueWei);
        activities.push({
          id: `${txHash}-native-out`,
          txHash,
          blockNumber: blockNum,
          timestamp: blockTimestamp,
          dateFormatted,
          category: 'transfers_out',
          categoryLabel: 'Transfers Out',
          title: `Outbound Native Transfer (${formatted} PHAROS)`,
          description: `Transferred ${formatted} PHAROS to ${tx.to?.slice(0, 8)}...${tx.to?.slice(-6)}.`,
          from: tx.from,
          to: tx.to || '0x',
          assetType: 'NATIVE_PHAROS',
          isNative: true,
          isContractCall: Boolean(tx.input && tx.input.length > 2),
          status: 'SUCCESS',
          tokenSymbol: 'PHAROS',
          rawAmount: valueWei.toString(),
          formattedAmount: `${formatted} PHAROS`,
          isNotable: valueWei >= 1000n * 10n ** 18n,
          explorerUrl: `${explorerUrl}/tx/${txHash}`,
        });
      } else if (isRecipient && hasValue && isSuccess) {
        inboundCount++;
        totalInboundWei += valueWei;
        const formatted = formatPharos(valueWei);
        activities.push({
          id: `${txHash}-native-in`,
          txHash,
          blockNumber: blockNum,
          timestamp: blockTimestamp,
          dateFormatted,
          category: 'transfers_in',
          categoryLabel: 'Transfers In',
          title: `Inbound Native Transfer (${formatted} PHAROS)`,
          description: `Received ${formatted} PHAROS from ${tx.from.slice(0, 8)}...${tx.from.slice(-6)}.`,
          from: tx.from,
          to: tx.to || '0x',
          assetType: 'NATIVE_PHAROS',
          isNative: true,
          isContractCall: Boolean(tx.input && tx.input.length > 2),
          status: 'SUCCESS',
          tokenSymbol: 'PHAROS',
          rawAmount: valueWei.toString(),
          formattedAmount: `${formatted} PHAROS`,
          isNotable: valueWei >= 1000n * 10n ** 18n,
          explorerUrl: `${explorerUrl}/tx/${txHash}`,
        });
      }
    } catch {
      // Ignore single tx fetch error
    }
  }

  return {
    activities,
    outboundCount,
    inboundCount,
    totalOutboundWei,
    totalInboundWei,
    totalTransactionsScanned: processedTxHashes.size,
  };
}
