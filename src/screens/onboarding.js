/* ============================================================
   ANCHOR — Onboarding Screen
   Multi-step onboarding: Goals → App Limits → Stake
   ============================================================ */

import {
  updateUser,
  setGoals,
  setWatchedApps,
  setStakeBalance,
  getState,
} from '../state.js';

/**
 * Render the onboarding flow into the given container.
 * @param {HTMLElement} container
 */
export function render(container) {
  let currentStep = 1;

  // ---- State for each step ----
  const formData = {
    name: 'Meet',
    goalsText: 'Apply to 3 jobs\nGo to the gym\nFinish DSA module 4',
    selectedApp: 'Instagram',
    selectedIcon: '📸',
    minutesLimit: 5,
    maxOpens: 3,
    stakeAmount: 100,
  };

  // ---- Build the DOM ----
  const screen = document.createElement('div');
  screen.className = 'screen flex flex-col flex-center';

  screen.innerHTML = `
    <div class="glass-card" style="max-width: 480px; width: 100%;">
      <!-- Header -->
      <div class="flex flex-col items-center mb-6">
        <span class="emoji-xl">⚓</span>
        <h1 class="heading mt-2">Welcome to Anchor</h1>
        <p class="text-secondary">Your AI accountability partner</p>
      </div>

      <!-- Stepper -->
      <div class="stepper mb-6" id="onboarding-stepper">
        <div class="stepper-dot active" id="step-dot-1">1</div>
        <div class="stepper-line"></div>
        <div class="stepper-dot" id="step-dot-2">2</div>
        <div class="stepper-line"></div>
        <div class="stepper-dot" id="step-dot-3">3</div>
      </div>

      <!-- Step Content Area -->
      <div id="step-content"></div>
    </div>
  `;

  container.appendChild(screen);

  const stepContent = screen.querySelector('#step-content');

  // ---- Step Renderers ----

  function renderStep1() {
    stepContent.innerHTML = `
      <div class="flex flex-col gap-4">
        <div class="input-group">
          <label class="input-label" for="onboarding-name">Your name</label>
          <input class="input" type="text" id="onboarding-name" value="${formData.name}" placeholder="Enter your name" />
        </div>

        <div class="input-group">
          <label class="input-label" for="onboarding-goals">What are your goals today?</label>
          <textarea class="input" id="onboarding-goals" rows="4" placeholder="One goal per line">${formData.goalsText}</textarea>
        </div>

        <button class="btn btn-primary btn-lg btn-block mt-4" id="onboarding-step1-next">
          Continue →
        </button>
      </div>
    `;

    // Bind
    stepContent.querySelector('#onboarding-name').addEventListener('input', (e) => {
      formData.name = e.target.value.trim();
    });
    stepContent.querySelector('#onboarding-goals').addEventListener('input', (e) => {
      formData.goalsText = e.target.value;
    });
    stepContent.querySelector('#onboarding-step1-next').addEventListener('click', () => {
      if (!formData.name) { alert('Please enter your name'); return; }
      if (!formData.goalsText.trim()) { alert('Please enter at least one goal'); return; }
      goToStep(2);
    });
  }

  function renderStep2() {
    stepContent.innerHTML = `
      <div class="flex flex-col gap-4">
        <h2 class="subheading">Which app to watch?</h2>

        <div class="glass-card-solid flex items-center gap-4" id="onboarding-app-selector">
          <span class="emoji-lg">${formData.selectedIcon}</span>
          <div>
            <p class="font-bold">${formData.selectedApp}</p>
            <p class="text-xs text-muted">Selected for monitoring</p>
          </div>
          <span class="badge badge-primary" style="margin-left:auto;">Active</span>
        </div>

        <div class="input-group">
          <label class="input-label" for="onboarding-minutes">Daily time limit (minutes)</label>
          <input class="input" type="number" id="onboarding-minutes" value="${formData.minutesLimit}" min="1" max="120" />
        </div>

        <div class="input-group">
          <label class="input-label" for="onboarding-opens">Max opens per day</label>
          <input class="input" type="number" id="onboarding-opens" value="${formData.maxOpens}" min="1" max="50" />
        </div>

        <button class="btn btn-primary btn-lg btn-block mt-4" id="onboarding-step2-next">
          Continue →
        </button>
      </div>
    `;

    // Bind
    stepContent.querySelector('#onboarding-minutes').addEventListener('input', (e) => {
      formData.minutesLimit = parseInt(e.target.value, 10) || 5;
    });
    stepContent.querySelector('#onboarding-opens').addEventListener('input', (e) => {
      formData.maxOpens = parseInt(e.target.value, 10) || 3;
    });
    stepContent.querySelector('#onboarding-step2-next').addEventListener('click', () => {
      goToStep(3);
    });
  }

  function renderStep3() {
    stepContent.innerHTML = `
      <div class="flex flex-col gap-4">
        <h2 class="subheading">Set your stake</h2>

        <p class="text-secondary text-sm">
          Put some skin in the game. If you break your limits, a portion of your
          stake gets redirected to a goal you care about (like a course or charity).
        </p>

        <div class="input-group">
          <label class="input-label" for="onboarding-stake">Stake amount (₹)</label>
          <input class="input" type="number" id="onboarding-stake" value="${formData.stakeAmount}" min="10" max="10000" />
        </div>

        <div class="flex items-center gap-2 mt-2">
          <span class="badge badge-test">🧪 Test Mode</span>
          <span class="text-xs text-muted">No real money is moved in this demo</span>
        </div>

        <button class="btn btn-success btn-xl btn-block mt-4 btn-pulse-success" id="onboarding-launch">
          Launch Anchor 🚀
        </button>
      </div>
    `;

    // Bind
    stepContent.querySelector('#onboarding-stake').addEventListener('input', (e) => {
      formData.stakeAmount = parseInt(e.target.value, 10) || 100;
    });
    stepContent.querySelector('#onboarding-launch').addEventListener('click', () => {
      completeOnboarding();
    });
  }

  // ---- Stepper Logic ----

  function updateStepper(step) {
    for (let i = 1; i <= 3; i++) {
      const dot = screen.querySelector(`#step-dot-${i}`);
      dot.classList.remove('active', 'completed');
      if (i < step) dot.classList.add('completed');
      if (i === step) dot.classList.add('active');
    }
  }

  function goToStep(step) {
    currentStep = step;
    updateStepper(step);

    // Animate transition
    stepContent.style.opacity = '0';
    stepContent.style.transform = 'translateX(20px)';

    setTimeout(() => {
      if (step === 1) renderStep1();
      if (step === 2) renderStep2();
      if (step === 3) renderStep3();

      // Force reflow then animate in
      void stepContent.offsetHeight;
      stepContent.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      stepContent.style.opacity = '1';
      stepContent.style.transform = 'translateX(0)';
    }, 150);
  }

  // ---- Complete Onboarding ----

  function completeOnboarding() {
    const today = new Date().toISOString().split('T')[0];

    // Parse goals from textarea (one per line)
    const goalLines = formData.goalsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const goals = goalLines.map((text, i) => ({
      id: `goal_${i + 1}`,
      date: today,
      text,
      status: 'open',
    }));

    // Save everything to state
    updateUser({ name: formData.name, onboarded: true });
    setGoals(goals);
    setWatchedApps([
      {
        id: 'app_1',
        appName: formData.selectedApp,
        icon: formData.selectedIcon,
        dailyMinutesLimit: formData.minutesLimit,
        dailyOpenLimit: formData.maxOpens,
      },
    ]);
    setStakeBalance(formData.stakeAmount);

    // Navigate to dashboard
    window.navigateTo('dashboard');
  }

  // ---- Initial Render ----
  goToStep(1);
}
