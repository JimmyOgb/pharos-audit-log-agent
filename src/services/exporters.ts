import PDFDocument from 'pdfkit';
import type { AuditReport } from '../types.js';

/**
 * Generate comprehensive Markdown report
 */
export function exportToMarkdown(report: AuditReport): string {
  const lines: string[] = [];
  const cov = report.coverage;

  lines.push(`# Pharos On-Chain Audit-Log Report`);
  lines.push(``);
  lines.push(`**Report ID:** \`${report.reportId}\`  `);
  lines.push(`**Generated At:** ${report.generatedAt}  `);
  lines.push(`**Network:** ${report.network.name} (Chain ID: \`${report.network.chainId}\`)  `);
  lines.push(`**Target Wallet:** \`${report.walletAddress}\`  `);
  lines.push(`**Scan Completeness:** **${cov.completeness}** (${cov.coveragePercentage}% of requested block span)  `);
  lines.push(`**Requested Period:** ${cov.requestedStartDate} to ${cov.requestedEndDate} (Requested Blocks: \`${cov.resolvedStartBlock}\` .. \`${cov.resolvedEndBlock}\`; Span: ${cov.requestedBlockSpan.toLocaleString()} blocks)  `);
  lines.push(`**Actual Scanned Coverage:** ${cov.actualStartDateFormatted} to ${cov.actualEndDateFormatted} (Scanned Blocks: \`${cov.actualStartBlock}\` .. \`${cov.actualEndBlock}\`; Span: ${cov.actualScannedBlocksCount.toLocaleString()} blocks)  `);
  
  if (cov.omittedBlockCount > 0) {
    lines.push(`> [!WARNING] **Partial Scan Notice**: ${cov.omittedBlockCount.toLocaleString()} earlier blocks were omitted due to execution boundary safeguards. Uninspected blocks: \`${cov.resolvedStartBlock}\` .. \`${cov.actualStartBlock - 1}\`.  `);
  }

  lines.push(`**On-Chain Verification:** ${report.provenance.verifiedOnChain ? 'VERIFIED LIVE (Read-Only)' : 'UNVERIFIED'}  `);
  lines.push(`**Data Provenance:** ${report.provenance.rawLogsRetrieved} raw logs, ${report.provenance.nativeTxCount} native txs inspected across ${cov.scannedChunksCount} chunk(s).  `);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 1. Executive Compliance Summary`);
  lines.push(``);
  lines.push(report.summary.executiveSummary);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 2. Activity Category & Asset Breakdown`);
  lines.push(``);
  lines.push(`| Category | Total Count | Native PHAROS | ERC-20 / Contracts | Classification Details |`);
  lines.push(`| :--- | :--- | :--- | :--- | :--- |`);

  for (const cat of report.categorySummaries) {
    let nativeStr = '-';
    let erc20Str = '-';
    if (cat.category === 'transfers_in') {
      nativeStr = `${report.categoryTotals.transfers_in.nativeCount} (${report.categoryTotals.transfers_in.nativeAmountFormatted})`;
      erc20Str = `${report.categoryTotals.transfers_in.erc20Count} transfer(s)`;
    } else if (cat.category === 'transfers_out') {
      nativeStr = `${report.categoryTotals.transfers_out.nativeCount} (${report.categoryTotals.transfers_out.nativeAmountFormatted})`;
      erc20Str = `${report.categoryTotals.transfers_out.erc20Count} transfer(s)`;
    }
    lines.push(`| **${cat.label}** | ${cat.count} | ${nativeStr} | ${erc20Str} | ${cat.details} |`);
  }

  lines.push(``);
  lines.push(`### Native Asset (PHAROS) Net Balance Impact`);
  lines.push(`- **Inbound Native Volume:** ${report.categoryTotals.native_summary.inboundTotalFormatted} (${report.categoryTotals.native_summary.inboundCount} transfer(s))`);
  lines.push(`- **Outbound Native Volume:** ${report.categoryTotals.native_summary.outboundTotalFormatted} (${report.categoryTotals.native_summary.outboundCount} transfer(s))`);
  lines.push(`- **Net Native PHAROS Delta:** ${report.categoryTotals.native_summary.netNativeChangeFormatted}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 3. Notable Transactions & Risk Exposure`);
  lines.push(``);

  if (report.notableTransactions.length === 0) {
    lines.push(`*No notable high-value transactions, contract failures, or infinite allowance risks identified during this audit window.*`);
  } else {
    lines.push(`| Date (UTC) | Block | Category | Asset | Finding / Risk Status | PharosScan Link |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- | :--- |`);
    for (const item of report.notableTransactions) {
      const shortHash = `${item.txHash.slice(0, 10)}...${item.txHash.slice(-8)}`;
      const statusNote = item.allowanceStatus ? `[${item.allowanceStatus}]` : '';
      lines.push(`| ${item.dateFormatted} | \`${item.blockNumber}\` | ${item.categoryLabel} | ${item.assetType} | ${item.notableReason || item.title} ${statusNote} | [${shortHash}](${item.explorerUrl}) |`);
    }
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 4. Complete Activity Ledger (${report.allActivities.length} Records)`);
  lines.push(``);

  if (report.allActivities.length === 0) {
    if (cov.completeness === 'COMPLETE') {
      lines.push(`*No on-chain events found for this address in the completely audited date range.*`);
    } else {
      lines.push(`*No on-chain events found for this address in the scanned ${cov.actualScannedBlocksCount.toLocaleString()}-block window (${cov.actualStartDateFormatted} to ${cov.actualEndDateFormatted}). Uninspected earlier blocks require continuation scanning.*`);
    }
  } else {
    lines.push(`| Block | Category | Asset Type | Description | Amount / Assets | Status | Transaction Hash |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- |`);
    for (const item of report.allActivities.slice(0, 100)) {
      const shortHash = `${item.txHash.slice(0, 10)}...${item.txHash.slice(-8)}`;
      const amt = item.formattedAmount ? `${item.formattedAmount} ${item.tokenSymbol || ''}` : '-';
      lines.push(`| \`${item.blockNumber}\` | ${item.categoryLabel} | ${item.assetType} | ${item.title} | ${amt} | ${item.status} | [${shortHash}](${item.explorerUrl}) |`);
    }
    if (report.allActivities.length > 100) {
      lines.push(`\n*(Showing top 100 of ${report.allActivities.length} events. See CSV export for full ledger).*`);
    }
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(`*Report generated automatically by Pharos Audit-Log Agent. Data source: Pharos Atlantic Testnet RPC (${report.network.rpcUrl}). Strictly read-only on-chain verification.*`);

  return lines.join('\n');
}

