import { type Log } from 'viem';
import { fetchLogsInChunks, rpcClient } from './rpc.js';

export const TOPIC_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const TOPIC_APPROVAL = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
export const TOPIC_APPROVAL_FOR_ALL = '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31';
export const TOPIC_SWAP_V2 = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
export const TOPIC_SWAP_V3 = '0xc42079f94a6350d7e6235f29174924f9d5fb2dfc5b2b1e41c4f519c629447228';

export function padTopicAddress(address: string): `0x${string}` {
  const clean = address.toLowerCase().replace(/^0x/, '');
  return `0x${clean.padStart(64, '0')}`;
}

export function unpadTopicAddress(topic: string): string {
  if (!topic || topic.length < 42) return topic;
  return `0x${topic.slice(-40).toLowerCase()}`;
}

export interface RawLogBundle {
  transfersIn: Log[];
  transfersOut: Log[];
  approvals: Log[];
  approvalsForAll: Log[];
  swapsV2: Log[];
  swapsV3: Log[];
  fromBlock: bigint;
  toBlock: bigint;
}

export async function fetchRawActivitiesForAddress(
  targetAddress: string,
  fromBlock: bigint,
  toBlock: bigint
): Promise<RawLogBundle> {
  const paddedAddress = padTopicAddress(targetAddress);

  // Run log fetches in parallel for efficiency
  const [
    transfersIn,
    transfersOut,
    approvals,
    approvalsForAll,
    swapsV2,
    swapsV3
  ] = await Promise.all([
    // Transfers In: Transfer(from, to=paddedAddress, value)
    fetchLogsInChunks(fromBlock, toBlock, [TOPIC_TRANSFER, null, paddedAddress]),
    // Transfers Out: Transfer(from=paddedAddress, to, value)
    fetchLogsInChunks(fromBlock, toBlock, [TOPIC_TRANSFER, paddedAddress, null]),
    // Approvals: Approval(owner=paddedAddress, spender, value)
    fetchLogsInChunks(fromBlock, toBlock, [TOPIC_APPROVAL, paddedAddress, null]),
    // Approvals For All: ApprovalForAll(owner=paddedAddress, operator, approved)
    fetchLogsInChunks(fromBlock, toBlock, [TOPIC_APPROVAL_FOR_ALL, paddedAddress, null]),
    // Swaps V2: Swap(..., to=paddedAddress)
    fetchLogsInChunks(fromBlock, toBlock, [TOPIC_SWAP_V2, null, paddedAddress]),
    // Swaps V3: Swap(..., recipient=paddedAddress)
    fetchLogsInChunks(fromBlock, toBlock, [TOPIC_SWAP_V3, null, paddedAddress])
  ]);

  return {
    transfersIn,
    transfersOut,
    approvals,
    approvalsForAll,
    swapsV2,
    swapsV3,
    fromBlock,
    toBlock,
  };
}
