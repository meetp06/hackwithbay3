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
  const balance = getStakeBalance();
  const currency = getStakeCurrency();
  const transactions = getStakeTransactions();
  const initialStake = getState().stakeLedger.balance + transactions.reduce((sum, tx) => sum + tx.amount, 0);

  const screen = document.createElement('div');
  screen.className = 'screen flex flex-col';

  // Calculate reinvestment totals
  const reinvestTxs = transactions.filter((tx) => tx.destination && tx.destination.startsWith('reinvest:'));
  const reinvestTotal = reinvestTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const reinvestTarget = reinvestTxs.length > 0 ? reinvestTxs[0].destination.split(':')[1] : 'DSA Course';

  screen.innerHTML = `
    <!-- Header -->
    <div class="flex flex-between items-center mb-6">
      <h1 class="heading">Stake Ledger</h1>
      <span class="badge badge-test">🧪 Test Mode</span>
    </div>

    <!-- Balance Hero Card -->
    <div class="glass-card-elevated flex flex-col items-center mb-6">
      <p class="text-muted text-xs mb-2">Current Balance</p>
      <p class="text-4xl font-bold" id="ledger-balance">${currency}${balance}</p>
      <p class="text-secondary text-sm mt-2">of ${currency}${initialStake} staked</p>
    </div>

    ${reinvestTotal > 0 ? `
    <!-- Reinvest Section -->
    <div class="glass-card mb-4">
      <div class="section-header">
        <span class="section-title">🎯 Reinvestment Progress</span>
      </div>
      <p class="text-sm mb-2">${currency}${reinvestTotal} reinvested toward <strong>${reinvestTarget}</strong></p>
      <div style="width:100%;height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">
        <div style="width:${Math.min((reinvestTotal / initialStake) * 100, 100)}%;height:100%;background:var(--color-primary);border-radius:4px;transition:width 0.5s ease;"></div>
      </div>
      <p class="text-xs text-muted mt-1">${Math.round((reinvestTotal / initialStake) * 100)}% of original stake</p>
    </div>
    ` : ''}

    <!-- Transaction List -->
    <div class="section-header mb-2">
      <span class="section-title">Transaction History</span>
    </div>

    ${transactions.length === 0 ? `
      <div class="glass-card flex flex-col items-center gap-2" style="padding:2rem;">
        <span class="emoji-lg">💪</span>
        <p class="text-secondary">No stake movements yet. Stay focused!</p>
      </div>
    ` : `
      <div class="transaction-list" id="ledger-transactions">
        ${transactions.map((tx) => {
          const icon = tx.destination && tx.destination.startsWith('reinvest:') ? '🎯' : '💝';
          const dest = tx.destination ? tx.destination.replace('reinvest:', '') : 'General';
          const timeAgo = getRelativeTime(tx.createdAt);
          return `
            <div class="transaction-item">
              <span class="transaction-icon">${icon}</span>
              <div class="transaction-details">
                <span class="transaction-reason">${tx.reason || 'Stake deduction'}</span>
                <span class="transaction-dest">${dest} · ${timeAgo}</span>
              </div>
              <span class="transaction-amount text-danger">-${currency}${tx.amount}</span>
            </div>
          `;
        }).join('')}
      </div>
    `}

    <!-- Back Button -->
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
