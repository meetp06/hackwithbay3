/* ============================================================
   ANCHOR — App Shell & Router
   Hash-based SPA router with screen lifecycle management
   ============================================================ */

import './styles/index.css';
import { initializeStore, getState, updateUser, hasApiKey, setApiKey, subscribe, resetStore } from './state.js';

// Lazy-load screens
const screens = {
  onboarding: () => import('./screens/onboarding.js'),
  dashboard: () => import('./screens/dashboard.js'),
  intervention: () => import('./screens/intervention.js'),
  ledger: () => import('./screens/ledger.js'),
  replan: () => import('./screens/replan.js'),
};

let currentScreen = null;
let currentCleanup = null;

// ---------- Router ----------

function getRoute() {
  const hash = window.location.hash.replace('#', '') || '';
  return hash || null;
}

async function navigate(route) {
  const app = document.getElementById('app');
  if (!app) return;

  // Cleanup previous screen
  if (currentCleanup && typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }

  // Determine route
  if (!route) {
    const state = getState();
    route = state.user.onboarded ? 'dashboard' : 'onboarding';
  }

  // Validate route
  if (!screens[route]) {
    route = 'dashboard';
  }

  // Update hash without triggering re-navigation
  if (window.location.hash !== `#${route}`) {
    history.replaceState(null, '', `#${route}`);
  }

  currentScreen = route;

  // Clear app content
  app.innerHTML = '';

  // Create screen container
  const container = document.createElement('div');
  container.className = route === 'intervention' ? '' : 'app-container';
  container.id = `screen-${route}`;
  app.appendChild(container);

  // Load and render screen
  try {
    const module = await screens[route]();
    const cleanup = module.render(container);
    if (typeof cleanup === 'function') {
      currentCleanup = cleanup;
    }
  } catch (err) {
    console.error(`Failed to load screen "${route}":`, err);
    container.innerHTML = `
      <div class="flex flex-col flex-center" style="min-height: 80vh; gap: var(--space-6);">
        <div class="emoji-xl">⚠️</div>
        <h2 class="heading text-xl">Something went wrong</h2>
        <p class="text-secondary text-sm">${err.message}</p>
        <button class="btn btn-primary" id="error-retry">Try Again</button>
      </div>
    `;
    const retryBtn = document.getElementById('error-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => navigate(route));
    }
  }

  // Add nav bar (except on onboarding and intervention)
  if (route !== 'onboarding' && route !== 'intervention') {
    renderNavBar(app, route);
  }
}

// ---------- Navigation Bar ----------

function renderNavBar(app, activeRoute) {
  // Remove existing nav
  const existingNav = document.querySelector('.nav-bar');
  if (existingNav) existingNav.remove();

  const nav = document.createElement('nav');
  nav.className = 'nav-bar';
  nav.setAttribute('aria-label', 'Main navigation');
  nav.innerHTML = `
    <button class="nav-item ${activeRoute === 'dashboard' ? 'active' : ''}" data-route="dashboard" id="nav-dashboard">
      <span class="nav-icon">📊</span>
      <span>Dashboard</span>
    </button>
    <button class="nav-item ${activeRoute === 'ledger' ? 'active' : ''}" data-route="ledger" id="nav-ledger">
      <span class="nav-icon">💰</span>
      <span>Ledger</span>
    </button>
    <button class="nav-item ${activeRoute === 'replan' ? 'active' : ''}" data-route="replan" id="nav-replan">
      <span class="nav-icon">🔄</span>
      <span>Re-plan</span>
    </button>
    <button class="nav-item" id="nav-settings">
      <span class="nav-icon">⚙️</span>
      <span>Settings</span>
    </button>
  `;

  app.appendChild(nav);

  // Nav event listeners
  nav.querySelectorAll('.nav-item[data-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const route = btn.dataset.route;
      window.navigateTo(route);
    });
  });

  // Settings button - show settings modal
  const settingsBtn = document.getElementById('nav-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => showSettingsModal());
  }
}

// ---------- Settings Modal ----------

