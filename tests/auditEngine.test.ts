import assert from 'node:assert';
import { resolveBlockRange } from '../src/services/blockResolver.js';
import { classifyActivities, formatTokenAmount } from '../src/services/classifier.js';
import { exportToMarkdown, exportToCSV, exportToPDF } from '../src/services/exporters.js';
import { generateAuditReport } from '../src/services/reportGenerator.js';
import { 
  TOPIC_TRANSFER, 
  TOPIC_APPROVAL, 
  TOPIC_SWAP_V2, 
  padTopicAddress 
} from '../src/services/activityFetcher.js';
import type { RawLogBundle, AuditReport } from '../src/types.js';

async function runTests() {
  console.log('🧪 Starting Pharos Audit-Log Agent Automated Test Suite...\n');

  // Test 1: Address validation
  console.log('Test 1: Address validation rejection');
  try {
    await generateAuditReport({ address: 'invalid-address' });
    assert.fail('Should have thrown on invalid address');
  } catch (err: any) {
    assert(err.message.includes('Invalid EVM wallet address'));
    console.log('  ✔ Invalid address properly rejected.');
  }

  // Test 2: Block range calculation
  console.log('\nTest 2: Block range resolution');
  const range = await resolveBlockRange('2026-11-01', '2026-11-08', 2000);
  assert(range.fromBlock <= range.toBlock, 'fromBlock must be <= toBlock');
  assert(range.startTimestamp < range.endTimestamp, 'startTimestamp must be < endTimestamp');
  console.log(`  ✔ Resolved block range: ${range.fromBlock} to ${range.toBlock} (Span: ${range.toBlock - range.fromBlock})`);

  // Test 3: Classification engine unit tests
  console.log('\nTest 3: Classification engine (5 categories & priority deduplication)');
  const dummyWallet = '0x1111111111111111111111111111111111111111';
  const dummyTargetPadded = padTopicAddress(dummyWallet);
  const otherWalletPadded = padTopicAddress('0x2222222222222222222222222222222222222222');

  const mockBundle: any = {
    transfersIn: [
      {
        address: '0x524b0b76e5d83c27e8d7bb54c9d5fc1dc78b97d0',
        topics: [TOPIC_TRANSFER, otherWalletPadded, dummyTargetPadded],
        data: '0x0000000000000000000000000000000000000000000000000000000005f5e100', // 100 USDT (6 decimals)
        blockNumber: 1000n,
        transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        logIndex: 0,
      }
    ],
    transfersOut: [
      {
        address: '0x524b0b76e5d83c27e8d7bb54c9d5fc1dc78b97d0',
        topics: [TOPIC_TRANSFER, dummyTargetPadded, otherWalletPadded],
        data: '0x0000000000000000000000000000000000000000000000000000000002faf080', // 50 USDT
        blockNumber: 1001n,
        transactionHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        logIndex: 0,
      }
    ],
    approvals: [
      {
        address: '0x72cb25026ff7328bfbb740e5564b735231c618ce',
        topics: [TOPIC_APPROVAL, dummyTargetPadded, otherWalletPadded],
        data: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', // Max Uint256
        blockNumber: 1002n,
        transactionHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        logIndex: 0,
      }
    ],
    approvalsForAll: [],
    swapsV2: [
      {
        address: '0x4444444444444444444444444444444444444444',
        topics: [TOPIC_SWAP_V2, null, dummyTargetPadded],
        data: '0x',
        blockNumber: 1003n,
        transactionHash: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        logIndex: 0,
      }
    ],
    swapsV3: [],
    fromBlock: 1000n,
    toBlock: 1003n,
  };

  const blockTs = new Map<number, number>([
    [1000, 1700000000],
    [1001, 1700000001],
    [1002, 1700000002],
    [1003, 1700000003],
  ]);

  const classified = classifyActivities(dummyWallet, mockBundle, blockTs);
  assert.strictEqual(classified.categoryTotals.transfers_in.count, 1, 'Should have 1 transfer in');
  assert.strictEqual(classified.categoryTotals.transfers_out.count, 1, 'Should have 1 transfer out');
  assert.strictEqual(classified.categoryTotals.token_approvals.count, 1, 'Should have 1 approval');
  assert.strictEqual(classified.categoryTotals.token_approvals.unlimitedApprovals, 1, 'Should detect unlimited approval');
  assert.strictEqual(classified.categoryTotals.swaps.count, 1, 'Should have 1 swap');
  assert(classified.notableTransactions.length >= 1, 'Notable transactions must be identified');
  console.log('  ✔ Activity classification and category aggregation passed.');

  // Test 4: Formatters and unlimited thresholds
  console.log('\nTest 4: Value formatting & BigInt safety');
  assert.strictEqual(formatTokenAmount(2n ** 256n - 1n), 'Unlimited (MAX)');
  assert.strictEqual(formatTokenAmount(1000000000000000000n, 18), '1');
  console.log('  ✔ BigInt formatting and unlimited allowance detection passed.');

  // Test 5: Exporters (Markdown, CSV, PDF)
  console.log('\nTest 5: Exporter verification (Markdown, CSV, PDF)');
  const dummyReport: AuditReport = {
    reportId: 'AUDIT-TEST-1234',
    generatedAt: new Date().toISOString(),
    walletAddress: dummyWallet,
    startDate: '2026-11-01T00:00:00.000Z',
    endDate: '2026-11-08T23:59:59.000Z',
    startBlock: 1000,
    endBlock: 1003,
    network: {
      name: 'Pharos Atlantic Testnet',
      chainId: 688689,
      rpcUrl: 'https://atlantic.dplabs-internal.com',
      explorerUrl: 'https://atlantic.pharosscan.com',
    },
    summary: {
      totalTransactions: classified.allActivities.length,
      totalCategoriesRepresented: 4,
      executiveSummary: 'Test executive summary for compliance validation.',
    },
    categorySummaries: classified.categorySummaries,
    categoryTotals: classified.categoryTotals,
    notableTransactions: classified.notableTransactions,
    allActivities: classified.allActivities,
    provenance: {
      queryTimestamp: new Date().toISOString(),
      blockSpan: 3,
      verifiedOnChain: true,
    },
  };

  // Test Markdown export
  const md = exportToMarkdown(dummyReport);
  assert(md.includes('# Pharos On-Chain Audit-Log Report'));
  assert(md.includes(dummyWallet));
  assert(md.includes('https://atlantic.pharosscan.com/tx/'));
  console.log('  ✔ Markdown exporter generated valid document with explorer links.');

  // Test CSV export
  const csv = exportToCSV(dummyReport);
  assert(csv.startsWith('Report_ID,Wallet_Address'));
  assert(csv.includes(dummyWallet));
  const csvRows = csv.split('\r\n');
  assert(csvRows.length >= classified.allActivities.length + 1);
  console.log(`  ✔ CSV exporter generated RFC 4180 compliant CSV (${csvRows.length} rows).`);

  // Test PDF export
  const pdfBuffer = await exportToPDF(dummyReport);
  assert(Buffer.isBuffer(pdfBuffer));
  assert(pdfBuffer.length > 1000);
  assert(pdfBuffer.toString('utf-8', 0, 5) === '%PDF-', 'Must start with PDF magic bytes');
  console.log(`  ✔ PDF exporter generated valid PDF document (${pdfBuffer.length} bytes).`);

  // Test 6: Live Integration Test against Pharos Atlantic Testnet
  console.log('\nTest 6: Live on-chain integration test (Atlantic Testnet)');
  const liveAddress = '0x299ce4113abf88f4997737184aa8a7a3d58ac15c';
  console.log(`  Querying live activity for ${liveAddress}...`);
  const liveReport = await generateAuditReport({
    address: liveAddress,
    blockSpan: 500, // sample 500 blocks
  });

  assert(liveReport.reportId.startsWith('AUDIT-'));
  assert.strictEqual(liveReport.walletAddress.toLowerCase(), liveAddress.toLowerCase());
  assert(liveReport.allActivities.length > 0, 'Live address should have real activities on Atlantic Testnet');
  console.log(`  ✔ Live report generated with ${liveReport.allActivities.length} on-chain activities.`);
  console.log(`    - Transfers In: ${liveReport.categoryTotals.transfers_in.count}`);
  console.log(`    - Transfers Out: ${liveReport.categoryTotals.transfers_out.count}`);
  console.log(`    - Swaps: ${liveReport.categoryTotals.swaps.count}`);
  console.log(`    - Approvals: ${liveReport.categoryTotals.token_approvals.count}`);
  console.log(`    - Notable Transactions: ${liveReport.notableTransactions.length}`);

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
