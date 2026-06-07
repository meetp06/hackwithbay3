/* ============================================================
   ANCHOR — Intervention Screen
   THE STAR OF THE DEMO: Agent debate with realtime & edge fn
   ============================================================ */

import { insforge, syncStateFromInsForge } from '../insforge.js';
import {
  getWatchedApps,
  getTodayUsage,
  isOverLimit,
  getGoalProgress,
  getStakeBalance,
  getStakeCurrency,
  getTodayGoals,
} from '../state.js';

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- Typewriter Effect ----
function typewrite(el, text, speed = 25) {
  return new Promise((resolve) => {
    el.textContent = '';
    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    cursor.textContent = '|';
    el.appendChild(cursor);

    let i = 0;
    function tick() {
      if (i < text.length) {
        const charNode = document.createTextNode(text[i]);
        el.insertBefore(charNode, cursor);
        i++;
        setTimeout(tick, speed);
      } else {
        setTimeout(() => {
          if (cursor.parentNode) cursor.remove();
          resolve();
        }, 400);
      }
    }
    tick();
  });
}

export function render(container) {
  const apps = getWatchedApps();
  const app = apps[0] || { appName: 'Instagram', icon: '📸', dailyMinutesLimit: 5, dailyOpenLimit: 3 };
  const usage = getTodayUsage(app.appName);
  const overLimitInfo = isOverLimit(app.appName);
  const progress = getGoalProgress();

  const screen = document.createElement('div');
  screen.className = 'intervention-overlay';

  const todayGoals = getTodayGoals();
  const openGoals = todayGoals.filter((g) => g.status !== 'done');

  screen.innerHTML = `
    <button class="intervention-close" id="intervention-close-btn" aria-label="Close">×</button>

    <div class="intervention-inner">
      <!-- Usage Context Bar -->
      <div class="usage-bar mb-3">
        <span class="app-icon-chip" data-app="${escapeHtml(app.appName)}">${escapeHtml(app.icon)}</span>
        <span class="usage-stat">${escapeHtml(app.appName)}: ${usage.totalMinutes}/${app.dailyMinutesLimit} min</span>
        <span class="usage-divider">·</span>
        <span class="usage-stat">${usage.opens}/${app.dailyOpenLimit} opens</span>
        ${overLimitInfo.isOver ? '<span class="badge badge-danger" style="margin-left:auto;">Over Limit</span>' : ''}
      </div>

      <!-- Mainframe Coach card -->
      <div class="agent-card agent-card-coach mb-3">
        <div class="agent-label">MAINFRAME</div>
        <div class="agent-message" id="intervention-coach-msg">
          <span class="text-muted">Reading your goals…</span>
        </div>
      </div>

      <!-- Your Goals Today -->
      <div class="iv-section mb-3">
        <div class="iv-section-title">Your goals today</div>
        ${openGoals.length === 0 ? `
          <div class="iv-empty">All goals done. Nice.</div>
        ` : openGoals.map((g) => `
          <div class="iv-goal-row">
            <span class="iv-goal-dot"></span>
            <span class="iv-goal-text">${escapeHtml(g.text)}</span>
          </div>
        `).join('')}
      </div>

      <!-- AI Roadmap (generated) -->
      <div class="iv-section mb-3" id="iv-roadmap-section">
        <div class="iv-section-title">Mainframe roadmap</div>
        <div class="iv-roadmap" id="iv-roadmap-body">
          <div class="iv-empty">Generating your next 3 steps…</div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="action-buttons hidden" id="intervention-actions">
        <button class="action-btn action-btn-recommended" id="intervention-action-task">
          <span class="action-icon-text">Open</span>
          <span class="action-text">
            <span class="action-label">Open my real task</span>
            <span class="action-desc">Back to what matters</span>
          </span>
        </button>

        <button class="action-btn" id="intervention-action-break">
          <span class="action-icon-text">Pause</span>
          <span class="action-text">
            <span class="action-label">Take a 2-min break</span>
            <span class="action-desc">Logged and timed</span>
          </span>
        </button>

        <button class="action-btn action-btn-danger" id="intervention-action-proceed">
          <span class="action-icon-text">Risk</span>
          <span class="action-text">
            <span class="action-label">Proceed anyway</span>
            <span class="action-desc">Your stake may be affected</span>
          </span>
        </button>
      </div>

      <div class="break-timer hidden" id="intervention-break-timer">
        <div class="timer-display" id="break-timer-display">2:00</div>
        <div class="timer-label">Break in progress — breathe</div>
      </div>
    </div>
  `;

  container.appendChild(screen);

  // Close button → back to dashboard
  screen.querySelector('#intervention-close-btn').addEventListener('click', () => {
    try { insforge.realtime.disconnect(); } catch (e) { /* ignore */ }
    window.navigateTo('dashboard');
  });

  // ---- DOM refs ----
  const coachMsgEl = screen.querySelector('#intervention-coach-msg');
  const roadmapBodyEl = screen.querySelector('#iv-roadmap-body');
  const actionsEl = screen.querySelector('#intervention-actions');
  const breakTimerEl = screen.querySelector('#intervention-break-timer');
  const breakTimerDisplay = screen.querySelector('#break-timer-display');

  let suggestedStakeFromAgent = 10;
  let currentInterventionId = null;
  let currentUser = null;

  // ---- Setup Realtime and Trigger Edge Function ----
  setupInterventionFlow();

  async function setupInterventionFlow() {
    try {
      const { data: { user } } = await insforge.auth.getCurrentUser();
      if (!user) {
        coachMsgEl.textContent = "Error: Not authenticated";
        return;
      }
      currentUser = user;

      // 1. Connect to Realtime & Subscribe
      const channelName = `interventions:${user.id}`;
      coachMsgEl.textContent = "Connecting to agent...";

      await insforge.realtime.connect();
      await insforge.realtime.subscribe(channelName);
      console.log(`[Realtime] Subscribed to ${channelName}`);

      // 2. Listener for realtime message
      insforge.realtime.on("new_intervention", async (payload) => {
        console.log("[Realtime] Received new intervention broadcast:", payload);
        suggestedStakeFromAgent = payload.suggested_stake || 10;
        currentInterventionId = payload.id;
        await typewrite(coachMsgEl, payload.agent_message, 20);
        setTimeout(() => actionsEl.classList.remove('hidden'), 200);
      });

      // 3. Generate the AI roadmap (in parallel)
      generateRoadmap(openGoals);

      // 4. Trigger backend Edge Function for Coach message
      coachMsgEl.textContent = "Mainframe is reading your goals...";
      await insforge.functions.invoke("intervene", {
        body: {
          user_id: user.id,
          app_name: app.appName,
          usage_today: { opens: usage.opens, totalMinutes: usage.totalMinutes }
        }
      });
    } catch (err) {
      console.error("Intervention flow failed, using scripted fallback:", err);
      await typewrite(coachMsgEl, `You have goals pending today. Let's redirect that energy.`, 20);
      actionsEl.classList.remove('hidden');
      generateRoadmap(openGoals);
    }
  }

  async function generateRoadmap(goals) {
    // Always render fallback first so something's visible.
    const fallback = buildFallbackRoadmap(goals);
    renderRoadmap(fallback);

    if (goals.length === 0) return;

    try {
      const systemPrompt = `You are Mainframe's planner. Generate exactly 3 concise next steps the user should take RIGHT NOW instead of scrolling. Each step ≤ 12 words. Reference at least one of their goals.
Respond ONLY with valid JSON: {"steps":[{"label":"...", "minutes":<int>}, ...]}.
No prose, no fences.`;
      const userPrompt = `Goals pending today:\n${goals.map((g, i) => `${i + 1}. ${g.text}`).join('\n')}\nGenerate 3 ordered concrete next steps.`;
      const response = await insforge.ai.chat.completions.create({
        model: "anthropic/claude-3.5-haiku",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
      });
      const raw = response.choices[0].message.content.trim().replace(/^```json/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(raw);
      if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        renderRoadmap(parsed.steps.slice(0, 3));
      }
    } catch (e) {
      console.warn('[Mainframe Roadmap] LLM generation failed, kept fallback', e);
    }
  }

  function buildFallbackRoadmap(goals) {
    if (goals.length === 0) {
      return [
        { label: 'Stand up. 60s deep breath.', minutes: 1 },
        { label: 'Drink a glass of water.', minutes: 1 },
        { label: 'Pick a small win for the next hour.', minutes: 5 },
      ];
    }
    const first = goals[0].text;
    return [
      { label: `Open the doc/app for "${first}".`, minutes: 2 },
      { label: `Spend 10 focused minutes on it. No tabs.`, minutes: 10 },
      { label: `Mark one sub-step done before checking phone again.`, minutes: 1 },
    ];
  }

  function renderRoadmap(steps) {
    roadmapBodyEl.innerHTML = steps.map((s, i) => `
      <div class="iv-step">
        <span class="iv-step-num">${i + 1}</span>
        <span class="iv-step-label">${escapeHtml(s.label)}</span>
        <span class="iv-step-time">${s.minutes ? `${s.minutes}m` : ''}</span>
      </div>
    `).join('');
  }

  // ---- Action Handlers ----

  // 🎯 Open my real task
  screen.querySelector('#intervention-action-task').addEventListener('click', async () => {
    const btn = screen.querySelector('#intervention-action-task');
    btn.disabled = true;
    const taskLabel = btn.querySelector('.action-label');
    if (taskLabel) taskLabel.textContent = 'Redirecting...';

    if (currentUser && currentInterventionId) {
      await insforge.functions.invoke("decide_consequence", {
        body: {
          user_id: currentUser.id,
          intervention_id: currentInterventionId,
          user_action: 'open_task',
        }
      });
    }

    await syncStateFromInsForge();
    showToast(screen, 'Great choice — back to your tasks.');
    setTimeout(() => {
      window.navigateTo('dashboard');
    }, 1200);
  });

  // ⏸️ Take a 2-min break
  screen.querySelector('#intervention-action-break').addEventListener('click', async () => {
    if (currentUser && currentInterventionId) {
      await insforge.functions.invoke("decide_consequence", {
        body: {
          user_id: currentUser.id,
          intervention_id: currentInterventionId,
          user_action: 'break',
        }
      });
    }

    actionsEl.classList.add('hidden');
    breakTimerEl.classList.remove('hidden');

    startBreakTimer(120, breakTimerDisplay, async () => {
      await syncStateFromInsForge();
      showToast(screen, 'Break over — let\'s refocus.');
      setTimeout(() => {
        window.navigateTo('dashboard');
      }, 1200);
    });
  });

  // ⚠️ Proceed anyway
  screen.querySelector('#intervention-action-proceed').addEventListener('click', async () => {
    const excuse = prompt("What's your excuse for scrolling anyway?") || "Just a quick scroll";
    const over = isOverLimit(app.appName);

    const btn = screen.querySelector('#intervention-action-proceed');
    btn.disabled = true;
    const proceedLabel = btn.querySelector('.action-label');
    if (proceedLabel) proceedLabel.textContent = 'Logging...';

    if (currentUser && currentInterventionId) {
      await insforge.functions.invoke("decide_consequence", {
        body: {
          user_id: currentUser.id,
          intervention_id: currentInterventionId,
          user_action: 'proceed',
          excuse: excuse,
          app_name: app.appName,
          was_over_limit: over.isOver,
          suggested_stake: suggestedStakeFromAgent,
        }
      });
    }

    await syncStateFromInsForge();

    if (over.isOver) {
      const currency = getStakeCurrency();
      actionsEl.classList.add('hidden');
      
      const consequenceEl = document.createElement('div');
      consequenceEl.className = 'glass-card-elevated flex flex-col items-center gap-4 mt-4';
      consequenceEl.innerHTML = `
        <div class="consequence-mark">−</div>
        <p class="text-danger font-bold text-lg">Stake Deducted</p>
        <p class="text-2xl font-bold balance-flash">−${currency}${suggestedStakeFromAgent}</p>
        <p class="text-secondary text-sm">Redirected to: DSA Course</p>
        <p class="text-muted text-xs">Remaining balance: ${currency}${getStakeBalance()}</p>
      `;
      screen.querySelector('#intervention-debate').appendChild(consequenceEl);

      setTimeout(() => {
        window.navigateTo('dashboard');
      }, 2500);
    } else {
      showToast(screen, 'Usage logged — stay mindful.');
      setTimeout(() => {
        window.navigateTo('dashboard');
      }, 1200);
    }
  });

  // Clean up socket listener when unmounting
  return () => {
    insforge.realtime.disconnect();
  };
}

function startBreakTimer(totalSeconds, displayEl, onComplete) {
  let remaining = totalSeconds;
  function updateDisplay() {
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    displayEl.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
  }
  updateDisplay();

  const interval = setInterval(() => {
    remaining--;
    updateDisplay();
    if (remaining <= 0) {
      clearInterval(interval);
      onComplete();
    }
  }, 1000);
}

function showToast(parent, message) {
  const toast = document.createElement('div');
  toast.className = 'glass-card-solid flex items-center gap-2';
  toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);z-index:1000;padding:0.75rem 1.5rem;';
  toast.textContent = message;
  parent.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    setTimeout(() => toast.remove(), 500);
  }, 1000);
}
