import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateAuditReport } from './services/reportGenerator.js';
import { exportToMarkdown, exportToCSV, exportToPDF } from './services/exporters.js';
import { renderDashboardHtml } from './views.js';
import { validateAndNormalizeAddress } from './services/addressValidator.js';
import type { AuditReport } from './types.js';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory cache for reports, strictly isolated by wallet address and report ID
// A report for wallet A is NEVER returned or shared with wallet B.
const reportStore = new Map<string, AuditReport>();
const latestReportByWallet = new Map<string, AuditReport>();
const scanSessionStore = new Map<string, AuditReport>();

// Web Dashboard
app.get(['/', '/api'], (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderDashboardHtml());
});

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    agent: 'Pharos Audit-Log Agent',
    network: 'Pharos Atlantic Testnet',
    chainId: Number(process.env.PHAROS_CHAIN_ID || 688689),
    rpcUrl: process.env.PHAROS_RPC_URL || 'https://atlantic.dplabs-internal.com',
    explorer: process.env.PHAROS_EXPLORER_URL || 'https://atlantic.pharosscan.com',
    timestamp: new Date().toISOString(),
  });
});

// Generate Audit Report
app.post('/api/report', async (req: Request, res: Response) => {
  try {
    const { address, startDate, endDate, blockSpan, cursor, continuationState } = req.body;
    if (!address) {
      return res.status(400).json({ success: false, error: 'Missing required field: "address"' });
    }

    // Universal address validation and normalization
    let cleanAddress: string;
    try {
      cleanAddress = validateAndNormalizeAddress(address);
    } catch (valErr: any) {
      return res.status(400).json({ success: false, error: valErr.message });
    }

    // If continuation state is provided, enforce strict address isolation
    if (continuationState && typeof continuationState === 'object' && continuationState.originalTargetAddress) {
      const origClean = validateAndNormalizeAddress(continuationState.originalTargetAddress);
      if (origClean !== cleanAddress) {
        return res.status(400).json({
          success: false,
          error: `Continuation session mismatch: continuation belongs to "${origClean}", but request targeted "${cleanAddress}". Wallet-specific scan sessions are strictly isolated.`
        });
      }
    }

    const report = await generateAuditReport({
      address: cleanAddress,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      blockSpan: blockSpan ? Number(blockSpan) : undefined,
      continuationState: continuationState && typeof continuationState === 'object' ? continuationState : undefined,
      cursor: cursor && typeof cursor === 'object' ? {
        fromBlock: Number(cursor.fromBlock),
        toBlock: Number(cursor.toBlock),
      } : undefined,
    });

    // Store in isolated wallet caches
    const walletKey = cleanAddress.toLowerCase();
    latestReportByWallet.set(walletKey, report);
    reportStore.set(report.reportId, report);

    const sessionKey = `${walletKey}:${report.network.chainId}:${report.startBlock}:${report.endBlock}`;
    scanSessionStore.set(sessionKey, report);

    res.json({ success: true, report });
  } catch (err: any) {
    console.error('[API] /api/report error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Internal audit processing error' });
  }
});

// Get Latest Report for a Specific Wallet
app.get('/api/report/latest', (req: Request, res: Response) => {
  const rawAddress = req.query.address as string;
  if (!rawAddress) {
    return res.status(400).json({
      success: false,
      error: 'Query parameter "address" is required to retrieve the latest wallet audit report. Cross-wallet cache sharing is strictly prohibited.'
    });
  }

  let cleanAddress: string;
  try {
    cleanAddress = validateAndNormalizeAddress(rawAddress);
  } catch (valErr: any) {
    return res.status(400).json({ success: false, error: valErr.message });
  }

  const walletReport = latestReportByWallet.get(cleanAddress.toLowerCase());
  if (!walletReport) {
    return res.status(404).json({
      success: false,
      error: `No report has been generated yet for wallet "${cleanAddress}".`
    });
  }

  res.json({ success: true, report: walletReport });
});

// Helper to resolve report for export without cross-wallet leakage
function resolveExportReport(req: Request): AuditReport | null {
  if (req.body?.report && typeof req.body.report === 'object') {
    return req.body.report as AuditReport;
  }

  const reportId = (req.query.id as string) || (req.body?.id as string);
  if (reportId && reportStore.has(reportId)) {
    const r = reportStore.get(reportId)!;
    const rawAddress = (req.query.address as string) || (req.body?.address as string);
    if (rawAddress) {
      try {
        const clean = validateAndNormalizeAddress(rawAddress);
        if (clean.toLowerCase() !== r.walletAddress.toLowerCase()) {
          return null; // Mismatch protection
        }
      } catch {
        return null;
      }
    }
    return r;
  }

  const rawAddress = (req.query.address as string) || (req.body?.address as string);
  if (rawAddress) {
    try {
      const clean = validateAndNormalizeAddress(rawAddress);
      return latestReportByWallet.get(clean.toLowerCase()) || null;
    } catch {
      return null;
    }
  }

  return null;
}

// Export: Markdown
app.all('/api/export/markdown', async (req: Request, res: Response) => {
  const report = resolveExportReport(req);

  if (!report) {
    return res.status(404).send('No audit report available for the specified wallet. Please generate a report first.');
  }

  const markdown = exportToMarkdown(report);
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pharos-audit-${report.walletAddress.slice(2, 8)}.md"`);
  res.send(markdown);
});

// Export: CSV
app.all('/api/export/csv', async (req: Request, res: Response) => {
  const report = resolveExportReport(req);

  if (!report) {
    return res.status(404).send('No audit report available for the specified wallet. Please generate a report first.');
  }

  const csv = exportToCSV(report);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pharos-audit-${report.walletAddress.slice(2, 8)}.csv"`);
  res.send(csv);
});

// Export: PDF
app.all('/api/export/pdf', async (req: Request, res: Response) => {
  const report = resolveExportReport(req);

  if (!report) {
    return res.status(404).send('No audit report available for the specified wallet. Please generate a report first.');
  }

  try {
    const pdfBuffer = await exportToPDF(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="pharos-audit-${report.walletAddress.slice(2, 8)}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err: any) {
    console.error('[API] PDF generation failed:', err);
    res.status(500).send('Failed to generate PDF document: ' + err?.message);
  }
});

// Start local dev server if executed directly
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Pharos Audit-Log Agent] Listening on http://localhost:${PORT}`);
  });
}

export default app;
