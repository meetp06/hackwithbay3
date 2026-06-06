/* ============================================================
   ANCHOR — Centralized State Store
   localStorage-backed reactive state with event emitter
   ============================================================ */

const STORAGE_KEY = 'anchor_state';
const API_KEY_STORAGE = 'anchor_api_key';

// ---------- Event Emitter ----------
const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(key, value) {
  listeners.forEach((fn) => {
    try { fn(key, value); } catch (e) { console.error('State listener error:', e); }
  });
}

// ---------- Default State ----------
function createDefaultState() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  return {
    user: {
      id: 'user_1',
      name: 'Meet',
      onboarded: false,
    },

    goals: [
      {
        id: 'goal_1',
        date: today,
        text: 'Apply to 3 jobs',
        status: 'open',
      },
      {
        id: 'goal_2',
        date: today,
        text: 'Go to the gym',
        status: 'open',
      },
      {
        id: 'goal_3',
        date: today,
        text: 'Finish DSA module 4',
        status: 'open',
      },
    ],

    watchedApps: [
      {
        id: 'app_1',
        appName: 'Instagram',
        icon: '📸',
        dailyMinutesLimit: 5,
        dailyOpenLimit: 3,
      },
    ],

    usageEvents: [],

    interventions: [],

    stakeLedger: {
      balance: 100,
      currency: '₹',
      transactions: [],
    },

    // Pre-seeded memories for demo impact
    memories: [
      {
        id: 'mem_1',
        text: "Said 'just 2 minutes' but spent 18 minutes scrolling Instagram Reels. Chose 'proceed anyway' despite being over limit.",
        metadata: {
          app: 'Instagram',
          excuse: 'just 2 minutes',
          actualDuration: 18,
          action: 'proceed',
          date: getRelativeDate(-3),
        },
        timestamp: getRelativeDate(-3),
      },
      {
        id: 'mem_2',
        text: "Claimed 'just checking DMs' but ended up scrolling the feed for 12 minutes. Had 0 of 2 tasks done at that point.",
        metadata: {
          app: 'Instagram',
          excuse: 'just checking DMs',
          actualDuration: 12,
          action: 'proceed',
          date: getRelativeDate(-1),
        },
        timestamp: getRelativeDate(-1),
      },
      {
        id: 'mem_3',
        text: "Chose 'Open my real task' and went back to job applications. Completed 2 applications in the next hour.",
        metadata: {
          app: 'Instagram',
          excuse: null,
          actualDuration: 0,
          action: 'open_task',
          date: getRelativeDate(-2),
        },
        timestamp: getRelativeDate(-2),
      },
    ],

    weeklyHistory: generateWeeklyHistory(),
  };
}

function getRelativeDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() + daysAgo);
  return d.toISOString();
}

function generateWeeklyHistory() {
  const history = [];
  for (let i = 6; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    history.push({
      date: d.toISOString().split('T')[0],
      minutesUsed: Math.floor(Math.random() * 12) + 2,
      opens: Math.floor(Math.random() * 5) + 1,
      interventions: Math.floor(Math.random() * 3),
      proceeded: Math.random() > 0.6 ? 1 : 0,
    });
  }
  return history;
}

// ---------- State Object ----------
let state = null;

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      state = JSON.parse(stored);
      // Ensure all keys exist (merge with defaults for new fields)
      const defaults = createDefaultState();
      for (const key of Object.keys(defaults)) {
        if (!(key in state)) {
          state[key] = defaults[key];
        }
      }
      return;
    }
  } catch (e) {
    console.warn('Failed to load state, using defaults:', e);
  }
  state = createDefaultState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save state:', e);
  }
}

// ---------- Public API ----------

export function initializeStore() {
  loadState();
}

export function getState() {
  if (!state) loadState();
  return state;
}

export function setState(key, value) {
  if (!state) loadState();
  state[key] = value;
  saveState();
  notify(key, value);
}

export function updateUser(updates) {
  const s = getState();
  s.user = { ...s.user, ...updates };
  saveState();
  notify('user', s.user);
}

export function resetStore() {
  state = createDefaultState();
  saveState();
  notify('reset', state);
}

// ---------- Goals ----------

export function getTodayGoals() {
  const today = new Date().toISOString().split('T')[0];
  return getState().goals.filter((g) => g.date === today);
}

export function setGoals(goals) {
  setState('goals', goals);
}

export function toggleGoal(goalId) {
  const s = getState();
  const goal = s.goals.find((g) => g.id === goalId);
  if (goal) {
    goal.status = goal.status === 'done' ? 'open' : 'done';
    saveState();
    notify('goals', s.goals);
  }
}

export function getGoalProgress() {
  const todayGoals = getTodayGoals();
  if (todayGoals.length === 0) return { done: 0, total: 0, percent: 0 };
  const done = todayGoals.filter((g) => g.status === 'done').length;
  return { done, total: todayGoals.length, percent: Math.round((done / todayGoals.length) * 100) };
}

// ---------- Watched Apps ----------

export function getWatchedApps() {
  return getState().watchedApps;
}

export function setWatchedApps(apps) {
  setState('watchedApps', apps);
}

