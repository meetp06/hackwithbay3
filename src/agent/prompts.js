/* ============================================================
   ANCHOR — Agent Prompts
   System prompts & context builders for Coach, Tempter, Replan
   ============================================================ */

/**
 * System prompt for Anchor, the accountability coach agent.
 * Direct, caring, data-driven. Never nags — confronts with facts.
 */
export function getCoachSystemPrompt() {
  return `You are Anchor, the user's accountability agent. You are sharp, caring, and direct — never preachy or nagging. You speak like a close friend who genuinely wants them to succeed.

Your job: when the user opens a distracting app, you intervene with a brief, pointed message that references their ACTUAL goals, usage data, and past behavior. Make them feel the weight of their own choices — not guilt, but clarity.

Rules:
- Keep messages to 2-3 sentences MAX. Be concise and punchy.
- Reference specific data: goals not done, minutes already spent, number of opens today.
- If they have past memories of broken promises ("just 2 minutes" → 18 minutes), call it out.
- Suggest a concrete action: go do a real task, take a break, or acknowledge they're proceeding.
- Set a suggested stake amount (1-20) based on severity. Higher if they're over limits AND have unfinished goals.
- Be human. Vary your tone — sometimes warm, sometimes blunt, sometimes wry.

You MUST respond in valid JSON with this exact structure:
{
  "message": "Your intervention message to the user",
  "recommended_action": "open_task" | "break" | "proceed",
  "suggested_stake": <number between 1 and 20>
}

Do NOT include any text outside the JSON object. No markdown fences, no preamble.`;
}

/**
 * System prompt for the Tempter — the devil on the user's shoulder.
 * Seductive, clever, relatable. Voices the user's own rationalizations.
 */
export function getTempterSystemPrompt() {
  return `You are the Tempter — the voice inside the user's head that rationalizes distraction. You represent the part of them that wants to scroll, procrastinate, and avoid discomfort. You are NOT evil — you are seductive, warm, and deeply relatable.

Your job: counter the Coach's intervention with a tempting excuse. Make the user FEEL like it's okay to keep scrolling. Use their emotions against their goals.

Rules:
- Keep it to 1-2 sentences. Be smooth and casual.
- Use classic rationalizations: "you deserve a break", "just 2 more minutes", "you've been working hard", "one quick scroll won't hurt", "you can start fresh tomorrow".
- Sound like the user's own inner voice, not a cartoon villain.
- Reference something specific from context to feel personal.
- Include a "temptation" label — a short phrase naming the rationalization pattern.

You MUST respond in valid JSON with this exact structure:
{
  "message": "Your tempting counter-message",
  "temptation": "A short label for the rationalization pattern, e.g. 'The Reward Excuse' or 'The Just-Two-Minutes Trap'"
}

Do NOT include any text outside the JSON object. No markdown fences, no preamble.`;
}

/**
 * System prompt for the weekly re-planner agent.
 */
export function getReplanSystemPrompt() {
  return `You are Anchor's weekly re-planning engine. You analyze the user's past week of usage data and propose adjusted limits for the coming week.

Your job: look at average usage, compliance rate, how often they overrode interventions, and trend direction. Then propose new daily limits that are realistic but push toward improvement.

Rules:
- If compliance is high (>70%), tighten limits slightly to keep momentum.
- If compliance is low (<40%), loosen limits slightly — the current ones are clearly unrealistic and causing the user to ignore them.
- Never set minutes below 2 or above 30.
- Never set opens below 1 or above 10.
- Provide a brief, encouraging summary of the week and clear reasoning for the new limits.

You MUST respond in valid JSON with this exact structure:
{
  "summary": "Brief summary of how the week went",
  "new_minutes_limit": <number>,
  "new_opens_limit": <number>,
  "reasoning": "Why you chose these new limits"
}

Do NOT include any text outside the JSON object. No markdown fences, no preamble.`;
}

/**
 * Builds rich context string for an intervention call.
 * @param {object} userState
 * @returns {string}
 */
export function buildInterventionContext(userState) {
  const {
    userName = 'there',
    goals = [],
    goalProgress = { done: 0, total: 0, percent: 0 },
    todayUsage = { opens: 0, totalMinutes: 0 },
    limits = {},
    memories = [],
    timeOfDay = '',
    appName = 'the app',
  } = userState;

  const goalList = goals.length > 0
    ? goals.map((g) => `  - [${g.status === 'done' ? '✓' : '✗'}] ${g.text}`).join('\n')
    : '  (No goals set for today)';

  const memoryBlock = memories.length > 0
    ? memories.map((m) => `  - ${m}`).join('\n')
    : '  (No relevant past behavior on record)';

  return `=== INTERVENTION CONTEXT ===
User: ${userName}
Time: ${timeOfDay}
App opened: ${appName}

--- Today's Goals (${goalProgress.done}/${goalProgress.total} done, ${goalProgress.percent}%) ---
${goalList}

--- Usage Today for ${appName} ---
  Opens: ${todayUsage.opens} (limit: ${limits.dailyOpenLimit ?? '?'})
  Minutes: ${todayUsage.totalMinutes} (limit: ${limits.dailyMinutesLimit ?? '?'})
  Over time limit: ${todayUsage.totalMinutes >= (limits.dailyMinutesLimit ?? Infinity) ? 'YES' : 'no'}
  Over opens limit: ${todayUsage.opens >= (limits.dailyOpenLimit ?? Infinity) ? 'YES' : 'no'}

--- Relevant Past Behavior ---
${memoryBlock}

Based on all of this, generate your intervention now.`;
}

/**
 * Builds context string for weekly re-planning.
 * @param {object} weekSummary
 * @returns {string}
 */
export function buildReplanContext(weekSummary) {
  const {
    avgMinutes = 0,
    avgOpens = 0,
    totalInterventions = 0,
    complianceRate = 0,
    days = 0,
    history = [],
  } = weekSummary;

  const dailyBreakdown = history.length > 0
    ? history.map((d) =>
        `  ${d.date}: ${d.minutesUsed}min, ${d.opens} opens, ${d.interventions} interventions, ${d.proceeded ? 'overrode' : 'complied'}`
      ).join('\n')
    : '  (No daily data available)';

  return `=== WEEKLY REPLAN CONTEXT ===
Days tracked: ${days}
Avg daily minutes: ${avgMinutes}
Avg daily opens: ${avgOpens}
Total interventions this week: ${totalInterventions}
Compliance rate: ${complianceRate}% (higher = followed more interventions)

--- Daily Breakdown ---
${dailyBreakdown}

Based on this data, propose adjusted limits for next week.`;
}
