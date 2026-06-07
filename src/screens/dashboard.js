/* ============================================================
   ANCHOR — Dashboard (Hypebeast-inspired editorial feed)
   ============================================================ */

import {
  getState,
  getTodayGoals,
  getGoalProgress,
  toggleGoal,
  setGoals,
  getWatchedApps,
  getTodayUsage,
  isOverLimit,
  getTodayInterventions,
  getStakeBalance,
  getStakeCurrency,
  addUsageEvent,
  subscribe,
} from '../state.js';

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const ICONS = {
  flame: '<svg viewBox="0 0 24 24"><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-2 1-2 4a6 6 0 0 0 12 0c0-5-7-9-7-9z"/></svg>',
  chat:  '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/></svg>',
  save:  '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4V3z"/></svg>',
};

export function render(container) {
  const screen = document.createElement('div');
  screen.className = 'screen';
  container.appendChild(screen);

  let unsubscribe = null;

  function build() {
    const state = getState();
    const apps = getWatchedApps();
    const interventions = getTodayInterventions();
    const goals = getTodayGoals();
    const progress = getGoalProgress();
    const balance = getStakeBalance();
    const currency = getStakeCurrency();

    const serializedGoals = JSON.stringify(goals.map(g => ({ id: g.id, status: g.status, text: g.text })));
    if (window.lastGoalSetKey !== serializedGoals) {
      window.lastGoalSetKey = serializedGoals;
      window.currentGoalRoadmap = null;
      window.currentGoalRoadmapLoading = true;
      import('../agent/brain.js').then(({ generateGoalRoadmap }) => {
        generateGoalRoadmap(goals).then((res) => {
          window.currentGoalRoadmap = res.steps;
          window.currentGoalRoadmapLoading = false;
          build();
        });
      });
    }

    const heroApp = apps[0] || { appName: 'Instagram', icon: 'IG', dailyMinutesLimit: 5, dailyOpenLimit: 3 };

    screen.innerHTML = `
      <!-- All apps overview: per-app usage breakdown -->
      <div class="feed-card">
        <div class="feed-meta">
          <span class="avatar" style="background:#4f46e5;">∑</span>
          <span class="meta-name">All Apps Today</span>
          <span class="meta-dot">·</span>
          <span class="meta-time">${apps.length} watched</span>
        </div>
        <div class="app-usage-list">
          ${apps.map((a) => {
            const u = getTodayUsage(a.appName);
            const aPct = Math.min(u.totalMinutes / a.dailyMinutesLimit, 1);
            const aPctDisplay = Math.round(aPct * 100);
            const aOver = isOverLimit(a.appName);
            const barColor = aPct >= 0.9 ? '#e11d48' : (aPct >= 0.6 ? '#f59e0b' : '#10b981');
            return `
              <button class="app-usage-row" data-app="${escapeHtml(a.appName)}">
                <span class="app-icon-chip app-icon-chip-lg" data-app="${escapeHtml(a.appName)}">${escapeHtml(a.icon)}</span>
                <div class="app-usage-body">
                  <div class="app-usage-head">
                    <span class="app-usage-name">${escapeHtml(a.appName)}</span>
                    <span class="app-usage-num">${u.totalMinutes}/${a.dailyMinutesLimit}m · ${u.opens}/${a.dailyOpenLimit}</span>
                  </div>
                  <div class="app-usage-bar">
                    <div class="app-usage-bar-fill" style="width:${aPctDisplay}%; background:${barColor};"></div>
                  </div>
                </div>
                ${aOver.isOver ? '<span class="badge badge-danger" style="font-size:9px;">OVER</span>' : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Goals card -->
      <div class="feed-card">
        <div class="feed-meta">
          <span class="avatar" style="background:#f59e0b;">G</span>
          <span class="meta-name">Today's Journey Map</span>
          <span class="meta-dot">·</span>
          <span class="meta-time">${progress.done}/${progress.total} done</span>
        </div>
        <div>
          ${window.currentGoalRoadmapLoading ? `
            <div style="padding: 24px 0; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;" class="text-secondary text-sm">
              <span class="typewriter-cursor" style="height: 18px; width: 3px; background: var(--color-warning);"></span>
              <span>Mapping your focus journey...</span>
            </div>
          ` : (window.currentGoalRoadmap && window.currentGoalRoadmap.length > 0 ? `
            <div class="goal-roadmap-container" style="position: relative; margin: 18px 0 12px 14px; padding-left: 20px;">
              <!-- Connected pathway line -->
              <div style="position: absolute; left: 4px; top: 12px; bottom: 12px; width: 2px; background: linear-gradient(180deg, var(--color-success) 0%, var(--color-primary) 50%, rgba(59, 130, 246, 0.1) 100%); z-index: 1;"></div>
              
              ${window.currentGoalRoadmap.map((step, idx) => {
                const isDone = step.status === 'done';
                const circleBg = isDone ? 'var(--color-success)' : 'var(--color-bg-elevated)';
                const circleBorder = isDone ? 'none' : '1px solid rgba(255,255,255,0.2)';
                const circleGlow = isDone ? 'box-shadow: 0 0 12px var(--color-success-glow);' : '';
                const textDecoration = isDone ? 'line-through; opacity: 0.6;' : '';

                return `
                  <div class="goal-roadmap-step" data-goal-id="${escapeHtml(step.id)}" style="position: relative; margin-bottom: 18px; cursor: pointer; display: flex; align-items: flex-start; gap: 12px; z-index: 2;">
                    <!-- Glowing Node Circle -->
                    <div class="roadmap-node" style="width: 26px; height: 26px; border-radius: 50%; background: ${circleBg}; border: ${circleBorder}; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; transition: all 0.3s ease; ${circleGlow} margin-left: -32px;">
                      ${escapeHtml(step.emoji || '🎯')}
                    </div>
                    <!-- Goal Details -->
                    <div class="glass-card" style="flex: 1; padding: 10px 12px; margin-top: -3px; border-radius: 12px; background: rgba(255,255,255,0.03); transition: all 0.2s ease; border: 1px solid rgba(255,255,255,0.05);">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${isDone ? 'var(--color-success)' : 'var(--color-primary)'};">${escapeHtml(step.phase)}</span>
                        ${isDone ? '<span class="badge badge-success" style="font-size: 8px; padding: 0px 4px; line-height: 1.2;">DONE</span>' : ''}
                      </div>
                      <p style="font-size: 13px; font-weight: 600; text-decoration: ${textDecoration}; color: #fff; line-height: 1.3;">${escapeHtml(step.label)}</p>
                      <p style="font-size: 11px; color: var(--color-text-secondary); line-height: 1.3; margin-top: 2px; text-decoration: ${textDecoration}">${escapeHtml(step.desc)}</p>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <div class="feed-subtitle" style="margin:0 0 12px; text-align: center;">No goals yet. Add one below to start your visual roadmap.</div>
          `)}
        </div>
        <div class="goal-add-inline">
          <input id="dashboard-goal-input" placeholder="Add a goal..." />
          <button id="dashboard-goal-add-btn" aria-label="Add goal">+</button>
        </div>
      </div>

      <!-- Stake card -->
      <div class="feed-card">
        <div class="feed-meta">
          <span class="avatar" style="background:#10b981;">$</span>
          <span class="meta-name">Stake Ledger</span>
          <span class="meta-dot">·</span>
          <span class="meta-time">live</span>
        </div>
        <div class="feed-hero feed-hero-stake">
          <span class="big">${currency}${balance}</span>
          <span class="label">balance · test mode</span>
        </div>
        <div class="feed-title">Your skin in the game</div>
        <div class="feed-subtitle">Break a limit → stake redirects to your real goal.</div>
        <div class="feed-actions">
          <span class="spacer"></span>
          <button class="icon-btn" id="dashboard-ledger-link" aria-label="Open ledger">${ICONS.save}</button>
        </div>
      </div>

      <!-- Simulate card -->
      <div class="feed-card" style="padding-bottom:24px;">
        <div class="feed-meta">
          <span class="avatar" style="background:#4f46e5;">${escapeHtml(heroApp.icon)}</span>
          <span class="meta-name">Test the Agent</span>
          <span class="meta-dot">·</span>
          <span class="meta-time">demo</span>
        </div>
        <button class="simulate-btn" id="dashboard-simulate-btn" style="margin-top:6px;">
          <span class="sim-icon">${escapeHtml(heroApp.icon)}</span>
          Open ${escapeHtml(heroApp.appName)}
        </button>
      </div>
    `;

    // ---- Wire up ----

    screen.querySelectorAll('.goal-roadmap-step, .goal-row').forEach((el) => {
      el.addEventListener('click', () => {
        const goalId = el.dataset.goalId;
        if (goalId && !goalId.startsWith('pad_') && !goalId.startsWith('fallback_')) {
          toggleGoal(goalId);
        }
      });
    });

    const goalInput = screen.querySelector('#dashboard-goal-input');
    const goalAddBtn = screen.querySelector('#dashboard-goal-add-btn');
    const addGoal = () => {
      const text = (goalInput.value || '').trim();
      if (!text) return;
      const today = new Date().toISOString().split('T')[0];
      const allGoals = getState().goals.slice();
      allGoals.push({ id: `goal_${Date.now()}`, date: today, text, status: 'open' });
      setGoals(allGoals);
      goalInput.value = '';
    };
    goalAddBtn.addEventListener('click', addGoal);
    goalInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addGoal(); });

    screen.querySelector('#dashboard-ledger-link').addEventListener('click', () => {
      window.navigateTo('ledger');
    });

    screen.querySelector('#dashboard-simulate-btn').addEventListener('click', () => {
      addUsageEvent({ appName: heroApp.appName });
      window.navigateTo('intervention');
    });
  }

  build();

  unsubscribe = subscribe((key) => {
    if (['goals', 'usageEvents', 'interventions', 'stakeLedger', 'watchedApps', 'user'].includes(key)) {
      build();
    }
  });

  return () => { if (unsubscribe) unsubscribe(); };
}
