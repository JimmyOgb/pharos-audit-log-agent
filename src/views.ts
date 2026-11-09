export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pharos Audit-Log Agent — EVM On-Chain Compliance Reporting</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --card-border: #1f2937;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --accent: #8b5cf6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: rgba(17, 24, 39, 0.8);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--card-border);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .brand-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: #fff;
    }
    .brand-title {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .network-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #10b981;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .network-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 8px #10b981;
    }
    main {
      flex: 1;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      width: 100%;
    }
    .hero {
      margin-bottom: 2rem;
    }
    .hero h1 {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 0.5rem;
    }
    .hero p {
      color: var(--text-muted);
      font-size: 1rem;
      max-width: 760px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .form-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr auto;
      gap: 1rem;
      align-items: end;
    }
    @media (max-width: 900px) {
      .form-grid { grid-template-columns: 1fr; }
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .form-group label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
    }
    input, select {
      background: #0d131f;
      border: 1px solid #374151;
      color: #fff;
      padding: 0.65rem 0.9rem;
      border-radius: 8px;
      font-size: 0.95rem;
      outline: none;
      font-family: inherit;
    }
    input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }
    .quick-addresses {
      margin-top: 0.75rem;
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .quick-btn {
      background: #1f2937;
      border: 1px solid #374151;
      color: #94a3b8;
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      transition: all 0.15s ease;
    }
    .quick-btn:hover {
      background: #374151;
      color: #fff;
    }
    .btn-submit {
      background: var(--primary);
      color: #fff;
      border: none;
      padding: 0.7rem 1.25rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: background 0.15s;
    }
    .btn-submit:hover:not(:disabled) {
      background: var(--primary-hover);
    }
    .btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-reset {
      background: #374151;
      color: #94a3b8;
      border: none;
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-reset:hover {
      background: #4b5563;
      color: #fff;
    }
    .summary-card {
      border-left: 4px solid var(--primary);
    }
    .summary-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.25rem;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .summary-title {
      font-size: 1.25rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }
    .export-btns {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .btn-export {
      background: #1f2937;
      border: 1px solid #374151;
      color: #e5e7eb;
      padding: 0.45rem 0.85rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.15s;
    }
    .btn-export:hover {
      background: #374151;
      border-color: #4b5563;
    }
    .btn-export-primary {
      background: rgba(59, 130, 246, 0.15);
      border-color: rgba(59, 130, 246, 0.4);
      color: #60a5fa;
    }
    .btn-export-primary:hover {
      background: rgba(59, 130, 246, 0.25);
    }
    .narrative-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 1.1rem;
      margin-bottom: 1.25rem;
      line-height: 1.6;
      font-size: 0.95rem;
      color: #cbd5e1;
    }
    .categories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .cat-card {
      background: #0d131f;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 1rem;
    }
    .cat-name {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 0.35rem;
    }
    .cat-count {
      font-size: 1.75rem;
      font-weight: 700;
      color: #fff;
    }
    .cat-detail {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 0.25rem;
    }
    .table-container {
      overflow-x: auto;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      background: #0d131f;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.85rem;
    }
    th {
      background: #111827;
      padding: 0.75rem 1rem;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--card-border);
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }
    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #1f2937;
      color: #d1d5db;
    }
    tr:hover td {
      background: rgba(30, 41, 59, 0.4);
    }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-transfers_in { background: rgba(16, 185, 129, 0.15); color: #10b981; }
    .badge-transfers_out { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
    .badge-swaps { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
    .badge-token_approvals { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .badge-contract_interactions { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
    .link-explorer {
      color: #38bdf8;
      text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
    }
    .link-explorer:hover {
      text-decoration: underline;
    }
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 0.8s ease-in-out infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    footer {
      border-top: 1px solid var(--card-border);
      padding: 1.5rem 2rem;
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: auto;
    }
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <div class="brand-icon">P</div>
      <div class="brand-title">Pharos Audit-Log Agent</div>
    </div>
    <div class="network-badge">
      <span class="network-dot"></span>
      Atlantic Testnet (688689)
    </div>
  </header>

  <main>
    <div class="hero">
      <h1>On-Chain Compliance Activity Audit</h1>
      <p>Analyze genuine historical activity for any EVM wallet on Pharos Atlantic Testnet. Verifies native transfers, ERC-20 movements, DEX swaps, and token allowances with instant Markdown, PDF, and CSV exports.</p>
    </div>

    <div class="card">
      <form id="auditForm" onsubmit="handleAuditSubmit(event)">
        <div class="form-grid">
          <div class="form-group">
            <label for="addressInput">EVM Wallet Address</label>
            <input 
              type="text" 
              id="addressInput" 
              placeholder="0x... (Enter any valid EVM wallet address)" 
              required 
              autocomplete="off"
              spellcheck="false"
              oninput="handleAddressChange()"
            />
          </div>
          <div class="form-group">
            <label for="startDate">Start Date</label>
            <input type="date" id="startDate" />
          </div>
          <div class="form-group">
            <label for="endDate">End Date</label>
            <input type="date" id="endDate" />
          </div>
          <div class="form-group">
            <button type="submit" class="btn-submit" id="btnSubmit">
              <span id="btnText">Generate Audit</span>
              <span id="btnSpinner" class="spinner" style="display: none;"></span>
            </button>
          </div>
        </div>

        <div class="quick-addresses">
          <span style="font-size: 0.8rem; color: #64748b;">Sample Wallets:</span>
          <button type="button" class="quick-btn" onclick="setWallet('0xE4220c4b71877bb94EB173f467ef5c5557017085')">0xE422...7085 (Target: Swaps & Outbound)</button>
          <button type="button" class="quick-btn" onclick="setWallet('0x70997970c51812dc3a010c7d01b50e0d17dc79c8')">0x7099...dc79 (Counterparty: Inbound Native)</button>
          <button type="button" class="quick-btn" onclick="setWallet('0x89b97db15f0bc3b12c8a2e4ae8549788c0823838')">0x89b9...3838 (Active Token User)</button>
          <button type="button" class="quick-btn" onclick="setWallet('0x196fc6aab375e4999dd5f23522bc8ece986b1493')">0x196f...1493 (Faucet/Funding)</button>
          <button type="button" class="quick-btn" onclick="setWallet('0x000000000000000000000000000000000000dead')">0x0000...dead (Zero-Activity Safeguard)</button>
          <span style="font-size: 0.8rem; color: #64748b; margin-left: 0.5rem;">Date Presets:</span>
          <button type="button" class="quick-btn" onclick="setDateRange('2026-10-15', '2026-11-09')">Active Window (Oct–Nov 2026)</button>
          <button type="button" class="quick-btn" onclick="setDateRange('2025-09-28', '2026-11-09')">Genesis Full Range</button>
          <button type="button" class="btn-reset" onclick="clearSavedSession()" id="btnClearSession" style="display: none; margin-left: auto;">🗑️ Reset Saved Session</button>
        </div>
      </form>
    </div>

    <div id="restoredNotice" style="display: none; background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.35); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; font-size: 0.85rem; color: #93c5fd; display: flex; justify-content: space-between; align-items: center;">
      <span id="restoredNoticeText">📂 Restored active audit session from local storage.</span>
      <button type="button" onclick="clearSavedSession()" style="background: none; border: 1px solid #3b82f6; color: #93c5fd; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">Clear Session</button>
    </div>

    <div id="resultsContainer" style="display: none;">
      <!-- Results will be injected here -->
    </div>
  </main>

  <footer>
    Pharos Audit-Log Agent • Atlantic Testnet (Chain ID 688689) • Genesis Block 1: 2025-09-28T07:16:24Z • Strictly Read-Only Verifiable Ledger
  </footer>

  <script>
    const STORAGE_PREFIX = 'pharos_audit_session_';
    const LAST_WALLET_KEY = 'pharos_audit_last_wallet';
    let currentReport = null;
    let currentContinuationState = null;
    let isAutoScanning = false;
    let pauseRequested = false;
    let activeScanRequestId = 0;

    function getStorageKey(addr) {
      return STORAGE_PREFIX + (addr || '').trim().toLowerCase();
    }

    window.addEventListener('DOMContentLoaded', () => {
      const today = new Date();
      const past7 = new Date();
      past7.setDate(today.getDate() - 7);
      
      document.getElementById('endDate').value = today.toISOString().slice(0, 10);
      document.getElementById('startDate').value = past7.toISOString().slice(0, 10);

      // Check if there was a last active wallet
      try {
        const lastWallet = localStorage.getItem(LAST_WALLET_KEY);
        if (lastWallet) {
          document.getElementById('addressInput').value = lastWallet;
          restoreWalletSession(lastWallet);
        }
      } catch (err) {
        console.warn('Could not restore last wallet:', err);
      }
    });

    function handleAddressChange() {
      // Invalidate any active background fetch immediately
      activeScanRequestId++;
      const inputAddr = document.getElementById('addressInput').value.trim();
      if (!inputAddr) {
        currentReport = null;
        currentContinuationState = null;
        document.getElementById('resultsContainer').style.display = 'none';
        document.getElementById('restoredNotice').style.display = 'none';
        document.getElementById('btnClearSession').style.display = 'none';
        return;
      }

      // If user typed a different address than current report, isolate immediately
      if (!currentReport || currentReport.walletAddress.toLowerCase() !== inputAddr.toLowerCase()) {
        currentContinuationState = null;
        restoreWalletSession(inputAddr);
      }
    }

    function restoreWalletSession(addr) {
      try {
        const saved = localStorage.getItem(getStorageKey(addr));
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.walletAddress && parsed.walletAddress.toLowerCase() === addr.toLowerCase() && parsed.coverage) {
            currentReport = parsed;
            currentContinuationState = parsed.continuationState || null;
            if (parsed.coverage.requestedStartDate) {
              document.getElementById('startDate').value = parsed.coverage.requestedStartDate.slice(0, 10);
            }
            if (parsed.coverage.requestedEndDate) {
              document.getElementById('endDate').value = parsed.coverage.requestedEndDate.slice(0, 10);
            }
            document.getElementById('restoredNoticeText').innerText = '📂 Restored active session for ' + parsed.walletAddress;
            document.getElementById('restoredNotice').style.display = 'flex';
            document.getElementById('btnClearSession').style.display = 'inline-block';
            renderReport(parsed, false);
            return;
          }
        }
      } catch (err) {
        console.warn('Could not restore wallet session:', err);
      }

      // If no saved session for this address, isolate UI by hiding previous results
      currentReport = null;
      currentContinuationState = null;
      document.getElementById('resultsContainer').style.display = 'none';
      document.getElementById('restoredNotice').style.display = 'none';
      document.getElementById('btnClearSession').style.display = 'none';
    }

    function setWallet(addr) {
      document.getElementById('addressInput').value = addr;
      handleAddressChange();
    }

    function setDateRange(start, end) {
      document.getElementById('startDate').value = start;
      document.getElementById('endDate').value = end;
    }

    function clearSavedSession() {
      const inputAddr = document.getElementById('addressInput').value.trim();
      if (inputAddr) {
        try {
          localStorage.removeItem(getStorageKey(inputAddr));
          localStorage.removeItem(LAST_WALLET_KEY);
        } catch {}
      }
      currentReport = null;
      currentContinuationState = null;
      document.getElementById('resultsContainer').style.display = 'none';
      document.getElementById('restoredNotice').style.display = 'none';
      document.getElementById('btnClearSession').style.display = 'none';
    }

    async function handleAuditSubmit(e) {
      e.preventDefault();
      const address = document.getElementById('addressInput').value.trim();
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;

      const thisReqId = ++activeScanRequestId;

      const btnSubmit = document.getElementById('btnSubmit');
      const btnText = document.getElementById('btnText');
      const btnSpinner = document.getElementById('btnSpinner');

      btnSubmit.disabled = true;
      btnText.innerText = 'Retrieving from Official Pharos MCP...';
      btnSpinner.style.display = 'inline-block';

      try {
        const resp = await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, startDate, endDate })
        });

        if (thisReqId !== activeScanRequestId) return; // Discard stale response

        const data = await resp.json();
        if (!data.success) {
          alert('Error generating report: ' + (data.error || 'Unknown error'));
          return;
        }

        currentReport = data.report;
        currentContinuationState = data.report.continuationState || null;
        renderReport(currentReport);
      } catch (err) {
        if (thisReqId !== activeScanRequestId) return;
        alert('Network error connecting to Pharos MCP / RPC node: ' + err.message);
      } finally {
        if (thisReqId === activeScanRequestId) {
          btnSubmit.disabled = false;
          btnText.innerText = 'Generate Audit';
          btnSpinner.style.display = 'none';
        }
      }
    }

    function renderReport(r) {
      const container = document.getElementById('resultsContainer');
      container.style.display = 'block';

      // Persist report in localStorage strictly isolated by wallet address
      try {
        localStorage.setItem(getStorageKey(r.walletAddress), JSON.stringify(r));
        localStorage.setItem(LAST_WALLET_KEY, r.walletAddress);
        document.getElementById('btnClearSession').style.display = 'inline-block';
      } catch (e) {
        console.warn('Could not save session to localStorage:', e);
      }

      const catMap = {};
      r.categorySummaries.forEach(c => { catMap[c.category] = c; });

      const cov = r.coverage || {};
      const statusColor = cov.completeness === 'COMPLETE' ? '#10b981' : (cov.completeness === 'PARTIAL' ? '#f59e0b' : '#ef4444');
      const statusBg = cov.completeness === 'COMPLETE' ? 'rgba(16, 185, 129, 0.1)' : (cov.completeness === 'PARTIAL' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)');

      const totalScanned = cov.cumulativeScannedBlocksCount || (r.continuationState ? r.continuationState.totalScannedBlocks : cov.actualScannedBlocksCount);
      const totalReq = cov.requestedBlockSpan || (r.continuationState ? r.continuationState.totalRequestedBlocks : totalScanned);
      const remaining = cov.omittedBlockCount || 0;
      const cumStartB = cov.cumulativeStartBlock ?? cov.actualStartBlock;
      const cumEndB = cov.cumulativeEndBlock ?? cov.actualEndBlock;

      let partialNoticeHtml = '';
      if (cov.completeness === 'PARTIAL') {
        let actionBtns = '';
        if (r.continuationState) {
          actionBtns = '<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">' +
            '<button type="button" onclick="continueScan()" style="background: #f59e0b; color: #000; border: none; font-weight: 700; padding: 0.45rem 0.9rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">⏭️ Scan Next Chunk (3,000 blocks)</button>' +
            (isAutoScanning 
              ? '<button type="button" id="btnPauseScan" onclick="pauseAutoScan()" style="background: #ef4444; color: #fff; border: none; font-weight: 700; padding: 0.45rem 0.9rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">⏸️ Pause Auto-Scan</button>'
              : '<button type="button" id="btnAutoScan" onclick="autoScanAll()" style="background: #3b82f6; color: #fff; border: none; font-weight: 700; padding: 0.45rem 0.9rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">⚡ Auto-Scan Remaining</button>'
            ) +
          '</div>';
        } else if (cov.continuationCursor) {
          actionBtns = '<button type="button" onclick="continueScan()" style="background: #f59e0b; color: #000; border: none; font-weight: 700; padding: 0.45rem 0.9rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">⏭️ Scan Next Chunk</button>';
        }

        partialNoticeHtml = '<div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 8px; padding: 0.9rem 1.1rem; margin-bottom: 1.25rem;">' +
          '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">' +
            '<div>' +
              '<strong style="color: #f59e0b;">⚠️ Partial Audit Coverage (' + (cov.coveragePercentage || 0) + '%):</strong> ' +
              '<span style="font-size: 0.85rem; color: #cbd5e1;">Cumulatively scanned ' + (totalScanned ? totalScanned.toLocaleString() : 0) + ' of ' + (totalReq ? totalReq.toLocaleString() : 0) + ' requested blocks across ' + (cov.scannedChunksCount || 1) + ' chunk(s). ' + (remaining ? remaining.toLocaleString() : 0) + ' remaining blocks uninspected.</span>' +
            '</div>' +
            actionBtns +
          '</div>' +
          '<div style="background: #1f2937; border-radius: 9999px; height: 6px; width: 100%; margin-top: 0.75rem; overflow: hidden;">' +
            '<div style="background: #f59e0b; height: 100%; width: ' + Math.min(100, (cov.coveragePercentage || 0)) + '%; transition: width 0.3s ease;"></div>' +
          '</div>' +
        '</div>';
      }

      let notableRows = '';
      if (r.notableTransactions.length === 0) {
        notableRows = '<tr><td colspan="5" style="text-align: center; color: #9ca3af;">No notable high-value transactions, contract failures, or infinite allowance risks identified.</td></tr>';
      } else {
        notableRows = r.notableTransactions.map(t => {
          let valDisplay = '-';
          if (t.category === 'token_approvals' && (t.isUnlimited || (t.details && t.details.includes('Infinite')))) {
            valDisplay = 'Unlimited ' + (t.tokenSymbol || 'ERC-20');
          } else if (t.formattedAmount) {
            valDisplay = t.formattedAmount + ' ' + (t.tokenSymbol || '');
          }
          return \`
          <tr>
            <td>\${t.dateFormatted}</td>
            <td><span class="badge badge-\${t.category}">\${t.categoryLabel}</span></td>
            <td><strong>\${t.title}</strong><br><span style="font-size: 0.75rem; color: #ef4444;">\${t.notableReason || t.details || ''}</span></td>
            <td style="font-family: 'JetBrains Mono', monospace;">\${valDisplay}</td>
            <td><a href="\${t.explorerUrl}" target="_blank" rel="noopener" class="link-explorer">\${t.txHash.slice(0, 8)}...\${t.txHash.slice(-6)} ↗</a></td>
          </tr>
        \`;
        }).join('');
      }

      let allRows = '';
      if (r.allActivities.length === 0) {
        allRows = \`<tr><td colspan="8" style="text-align: center; color: #9ca3af;">Zero activities detected in cumulatively scanned window (\${totalScanned ? totalScanned.toLocaleString() : 0} blocks; \${r.startDate} to \${r.endDate}).</td></tr>\`;
      } else {
        allRows = r.allActivities.slice(0, 100).map(t => \`
          <tr>
            <td style="font-family: 'JetBrains Mono', monospace;">\${t.blockNumber}</td>
            <td>\${t.dateFormatted}</td>
            <td><span class="badge badge-\${t.category}">\${t.categoryLabel}</span></td>
            <td><span style="font-size: 0.75rem; background: #1e293b; padding: 0.2rem 0.4rem; border-radius: 4px;">\${t.assetType || (t.tokenSymbol ? 'ERC20' : 'PHAROS')}</span></td>
            <td>\${t.title}</td>
            <td style="font-family: 'JetBrains Mono', monospace;">\${t.formattedAmount ? t.formattedAmount + ' ' + (t.tokenSymbol || '') : '-'}</td>
            <td><span style="font-size: 0.75rem; color: \${t.status === 'REVERTED' ? '#ef4444' : '#10b981'}; font-weight: 600;">\${t.status || 'SUCCESS'}</span></td>
            <td><a href="\${t.explorerUrl}" target="_blank" rel="noopener" class="link-explorer">\${t.txHash.slice(0, 8)}...\${t.txHash.slice(-6)} ↗</a></td>
          </tr>
        \`).join('');
      }

      const genesisBadge = cov.genesisClamped && cov.genesisNotice
        ? \`<div style="color: #38bdf8; font-size: 0.8rem; margin-top: 0.25rem;">ℹ️ \${cov.genesisNotice}</div>\`
        : '';

      container.innerHTML = \`
        <div class="card summary-card">
          <div class="summary-header">
            <div>
              <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <div class="summary-title">Audit Report: \${r.walletAddress}</div>
                <span style="background: \${statusBg}; border: 1px solid \${statusColor}; color: \${statusColor}; padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700;">
                  STATUS: \${cov.completeness || 'COMPLETE'}
                </span>
              </div>
              <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.4rem; line-height: 1.5;">
                <div><strong>Requested Period:</strong> \${cov.requestedStartDate ? cov.requestedStartDate.slice(0, 10) : ''} to \${cov.requestedEndDate ? cov.requestedEndDate.slice(0, 10) : ''} (Blocks \${(cov.resolvedStartBlock || 0).toLocaleString()} .. \${(cov.resolvedEndBlock || 0).toLocaleString()}; \${(cov.requestedBlockSpan || 0).toLocaleString()} blocks)</div>
                \${genesisBadge}
                <div style="margin-top: 0.25rem;"><strong>Cumulative Scanned Coverage:</strong> <span style="color: #f3f4f6; font-weight: 600;">\${r.startDate} to \${r.endDate}</span> (Blocks \${cumStartB.toLocaleString()} .. \${cumEndB.toLocaleString()}; <strong>\${totalScanned.toLocaleString()} blocks scanned</strong> across \${cov.scannedChunksCount || 1} chunk(s))</div>
                \${cov.completeness === 'PARTIAL' ? \`<div style="color: #f59e0b; font-size: 0.8rem; margin-top: 0.15rem;">Latest Chunk: Blocks \${(cov.actualStartBlock || 0).toLocaleString()} .. \${(cov.actualEndBlock || 0).toLocaleString()} (\${(cov.actualScannedBlocksCount || 0).toLocaleString()} blocks) • \${(cov.omittedBlockCount || 0).toLocaleString()} remaining blocks uninspected</div>\` : ''}
              </div>
            </div>
            <div class="export-btns">
              <button type="button" onclick="exportFile('markdown')" class="btn-export">
                📄 Markdown (.md)
              </button>
              <button type="button" onclick="exportFile('pdf')" class="btn-export btn-export-primary">
                📑 PDF Report (.pdf)
              </button>
              <button type="button" onclick="exportFile('csv')" class="btn-export">
                📊 CSV Ledger (.csv)
              </button>
            </div>
          </div>

          \${partialNoticeHtml}

          <div class="narrative-box">
            <strong>Executive Compliance Summary:</strong><br>
            \${r.summary.executiveSummary}
          </div>

          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; font-size: 0.85rem;">
            <strong style="color: #38bdf8;">Native Asset (PHAROS) Net Balance Impact:</strong>
            <span style="color: #94a3b8; margin-left: 0.5rem;">
              Inbound: <strong>\${r.categoryTotals.native_summary ? r.categoryTotals.native_summary.inboundTotalFormatted : '0.0000 PHAROS'}</strong> (\${r.categoryTotals.native_summary ? r.categoryTotals.native_summary.inboundCount : 0}) • 
              Outbound: <strong>\${r.categoryTotals.native_summary ? r.categoryTotals.native_summary.outboundTotalFormatted : '0.0000 PHAROS'}</strong> (\${r.categoryTotals.native_summary ? r.categoryTotals.native_summary.outboundCount : 0}) • 
              Net Delta: <strong style="color: #10b981;">\${r.categoryTotals.native_summary ? r.categoryTotals.native_summary.netNativeChangeFormatted : '0.0000 PHAROS'}</strong>
            </span>
          </div>

          <div class="categories-grid">
            <div class="cat-card">
              <div class="cat-name">TRANSFERS IN</div>
              <div class="cat-count">\${catMap['transfers_in'] ? catMap['transfers_in'].count : 0}</div>
              <div class="cat-detail">\${r.categoryTotals.transfers_in.uniqueSenders || 0} unique senders</div>
            </div>
            <div class="cat-card">
              <div class="cat-name">TRANSFERS OUT</div>
              <div class="cat-count">\${catMap['transfers_out'] ? catMap['transfers_out'].count : 0}</div>
              <div class="cat-detail">\${r.categoryTotals.transfers_out.uniqueRecipients || 0} unique recipients</div>
            </div>
            <div class="cat-card">
              <div class="cat-name">SWAPS</div>
              <div class="cat-count">\${catMap['swaps'] ? catMap['swaps'].count : 0}</div>
              <div class="cat-detail">Uniswap / AMM Liquidity</div>
            </div>
            <div class="cat-card">
              <div class="cat-name">TOKEN APPROVALS</div>
              <div class="cat-count">\${catMap['token_approvals'] ? catMap['token_approvals'].count : 0}</div>
              <div class="cat-detail">\${r.categoryTotals.token_approvals.unlimitedApprovals || r.categoryTotals.token_approvals.currentVerifiedUnlimited || 0} unlimited allowances</div>
            </div>
            <div class="cat-card">
              <div class="cat-name">CONTRACT CALLS</div>
              <div class="cat-count">\${catMap['contract_interactions'] ? catMap['contract_interactions'].count : 0}</div>
              <div class="cat-detail">Smart Contract Invocation</div>
            </div>
          </div>

          <h3 style="font-size: 1.1rem; margin-bottom: 0.75rem;">Notable Transactions & Risk Alerts (\${r.notableTransactions.length})</h3>
          <div class="table-container" style="margin-bottom: 1.5rem;">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Category</th>
                  <th>Finding / Details</th>
                  <th>Value</th>
                  <th>PharosScan</th>
                </tr>
              </thead>
              <tbody>
                \${notableRows}
              </tbody>
            </table>
          </div>

          <h3 style="font-size: 1.1rem; margin-bottom: 0.75rem;">Complete On-Chain Activity Ledger (\${r.allActivities.length} Total Events)</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Block</th>
                  <th>Timestamp</th>
                  <th>Category</th>
                  <th>Asset</th>
                  <th>Action Summary</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>PharosScan</th>
                </tr>
              </thead>
              <tbody>
                \${allRows}
              </tbody>
            </table>
          </div>
        </div>
      \`;
      
      if (!isAutoScanning) {
        container.scrollIntoView({ behavior: 'smooth' });
      }
    }

    async function continueScan(isAuto = false) {
      if (!currentReport) {
        alert('No active audit report to continue.');
        return false;
      }

      const inputAddr = document.getElementById('addressInput').value.trim();
      if (inputAddr && inputAddr.toLowerCase() !== currentReport.walletAddress.toLowerCase()) {
        alert('The wallet address in the input field (' + inputAddr + ') does not match the active scan session (' + currentReport.walletAddress + '). Please click "Generate Audit" to initiate an independent scan.');
        return false;
      }

      const btnSubmit = document.getElementById('btnSubmit');
      const btnText = document.getElementById('btnText');
      const btnSpinner = document.getElementById('btnSpinner');

      if (!isAuto) {
        btnSubmit.disabled = true;
        btnText.innerText = 'Scanning Chunk...';
        btnSpinner.style.display = 'inline-block';
      }

      let retries = 0;
      while (retries < 3) {
        try {
          const payload = {
            address: currentReport.walletAddress,
          };

          if (currentContinuationState) {
            payload.continuationState = currentContinuationState;
          } else if (currentReport.coverage && currentReport.coverage.continuationCursor) {
            payload.cursor = currentReport.coverage.continuationCursor;
          } else {
            alert('Audit is already complete or no continuation available.');
            return false;
          }

          const resp = await fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!resp.ok) {
            const errBody = await resp.text();
            throw new Error('HTTP ' + resp.status + ': ' + errBody.slice(0, 120));
          }

          const data = await resp.json();
          if (data.success && data.report) {
            currentReport = data.report;
            currentContinuationState = data.report.continuationState || null;
            renderReport(currentReport);
            return true;
          } else {
            throw new Error(data.error || 'Unknown error');
          }
        } catch (e) {
          retries++;
          if (retries >= 3) {
            console.warn('[Audit] Continuation halted after retries:', e.message);
            if (!isAuto) {
              alert('Continuation halted after retries: ' + e.message);
            }
            return false;
          }
          await new Promise(r => setTimeout(r, 1200));
        }
      }
      return false;
    }

    function pauseAutoScan() {
      pauseRequested = true;
      const pauseBtn = document.getElementById('btnPauseScan');
      if (pauseBtn) {
        pauseBtn.disabled = true;
        pauseBtn.innerText = 'Pausing...';
      }
    }

    async function autoScanAll() {
      if (isAutoScanning) return;
      isAutoScanning = true;
      pauseRequested = false;

      renderReport(currentReport); // updates buttons to show pause button

      let chunksProcessed = 0;
      const maxChunks = 2000;

      while (currentContinuationState && !currentReport.coverage.isComplete && chunksProcessed < maxChunks) {
        if (pauseRequested) {
          break;
        }
        chunksProcessed++;
        const ok = await continueScan(true);
        if (!ok) {
          console.warn('[AutoScan] Chunk step paused or encountered retry limit. Cumulative progress preserved.');
          break;
        }
        await new Promise(r => setTimeout(r, 250));
      }

      isAutoScanning = false;
      pauseRequested = false;
      renderReport(currentReport); // resets button states
    }

    async function exportFile(format) {
      if (!currentReport) {
        alert('Please generate an audit report first.');
        return;
      }
      try {
        const queryParams = new URLSearchParams({
          address: currentReport.walletAddress,
          id: currentReport.reportId
        });
        const resp = await fetch('/api/export/' + format + '?' + queryParams.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report: currentReport })
        });
        if (!resp.ok) {
          throw new Error(await resp.text());
        }
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = format === 'markdown' ? 'md' : format;
        a.download = 'pharos-audit-' + currentReport.walletAddress.slice(2, 8) + '.' + ext;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (err) {
        alert('Export failed: ' + err.message);
      }
    }
  </script>
</body>
</html>`;
}
