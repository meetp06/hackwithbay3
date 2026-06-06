/* ============================================================
   ANCHOR — Intervention Screen
   THE STAR OF THE DEMO: Agent debate with typewriter effect
   ============================================================ */

import {
  getWatchedApps,
  getTodayUsage,
  isOverLimit,
  addIntervention,
  addStakeTransaction,
  addMemory,
  getGoalProgress,
  getStakeBalance,
  getStakeCurrency,
} from '../state.js';

import {
  generateIntervention,
  generateTempterResponse,
} from '../agent/brain.js';

// ---- Typewriter Effect ----

/**
 * Types text character-by-character into an element.
 * Returns a promise that resolves when typing is complete.
 * @param {HTMLElement} el  - Target element
 * @param {string} text     - Text to type
 * @param {number} speed    - Milliseconds per character
 * @returns {Promise<void>}
 */
function typewrite(el, text, speed = 30) {
  return new Promise((resolve) => {
    el.textContent = '';
    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    cursor.textContent = '|';
    el.appendChild(cursor);

    let i = 0;
    function tick() {
      if (i < text.length) {
        // Insert character before cursor
        const charNode = document.createTextNode(text[i]);
        el.insertBefore(charNode, cursor);
        i++;
        setTimeout(tick, speed);
      } else {
        // Remove cursor after a brief pause
        setTimeout(() => {
          if (cursor.parentNode) cursor.remove();
          resolve();
        }, 400);
      }
    }
    tick();
  });
}

/**
 * Render the intervention screen into the given container.
 * @param {HTMLElement} container
 */
