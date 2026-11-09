import PDFDocument from 'pdfkit';
import type { AuditReport, ActivityItem } from '../types.js';

/**
 * Generate comprehensive Markdown report
 */
export function exportToMarkdown(report: AuditReport): string {
  const lines: string[] = [];

  lines.push(`# Pharos On-Chain Audit-Log Report`);
  lines.push(``);
  lines.push(`**Report ID:** \`${report.reportId}\`  `);
  lines.push(`**Generated At:** ${report.generatedAt}  `);
  lines.push(`**Network:** ${report.network.name} (Chain ID: \`${report.network.chainId}\`)  `);
  lines.push(`**Target Wallet:** \`${report.walletAddress}\`  `);
  lines.push(`**Audit Period:** ${report.startDate.slice(0, 10)} to ${report.endDate.slice(0, 10)} (Blocks: \`${report.startBlock}\` .. \`${report.endBlock}\`)  `);
  lines.push(`**On-Chain Verification:** ${report.provenance.verifiedOnChain ? 'VERIFIED LIVE (Read-Only)' : 'UNVERIFIED'}  `);
  lines.push(`**Data Provenance:** ${report.provenance.rawLogsRetrieved} raw node logs retrieved, ${report.provenance.deduplicatedEventsCount} unique verified records normalized.  `);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 1. Executive Compliance Summary`);
  lines.push(``);
  lines.push(report.summary.executiveSummary);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 2. Activity Category Breakdown`);
  lines.push(``);
  lines.push(`| Category | Count | Classification Details |`);
  lines.push(`| :--- | :--- | :--- |`);

  for (const cat of report.categorySummaries) {
    lines.push(`| **${cat.label}** | ${cat.count} | ${cat.details} |`);
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 3. Notable Transactions & Risk Exposure`);
  lines.push(``);

  if (report.notableTransactions.length === 0) {
    lines.push(`*No notable high-value transactions or infinite allowance risks identified during this audit window.*`);
  } else {
    lines.push(`| Date (UTC) | Block | Category | Finding / Risk Status | PharosScan Link |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);
    for (const item of report.notableTransactions) {
      const shortHash = `${item.txHash.slice(0, 10)}...${item.txHash.slice(-8)}`;
      const statusNote = item.allowanceStatus ? `[${item.allowanceStatus}]` : '';
      lines.push(`| ${item.dateFormatted} | \`${item.blockNumber}\` | ${item.categoryLabel} | ${item.notableReason || item.title} ${statusNote} | [${shortHash}](${item.explorerUrl}) |`);
    }
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 4. Complete Activity Ledger (${report.allActivities.length} Events)`);
  lines.push(``);

  if (report.allActivities.length === 0) {
    lines.push(`*No on-chain events found for this address in the selected date range.*`);
  } else {
    lines.push(`| Block | Category | Description | Amount / Assets | Transaction Hash |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);
    for (const item of report.allActivities.slice(0, 100)) {
      const shortHash = `${item.txHash.slice(0, 10)}...${item.txHash.slice(-8)}`;
      const amt = item.formattedAmount ? `${item.formattedAmount} ${item.tokenSymbol || ''}` : '-';
      lines.push(`| \`${item.blockNumber}\` | ${item.categoryLabel} | ${item.title} | ${amt} | [${shortHash}](${item.explorerUrl}) |`);
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
    'Block_Number',
    'Timestamp',
    'Date_UTC',
    'Category',
    'Category_Label',
    'Title',
    'Description',
    'From_Address',
    'To_Address',
    'Token_Address',
    'Token_Symbol',
    'Amount',
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
      escapeCSV(item.blockNumber),
      escapeCSV(item.timestamp),
      escapeCSV(item.dateFormatted),
      escapeCSV(item.category),
      escapeCSV(item.categoryLabel),
      escapeCSV(item.title),
      escapeCSV(item.description),
      escapeCSV(item.from),
      escapeCSV(item.to),
      escapeCSV(item.tokenAddress || ''),
      escapeCSV(item.tokenSymbol || ''),
      escapeCSV(item.formattedAmount || ''),
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
          Keywords: 'Pharos, Audit, Compliance, Blockchain, EVM',
          CreationDate: new Date(),
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Header Banner
      doc.rect(40, 40, 515, 60).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(18).text('PHAROS ON-CHAIN AUDIT-LOG REPORT', 55, 52, { bold: true } as any);
      doc.fontSize(10).fillColor('#94a3b8').text('Verifiable EVM Compliance & Activity Statement', 55, 75);
      doc.fontSize(9).fillColor('#38bdf8').text(`ID: ${report.reportId}`, 380, 75, { align: 'right' });

      doc.moveDown(3);

      // Metadata Grid
      const metaY = 115;
      doc.rect(40, metaY, 515, 70).fill('#f8fafc').stroke('#e2e8f0');
      doc.fillColor('#334155').fontSize(9);
      
      doc.text(`Target Wallet:`, 50, metaY + 10, { bold: true } as any);
      doc.fillColor('#0284c7').text(report.walletAddress, 130, metaY + 10);

      doc.fillColor('#334155').text(`Audit Range:`, 50, metaY + 28, { bold: true } as any);
      doc.fillColor('#475569').text(`${report.startDate.slice(0, 10)} to ${report.endDate.slice(0, 10)} (Blocks ${report.startBlock}..${report.endBlock})`, 130, metaY + 28);

      doc.fillColor('#334155').text(`Network:`, 50, metaY + 46, { bold: true } as any);
      doc.fillColor('#16a34a').text(`${report.network.name} (Chain ID: ${report.network.chainId}) - VERIFIED ON-CHAIN`, 130, metaY + 46);

      // Section: Executive Summary
      let currentY = 200;
      doc.fillColor('#0f172a').fontSize(13).text('1. Executive Compliance Summary', 40, currentY, { underline: true });
      currentY += 20;

      doc.fillColor('#334155').fontSize(9.5).text(report.summary.executiveSummary, 40, currentY, {
        width: 515,
        lineGap: 3,
      });

      currentY = doc.y + 20;

      // Section: Category Breakdown
      doc.fillColor('#0f172a').fontSize(13).text('2. Activity Category Breakdown', 40, currentY, { underline: true });
      currentY += 22;

      // Table Header
      doc.rect(40, currentY, 515, 20).fill('#e2e8f0');
      doc.fillColor('#1e293b').fontSize(9);
      doc.text('Category', 50, currentY + 5, { bold: true } as any);
      doc.text('Count', 180, currentY + 5, { bold: true } as any);
      doc.text('Details', 240, currentY + 5, { bold: true } as any);
      currentY += 20;

      // Table Rows
      for (const cat of report.categorySummaries) {
        doc.rect(40, currentY, 515, 20).fill(cat.count > 0 ? '#ffffff' : '#f8fafc').stroke('#f1f5f9');
        doc.fillColor('#0f172a').text(cat.label, 50, currentY + 5);
        doc.fillColor(cat.count > 0 ? '#0284c7' : '#94a3b8').text(String(cat.count), 180, currentY + 5);
        doc.fillColor('#475569').text(cat.details.slice(0, 60), 240, currentY + 5);
        currentY += 20;
      }

      currentY += 20;

      if (currentY > 650) {
        doc.addPage();
        currentY = 40;
      }

      // Section: Notable Transactions
      doc.fillColor('#0f172a').fontSize(13).text('3. Notable Transactions & Risk Exposure', 40, currentY, { underline: true });
      currentY += 22;

      if (report.notableTransactions.length === 0) {
        doc.fillColor('#64748b').fontSize(9.5).text('No notable high-value transactions or infinite allowance risks detected.', 40, currentY);
        currentY += 20;
      } else {
        doc.rect(40, currentY, 515, 20).fill('#e2e8f0');
        doc.fillColor('#1e293b').fontSize(9);
        doc.text('Block', 50, currentY + 5, { bold: true } as any);
        doc.text('Category', 110, currentY + 5, { bold: true } as any);
        doc.text('Finding / Risk Status', 200, currentY + 5, { bold: true } as any);
        doc.text('Explorer Link', 420, currentY + 5, { bold: true } as any);
        currentY += 20;

        for (const item of report.notableTransactions.slice(0, 10)) {
          if (currentY > 750) {
            doc.addPage();
            currentY = 40;
          }

          doc.rect(40, currentY, 515, 22).fill('#ffffff').stroke('#f1f5f9');
          doc.fillColor('#334155').fontSize(8.5).text(String(item.blockNumber), 50, currentY + 6);
          doc.fillColor('#0284c7').text(item.categoryLabel, 110, currentY + 6);
          doc.fillColor('#b91c1c').text((item.notableReason || item.title).slice(0, 42), 200, currentY + 6);
          
          doc.fillColor('#2563eb').text('View on PharosScan', 420, currentY + 6, {
            link: item.explorerUrl,
            underline: true,
          });

          currentY += 22;
        }
      }

      // Footer
      const pages = doc.bufferedPageRange();
      doc.fontSize(8).fillColor('#94a3b8').text(
        `Pharos Audit-Log Agent | Atlantic Testnet | ${report.generatedAt} | Read-Only Verifiable Ledger`,
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
