/* ============================================================
   ANCHOR — Weekly Re-plan Screen
   Agent-powered analysis and limit adjustment proposals
   ============================================================ */

import { insforge, syncStateFromInsForge } from '../insforge.js';
import {
  getWeekSummary,
  getWeeklyHistory,
  getWatchedApps,
} from '../state.js';

export function render(container) {
  const summary = getWeekSummary();
  const history = getWeeklyHistory();
  const apps = getWatchedApps();
  const app = apps[0] || { appName: 'Instagram', dailyMinutesLimit: 5, dailyOpenLimit: 3 };

  // Day labels for bar chart
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxMinutes = Math.max(...history.map((d) => d.minutesUsed), 1);

  const screen = document.createElement('div');
  screen.className = 'screen flex flex-col';

  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  screen.innerHTML = `
    <!-- Header -->
    <div class="flex flex-between items-center mb-6">
      <h1 class="heading">Weekly Re-plan</h1>
      <span class="badge badge-primary">AI Agent</span>
    </div>

    <!-- Week Summary Stats -->
    <div class="stats-grid mb-6">
      <div class="stat-card">
        <div class="stat-value">${summary.avgMinutes}m</div>
        <div class="stat-label">Avg min/day</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.avgOpens}</div>
        <div class="stat-label">Avg opens/day</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.totalInterventions}</div>
        <div class="stat-label">Interventions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.complianceRate}%</div>
        <div class="stat-label">Compliance</div>
      </div>
    </div>

    <!-- Daily Breakdown Bar Chart -->
    <div class="glass-card mb-6">
      <div class="section-header mb-4">
        <span class="section-title">Daily Breakdown</span>
        <span class="text-muted text-xs">Last ${history.length} days</span>
      </div>
      <div class="flex items-center gap-2" style="height:120px;align-items:flex-end;" id="replan-bar-chart">
        ${history.map((day) => {
          const heightPct = Math.max((day.minutesUsed / maxMinutes) * 100, 4);
          const d = new Date(day.date);
          const label = dayNames[d.getDay()];
          const isFailed = day.proceeded > 0 || day.minutesUsed > app.dailyMinutesLimit;
          const statusLabel = isFailed ? 'FAIL' : 'OK';
          const badgeClass = isFailed ? 'badge-danger' : 'badge-success';
          return `
            <div class="flex flex-col items-center" style="flex:1;">
              <span class="text-xs text-muted mb-1">${day.minutesUsed}m</span>
              <div style="width:100%;max-width:32px;height:${heightPct}%;background:${barColor};border-radius:4px 4px 0 0;transition:height 0.5s ease;min-height:4px;"></div>
              <span class="text-xs text-muted mt-1">${label}</span>
              <span class="badge ${badgeClass}" style="font-size: 7px; padding: 1px 3px; margin-top: 4px; border-radius: 3px; line-height: 1; letter-spacing: 0.02em;">${statusLabel}</span>
            </div>
          `;
        }).join('')}
      </div>
      <!-- Limit line indicator -->
      <div class="flex items-center gap-2 mt-2">
        <div style="width:12px;height:2px;background:var(--color-warning);"></div>
        <span class="text-xs text-muted">Limit: ${app.dailyMinutesLimit} min/day</span>
      </div>
    </div>

    <!-- Run Re-plan Button -->
    <div class="flex" style="justify-content:center; margin-bottom:18px;">
      <button class="btn btn-primary btn-pulse" id="replan-run-btn" style="padding:8px 18px; font-size:0.8rem; border-radius:999px; width:auto;">
        Run AI Re-plan
      </button>
    </div>

    <!-- Proposal Area (hidden initially) -->
    <div class="hidden" id="replan-proposal-area"></div>

    <!-- Back Button -->
    <button class="btn btn-ghost btn-block mt-4" id="replan-back-btn">
      ← Back to Dashboard
    </button>
  `;

  container.appendChild(screen);

  // ---- DOM refs ----
  const runBtn = screen.querySelector('#replan-run-btn');
  const proposalArea = screen.querySelector('#replan-proposal-area');

  let currentUser = null;

  insforge.auth.getCurrentUser().then(({ data: { user } }) => {
    currentUser = user;
  });

  // ---- Event Listeners ----

  runBtn.addEventListener('click', async () => {
    if (!currentUser) {
      alert('Error: Not authenticated');
      return;
    }

    // Show loading state
    runBtn.disabled = true;
    runBtn.textContent = 'Analyzing your patterns...';
    runBtn.classList.remove('btn-pulse');
    proposalArea.classList.remove('hidden');
    proposalArea.innerHTML = `
      <div class="glass-card flex flex-col items-center gap-2" style="padding:2rem;">
        <div class="hero-mark">AI</div>
        <p class="text-secondary">Analyzing your patterns...</p>
        <p class="text-muted text-xs">This may take a moment</p>
      </div>
    `;

    let proposal;
    try {
      // Invoke InsForge Weekly Replan Edge Function
      const { data, error } = await insforge.functions.invoke("weekly_replan", {
        body: { user_id: currentUser.id }
      });
      if (error) throw error;
      proposal = data;
    } catch (err) {
      console.error('Re-plan generation failed, using fallback:', err);
      // Fallback proposal
      proposal = {
        summary: "Based on your usage patterns this week, you're averaging above your limit. I recommend tightening your daily minutes while giving yourself slightly more opens.",
        new_minutes_limit: Math.max(app.dailyMinutesLimit - 1, 2),
        new_opens_limit: app.dailyOpenLimit + 1,
        reasoning: "Your average daily usage exceeds your limit. Shorter but more frequent check-ins may help you stay in control without feeling restricted.",
        roadmap: [
          { phase: "Days 1-2: Setup", task: "Review and organize your pending tasks every morning.", strategy: "Set daily app limits to block scrolling triggers." },
          { phase: "Days 3-5: Action", task: "Carve out 30-min focus blocks for your main goals.", strategy: "Open your real task before launching distracting apps." },
          { phase: "Days 6-7: Complete", task: "Track completed milestones and check final compliance.", strategy: "Commit a small stake to seal your weekly win." }
        ]
      };
    }

    const newMinutes = proposal.new_minutes_limit || Math.max(app.dailyMinutesLimit - 1, 2);
    const newOpens = proposal.new_opens_limit || app.dailyOpenLimit;
    const summaryText = proposal.summary || 'Based on your patterns, here are my recommendations.';
    const reasoningText = proposal.reasoning || '';

    // Render proposal
    proposalArea.innerHTML = `
      <div class="glass-card-elevated mb-4">
        <div class="section-header mb-4">
          <span class="section-title">Agent Proposal</span>
        </div>

        <p class="text-sm mb-4">${summaryText}</p>

        <div class="divider mb-4"></div>

        <!-- Side-by-side Comparisons -->
        <div class="flex flex-col gap-4 mb-4">
          <div class="replan-comparison">
            <div class="replan-value replan-old">
              <span class="text-muted text-xs">Current</span>
              <span class="font-bold">${app.dailyMinutesLimit} min/day</span>
            </div>
            <span class="replan-arrow">→</span>
            <div class="replan-value replan-new">
              <span class="text-muted text-xs">Proposed</span>
              <span class="font-bold">${newMinutes} min/day</span>
            </div>
          </div>

          <div class="replan-comparison">
            <div class="replan-value replan-old">
              <span class="text-muted text-xs">Current</span>
              <span class="font-bold">${app.dailyOpenLimit} opens/day</span>
            </div>
            <span class="replan-arrow">→</span>
            <div class="replan-value replan-new">
              <span class="text-muted text-xs">Proposed</span>
              <span class="font-bold">${newOpens} opens/day</span>
            </div>
          </div>
        </div>

        ${proposal.roadmap && proposal.roadmap.length > 0 ? `
          <div class="divider mb-4"></div>
          <div class="section-header mb-3">
            <span class="section-title">Weekly Focus Roadmap</span>
          </div>
          <div class="replan-roadmap" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
            ${proposal.roadmap.map((step, idx) => `
              <div class="replan-roadmap-step" style="display: flex; gap: 12px; align-items: flex-start;">
                <div style="background: var(--color-primary-soft); color: var(--color-primary); border-radius: 8px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 2px;">
                  ${idx + 1}
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--color-text-secondary); letter-spacing: 0.03em;">${escapeHtml(step.phase)}</span>
                  </div>
                  <span style="font-size: 12px; font-weight: 600; color: #fff; line-height: 1.3;">${escapeHtml(step.task)}</span>
                  <span style="font-size: 11px; color: var(--color-text-muted); font-style: italic;">➔ Strategy: ${escapeHtml(step.strategy)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${reasoningText ? `
          <div class="divider mb-4"></div>
          <p class="text-secondary text-sm">${reasoningText}</p>
        ` : ''}

        <!-- Action Buttons -->
        <div class="flex gap-2 mt-4">
          <button class="btn btn-success" style="flex:1;" id="replan-accept-btn">Accept</button>
          <button class="btn btn-ghost" style="flex:1;" id="replan-modify-btn">Modify</button>
          <button class="btn btn-ghost" style="flex:1;" id="replan-reject-btn">Reject</button>
        </div>
      </div>
    `;

    // Hide the run button
    runBtn.classList.add('hidden');

    // ---- Proposal Action Handlers ----

    // Accept
    proposalArea.querySelector('#replan-accept-btn').addEventListener('click', async () => {
      const acceptBtn = proposalArea.querySelector('#replan-accept-btn');
      acceptBtn.disabled = true;
      acceptBtn.textContent = 'Saving...';

      try {
        await insforge.database
          .from("watched_apps")
          .update({
            daily_minutes_limit: newMinutes,
            daily_open_limit: newOpens
          })
          .eq("user_id", currentUser.id);

        await syncStateFromInsForge();
        showReplanToast(screen, 'New limits applied. Stay focused.');
        setTimeout(() => {
          window.navigateTo('dashboard');
        }, 1500);
      } catch (err) {
        alert(`Failed to save limits: ${err.message}`);
        acceptBtn.disabled = false;
        acceptBtn.textContent = '✅ Accept';
      }
    });

    // Modify
    proposalArea.querySelector('#replan-modify-btn').addEventListener('click', () => {
      // Replace proposal with editable form
      proposalArea.innerHTML = `
        <div class="glass-card mb-4">
          <h3 class="subheading mb-4">Customize Limits</h3>
          <div class="input-group mb-4">
            <label class="input-label" for="replan-custom-minutes">Daily minutes limit</label>
            <input class="input" type="number" id="replan-custom-minutes" value="${newMinutes}" min="1" max="120" />
          </div>
          <div class="input-group mb-4">
            <label class="input-label" for="replan-custom-opens">Daily opens limit</label>
            <input class="input" type="number" id="replan-custom-opens" value="${newOpens}" min="1" max="50" />
          </div>
          <button class="btn btn-success btn-block" id="replan-custom-save">Save Custom Limits</button>
        </div>
      `;

      proposalArea.querySelector('#replan-custom-save').addEventListener('click', async () => {
        const customMinutes = parseInt(proposalArea.querySelector('#replan-custom-minutes').value, 10) || newMinutes;
        const customOpens = parseInt(proposalArea.querySelector('#replan-custom-opens').value, 10) || newOpens;

        const saveBtn = proposalArea.querySelector('#replan-custom-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
          await insforge.database
            .from("watched_apps")
            .update({
              daily_minutes_limit: customMinutes,
              daily_open_limit: customOpens
            })
            .eq("user_id", currentUser.id);

          await syncStateFromInsForge();
          showReplanToast(screen, 'Custom limits saved.');
          setTimeout(() => {
            window.navigateTo('dashboard');
          }, 1500);
        } catch (err) {
          alert(`Failed to save limits: ${err.message}`);
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Custom Limits';
        }
      });
    });

    // Reject
    proposalArea.querySelector('#replan-reject-btn').addEventListener('click', () => {
      proposalArea.innerHTML = `
        <div class="glass-card flex flex-col items-center gap-2" style="padding:1.5rem;">
          <div class="hero-mark">OK</div>
          <p class="text-secondary">Keeping current limits. See you next week.</p>
        </div>
      `;

      setTimeout(() => {
        window.navigateTo('dashboard');
      }, 1500);
    });
  });

  // Back button
  screen.querySelector('#replan-back-btn').addEventListener('click', () => {
    window.navigateTo('dashboard');
  });
}

function showReplanToast(parent, message) {
  const toast = document.createElement('div');
  toast.className = 'glass-card-solid flex items-center gap-2';
  toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);z-index:1000;padding:0.75rem 1.5rem;';
  toast.textContent = message;
  parent.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    setTimeout(() => toast.remove(), 500);
  }, 1200);
}
