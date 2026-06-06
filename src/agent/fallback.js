/* ============================================================
   ANCHOR — Fallback Responses
   Pre-scripted interventions for when the LLM API is down
   ============================================================ */

/**
 * Returns a fallback intervention response using real context data.
 * Cycles through variants so it doesn't feel repetitive.
 * @param {object} context
 * @param {object} context.goalProgress - {done, total, percent}
 * @param {object} context.todayUsage - {opens, totalMinutes}
 * @param {object} context.limits - {dailyMinutesLimit, dailyOpenLimit}
 * @param {string} context.appName
 * @param {string} context.timeOfDay
 * @param {Array} context.goals - today's goal objects
 * @returns {{message: string, recommended_action: string, suggested_stake: number}}
 */
export function getFallbackIntervention(context) {
  const {
    goalProgress = { done: 0, total: 0, percent: 0 },
    todayUsage = { opens: 0, totalMinutes: 0 },
    limits = {},
    appName = 'this app',
    timeOfDay = '',
    goals = [],
  } = context;

  const openGoals = goals.filter((g) => g.status !== 'done');
  const firstOpenGoal = openGoals.length > 0 ? openGoals[0].text : 'your next task';
  const isOver = todayUsage.totalMinutes >= (limits.dailyMinutesLimit ?? Infinity)
    || todayUsage.opens >= (limits.dailyOpenLimit ?? Infinity);

  const variants = [
    {
      message: `${goalProgress.done} of ${goalProgress.total} goals done and you're opening ${appName} again. You've already spent ${todayUsage.totalMinutes} minutes here today. How about "${firstOpenGoal}" instead?`,
      recommended_action: 'open_task',
      suggested_stake: isOver ? 10 : 5,
    },
    {
      message: `That's open #${todayUsage.opens + 1} for ${appName} today. ${todayUsage.totalMinutes} minutes gone already. "${firstOpenGoal}" is still waiting — go knock it out.`,
      recommended_action: 'open_task',
      suggested_stake: isOver ? 12 : 5,
    },
    {
      message: `It's ${timeOfDay || 'getting late'} and you've got ${goalProgress.total - goalProgress.done} goals left. Every minute on ${appName} is a minute stolen from the person you're trying to become.`,
      recommended_action: 'open_task',
      suggested_stake: isOver ? 15 : 7,
    },
    {
      message: `${todayUsage.totalMinutes} minutes on ${appName} so far. Your limit is ${limits.dailyMinutesLimit ?? '?'}. ${goalProgress.done === goalProgress.total ? 'Goals are done — maybe take a real break instead?' : `"${firstOpenGoal}" won't finish itself.`}`,
      recommended_action: goalProgress.done === goalProgress.total ? 'break' : 'open_task',
      suggested_stake: isOver ? 10 : 3,
    },
    {
      message: `You know the pattern: "just a quick scroll" turns into 15 minutes. You've opened ${appName} ${todayUsage.opens} times today. Let's break the loop — go do "${firstOpenGoal}".`,
      recommended_action: 'open_task',
      suggested_stake: isOver ? 12 : 6,
    },
  ];

  // Pick a variant based on current second to add variety
  const index = Math.floor(Date.now() / 1000) % variants.length;
  return variants[index];
}

/**
 * Returns a fallback Tempter response.
 * @param {object} context
 * @param {string} context.appName
 * @param {object} context.todayUsage
 * @returns {{message: string, temptation: string}}
 */
export function getFallbackTempterResponse(context) {
  const {
    appName = 'this app',
    todayUsage = { totalMinutes: 0 },
  } = context;

  const variants = [
    {
      message: `Come on, you've been grinding all day. Just 2 minutes on ${appName} to recharge — you've earned it.`,
      temptation: 'The Reward Excuse',
    },
    {
      message: `It's only ${todayUsage.totalMinutes} minutes total. That's basically nothing. One quick scroll and back to work.`,
      temptation: 'The Minimizer',
    },
    {
      message: `You'll focus better after a quick break. Forcing yourself to work when you're drained is just inefficient, right?`,
      temptation: 'The Productivity Rationalization',
    },
    {
      message: `Everyone needs downtime. You're not a machine. Just check ${appName} real quick and then you'll actually feel like working.`,
      temptation: 'The Self-Care Disguise',
    },
    {
      message: `You can start fresh tomorrow with full energy. Today's almost over anyway — what's a few more minutes gonna change?`,
      temptation: 'The Fresh Start Fallacy',
    },
  ];

  const index = Math.floor(Date.now() / 1000) % variants.length;
  return variants[index];
}

/**
 * Returns a fallback weekly replan proposal.
 * @param {object} weekSummary - {avgMinutes, avgOpens, complianceRate, totalInterventions}
 * @returns {{summary: string, new_minutes_limit: number, new_opens_limit: number, reasoning: string}}
 */
export function getFallbackReplan(weekSummary) {
  const {
    avgMinutes = 5,
    avgOpens = 3,
    complianceRate = 50,
  } = weekSummary;

  let newMinutes, newOpens, summary, reasoning;

  if (complianceRate >= 70) {
    // Doing well — tighten slightly
    newMinutes = Math.max(2, avgMinutes - 1);
    newOpens = Math.max(1, avgOpens - 1);
    summary = `Strong week — you followed through on ${complianceRate}% of interventions. You're building real discipline.`;
    reasoning = `Compliance is high at ${complianceRate}%. Tightening limits by 1 to keep pushing forward without making it unrealistic.`;
  } else if (complianceRate >= 40) {
    // Middle ground — keep steady
    newMinutes = avgMinutes;
    newOpens = avgOpens;
    summary = `Mixed week — ${complianceRate}% compliance. Some wins, some slips. Let's hold steady and build consistency.`;
    reasoning = `Compliance is moderate at ${complianceRate}%. Keeping limits the same to build a stable habit before tightening.`;
  } else {
    // Struggling — loosen to stay realistic
    newMinutes = Math.min(30, avgMinutes + 2);
    newOpens = Math.min(10, avgOpens + 1);
    summary = `Tough week — only ${complianceRate}% compliance. The limits may have been too aggressive. Let's adjust and rebuild.`;
    reasoning = `Compliance is low at ${complianceRate}%. Loosening limits slightly so they feel achievable — unrealistic limits get ignored entirely.`;
  }

  return {
    summary,
    new_minutes_limit: newMinutes,
    new_opens_limit: newOpens,
    reasoning,
  };
}
