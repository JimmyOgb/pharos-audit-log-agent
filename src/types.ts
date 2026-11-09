export type ActivityCategory = 
  | 'transfers_in' 
  | 'transfers_out' 
  | 'swaps' 
  | 'token_approvals' 
  | 'contract_interactions';

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
  tokenAddress?: string;
  tokenSymbol?: string;
  rawAmount?: string;
  formattedAmount?: string;
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

export interface CategoryTotals {
  transfers_in: {
    count: number;
    uniqueSenders: number;
    sampleTokens: string[];
  };
  transfers_out: {
    count: number;
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
    uniqueSpenders: number;
  };
  contract_interactions: {
    count: number;
    uniqueContracts: number;
  };
}

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
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
  summary: {
    totalTransactions: number;
    totalCategoriesRepresented: number;
    executiveSummary: string;
  };
  categorySummaries: CategorySummary[];
  categoryTotals: CategoryTotals;
  notableTransactions: ActivityItem[];
  allActivities: ActivityItem[];
  provenance: {
    queryTimestamp: string;
    blockSpan: number;
    verifiedOnChain: boolean;
  };
}

export interface AuditRequest {
  address: string;
  startDate?: string;
  endDate?: string;
  blockSpan?: number;
}