// ---------- Usage Events ----------

export function addUsageEvent(event) {
  const s = getState();
  const newEvent = {
    id: `usage_${Date.now()}`,
    openedAt: new Date().toISOString(),
    durationSec: 0,
    overLimit: false,
    ...event,
  };
  s.usageEvents.push(newEvent);
  saveState();
  notify('usageEvents', s.usageEvents);
  return newEvent;
}

export function updateUsageEvent(eventId, updates) {
  const s = getState();
  const event = s.usageEvents.find((e) => e.id === eventId);
  if (event) {
    Object.assign(event, updates);
    saveState();
    notify('usageEvents', s.usageEvents);
  }
}

export function getTodayUsage(appName) {
  const today = new Date().toISOString().split('T')[0];
  const events = getState().usageEvents.filter(
    (e) => e.appName === appName && e.openedAt.startsWith(today)
  );
  const totalSeconds = events.reduce((sum, e) => sum + (e.durationSec || 0), 0);
  return {
    events,
    opens: events.length,
    totalMinutes: Math.round(totalSeconds / 60),
    totalSeconds,
  };
}

export function isOverLimit(appName) {
  const app = getState().watchedApps.find((a) => a.appName === appName);
  if (!app) return { overTime: false, overOpens: false, isOver: false };

  const usage = getTodayUsage(appName);
  const overTime = usage.totalMinutes >= app.dailyMinutesLimit;
  const overOpens = usage.opens >= app.dailyOpenLimit;

  return { overTime, overOpens, isOver: overTime || overOpens, usage, limits: app };
}

// ---------- Interventions ----------

export function addIntervention(intervention) {
  const s = getState();
  const newIntervention = {
    id: `int_${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...intervention,
  };
  s.interventions.push(newIntervention);
  saveState();
  notify('interventions', s.interventions);
  return newIntervention;
}

export function getTodayInterventions() {
  const today = new Date().toISOString().split('T')[0];
  return getState().interventions.filter((i) => i.createdAt.startsWith(today));
}

// ---------- Stake Ledger ----------

export function getStakeBalance() {
  return getState().stakeLedger.balance;
}

export function getStakeCurrency() {
  return getState().stakeLedger.currency;
}

export function addStakeTransaction(tx) {
  const s = getState();
  const transaction = {
    id: `tx_${Date.now()}`,
    createdAt: new Date().toISOString(),
    isTest: true,
    ...tx,
  };
  s.stakeLedger.transactions.unshift(transaction);
  s.stakeLedger.balance = Math.max(0, s.stakeLedger.balance - transaction.amount);
  saveState();
  notify('stakeLedger', s.stakeLedger);
  return transaction;
}

export function getStakeTransactions() {
  return getState().stakeLedger.transactions;
}

export function setStakeBalance(balance) {
  const s = getState();
  s.stakeLedger.balance = balance;
  saveState();
  notify('stakeLedger', s.stakeLedger);
}

// ---------- Memories ----------

export function addMemory(text, metadata = {}) {
  const s = getState();
  const memory = {
    id: `mem_${Date.now()}`,
    text,
    metadata,
    timestamp: new Date().toISOString(),
  };
  s.memories.push(memory);
  saveState();
  notify('memories', s.memories);
  return memory;
}

export function getMemories() {
  return getState().memories;
}

/**
 * Simple keyword-based relevance scoring for memory retrieval.
 * In production, this would use real vector embeddings + cosine similarity.
 * For the hackathon, TF-IDF-like keyword overlap works surprisingly well.
 */
export function retrieveRelevantMemories(query, k = 2) {
  const memories = getMemories();
  if (memories.length === 0) return [];

  const queryWords = tokenize(query);

  const scored = memories.map((mem) => {
    const memWords = tokenize(mem.text);
    const overlap = queryWords.filter((w) => memWords.includes(w)).length;
    const score = overlap / Math.max(queryWords.length, 1);
    return { memory: mem, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).filter((s) => s.score > 0).map((s) => s.memory);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

// ---------- Weekly History ----------

export function getWeeklyHistory() {
  return getState().weeklyHistory || [];
}

export function getWeekSummary() {
  const history = getWeeklyHistory();
  if (history.length === 0) {
    return {
      avgMinutes: 0,
      avgOpens: 0,
      totalInterventions: 0,
      complianceRate: 0,
      days: 0,
    };
  }

  const totalMin = history.reduce((s, d) => s + d.minutesUsed, 0);
  const totalOpens = history.reduce((s, d) => s + d.opens, 0);
  const totalInts = history.reduce((s, d) => s + d.interventions, 0);
  const totalProceeded = history.reduce((s, d) => s + d.proceeded, 0);

  return {
    avgMinutes: Math.round(totalMin / history.length),
    avgOpens: Math.round(totalOpens / history.length),
    totalInterventions: totalInts,
    complianceRate: totalInts > 0 ? Math.round(((totalInts - totalProceeded) / totalInts) * 100) : 100,
    days: history.length,
    history,
  };
}

// ---------- API Key ----------

export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function setApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE, key);
  notify('apiKey', key);
}

export function hasApiKey() {
  return !!getApiKey();
}
