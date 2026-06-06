/* ============================================================
   ANCHOR — Agent Memory Layer
   Retrieval, storage, and formatting of behavioral memories
   ============================================================ */

import { retrieveRelevantMemories, addMemory, getMemories } from '../state.js';

/**
 * Retrieves top-k relevant memories for a given app + context,
 * formatted as human-readable strings for prompt injection.
 * @param {string} appName - The app being opened
 * @param {string} context - Additional context (e.g. "scrolling", "over limit")
 * @returns {string[]} Array of formatted memory strings
 */
export function getRelevantMemories(appName, context = '') {
  const query = `${appName} ${context} scrolling distraction procrastination excuse`.trim();
  const memories = retrieveRelevantMemories(query, 2);
  return memories.map((mem) => {
    const daysAgo = getDaysAgo(mem.timestamp);
    const timeLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;
    return `[${timeLabel}] ${mem.text}`;
  });
}

/**
 * Stores a new memory after an intervention interaction.
 * Converts structured data into a natural language sentence
 * so the memory is useful for future LLM context.
 * @param {object} data
 * @param {string} data.appName
 * @param {string} data.userAction - "open_task" | "break" | "proceed"
 * @param {string|null} data.excuse - What the user said / the temptation they faced
 * @param {number} data.duration - Minutes spent on the app this session
 * @param {object} data.goalsStatus - {done, total}
 */
export function storeInterventionMemory(data) {
  const { appName, userAction, excuse, duration, goalsStatus } = data;

  let sentence = '';

  if (userAction === 'proceed') {
    sentence = excuse
      ? `Said '${excuse}' but chose to keep using ${appName}.`
      : `Chose to proceed on ${appName} despite the intervention.`;
    if (duration > 0) {
      sentence += ` Spent ${duration} minutes total.`;
    }
    if (goalsStatus) {
      sentence += ` Had ${goalsStatus.done} of ${goalsStatus.total} goals done at that point.`;
    }
  } else if (userAction === 'open_task') {
    sentence = `Chose 'Open my real task' instead of ${appName}.`;
    if (goalsStatus) {
      sentence += ` Had ${goalsStatus.done} of ${goalsStatus.total} goals remaining.`;
    }
  } else if (userAction === 'break') {
    sentence = `Took a break instead of continuing on ${appName}.`;
  } else {
    sentence = `Interacted with intervention for ${appName}. Action: ${userAction}.`;
  }

  addMemory(sentence, {
    app: appName,
    excuse: excuse || null,
    actualDuration: duration || 0,
    action: userAction,
    date: new Date().toISOString(),
  });
}

/**
 * Formats an array of memory objects into a string block for LLM context.
 * @param {Array} memories - Array of memory objects from getMemories()
 * @returns {string}
 */
export function formatMemoryForPrompt(memories) {
  if (!memories || memories.length === 0) {
    return 'No past behavioral memories recorded yet.';
  }

  return memories
    .map((mem) => {
      const daysAgo = getDaysAgo(mem.timestamp);
      const timeLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`;
      return `[${timeLabel}] ${mem.text}`;
    })
    .join('\n');
}

// ---------- Helpers ----------

/**
 * Calculate how many days ago a timestamp was.
 * @param {string} isoTimestamp
 * @returns {number}
 */
function getDaysAgo(isoTimestamp) {
  const then = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
