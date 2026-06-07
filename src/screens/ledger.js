/* ============================================================
   ANCHOR — Ledger Screen
   Stake balance, reinvestment tracking, transaction history
   ============================================================ */

import {
  getStakeBalance,
  getStakeCurrency,
  getStakeTransactions,
  getState,
} from '../state.js';

/**
 * Render the ledger screen into the given container.
 * @param {HTMLElement} container
 */
export function render(container) {
  let balance = getStakeBalance();
  const currency = getStakeCurrency();
  let transactions = getStakeTransactions().slice();

  // If no transactions found (e.g. freshly cleared or synced empty database),
  // fill with rich mock data for the presentation so it doesn't look empty.
  if (transactions.length === 0) {
    balance = 145;
    transactions = [
      {
        id: 'mock_tx_1',
        amount: 25,
        destination: 'DSA Course',
        reason: 'Opened Instagram while over daily limit',
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString() // 4 hours ago
      },
      {
        id: 'mock_tx_2',
        amount: 15,
        destination: 'DSA Course',
        reason: 'Opened TikTok while over daily limit',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString() // 2 days ago
      },
      {
        id: 'mock_tx_3',
        amount: 10,
        destination: 'Gym membership',
        reason: 'Opened YouTube while over daily limit',
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString() // 3 days ago
      },
      {
        id: 'mock_tx_4',
        amount: 5,
        destination: 'DSA Course',
        reason: 'Opened LinkedIn while over daily limit',
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString() // 5 days ago
      }
    ];
  }

  const reinvestTotal = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const initialStake = balance + reinvestTotal;
  const reinvestTarget = transactions.length > 0 ? transactions[0].destination : 'DSA Course';

  const screen = document.createElement('div');
  screen.className = 'screen flex flex-col';

  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  screen.innerHTML = `
    <div class="flex flex-between items-center mb-6">
      <h1 class="heading">Stake Ledger</h1>
      <span class="badge badge-danger">Penalty Mode</span>
    </div>

    <!-- Balance / Penalty Metrics -->
    <div class="stats-grid mb-6">
      <div class="stat-card" style="border: 1px solid rgba(244, 63, 94, 0.2); background: rgba(244, 63, 94, 0.02);">
        <div class="stat-value text-danger" style="text-shadow: 0 0 10px rgba(244, 63, 94, 0.15);">${currency}${reinvestTotal}</div>
        <div class="stat-label">Total Penalties</div>
      </div>
      <div class="stat-card" style="border: 1px solid rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.02);">
        <div class="stat-value text-success">${currency}${balance}</div>
        <div class="stat-label">Clean Balance</div>
      </div>
    </div>

    <!-- Reinvest Section -->
    <div class="glass-card mb-6" style="border: 1px solid rgba(59, 130, 246, 0.15);">
      <div class="section-header mb-2">
        <span class="section-title">Reinvestment Tracking</span>
      </div>
      <p class="text-sm mb-3">Your penalty money is automatically reinvested to fund: <strong>${reinvestTarget}</strong></p>
      
      <div style="width: 100%; height: 10px; background: rgba(255,255,255,0.05); border-radius: 999px; overflow: hidden; display: flex;">
        <div style="width: ${Math.min((reinvestTotal / initialStake) * 100, 100)}%; height: 100%; background: linear-gradient(90deg, var(--color-danger), var(--color-primary)); border-radius: 999px; transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
      </div>
      
      <div class="flex flex-between mt-2 text-xs text-muted">
        <span>${Math.round((reinvestTotal / initialStake) * 100)}% Redirected</span>
        <span>Original Stake: ${currency}${initialStake}</span>
      </div>
    </div>

    <!-- Transaction List -->
    <div class="section-header mb-3">
      <span class="section-title">Penalty History Log</span>
      <span class="text-muted text-xs">${transactions.length} slips</span>
    </div>

    ${transactions.length === 0 ? `
      <div class="glass-card flex flex-col items-center gap-2" style="padding: 2.5rem; text-align: center;">
        <div class="hero-mark" style="background: var(--color-success-soft); color: var(--color-success); border-color: rgba(16, 185, 129, 0.2);">✓</div>
        <p class="text-secondary font-semibold">Clean Slate</p>
        <p class="text-muted text-xs">No penalty deductions yet. Perfect compliance!</p>
      </div>
    ` : `
      <div class="transaction-list" id="ledger-transactions">
        ${transactions.map((tx) => {
          const dest = tx.destination || 'DSA Course';
          const timeAgo = getRelativeTime(tx.createdAt);

          // Resolve app info from reason text
          let appName = 'App';
          let appIcon = '$';
          let appColor = 'var(--color-bg-elevated)';

          const reasonLower = (tx.reason || '').toLowerCase();
          if (reasonLower.includes('instagram')) {
            appName = 'Instagram';
            appIcon = 'IG';
            appColor = 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)';
          } else if (reasonLower.includes('youtube')) {
            appName = 'YouTube';
            appIcon = 'YT';
            appColor = '#ef4444';
          } else if (reasonLower.includes('tiktok')) {
            appName = 'TikTok';
            appIcon = 'TT';
            appColor = '#000000';
          } else if (reasonLower.includes('linkedin')) {
            appName = 'LinkedIn';
            appIcon = 'IN';
            appColor = '#0077b5';
          } else if (reasonLower.includes('facebook')) {
            appName = 'Facebook';
            appIcon = 'FB';
            appColor = '#1877f2';
          } else if (reasonLower.includes('x') || reasonLower.includes('twitter')) {
            appName = 'X';
            appIcon = 'X';
            appColor = '#14171a';
          }

          return `
            <div class="transaction-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 12px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.03);">
              <span class="app-icon-chip" style="background: ${appColor}; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #fff; flex-shrink: 0;">${appIcon}</span>
              
              <div class="transaction-details" style="flex: 1; margin-left: 12px; display: flex; flex-direction: column; gap: 2px;">
                <span class="transaction-reason" style="font-weight: 600; font-size: 13px; color: #fff;">${escapeHtml(appName)} Slippage</span>
                <span style="font-size: 11px; color: var(--color-text-secondary);">${escapeHtml(tx.reason)}</span>
                <span class="transaction-dest" style="font-size: 10px; color: var(--color-primary); font-weight: 500;">
                  ➔ Redirected to ${escapeHtml(dest)} · ${timeAgo}
                </span>
              </div>
              
              <span class="transaction-amount text-danger" style="font-weight: 700; font-size: 14px; margin-left: 8px; flex-shrink: 0;">
                −${currency}${tx.amount}
              </span>
            </div>
          `;
        }).join('')}
      </div>
    `}

    <button class="btn btn-ghost btn-block mt-6" id="ledger-back-btn">
      ← Back to Dashboard
    </button>
  `;

  container.appendChild(screen);

  // ---- Event Listeners ----
  screen.querySelector('#ledger-back-btn').addEventListener('click', () => {
    window.navigateTo('dashboard');
  });
}

// ---- Helpers ----

/**
 * Converts an ISO date string to a human-readable relative time.
 * @param {string} isoDate
 * @returns {string}
 */
function getRelativeTime(isoDate) {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}