export function render(container) {
  const apps = getWatchedApps();
  const app = apps[0] || { appName: 'Instagram', icon: '📸', dailyMinutesLimit: 5, dailyOpenLimit: 3 };
  const usage = getTodayUsage(app.appName);
  const overLimitInfo = isOverLimit(app.appName);
  const progress = getGoalProgress();

  const screen = document.createElement('div');
  screen.className = 'intervention-overlay';

  screen.innerHTML = `
    <!-- Usage Context Bar -->
    <div class="usage-bar mb-4">
      <span class="usage-icon">${app.icon}</span>
      <span class="usage-stat">${app.appName}: ${usage.totalMinutes}min / ${app.dailyMinutesLimit}min</span>
      <span class="usage-divider">·</span>
      <span class="usage-stat">${usage.opens} of ${app.dailyOpenLimit} opens</span>
      ${overLimitInfo.isOver ? '<span class="badge badge-danger" style="margin-left:auto;">⚠️ Over Limit</span>' : ''}
    </div>

    <!-- Agent Debate Area -->
    <div class="flex flex-col gap-4 mb-6" id="intervention-debate">
      <!-- Tempter Card -->
      <div class="agent-card agent-card-tempter">
        <div class="agent-label">😈 TEMPTER</div>
        <div class="agent-message" id="intervention-tempter-msg">
          <span class="text-muted">...</span>
        </div>
      </div>

      <!-- Coach Card -->
      <div class="agent-card agent-card-coach">
        <div class="agent-label">🛡️ ANCHOR</div>
        <div class="agent-message" id="intervention-coach-msg">
          <span class="text-muted">Anchor is thinking...</span>
        </div>
      </div>
    </div>

    <!-- Action Buttons (hidden until messages are typed) -->
    <div class="action-buttons hidden" id="intervention-actions">
      <button class="action-btn action-btn-recommended" id="intervention-action-task">
        <span class="action-icon">🎯</span>
        <span class="action-text">
          <span class="action-label">Open my real task</span>
          <span class="action-desc">Get back to what matters</span>
        </span>
      </button>

      <button class="action-btn" id="intervention-action-break">
        <span class="action-icon">⏸️</span>
        <span class="action-text">
          <span class="action-label">Take a 2-min break</span>
          <span class="action-desc">Logged and timed</span>
        </span>
      </button>

      <button class="action-btn action-btn-danger" id="intervention-action-proceed">
        <span class="action-icon">⚠️</span>
        <span class="action-text">
          <span class="action-label">Proceed anyway</span>
          <span class="action-desc">Your stake may be affected</span>
        </span>
      </button>
    </div>

    <!-- Break Timer (hidden initially) -->
    <div class="break-timer hidden" id="intervention-break-timer">
      <div class="timer-display" id="break-timer-display">2:00</div>
      <div class="timer-label">Break in progress — breathe 🌿</div>
    </div>
  `;

  container.appendChild(screen);

  // ---- DOM refs ----
  const tempterMsgEl = screen.querySelector('#intervention-tempter-msg');
  const coachMsgEl = screen.querySelector('#intervention-coach-msg');
  const actionsEl = screen.querySelector('#intervention-actions');
  const breakTimerEl = screen.querySelector('#intervention-break-timer');
  const breakTimerDisplay = screen.querySelector('#break-timer-display');

  // ---- Fire the agent calls ----
  runIntervention();

  // Store suggested stake from the coach for the proceed handler
  let suggestedStakeFromAgent = 10;

  async function runIntervention() {
    let tempterText = '';
    let coachText = '';

    const fallbackTempter = "Come on, just a quick scroll won't hurt. You've been working hard — you deserve a little break. It's only Instagram...";
    const fallbackCoach = `You have ${progress.total - progress.done} goals still pending. Last time you said "just a minute" it turned into 18. Your future self is counting on you right now.`;

    try {
      // Run both agent calls in parallel
      const [tempterResult, coachResult] = await Promise.all([
        generateTempterResponse(app.appName),
        generateIntervention(app.appName),
      ]);

      // Extract .message from response objects
      tempterText = (tempterResult && tempterResult.message) ? tempterResult.message : fallbackTempter;
      coachText = (coachResult && coachResult.message) ? coachResult.message : fallbackCoach;

      // Capture suggested stake from coach
      if (coachResult && typeof coachResult.suggested_stake === 'number') {
        suggestedStakeFromAgent = coachResult.suggested_stake;
      }
    } catch (err) {
      console.error('Agent generation failed, using fallbacks:', err);
      tempterText = fallbackTempter;
      coachText = fallbackCoach;
    }

    // Typewrite tempter message first
    await typewrite(tempterMsgEl, tempterText, 25);

    // Then coach message
    await typewrite(coachMsgEl, coachText, 25);

    // Show action buttons with a slight delay
    setTimeout(() => {
      actionsEl.classList.remove('hidden');
    }, 300);
  }

  // ---- Action Handlers ----

  // 🎯 Open my real task
  screen.querySelector('#intervention-action-task').addEventListener('click', () => {
    addIntervention({
      appName: app.appName,
      userAction: 'open_task',
      goalsAtTime: progress,
    });

    addMemory(
      `Chose to open real task instead of ${app.appName}. Had ${progress.done}/${progress.total} goals done.`,
      { app: app.appName, action: 'open_task', date: new Date().toISOString() }
    );

    // Show brief success indicator then navigate
    showToast(screen, '🎯 Great choice! Back to your tasks.');
    setTimeout(() => {
      window.navigateTo('dashboard');
    }, 1200);
  });

  // ⏸️ Take a 2-min break
  screen.querySelector('#intervention-action-break').addEventListener('click', () => {
    addIntervention({
      appName: app.appName,
      userAction: 'break',
      goalsAtTime: progress,
    });

    // Hide actions, show timer
    actionsEl.classList.add('hidden');
    breakTimerEl.classList.remove('hidden');

    startBreakTimer(120, breakTimerDisplay, () => {
      showToast(screen, '⏸️ Break over! Let\'s refocus.');
      setTimeout(() => {
        window.navigateTo('dashboard');
      }, 1200);
    });
  });

  // ⚠️ Proceed anyway
  screen.querySelector('#intervention-action-proceed').addEventListener('click', () => {
    const over = isOverLimit(app.appName);
    const currency = getStakeCurrency();

    addIntervention({
      appName: app.appName,
      userAction: 'proceed',
      overLimit: over.isOver,
      goalsAtTime: progress,
    });

    addMemory(
      `Chose to proceed to ${app.appName} despite intervention. ${over.isOver ? 'Was over limit.' : 'Was within limit.'} Had ${progress.done}/${progress.total} goals done.`,
      { app: app.appName, action: 'proceed', overLimit: over.isOver, date: new Date().toISOString() }
    );

    if (over.isOver) {
      // Stake consequence
      const suggestedStake = suggestedStakeFromAgent;

      addStakeTransaction({
        amount: suggestedStake,
        destination: 'reinvest:DSA Course',
        reason: 'Over-limit Instagram usage',
      });

      // Show consequence animation
      actionsEl.classList.add('hidden');
      const consequenceEl = document.createElement('div');
      consequenceEl.className = 'glass-card-elevated flex flex-col items-center gap-4 mt-4';
      consequenceEl.innerHTML = `
        <span class="emoji-xl">💸</span>
        <p class="text-danger font-bold text-lg">Stake Deducted</p>
        <p class="text-2xl font-bold balance-flash">-${currency}${suggestedStake}</p>
        <p class="text-secondary text-sm">Redirected to: DSA Course</p>
        <p class="text-muted text-xs">Remaining balance: ${currency}${getStakeBalance()}</p>
      `;
      screen.querySelector('#intervention-debate').appendChild(consequenceEl);

      setTimeout(() => {
        window.navigateTo('dashboard');
      }, 2500);
    } else {
      // Not over limit — just record and navigate
      showToast(screen, '⚠️ Usage logged. Stay mindful!');
      setTimeout(() => {
        window.navigateTo('dashboard');
      }, 1200);
    }
  });
}

// ---- Break Timer ----

/**
 * Starts a countdown timer.
 * @param {number} totalSeconds
 * @param {HTMLElement} displayEl
 * @param {Function} onComplete
 */
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

// ---- Toast ----

/**
 * Shows a brief toast notification.
 * @param {HTMLElement} parent
 * @param {string} message
 */
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
