/* ============================================================
   ANCHOR — Agent Brain
   Orchestrates context → prompt → LLM → response pipeline
   ============================================================ */

import {
  getState,
  getTodayGoals,
  getGoalProgress,
  getTodayUsage,
  isOverLimit,
  getApiKey,
  getWeekSummary,
} from '../state.js';

import {
  getCoachSystemPrompt,
  getTempterSystemPrompt,
  getReplanSystemPrompt,
  buildInterventionContext,
  buildReplanContext,
} from './prompts.js';

import { getRelevantMemories } from './memory.js';

import {
  getFallbackIntervention,
  getFallbackTempterResponse,
  getFallbackReplan,
} from './fallback.js';

// ---------- Public API ----------

/**
 * Main intervention generator. Gathers all user context,
 * calls Coach LLM, and returns a structured response.
 * Falls back to scripted response on any failure.
 * @param {string} appName - The watched app being opened
 * @returns {Promise<{message: string, recommended_action: string, suggested_stake: number}>}
 */
export async function generateIntervention(appName) {
  const fallbackContext = buildFallbackContext(appName);

  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.warn('[Anchor Brain] No API key — using fallback');
      return getFallbackIntervention(fallbackContext);
    }

    const state = getState();
    const goals = getTodayGoals();
    const goalProgress = getGoalProgress();
    const usage = getTodayUsage(appName);
    const limitInfo = isOverLimit(appName);
    const memories = getRelevantMemories(appName, limitInfo.isOver ? 'over limit' : 'distraction');
    const timeOfDay = getTimeOfDay();

    const context = buildInterventionContext({
      userName: state.user?.name || 'there',
      goals,
      goalProgress,
      todayUsage: usage,
      limits: limitInfo.limits || {},
      memories,
      timeOfDay,
      appName,
    });

    const systemPrompt = getCoachSystemPrompt();
    const result = await callGeminiAPI(systemPrompt, context);

    // Validate response shape
    if (result && result.message && result.recommended_action) {
      return {
        message: result.message,
        recommended_action: result.recommended_action,
        suggested_stake: typeof result.suggested_stake === 'number' ? result.suggested_stake : 5,
      };
    }

    console.warn('[Anchor Brain] Invalid LLM response shape, using fallback');
    return getFallbackIntervention(fallbackContext);
  } catch (err) {
    console.error('[Anchor Brain] Intervention generation failed:', err);
    return getFallbackIntervention(fallbackContext);
  }
}

/**
 * Generates the Tempter's counter-argument to a coach message.
 * @param {string} appName
 * @param {string} coachMessage - The coach's intervention message
 * @returns {Promise<{message: string, temptation: string}>}
 */
export async function generateTempterResponse(appName, coachMessage) {
  const fallbackContext = buildFallbackContext(appName);

  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return getFallbackTempterResponse(fallbackContext);
    }

    const usage = getTodayUsage(appName);
    const goalProgress = getGoalProgress();

    const userMessage = `The Coach just told the user:
"${coachMessage}"

Context: User has opened ${appName}. They've used it ${usage.totalMinutes} minutes today across ${usage.opens} opens. Goals: ${goalProgress.done}/${goalProgress.total} done.

Generate your tempting counter-argument now.`;

    const systemPrompt = getTempterSystemPrompt();
    const result = await callGeminiAPI(systemPrompt, userMessage);

    if (result && result.message && result.temptation) {
      return {
        message: result.message,
        temptation: result.temptation,
      };
    }

    return getFallbackTempterResponse(fallbackContext);
  } catch (err) {
    console.error('[Anchor Brain] Tempter generation failed:', err);
    return getFallbackTempterResponse(fallbackContext);
  }
}

/**
 * Generates a weekly replan proposal with adjusted limits.
 * @returns {Promise<{summary: string, new_minutes_limit: number, new_opens_limit: number, reasoning: string}>}
 */
export async function generateWeeklyReplan() {
  const weekSummary = getWeekSummary();

  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return getFallbackReplan(weekSummary);
    }

    const context = buildReplanContext(weekSummary);
    const systemPrompt = getReplanSystemPrompt();
    const result = await callGeminiAPI(systemPrompt, context);

    if (
      result &&
      result.summary &&
      typeof result.new_minutes_limit === 'number' &&
      typeof result.new_opens_limit === 'number'
    ) {
      return {
        summary: result.summary,
        new_minutes_limit: clamp(result.new_minutes_limit, 2, 30),
        new_opens_limit: clamp(result.new_opens_limit, 1, 10),
        reasoning: result.reasoning || '',
      };
    }

    return getFallbackReplan(weekSummary);
  } catch (err) {
    console.error('[Anchor Brain] Replan generation failed:', err);
    return getFallbackReplan(weekSummary);
  }
}

// ---------- Gemini API ----------

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const API_TIMEOUT_MS = 8000;

/**
 * Calls the Gemini REST API with a system prompt and user message.
 * Parses the JSON response, handling markdown code fences.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<object>} Parsed JSON from the LLM response
 */
