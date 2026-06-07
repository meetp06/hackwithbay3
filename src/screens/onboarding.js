/* ============================================================
   ANCHOR — Onboarding Screen
   Multi-step onboarding: Auth → Goals → App Limits → Stake
   ============================================================ */

import { insforge, syncStateFromInsForge } from '../insforge.js';
import { updateUser, getState } from '../state.js';

export function render(container) {
  let currentStep = 0; // Step 0 is Auth

  // ---- State for each step ----
  const formData = {
    email: 'meet@example.com',
    password: 'password123',
    name: 'Meet',
    goalsText: 'Apply to 3 jobs\nGo to the gym\nFinish DSA module 4',
    selectedApp: 'Instagram',
    selectedIcon: '📸',
    minutesLimit: 5,
    maxOpens: 3,
    stakeAmount: 100,
    isSignUp: false, // Login by default
  };

  // ---- Build the DOM ----
  const screen = document.createElement('div');
  screen.className = 'screen flex flex-col flex-center';

  screen.innerHTML = `
    <div class="glass-card" style="max-width: 480px; width: 100%;">
      <div class="flex flex-col items-center mb-6">
        <div class="hero-mark">A</div>
        <h1 class="heading mt-3">Welcome to Mainframe</h1>
        <p class="text-secondary">Your AI accountability partner</p>
      </div>

      <div class="stepper mb-6" id="onboarding-stepper">
        <div class="stepper-dot active" id="step-dot-0">0</div>
        <div class="stepper-line"></div>
        <div class="stepper-dot" id="step-dot-1">1</div>
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

  function renderStep0() {
    stepContent.innerHTML = `
      <div class="flex flex-col gap-4">
        <h2 class="subheading text-center" id="auth-title">${formData.isSignUp ? 'Create your Account' : 'Sign In'}</h2>
        
        <div class="input-group">
          <label class="input-label" for="onboarding-email">Email</label>
          <input class="input" type="email" id="onboarding-email" value="${formData.email}" placeholder="enter your email" />
        </div>

        <div class="input-group">
          <label class="input-label" for="onboarding-password">Password</label>
          <input class="input" type="password" id="onboarding-password" value="${formData.password}" placeholder="enter your password" />
        </div>

        <button class="btn btn-primary btn-lg btn-block mt-2" id="auth-submit-btn">
          ${formData.isSignUp ? 'Sign Up' : 'Sign In'}
        </button>

        <div class="flex justify-center mt-2">
          <button class="btn btn-ghost text-xs" id="auth-toggle-btn">
            ${formData.isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>

        <div class="divider"></div>
        
        <p class="text-xs text-muted text-center" style="line-height: 1.4;">
          💡 <strong>Tip:</strong> You can log in instantly using the pre-seeded account:<br/>
          Email: <code style="color:var(--color-primary);">meet@example.com</code> / Password: <code style="color:var(--color-primary);">password123</code>
        </p>
      </div>
    `;

    // Bind inputs
    const emailInput = stepContent.querySelector('#onboarding-email');
    const passInput = stepContent.querySelector('#onboarding-password');

    emailInput.addEventListener('input', (e) => { formData.email = e.target.value.trim(); });
    passInput.addEventListener('input', (e) => { formData.password = e.target.value.trim(); });

    // Submit handler
    stepContent.querySelector('#auth-submit-btn').addEventListener('click', async () => {
      if (!formData.email || !formData.password) {
        alert('Please fill in both email and password');
        return;
      }

      const submitBtn = stepContent.querySelector('#auth-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating...';

      try {
        if (formData.isSignUp) {
          const { data, error } = await insforge.auth.signUp({
            email: formData.email,
            password: formData.password,
            name: formData.name,
          });

          if (error) throw error;
          
          alert('Account created! For this demo, we\'ve pre-verified your account. Please click sign in now.');
          formData.isSignUp = false;
          goToStep(0);
        } else {
          const { data, error } = await insforge.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });

          if (error) throw error;

          console.log('Successfully logged in user:', data.user.email);
          
          // Check if already onboarded by querying watched apps
          const { data: apps } = await insforge.database
            .from("watched_apps")
            .select("*")
            .eq("user_id", data.user.id);

          if (apps && apps.length > 0) {
            // Already has app limits config, sync and bypass remaining onboarding
            console.log('User already onboarded, syncing database...');
            await syncStateFromInsForge();
            window.navigateTo('dashboard');
          } else {
            // First time onboarding, continue
            goToStep(1);
          }
        }
      } catch (err) {
        console.error('[Onboarding Auth Error] raw:', err);
        const detail = err?.message
          || err?.error
          || err?.data?.message
          || (typeof err === 'string' ? err : JSON.stringify(err, Object.getOwnPropertyNames(err || {})));
        alert(`Authentication Error: ${detail}\n\nOpen DevTools console + Network tab for full details.`);
        submitBtn.disabled = false;
        submitBtn.textContent = formData.isSignUp ? 'Sign Up' : 'Sign In';
      }
    });

    // Toggle mode
    stepContent.querySelector('#auth-toggle-btn').addEventListener('click', () => {
      formData.isSignUp = !formData.isSignUp;
      goToStep(0);
    });
  }

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
    const APPS = [
      { name: 'Instagram', icon: 'IG' },
      { name: 'LinkedIn',  icon: 'IN' },
      { name: 'Facebook',  icon: 'FB' },
      { name: 'WhatsApp',  icon: 'WA' },
      { name: 'X',         icon: 'X'  },
      { name: 'TikTok',    icon: 'TT' },
      { name: 'YouTube',   icon: 'YT' },
      { name: 'Snapchat',  icon: 'SC' },
    ];
    stepContent.innerHTML = `
      <div class="flex flex-col gap-4">
        <h2 class="subheading">Which app to watch?</h2>

        <div class="flex" style="gap:6px; flex-wrap:wrap;">
          ${APPS.map((a) => `
            <button type="button" class="chip onboarding-app-chip ${a.name === formData.selectedApp ? 'active' : ''}" data-app="${a.name}" data-icon="${a.icon}" style="display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:1px solid var(--color-border-default);background:rgba(255,255,255,0.85);font-size:0.75rem;font-weight:600;color:var(--color-text-secondary);cursor:pointer;">
              <span class="app-icon-chip" data-app="${a.name}" style="width:18px;height:18px;font-size:9px;border-radius:6px;">${a.icon}</span>
              ${a.name}
            </button>
          `).join('')}
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

    // App selector chips
    stepContent.querySelectorAll('.onboarding-app-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        formData.selectedApp = chip.dataset.app;
        formData.selectedIcon = chip.dataset.icon;
        stepContent.querySelectorAll('.onboarding-app-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });

    // Limits
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
          <label class="input-label" for="onboarding-stake">Stake amount ($)</label>
          <input class="input" type="number" id="onboarding-stake" value="${formData.stakeAmount}" min="10" max="10000" />
        </div>

        <div class="flex items-center gap-2 mt-2">
          <span class="badge badge-test">TEST MODE</span>
          <span class="text-xs text-muted">No real money is moved in this demo</span>
        </div>

        <button class="btn btn-success btn-xl btn-block mt-4 btn-pulse-success" id="onboarding-launch">
          Launch Mainframe
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
    const steps = [0, 1, 2, 3];
    steps.forEach((i) => {
      const dot = screen.querySelector(`#step-dot-${i}`);
      if (dot) {
        dot.classList.remove('active', 'completed');
        if (i < step) dot.classList.add('completed');
        if (i === step) dot.classList.add('active');
      }
    });
  }

  function goToStep(step) {
    currentStep = step;
    updateStepper(step);

    // Animate transition
    stepContent.style.opacity = '0';
    stepContent.style.transform = 'translateX(20px)';

    setTimeout(() => {
      if (step === 0) renderStep0();
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

  async function completeOnboarding() {
    const launchBtn = stepContent.querySelector('#onboarding-launch');
    launchBtn.disabled = true;
    launchBtn.textContent = 'Saving to Database...';

    try {
      const { data: { user } } = await insforge.auth.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];

      // 1. Save profile / name
      await insforge.database.from("users").upsert({
        id: user.id,
        name: formData.name,
        email: user.email,
      });

      // 2. Parse and save goals
      const goalLines = formData.goalsText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (goalLines.length > 0) {
        await insforge.database.from("goals").insert(goalLines.map(text => ({
          user_id: user.id,
          date: today,
          text: text,
          status: 'open',
        })));
      }

      // 3. Save watched app limits — seed all 4 social apps, custom limits on selected
      const DEFAULTS = [
        { name: 'Instagram', mins: 5,  opens: 3 },
        { name: 'LinkedIn',  mins: 10, opens: 4 },
        { name: 'Facebook',  mins: 5,  opens: 3 },
        { name: 'WhatsApp',  mins: 15, opens: 6 },
        { name: 'X',         mins: 8,  opens: 4 },
        { name: 'TikTok',    mins: 5,  opens: 2 },
        { name: 'YouTube',   mins: 20, opens: 3 },
        { name: 'Snapchat',  mins: 5,  opens: 3 },
      ];
      const watchedRows = DEFAULTS.map((a) => ({
        user_id: user.id,
        app_name: a.name,
        daily_minutes_limit: a.name === formData.selectedApp ? formData.minutesLimit : a.mins,
        daily_open_limit:    a.name === formData.selectedApp ? formData.maxOpens     : a.opens,
      }));
      await insforge.database.from("watched_apps").insert(watchedRows);

      // 4. Save initial stake seed transaction (negative amount = credit)
      await insforge.database.from("stake_ledger").insert([{
        user_id: user.id,
        amount: -formData.stakeAmount,
        destination: "Initial Stake",
        reason: `Seeded initial stake balance of $${formData.stakeAmount}`,
        is_test: true,
      }]);

      console.log('Successfully completed onboarding in Postgres!');

      // Synchronize database to state manager
      await syncStateFromInsForge();

      // Navigate to dashboard
      window.navigateTo('dashboard');
    } catch (err) {
      alert(`Onboarding Save Error: ${err.message}`);
      launchBtn.disabled = false;
      launchBtn.textContent = 'Launch Mainframe 🚀';
    }
  }

  // ---- Initial Render ----
  goToStep(0);
}
