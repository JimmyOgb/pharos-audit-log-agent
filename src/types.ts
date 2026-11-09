export type ActivityCategory = 
  | 'transfers_in' 
  | 'transfers_out' 
  | 'swaps' 
  | 'token_approvals' 
  | 'contract_interactions';

export type AllowanceStatus = 
  | 'Historical unlimited approval observed'
  | 'Current unlimited allowance verified'
  | 'Current allowance reduced or revoked'
  | 'Current allowance unavailable or unverified';

export type ScanCompleteness = 'COMPLETE' | 'PARTIAL' | 'FAILED';

export type AssetType = 'NATIVE_PHAROS' | 'ERC20' | 'ERC721' | 'ERC1155';

export interface ActivityItem {
  id: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  dateFormatted: string;
  category: ActivityCategory;
  categoryLabel: string;
  title: string;
  description: string;
  from: string;
  to: string;
  assetType: AssetType;
  isNative: boolean;
  isContractCall: boolean;
  status: 'SUCCESS' | 'REVERTED';
  tokenAddress?: string;
  tokenSymbol?: string;
  rawAmount?: string;
  formattedAmount?: string;
  allowanceStatus?: AllowanceStatus;
  currentAllowanceRaw?: string;
  isSwapComponent?: boolean;
  isNotable: boolean;
  notableReason?: string;
  explorerUrl: string;
}

export interface CategorySummary {
  category: ActivityCategory;
  label: string;
  count: number;
  details: string;
}

export interface NativeSummary {
  inboundCount: number;
  inboundTotalFormatted: string;
  outboundCount: number;
  outboundTotalFormatted: string;
  netNativeChangeFormatted: string;
}

export interface CategoryTotals {
  transfers_in: {
    count: number;
    nativeCount: number;
    erc20Count: number;
    nativeAmountFormatted: string;
    uniqueSenders: number;
    sampleTokens: string[];
  };
  transfers_out: {
    count: number;
    nativeCount: number;
    erc20Count: number;
    nativeAmountFormatted: string;
    uniqueRecipients: number;
    sampleTokens: string[];
  };
  swaps: {
    count: number;
    dexProtocols: string[];
  };
  token_approvals: {
    count: number;
    unlimitedApprovals: number;
    currentVerifiedUnlimited: number;
    currentReducedOrRevoked: number;
    currentUnavailable: number;
    uniqueSpenders: number;
  };
  contract_interactions: {
    count: number;
    uniqueContracts: number;
  };
  native_summary: NativeSummary;
}

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
}

export interface ContinuationState {
  originalTargetAddress: string;
  requestedStartDate: string;
  requestedEndDate: string;
  resolvedStartBlock: number;
  resolvedEndBlock: number;
  totalRequestedBlocks: number;
  scannedBlockRanges: { fromBlock: number; toBlock: number }[];
  totalScannedBlocks: number;
  accumulatedActivities: ActivityItem[];
  nextFromBlock: number;
  nextToBlock: number;
  isComplete: boolean;
  empiricalSecondsPerBlock?: number;
}

export interface ScanCoverage {
  requestedStartDate: string;
  requestedEndDate: string;
  requestedBlockSpan: number;
  resolvedStartBlock: number;
  resolvedEndBlock: number;
  actualStartBlock: number;
  actualEndBlock: number;
  actualScannedBlocksCount: number;
  actualStartTimestamp: number;
  actualEndTimestamp: number;
  actualStartDateFormatted: string;
  actualEndDateFormatted: string;
  completeness: ScanCompleteness;
  isComplete: boolean;
  omittedBlockCount: number;
  coveragePercentage: number;
  scannedChunksCount: number;
  failedChunksCount: number;
  failureReason?: string;
  continuationCursor?: {
    nextFromBlock: number;
    nextToBlock: number;
  };
  continuationState?: ContinuationState;
}

export interface AuditReport {
  reportId: string;
  generatedAt: string;
  walletAddress: string;
  startDate: string;
  endDate: string;
  startBlock: number;
  endBlock: number;
  network: NetworkConfig;
  coverage: ScanCoverage;
  continuationState?: ContinuationState;
  summary: {
    totalTransactions: number;
    totalEvents: number;
    totalCategoriesRepresented: number;
    scanCompleteness: ScanCompleteness;
    nativeTransfersCount: number;
    erc20TransfersCount: number;
    executiveSummary: string;
  };
  categorySummaries: CategorySummary[];
  categoryTotals: CategoryTotals;
  notableTransactions: ActivityItem[];
  allActivities: ActivityItem[];
  provenance: {
    queryTimestamp: string;
    blockSpan: number;
    rawLogsRetrieved: number;
    deduplicatedEventsCount: number;
    verifiedOnChain: boolean;
    nativeTxCount: number;
    unsupportedOrPartialNotice?: string;
  };
}

export interface AuditRequest {
  address: string;
  startDate?: string;
  endDate?: string;
  blockSpan?: number;
  continuationState?: ContinuationState;
  cursor?: {
    fromBlock: number;
    toBlock: number;
  };
}