export async function callGeminiAPI(systemPrompt, userMessage) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No Gemini API key configured');
  }

  const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 300,
      responseMimeType: 'application/json',
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data = await response.json();

    // Extract text from Gemini response structure
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    return parseJSONFromLLM(text);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------- Helpers ----------

/**
 * Parse JSON from LLM text, stripping markdown code fences if present.
 * @param {string} text
 * @returns {object}
 */
function parseJSONFromLLM(text) {
  let cleaned = text.trim();

  // Strip ```json ... ``` or ``` ... ``` wrappers
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Last-resort: try to extract first JSON object from the text
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    throw new Error(`Failed to parse LLM response as JSON: ${cleaned.slice(0, 200)}`);
  }
}

/**
 * Returns a human-readable time-of-day string.
 * @returns {string}
 */
function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 6) return 'late night';
  if (hour < 12) return 'morning';
  if (hour < 14) return 'early afternoon';
  if (hour < 17) return 'afternoon';
  if (hour < 20) return 'evening';
  return 'night';
}

/**
 * Build context object for fallback functions from current state.
 * @param {string} appName
 * @returns {object}
 */
function buildFallbackContext(appName) {
  const goals = getTodayGoals();
  const goalProgress = getGoalProgress();
  const usage = getTodayUsage(appName);
  const limitInfo = isOverLimit(appName);

  return {
    appName,
    goals,
    goalProgress,
    todayUsage: usage,
    limits: limitInfo.limits || {},
    timeOfDay: getTimeOfDay(),
  };
}

/**
 * Clamp a number between min and max.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generates a visual connected roadmap of the user's goals.
 * @param {Array} goals - List of goals
 * @returns {Promise<{steps: Array}>}
 */
export async function generateGoalRoadmap(goals) {
  const fallback = buildFallbackGoalRoadmap(goals);

  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.warn('[Anchor Brain] No API key for goal roadmap — using fallback');
      return { steps: fallback };
    }

    const systemPrompt = `You are Mainframe's visual task planner. Take the user's current goals and organize them into exactly 3 sequential, connected steps or phases for their daily roadmap.
If they have fewer or more than 3 goals, consolidate or break them down into exactly 3 meaningful checkpoints.
For each step, generate:
1. label: Name of step (max 20 chars)
2. desc: Brief description/why it is structured here (max 12 words)
3. phase: High level phase title (e.g. "Phase 1: Setup")
4. emoji: Relevant emoji
5. status: "open" or "done" (match their current goal status if applicable)

Respond ONLY with valid JSON: {"steps":[{"id": "1", "label":"...", "desc":"...", "phase":"...", "emoji":"...", "status":"open"}]}.
Do NOT include markdown fences, preamble, or any text outside of the JSON object.`;

    const userMessage = `Current goals:\n${goals.map((g, i) => `${i + 1}. ${g.text} (${g.status})`).join('\n')}\nGenerate the 3-step visual journey.`;

    const result = await callGeminiAPI(systemPrompt, userMessage);

    if (result && result.steps && Array.isArray(result.steps) && result.steps.length > 0) {
      // Preserve original goal reference ids if possible to allow click interactions
      const mappedSteps = result.steps.slice(0, 3).map((step, idx) => {
        const matchingGoal = goals[idx];
        return {
          ...step,
          id: matchingGoal ? matchingGoal.id : (step.id || `gen_${idx}`),
          status: matchingGoal ? matchingGoal.status : (step.status || 'open'),
        };
      });
      return { steps: mappedSteps };
    }

    return { steps: fallback };
  } catch (err) {
    console.error('[Anchor Brain] Goal roadmap generation failed:', err);
    return { steps: fallback };
  }
}

function buildFallbackGoalRoadmap(goals) {
  if (!goals || goals.length === 0) {
    return [
      { id: '1', label: 'Breathe & Focus', desc: 'Center yourself before launching any apps.', phase: 'Phase 1: Prep', emoji: '🧘', status: 'open' },
      { id: '2', label: 'Define One Goal', desc: 'Write down a clear task for the hour.', phase: 'Phase 2: Define', emoji: '📝', status: 'open' },
      { id: '3', label: 'Take Action', desc: 'Work for 25 mins without checking notifications.', phase: 'Phase 3: Work', emoji: '⚡', status: 'open' },
    ];
  }

  const steps = [];
  const count = goals.length;

  for (let i = 0; i < 3; i++) {
    if (i < count) {
      const g = goals[i];
      steps.push({
        id: g.id || `fallback_${i}`,
        label: g.text.length > 20 ? g.text.slice(0, 17) + '...' : g.text,
        desc: `Work on achieving: ${g.text}`,
        phase: `Phase ${i + 1}: ${g.status === 'done' ? 'Completed' : 'Focus'}`,
        emoji: g.status === 'done' ? '✅' : '🎯',
        status: g.status,
      });
    } else {
      steps.push({
        id: `pad_${i}`,
        label: 'Mindful Review',
        desc: 'Review goals accomplished and recalibrate.',
        phase: `Phase ${i + 1}: Review`,
        emoji: '🔄',
        status: 'open',
      });
    }
  }
  return steps;
}