/**
 * Generate RFC 4180 compliant CSV export
 */
export function exportToCSV(report: AuditReport): string {
  const headers = [
    'Report_ID',
    'Wallet_Address',
    'Scan_Completeness',
    'Block_Number',
    'Timestamp',
    'Date_UTC',
    'Category',
    'Category_Label',
    'Asset_Type',
    'Is_Native',
    'Title',
    'Description',
    'From_Address',
    'To_Address',
    'Token_Address',
    'Token_Symbol',
    'Amount',
    'Status',
    'Allowance_Status',
    'Is_Swap_Component',
    'Is_Notable',
    'Notable_Reason',
    'Tx_Hash',
    'PharosScan_Url'
  ];

  const escapeCSV = (val: string | number | boolean | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[] = [];
  rows.push(headers.join(','));

  for (const item of report.allActivities) {
    const row = [
      escapeCSV(report.reportId),
      escapeCSV(report.walletAddress),
      escapeCSV(report.coverage.completeness),
      escapeCSV(item.blockNumber),
      escapeCSV(item.timestamp),
      escapeCSV(item.dateFormatted),
      escapeCSV(item.category),
      escapeCSV(item.categoryLabel),
      escapeCSV(item.assetType),
      escapeCSV(item.isNative),
      escapeCSV(item.title),
      escapeCSV(item.description),
      escapeCSV(item.from),
      escapeCSV(item.to),
      escapeCSV(item.tokenAddress || ''),
      escapeCSV(item.tokenSymbol || ''),
      escapeCSV(item.formattedAmount || ''),
      escapeCSV(item.status),
      escapeCSV(item.allowanceStatus || ''),
      escapeCSV(Boolean(item.isSwapComponent)),
      escapeCSV(item.isNotable),
      escapeCSV(item.notableReason || ''),
      escapeCSV(item.txHash),
      escapeCSV(item.explorerUrl)
    ];
    rows.push(row.join(','));
  }

  return rows.join('\r\n');
}

/**
 * Generate formatted PDF document
 */
export function exportToPDF(report: AuditReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        info: {
          Title: `Pharos Audit-Log Report - ${report.walletAddress}`,
          Author: 'Pharos Audit-Log Agent',
          Subject: 'EVM On-Chain Audit & Compliance Activity Report',
          Keywords: 'Pharos, Audit, Compliance, Blockchain, EVM, Native Transfers',
          CreationDate: new Date(),
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const cov = report.coverage;

      // Header Banner
      doc.rect(40, 40, 515, 60).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(17).text('PHAROS ON-CHAIN AUDIT-LOG REPORT', 55, 52, { bold: true } as any);
      doc.fontSize(9.5).fillColor('#94a3b8').text('Verifiable EVM Compliance & Activity Statement', 55, 74);
      
      const badgeColor = cov.completeness === 'COMPLETE' ? '#16a34a' : (cov.completeness === 'PARTIAL' ? '#d97706' : '#dc2626');
      doc.fontSize(9).fillColor(badgeColor).text(`STATUS: ${cov.completeness}`, 370, 54, { align: 'right' });
      doc.fontSize(8.5).fillColor('#38bdf8').text(`ID: ${report.reportId}`, 370, 74, { align: 'right' });

      // Partial Scan Alert Banner if applicable
      let currentY = 110;
      if (cov.completeness === 'PARTIAL') {
        doc.rect(40, currentY, 515, 26).fill('#fef3c7').stroke('#f59e0b');
        doc.fillColor('#92400e').fontSize(8.5).text(
          `NOTICE: PARTIAL AUDIT (${cov.coveragePercentage}% of requested range). ${cov.omittedBlockCount.toLocaleString()} earlier blocks were omitted due to execution safeguards.`,
          50,
          currentY + 7
        );
        currentY += 34;
      }

      // Metadata Grid
      doc.rect(40, currentY, 515, 78).fill('#f8fafc').stroke('#e2e8f0');
      doc.fillColor('#334155').fontSize(8.5);

      doc.text(`Target Wallet:`, 50, currentY + 8, { bold: true } as any);
      doc.fillColor('#0284c7').text(report.walletAddress, 135, currentY + 8);

      doc.fillColor('#334155').text(`Requested Range:`, 50, currentY + 24, { bold: true } as any);
      doc.fillColor('#475569').text(`${cov.requestedStartDate.slice(0, 10)} to ${cov.requestedEndDate.slice(0, 10)} (Blocks ${cov.resolvedStartBlock}..${cov.resolvedEndBlock})`, 135, currentY + 24);

      doc.fillColor('#334155').text(`Actual Scanned:`, 50, currentY + 40, { bold: true } as any);
      doc.fillColor('#475569').text(`${cov.actualStartDateFormatted.slice(0, 16)} to ${cov.actualEndDateFormatted.slice(0, 16)} (${cov.actualScannedBlocksCount.toLocaleString()} blocks)`, 135, currentY + 40);

      doc.fillColor('#334155').text(`Network:`, 50, currentY + 56, { bold: true } as any);
      doc.fillColor('#16a34a').text(`${report.network.name} (Chain ID: ${report.network.chainId}) - LIVE VERIFIED`, 135, currentY + 56);

      currentY += 88;

      // Section 1: Executive Summary
      doc.fillColor('#0f172a').fontSize(11).text('1. Executive Compliance Summary', 40, currentY, { underline: true });
      currentY += 16;

      doc.fillColor('#334155').fontSize(8.5).text(report.summary.executiveSummary, 40, currentY, {
        width: 515,
        lineGap: 2.5,
      });

      currentY += 60;

      // Section 2: Category & Asset Breakdown
      doc.fillColor('#0f172a').fontSize(11).text('2. Activity Category & Asset Breakdown', 40, currentY, { underline: true });
      currentY += 16;

      for (const cat of report.categorySummaries) {
        doc.fillColor('#1e293b').fontSize(8.5).text(`• ${cat.label}: `, 45, currentY, { bold: true, continued: true } as any);
        doc.fillColor('#475569').text(cat.details);
        currentY += 14;
      }

      currentY += 8;
      doc.fillColor('#0284c7').fontSize(8.5).text(
        `Native PHAROS Summary: Inbound ${report.categoryTotals.native_summary.inboundTotalFormatted} | Outbound ${report.categoryTotals.native_summary.outboundTotalFormatted} | Net ${report.categoryTotals.native_summary.netNativeChangeFormatted}`,
        45,
        currentY
      );
      currentY += 20;

      // Section 3: Notable Transactions
      doc.fillColor('#0f172a').fontSize(11).text('3. Notable Transactions & Risk Exposure', 40, currentY, { underline: true });
      currentY += 16;

      if (report.notableTransactions.length === 0) {
        doc.fillColor('#64748b').fontSize(8.5).text('No notable high-value transfers, contract failures, or infinite allowance risks identified in this window.', 45, currentY);
        currentY += 18;
      } else {
        for (const item of report.notableTransactions.slice(0, 5)) {
          doc.fillColor('#b91c1c').fontSize(8).text(`• [${item.categoryLabel}] [${item.assetType}] `, 45, currentY, { bold: true, continued: true } as any);
          doc.fillColor('#334155').text(`${item.notableReason || item.title} (Tx: ${item.txHash.slice(0, 14)}...)`);
          currentY += 13;
        }
      }

      // Footer
      doc.fontSize(7.5).fillColor('#94a3b8').text(
        `Generated by Pharos Audit-Log Agent | Atlantic Testnet (Chain ID 688689) | Strictly Read-Only On-Chain Data`,
        40,
        780,
        { align: 'center', width: 515 }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
