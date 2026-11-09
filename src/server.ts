import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateAuditReport } from './services/reportGenerator.js';
import { exportToMarkdown, exportToCSV, exportToPDF } from './services/exporters.js';
import { renderDashboardHtml } from './views.js';
import type { AuditReport } from './types.js';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory cache for recent reports
let latestReportCache: AuditReport | null = null;
const reportStore = new Map<string, AuditReport>();

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
    const { address, startDate, endDate, blockSpan } = req.body;
    if (!address) {
      return res.status(400).json({ success: false, error: 'Missing required field: "address"' });
    }

    const report = await generateAuditReport({
      address: String(address).trim(),
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      blockSpan: blockSpan ? Number(blockSpan) : undefined,
    });

    latestReportCache = report;
    reportStore.set(report.reportId, report);

    res.json({ success: true, report });
  } catch (err: any) {
    console.error('[API] /api/report error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Internal audit processing error' });
  }
});

// Get Latest Report
app.get('/api/report/latest', (_req: Request, res: Response) => {
  if (!latestReportCache) {
    return res.status(404).json({ success: false, error: 'No report has been generated yet.' });
  }
  res.json({ success: true, report: latestReportCache });
});

// Export: Markdown
app.get('/api/export/markdown', async (req: Request, res: Response) => {
  const reportId = req.query.id as string;
  const report = (reportId ? reportStore.get(reportId) : null) || latestReportCache;

  if (!report) {
    return res.status(404).send('No audit report available. Please generate a report first.');
  }

  const markdown = exportToMarkdown(report);
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pharos-audit-${report.walletAddress.slice(2, 8)}.md"`);
  res.send(markdown);
});

// Export: CSV
app.get('/api/export/csv', async (req: Request, res: Response) => {
  const reportId = req.query.id as string;
  const report = (reportId ? reportStore.get(reportId) : null) || latestReportCache;

  if (!report) {
    return res.status(404).send('No audit report available. Please generate a report first.');
  }

  const csv = exportToCSV(report);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pharos-audit-${report.walletAddress.slice(2, 8)}.csv"`);
  res.send(csv);
});

// Export: PDF
app.get('/api/export/pdf', async (req: Request, res: Response) => {
  const reportId = req.query.id as string;
  const report = (reportId ? reportStore.get(reportId) : null) || latestReportCache;

  if (!report) {
    return res.status(404).send('No audit report available. Please generate a report first.');
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
