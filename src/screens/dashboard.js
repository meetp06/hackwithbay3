/* ============================================================
   ANCHOR — Dashboard Screen
   Main hub: goals, usage ring, stats, simulate trigger
   ============================================================ */

import {
  getState,
  getTodayGoals,
  getGoalProgress,
  toggleGoal,
  getWatchedApps,
  getTodayUsage,
  isOverLimit,
  getTodayInterventions,
  getStakeBalance,
  getStakeCurrency,
  addUsageEvent,
  subscribe,
} from '../state.js';

/**
 * Render the dashboard into the given container.
 * @param {HTMLElement} container
 */
export function render(container) {
  const screen = document.createElement('div');
  screen.className = 'screen flex flex-col';
  container.appendChild(screen);

  // Unsubscribe handle for cleanup
  let unsubscribe = null;

  function buildDashboard() {
    const user = getState().user;
    const goals = getTodayGoals();
    const progress = getGoalProgress();
    const apps = getWatchedApps();
    const app = apps[0] || { appName: 'Instagram', icon: '📸', dailyMinutesLimit: 5, dailyOpenLimit: 3 };
    const usage = getTodayUsage(app.appName);
    const overLimit = isOverLimit(app.appName);
    const interventions = getTodayInterventions();
    const balance = getStakeBalance();
    const currency = getStakeCurrency();

    // Greeting based on time of day
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';

    // Date string
    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    // Usage ring calculations
    const usedMin = usage.totalMinutes;
    const limitMin = app.dailyMinutesLimit;
    const pct = Math.min(usedMin / limitMin, 1);
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const dashoffset = circumference * (1 - pct);
    let ringColor = 'var(--color-success)';
    if (pct >= 0.9) ringColor = 'var(--color-danger)';
    else if (pct >= 0.6) ringColor = 'var(--color-warning)';

    // Streak: count consecutive days with compliance from weekly history
    const weeklyHistory = getState().weeklyHistory || [];
    let streak = 0;
    for (let i = weeklyHistory.length - 1; i >= 0; i--) {
      if (weeklyHistory[i].proceeded === 0) streak++;
      else break;
    }

    // Success rate
    const totalInterventions = interventions.length;
    const successes = interventions.filter((i) => i.userAction !== 'proceed').length;
    const successRate = totalInterventions > 0 ? Math.round((successes / totalInterventions) * 100) : 100;

    screen.innerHTML = `
      <!-- Header -->
      <div class="mb-6">
        <h1 class="heading">${greeting}, ${user.name} 👋</h1>
        <p class="text-secondary">${dateStr}</p>
      </div>

      <!-- Goals Card -->
      <div class="glass-card mb-4" id="dashboard-goals-card">
        <div class="section-header">
          <span class="section-title">Today's Goals</span>
          <span class="section-action text-muted">${progress.done} of ${progress.total} done</span>
        </div>
        <div id="dashboard-goals-list">
          ${goals.map((g) => `
            <div class="goal-item ${g.status === 'done' ? 'completed' : ''}" data-goal-id="${g.id}">
              <span class="goal-checkbox">${g.status === 'done' ? '✅' : '⬜'}</span>
              <span class="goal-text">${g.text}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Usage Ring -->
      <div class="glass-card mb-4 flex flex-col items-center">
        <div class="section-header" style="width:100%;">
          <span class="section-title">${app.icon} ${app.appName} Usage</span>
          ${overLimit.isOver ? '<span class="badge badge-danger">Over Limit</span>' : '<span class="badge badge-success">Within Limit</span>'}
        </div>
        <div class="usage-ring mt-4 mb-2">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <!-- Background track -->
            <circle cx="70" cy="70" r="${radius}" fill="none"
              stroke="rgba(255,255,255,0.1)" stroke-width="6" />
            <!-- Progress arc -->
            <circle cx="70" cy="70" r="${radius}" fill="none"
              stroke="${ringColor}" stroke-width="6"
              stroke-linecap="round"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${dashoffset}"
              transform="rotate(-90 70 70)"
              style="transition: stroke-dashoffset 0.8s ease;" />
            <!-- Center text -->
            <text x="70" y="64" text-anchor="middle" fill="white"
              font-size="20" font-weight="bold">${usedMin} / ${limitMin}</text>
            <text x="70" y="84" text-anchor="middle" fill="rgba(255,255,255,0.6)"
              font-size="12">min</text>
          </svg>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid mb-4">
        <div class="stat-card">
          <div class="stat-value">${usage.opens}/${app.dailyOpenLimit}</div>
          <div class="stat-label">Opens today</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${streak}d</div>
          <div class="stat-label">Streak</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalInterventions}</div>
          <div class="stat-label">Interventions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${successRate}%</div>
          <div class="stat-label">Success rate</div>
        </div>
      </div>

      <!-- Stake Balance -->
      <div class="glass-card mb-4 flex flex-between items-center" id="dashboard-stake-card">
        <div>
          <p class="text-muted text-xs">Stake Balance</p>
          <p class="text-2xl font-bold">${currency}${balance}</p>
        </div>
        <span class="badge badge-test">🧪 Test Mode</span>
      </div>

      <!-- Simulate Button -->
      <button class="simulate-btn mb-6" id="dashboard-simulate-btn">
        <span class="sim-icon">${app.icon}</span>
        Simulate opening ${app.appName}
      </button>

      <!-- Bottom Navigation -->
      <div class="flex gap-4 mt-2" style="justify-content:center;">
        <button class="btn btn-ghost" id="dashboard-ledger-link">📊 View Ledger</button>
        <button class="btn btn-ghost" id="dashboard-replan-link">🔄 Weekly Re-plan</button>
      </div>
    `;

    // ---- Event Listeners ----

    // Goal checkboxes
    screen.querySelectorAll('.goal-item').forEach((el) => {
      el.addEventListener('click', () => {
        const goalId = el.dataset.goalId;
        toggleGoal(goalId);
      });
    });

    // Simulate button
    screen.querySelector('#dashboard-simulate-btn').addEventListener('click', () => {
      addUsageEvent({ appName: app.appName });
      window.navigateTo('intervention');
    });

    // Ledger link
    screen.querySelector('#dashboard-ledger-link').addEventListener('click', () => {
      window.navigateTo('ledger');
    });

    // Replan link
    screen.querySelector('#dashboard-replan-link').addEventListener('click', () => {
      window.navigateTo('replan');
    });
  }

  // Initial render
  buildDashboard();

  // Subscribe to state changes for reactive updates
  unsubscribe = subscribe((key) => {
    // Re-render on relevant state changes
    if (['goals', 'usageEvents', 'interventions', 'stakeLedger'].includes(key)) {
      buildDashboard();
    }
  });

  // Return cleanup function for the router
  return () => {
    if (unsubscribe) unsubscribe();
  };
}
