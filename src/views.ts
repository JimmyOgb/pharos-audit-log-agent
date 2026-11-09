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
      align-items: center;
      flex-wrap: wrap;
    }
    .quick-btn {
      background: #1f2937;
      border: 1px solid #374151;
      color: #9ca3af;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      transition: all 0.2s;
    }
    .quick-btn:hover {
      color: #fff;
      border-color: var(--primary);
    }
    .btn-submit {
      background: var(--primary);
      color: #fff;
      border: none;
      padding: 0.7rem 1.4rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: background 0.2s;
    }
    .btn-submit:hover {
      background: var(--primary-hover);
    }
    .btn-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .summary-card {
      background: linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9));
      border: 1px solid #334155;
    }
    .summary-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .summary-title {
      font-size: 1.15rem;
      font-weight: 700;
    }
    .export-btns {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .btn-export {
      background: #1e293b;
      border: 1px solid #475569;
      color: #e2e8f0;
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-export:hover {
      background: #334155;
      color: #fff;
      border-color: #64748b;
    }
    .btn-export-primary {
      background: #2563eb;
      border-color: #3b82f6;
    }
    .btn-export-primary:hover {
      background: #1d4ed8;
    }
    .narrative-box {
      background: rgba(15, 23, 42, 0.6);
      border-left: 4px solid var(--primary);
      padding: 1rem;
      border-radius: 0 8px 8px 0;
      margin-bottom: 1.5rem;
      line-height: 1.6;
      font-size: 0.95rem;
      color: #e2e8f0;
    }
    .categories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .cat-card {
      background: #0f172a;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 1rem;
      transition: transform 0.2s, border-color 0.2s;
    }
    .cat-card:hover {
      border-color: #374151;
    }
    .cat-name {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.4rem;
    }
    .cat-count {
      font-size: 1.8rem;
      font-weight: 700;
      color: #fff;
    }
    .cat-detail {
      font-size: 0.75rem;
      color: #94a3b8;
      margin-top: 0.4rem;
    }
    .table-container {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid var(--card-border);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.85rem;
    }
    th {
      background: #1e293b;
      padding: 0.75rem 1rem;
      color: #94a3b8;
      font-weight: 600;
      border-bottom: 1px solid var(--card-border);
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
    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);
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
      <p>Analyze genuine historical activity for any EVM wallet on Pharos Atlantic Testnet. Verifies transfers in/out, DEX swaps, and token allowances with instant Markdown, PDF, and CSV exports.</p>
    </div>

    <div class="card">
      <form id="auditForm" onsubmit="handleAuditSubmit(event)">
        <div class="form-grid">
          <div class="form-group">
            <label for="addressInput">EVM Wallet Address</label>
            <input 
              type="text" 
              id="addressInput" 
              placeholder="0x..." 
              required 
              value="0x299ce4113abf88f4997737184aa8a7a3d58ac15c"
              autocomplete="off"
              spellcheck="false"
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
          <span style="font-size: 0.8rem; color: #64748b;">Sample Active Wallets:</span>
          <button type="button" class="quick-btn" onclick="setWallet('0x299ce4113abf88f4997737184aa8a7a3d58ac15c')">0x299c...c15c (Active Trader)</button>
          <button type="button" class="quick-btn" onclick="setWallet('0x000000000000000000000000000000000000dead')">0x0000...dead (Burn/Idle)</button>
        </div>
      </form>
    </div>

    <div id="resultsContainer" style="display: none;">
      <!-- Results will be injected here -->
    </div>
  </main>

  <footer>
    Pharos Audit-Log Agent • Atlantic Testnet (Chain ID 688689) • Strictly Read-Only Verifiable Ledger • No Simulation
  </footer>

  <script>
    // Initialize date inputs default to past 7 days
    window.addEventListener('DOMContentLoaded', () => {
      const today = new Date();
      const past7 = new Date();
      past7.setDate(today.getDate() - 7);
      
      document.getElementById('endDate').value = today.toISOString().slice(0, 10);
      document.getElementById('startDate').value = past7.toISOString().slice(0, 10);
    });

    function setWallet(addr) {
      document.getElementById('addressInput').value = addr;
    }

    let currentReport = null;

    async function handleAuditSubmit(e) {
      e.preventDefault();
      const address = document.getElementById('addressInput').value.trim();
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;

      const btnSubmit = document.getElementById('btnSubmit');
      const btnText = document.getElementById('btnText');
      const btnSpinner = document.getElementById('btnSpinner');
      const container = document.getElementById('resultsContainer');

      btnSubmit.disabled = true;
      btnText.innerText = 'Scanning Chain...';
      btnSpinner.style.display = 'inline-block';

      try {
        const resp = await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, startDate, endDate })
        });

        const data = await resp.json();
        if (!data.success) {
          alert('Error generating report: ' + (data.error || 'Unknown error'));
          return;
        }

        currentReport = data.report;
        renderReport(currentReport);
      } catch (err) {
        alert('Network error connecting to Pharos node: ' + err.message);
      } finally {
        btnSubmit.disabled = false;
        btnText.innerText = 'Generate Audit';
        btnSpinner.style.display = 'none';
      }
    }

    function renderReport(r) {
      const container = document.getElementById('resultsContainer');
      container.style.display = 'block';

      const catMap = {};
      r.categorySummaries.forEach(c => { catMap[c.category] = c; });

      const cov = r.coverage || {};
      const statusColor = cov.completeness === 'COMPLETE' ? '#10b981' : (cov.completeness === 'PARTIAL' ? '#f59e0b' : '#ef4444');
      const statusBg = cov.completeness === 'COMPLETE' ? 'rgba(16, 185, 129, 0.1)' : (cov.completeness === 'PARTIAL' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)');

      let partialNoticeHtml = '';
      if (cov.completeness === 'PARTIAL') {
        let continueBtn = '';
        if (cov.continuationCursor) {
          continueBtn = '<button onclick="continueScan(' + cov.continuationCursor.nextFromBlock + ', ' + cov.continuationCursor.nextToBlock + ')" style="background: #f59e0b; color: #000; border: none; font-weight: 600; padding: 0.4rem 0.85rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">Scan Next Chunk (' + cov.continuationCursor.nextFromBlock + '..' + cov.continuationCursor.nextToBlock + ') ↗</button>';
        }
        partialNoticeHtml = '<div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;"><div><strong style="color: #f59e0b;">⚠️ Partial Audit Notice:</strong> <span style="font-size: 0.85rem; color: #cbd5e1;">Covered ' + (cov.coveragePercentage || 0) + '% (' + (cov.actualScannedBlocksCount || 0) + ' of ' + (cov.requestedBlockSpan || 0) + ' blocks). ' + (cov.omittedBlockCount || 0) + ' earlier blocks omitted due to execution boundary safeguards.</span></div>' + continueBtn + '</div>';
      }

      let notableRows = '';
      if (r.notableTransactions.length === 0) {
        notableRows = '<tr><td colspan="6" style="text-align: center; color: #9ca3af;">No notable high-value transactions, contract failures, or infinite allowance risks identified.</td></tr>';
      } else {
        notableRows = r.notableTransactions.map(t => \`
          <tr>
            <td>\${t.dateFormatted}</td>
            <td><span class="badge badge-\${t.category}">\${t.categoryLabel}</span></td>
            <td><span style="font-size: 0.75rem; background: #1e293b; padding: 0.2rem 0.4rem; border-radius: 4px;">\${t.assetType || 'ERC20'}</span></td>
            <td><strong>\${t.title}</strong><br><span style="font-size: 0.75rem; color: #ef4444;">\${t.notableReason || ''}</span></td>
            <td style="font-family: 'JetBrains Mono', monospace;">\${t.formattedAmount ? t.formattedAmount + ' ' + (t.tokenSymbol || '') : '-'}</td>
            <td><a href="\${t.explorerUrl}" target="_blank" rel="noopener" class="link-explorer">\${t.txHash.slice(0, 8)}...\${t.txHash.slice(-6)} ↗</a></td>
          </tr>
        \`).join('');
      }

      let allRows = '';
      if (r.allActivities.length === 0) {
        allRows = \`<tr><td colspan="7" style="text-align: center; color: #9ca3af;">Zero activities detected in scanned window (\${cov.actualScannedBlocksCount ? cov.actualScannedBlocksCount.toLocaleString() : 0} blocks).</td></tr>\`;
      } else {
        allRows = r.allActivities.slice(0, 50).map(t => \`
          <tr>
            <td style="font-family: 'JetBrains Mono', monospace;">\${t.blockNumber}</td>
            <td><span class="badge badge-\${t.category}">\${t.categoryLabel}</span></td>
            <td><span style="font-size: 0.75rem; background: #1e293b; padding: 0.2rem 0.4rem; border-radius: 4px;">\${t.assetType || 'ERC20'}</span></td>
            <td>\${t.title}</td>
            <td style="font-family: 'JetBrains Mono', monospace;">\${t.formattedAmount ? t.formattedAmount + ' ' + (t.tokenSymbol || '') : '-'}</td>
            <td><span style="font-size: 0.75rem; color: \${t.status === 'REVERTED' ? '#ef4444' : '#10b981'};">\${t.status || 'SUCCESS'}</span></td>
            <td><a href="\${t.explorerUrl}" target="_blank" rel="noopener" class="link-explorer">\${t.txHash.slice(0, 8)}...\${t.txHash.slice(-6)} ↗</a></td>
          </tr>
        \`).join('');
      }

      container.innerHTML = \`
        <div class="card summary-card">
          <div class="summary-header">
            <div>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="summary-title">Audit Report: \${r.walletAddress}</div>
                <span style="background: \${statusBg}; border: 1px solid \${statusColor}; color: \${statusColor}; padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700;">
                  STATUS: \${cov.completeness || 'COMPLETE'}
                </span>
              </div>
              <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.35rem;">
                Requested: \${cov.requestedStartDate ? cov.requestedStartDate.slice(0, 10) : ''} to \${cov.requestedEndDate ? cov.requestedEndDate.slice(0, 10) : ''} • Scanned: \${r.startDate} to \${r.endDate} (\${cov.actualScannedBlocksCount ? cov.actualScannedBlocksCount.toLocaleString() : 0} blocks)
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
              <div class="cat-name">Transfers In</div>
              <div class="cat-count">\${catMap['transfers_in'] ? catMap['transfers_in'].count : 0}</div>
              <div class="cat-detail">\${r.categoryTotals.transfers_in.nativeCount} Native (\${r.categoryTotals.transfers_in.nativeAmountFormatted}) • \${r.categoryTotals.transfers_in.erc20Count} ERC-20</div>
            </div>
            <div class="cat-card">
              <div class="cat-name">Transfers Out</div>
              <div class="cat-count">\${catMap['transfers_out'] ? catMap['transfers_out'].count : 0}</div>
              <div class="cat-detail">\${r.categoryTotals.transfers_out.nativeCount} Native (\${r.categoryTotals.transfers_out.nativeAmountFormatted}) • \${r.categoryTotals.transfers_out.erc20Count} ERC-20</div>
            </div>
            <div class="cat-card">
              <div class="cat-name">Swaps</div>
              <div class="cat-count">\${catMap['swaps'] ? catMap['swaps'].count : 0}</div>
              <div class="cat-detail">Uniswap / AMM Liquidity</div>
            </div>
            <div class="cat-card">
              <div class="cat-name">Token Approvals</div>
              <div class="cat-count">\${catMap['token_approvals'] ? catMap['token_approvals'].count : 0}</div>
              <div class="cat-detail">\${r.categoryTotals.token_approvals.currentVerifiedUnlimited} active unlimited (\${r.categoryTotals.token_approvals.currentReducedOrRevoked} revoked/reduced)</div>
            </div>
            <div class="cat-card">
              <div class="cat-name">Contract Calls</div>
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
                  <th>Asset</th>
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
      
      container.scrollIntoView({ behavior: 'smooth' });
    }

    async function continueScan(fromBlock, toBlock) {
      const address = document.getElementById('addressInput').value.trim();
      const btnSubmit = document.getElementById('btnSubmit');
      const btnText = document.getElementById('btnText');
      const btnSpinner = document.getElementById('btnSpinner');

      btnSubmit.disabled = true;
      btnText.innerText = 'Continuing Scan...';
      btnSpinner.style.display = 'inline-block';

      try {
        const resp = await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            cursor: { fromBlock, toBlock }
          })
        });
        const data = await resp.json();
        if (data.success) {
          renderReport(data.report);
        } else {
          alert('Continuation failed: ' + data.error);
        }
      } catch (e) {
        alert('Continuation error: ' + e.message);
      } finally {
        btnSubmit.disabled = false;
        btnText.innerText = 'Generate Audit';
        btnSpinner.style.display = 'none';
      }
    }

    async function exportFile(format) {
      if (!currentReport) {
        alert('Please generate an audit report first.');
        return;
      }
      try {
        const resp = await fetch('/api/export/' + format, {
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