function showSettingsModal() {
  const existing = document.getElementById('settings-modal');
  if (existing) existing.remove();

  const state = getState();

  const modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-card">
      <h2 class="heading text-xl mb-6">⚙️ Settings</h2>
      
      <div class="input-group mb-4">
        <label class="input-label" for="settings-api-key">Gemini API Key</label>
        <input type="password" class="input input-mono" id="settings-api-key" 
               placeholder="AIza..." value="${hasApiKey() ? '••••••••••••••••' : ''}" />
        <p class="text-xs text-muted mt-1">Used for AI agent brain. Get one free at makersuite.google.com</p>
      </div>

      <div class="input-group mb-6">
        <label class="input-label" for="settings-name">Your Name</label>
        <input type="text" class="input" id="settings-name" value="${state.user.name}" />
      </div>

      <div class="divider"></div>
      
      <div class="flex flex-col gap-3 mt-4">
        <button class="btn btn-primary btn-block" id="settings-save">Save Settings</button>
        <button class="btn btn-ghost btn-block" id="settings-close">Cancel</button>
        <button class="btn btn-danger btn-block mt-4" id="settings-reset" 
                style="opacity: 0.6; font-size: var(--font-size-xs);">Reset All Data</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.getElementById('settings-close').addEventListener('click', () => modal.remove());

  document.getElementById('settings-save').addEventListener('click', () => {
    const apiKeyInput = document.getElementById('settings-api-key');
    const nameInput = document.getElementById('settings-name');

    if (apiKeyInput.value && !apiKeyInput.value.includes('•')) {
      setApiKey(apiKeyInput.value.trim());
    }
    if (nameInput.value.trim()) {
      updateUser({ name: nameInput.value.trim() });
    }
    modal.remove();
  });

  document.getElementById('settings-reset').addEventListener('click', () => {
    if (confirm('Reset all data? This will clear your goals, usage history, and memories.')) {
      resetStore();
      localStorage.removeItem('anchor_api_key');
      modal.remove();
      window.navigateTo('onboarding');
    }
  });
}

// ---------- API Key Prompt ----------

function showApiKeyPrompt() {
  const modal = document.createElement('div');
  modal.id = 'api-key-modal';
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-card">
      <div class="flex flex-col flex-center gap-4 mb-6">
        <div class="emoji-xl">⚓</div>
        <h2 class="heading text-xl">Power Up Anchor</h2>
        <p class="text-secondary text-sm" style="text-align: center; line-height: 1.6;">
          Add a Gemini API key to enable the AI agent brain. 
          Without it, Anchor uses pre-scripted responses.
        </p>
      </div>
      
      <div class="input-group mb-6">
        <label class="input-label" for="api-key-input">Gemini API Key (optional)</label>
        <input type="text" class="input input-mono" id="api-key-input" 
               placeholder="AIzaSy..." autocomplete="off" />
        <p class="text-xs text-muted mt-1">
          Free at <span style="color: var(--color-primary);">aistudio.google.com/apikey</span>
        </p>
      </div>

      <div class="flex flex-col gap-3">
        <button class="btn btn-primary btn-block btn-lg" id="api-key-save">
          Save & Continue
        </button>
        <button class="btn btn-ghost btn-block" id="api-key-skip">
          Skip — use scripted fallback
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('api-key-save').addEventListener('click', () => {
    const key = document.getElementById('api-key-input').value.trim();
    if (key) setApiKey(key);
    modal.remove();
    navigate(getRoute());
  });

  document.getElementById('api-key-skip').addEventListener('click', () => {
    modal.remove();
    navigate(getRoute());
  });
}

// ---------- Global Navigation ----------

window.navigateTo = function (route) {
  window.location.hash = route;
};

// ---------- Init ----------

function init() {
  // Initialize state
  initializeStore();

  // Remove initial loader
  const loader = document.getElementById('initial-loader');
  if (loader) loader.remove();

  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    navigate(getRoute());
  });

  // Check for API key on first visit
  const state = getState();
  if (!hasApiKey() && !state.user.onboarded) {
    showApiKeyPrompt();
  } else {
    navigate(getRoute());
  }
}

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
