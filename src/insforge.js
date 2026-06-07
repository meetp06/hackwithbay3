import { createClient } from "@insforge/sdk";
import { setState, getState, updateUser } from "./state.js";
import {
  getCoachSystemPrompt,
  getReplanSystemPrompt,
  buildInterventionContext,
  buildReplanContext,
} from "./agent/prompts.js";

// Safe env resolver for Vite & Node.js
const getEnv = (key) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  if (typeof globalThis !== 'undefined' && globalThis.importMetaEnv) {
    return globalThis.importMetaEnv[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return '';
};

// Initialize InsForge Client
export const insforge = createClient({
  baseUrl: getEnv('NEXT_PUBLIC_INSFORGE_URL'),
  anonKey: getEnv('NEXT_PUBLIC_INSFORGE_ANON_KEY'),
});

// Helper to safely parse JSON from LLM response
function parseJSONFromLLM(text) {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    throw new Error(`Failed to parse LLM response as JSON: ${cleaned.slice(0, 200)}`);
  }
}

// Helper to get time of day string
function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 6) return 'late night';
  if (hour < 12) return 'morning';
  if (hour < 14) return 'early afternoon';
  if (hour < 17) return 'afternoon';
  if (hour < 20) return 'evening';
  return 'night';
}

// -------------------------------------------------------------
// Edge Functions Mock (Invoked locally via insforge.functions.invoke)
// -------------------------------------------------------------
const functionsMap = {
  /**
   * Intervene Edge Function
   */
  async intervene({ user_id, app_name, usage_today }) {
    console.log(`[Edge Function: intervene] Starting for ${app_name}...`);
    const todayStr = new Date().toISOString().split("T")[0];

    // 1. Load Goals
    const { data: goals } = await insforge.database
      .from("goals")
      .select("*")
      .eq("user_id", user_id)
      .eq("date", todayStr);

    // 2. Load Watched App Limits
    const { data: watchedApps } = await insforge.database
      .from("watched_apps")
      .select("*")
      .eq("user_id", user_id)
      .eq("app_name", app_name);

    const appLimit = watchedApps?.[0] || { daily_minutes_limit: 5, daily_open_limit: 3 };

    // 3. Load top-2 retrieved memories via Vector Search
    let retrievedMemoriesText = [];
    try {
      const queryText = `distraction in ${app_name} over limit`;
      const embeddingResponse = await insforge.ai.embeddings.create({
        model: "openai/text-embedding-3-small",
        input: queryText,
      });
      const queryEmbedding = embeddingResponse.data[0].embedding;

      const { data: memories } = await insforge.database.rpc("retrieve_memories", {
        p_user_id: user_id,
        p_query_embedding: queryEmbedding,
        p_limit: 2,
      });

      if (memories && memories.length > 0) {
        retrievedMemoriesText = memories.map(m => m.content);
      }
    } catch (err) {
      console.warn("[Edge Function: intervene] Memory retrieval failed:", err);
    }

    // 4. Construct AI context
    const goalsFormatted = (goals || []).map(g => ({ text: g.text, status: g.status }));
    const totalCount = goalsFormatted.length;
    const doneCount = goalsFormatted.filter(g => g.status === 'done').length;
    const goalProgress = {
      done: doneCount,
      total: totalCount,
      percent: totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0,
    };

    const context = buildInterventionContext({
      userName: "Meet", // Default
      goals: goalsFormatted,
      goalProgress,
      todayUsage: {
        opens: usage_today.opens,
        totalMinutes: usage_today.totalMinutes,
      },
      limits: {
        dailyMinutesLimit: appLimit.daily_minutes_limit,
        dailyOpenLimit: appLimit.daily_open_limit,
      },
      memories: retrievedMemoriesText,
      timeOfDay: getTimeOfDay(),
      appName: app_name,
    });

    // 5. Call Model Gateway (routes through InsForge)
    console.log("[Edge Function: intervene] Requesting AI Coach message...");
    const systemPrompt = getCoachSystemPrompt();
    const chatResult = await insforge.ai.chat.completions.create({
      model: "anthropic/claude-3.5-haiku",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: context }
      ],
      temperature: 0.9,
    });

    const llmResponseText = chatResult.choices[0].message.content;
    const parsed = parseJSONFromLLM(llmResponseText);

    // 6. Write to interventions table
    const { data: newInterventions } = await insforge.database
      .from("interventions")
      .insert([{
        user_id,
        agent_message: parsed.message,
        recommended_action: parsed.recommended_action,
        user_action: null,
      }])
      .select();

    const intervention = newInterventions?.[0];

    // 7. Push to device via realtime
    try {
      await insforge.realtime.connect();
      await insforge.realtime.publish(`interventions:${user_id}`, "new_intervention", {
        ...intervention,
        suggested_stake: parsed.suggested_stake || 5,
      });
      console.log("[Edge Function: intervene] Broadcasted live intervention to realtime.");
    } catch (err) {
      console.warn("[Edge Function: intervene] Realtime broadcast failed:", err);
    }

    return {
      message: parsed.message,
      recommended_action: parsed.recommended_action,
      suggested_stake: parsed.suggested_stake || 5,
      intervention_id: intervention?.id,
    };
  },

  /**
   * Decide Consequence Edge Function
   */
  async decide_consequence({ user_id, intervention_id, excuse, app_name, was_over_limit, user_action, suggested_stake }) {
    console.log(`[Edge Function: decide_consequence] Processing for intervention ${intervention_id}...`);

    // Update intervention with user action
    await insforge.database
      .from("interventions")
      .update({ user_action })
      .eq("id", intervention_id);

    // If over limit and user proceeds anyway, execute stake ledger and save memory
    if (was_over_limit && user_action === "proceed") {
      const stakeAmount = suggested_stake || 10;
      console.log(`[Edge Function: decide_consequence] Applying stake penalty: $${stakeAmount}`);

      // 1. Write stake ledger row (is_test = true)
      await insforge.database
        .from("stake_ledger")
        .insert([{
          user_id,
          amount: stakeAmount,
          destination: "Your DSA Course",
          reason: `Opened ${app_name} while over daily limit`,
          is_test: true,
        }]);

      // 2. Generate and store embedding of excuse in vector memories
      if (excuse && excuse.trim()) {
        try {
          const memoryContent = `Excused opening ${app_name} by claiming: "${excuse}". Spent time scrolling anyway.`;
          console.log("[Edge Function: decide_consequence] Generating vector embedding for excuse...");
          
          const embeddingResponse = await insforge.ai.embeddings.create({
            model: "openai/text-embedding-3-small",
            input: memoryContent,
          });
          const embedding = embeddingResponse.data[0].embedding;

          await insforge.database
            .from("memories")
            .insert([{
              user_id,
              content: memoryContent,
              embedding,
              metadata: {
                app: app_name,
                excuse,
                suggested_stake: stakeAmount,
              },
            }]);
          console.log("[Edge Function: decide_consequence] Excuse saved in vector memory.");
        } catch (err) {
          console.error("[Edge Function: decide_consequence] Excuse embedding generation failed:", err);
        }
      }
    }

    return { success: true };
  },

  /**
   * Weekly Replan Edge Function
   */
  async weekly_replan({ user_id }) {
    console.log("[Edge Function: weekly_replan] Compiling weekly summary...");
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // 1. Fetch usage events for last 7 days
    const { data: usageEvents } = await insforge.database
      .from("usage_events")
      .select("*")
      .eq("user_id", user_id)
      .gte("opened_at", oneWeekAgo.toISOString());

    // 2. Fetch interventions for last 7 days
    const { data: interventions } = await insforge.database
      .from("interventions")
      .select("*")
      .eq("user_id", user_id)
      .gte("created_at", oneWeekAgo.toISOString());

    // Group history by date
    const dailyData = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      dailyData[dateStr] = {
        date: dateStr,
        minutesUsed: 0,
        opens: 0,
        interventions: 0,
        proceeded: 0,
      };
    }

    (usageEvents || []).forEach(e => {
      const dateStr = e.openedAt?.split("T")[0] || e.opened_at?.split("T")[0];
      if (dailyData[dateStr]) {
        dailyData[dateStr].opens += 1;
        dailyData[dateStr].minutesUsed += Math.round(e.duration_sec / 60);
      }
    });

    (interventions || []).forEach(i => {
      const dateStr = i.createdAt?.split("T")[0] || i.created_at?.split("T")[0];
      if (dailyData[dateStr]) {
        dailyData[dateStr].interventions += 1;
        if (i.user_action === "proceed") {
          dailyData[dateStr].proceeded += 1;
        }
      }
    });

    const history = Object.values(dailyData);
    const totalMin = history.reduce((s, d) => s + d.minutesUsed, 0);
    const totalOpens = history.reduce((s, d) => s + d.opens, 0);
    const totalInts = history.reduce((s, d) => s + d.interventions, 0);
    const totalProceeded = history.reduce((s, d) => s + d.proceeded, 0);

    const weekSummary = {
      avgMinutes: Math.round(totalMin / 7),
      avgOpens: Math.round(totalOpens / 7),
      totalInterventions: totalInts,
      complianceRate: totalInts > 0 ? Math.round(((totalInts - totalProceeded) / totalInts) * 100) : 100,
      days: 7,
      history,
    };

    // Fetch user's goals/tasks to customize the roadmap
    let goalsListText = "";
    try {
      const { data: dbGoals } = await insforge.database
        .from("goals")
        .select("*")
        .eq("user_id", user_id);
      if (dbGoals && dbGoals.length > 0) {
        goalsListText = dbGoals.map(g => `- ${g.text} (${g.status})`).join("\n");
      }
    } catch (err) {
      console.warn("[Edge Function: weekly_replan] Failed to fetch goals:", err);
    }

    const context = buildReplanContext(weekSummary);
    const extendedContext = `${context}\n\nUser's Current Goals/Tasks:\n${goalsListText || '(No goals set yet)'}`;
    
    const baseSystemPrompt = getReplanSystemPrompt();
    const systemPrompt = `${baseSystemPrompt}\n\nAdditionally, you MUST include a "roadmap" field in your JSON response. The "roadmap" should be a JSON array of exactly 3 sequential steps (phases) for the coming week, designed to help the user achieve their current goals/tasks while staying under limits.
Each roadmap step must be a JSON object with:
- "phase": e.g., "Days 1-2: Setup", "Days 3-5: Focus", "Days 6-7: Complete"
- "task": specific task-oriented action step (max 15 words)
- "strategy": specific habit/app-blocking strategy to avoid distraction (max 15 words)

The output JSON structure MUST be:
{
  "summary": "...",
  "new_minutes_limit": <number>,
  "new_opens_limit": <number>,
  "reasoning": "...",
  "roadmap": [
    {"phase": "...", "task": "...", "strategy": "..."},
    {"phase": "...", "task": "...", "strategy": "..."},
    {"phase": "...", "task": "...", "strategy": "..."}
  ]
}`;

    const defaultRoadmap = [
      { phase: "Days 1-2: Setup", task: "Review and organize your pending tasks every morning.", strategy: "Set daily app limits to block scrolling triggers." },
      { phase: "Days 3-5: Action", task: "Carve out 30-min focus blocks for your main goals.", strategy: "Open your real task before launching distracting apps." },
      { phase: "Days 6-7: Complete", task: "Track completed milestones and check final compliance.", strategy: "Commit a small stake to seal your weekly win." }
    ];

    console.log("[Edge Function: weekly_replan] Calling AI Replanner...");
    let parsed = {};
    try {
      const chatResult = await insforge.ai.chat.completions.create({
        model: "anthropic/claude-3.5-haiku",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: extendedContext }
        ],
        temperature: 0.9,
      });

      const llmResponseText = chatResult.choices[0].message.content;
      parsed = parseJSONFromLLM(llmResponseText);
    } catch (e) {
      console.warn("[Edge Function: weekly_replan] LLM failed, using fallback:", e);
    }

    return {
      summary: parsed.summary,
      new_minutes_limit: parsed.new_minutes_limit,
      new_opens_limit: parsed.new_opens_limit,
      reasoning: parsed.reasoning,
      roadmap: parsed.roadmap || defaultRoadmap
    };
  }
};

// Override SDK's functions.invoke to execute edge functions locally
insforge.functions.invoke = async function (slug, options = {}) {
  const handler = functionsMap[slug];
  if (!handler) {
    return { data: null, error: { message: `Function "${slug}" not found` } };
  }
  try {
    const result = await handler(options.body || {});
    return { data: result, error: null };
  } catch (err) {
    console.error(`Error executing edge function ${slug}:`, err);
    return { data: null, error: { message: err.message } };
  }
};

// -------------------------------------------------------------
// Database Synchronization Layer
// -------------------------------------------------------------
export async function syncStateFromInsForge() {
  const { data: { user } } = await insforge.auth.getCurrentUser();
  if (!user) {
    console.log("[InsForge Sync] No authenticated user.");
    return false;
  }

  console.log("[InsForge Sync] Loading data from Postgres for user:", user.email);

  // 1. Sync User info
  updateUser({
    id: user.id,
    name: user.profile?.name || user.email.split("@")[0],
    onboarded: true,
  });

  // 2. Fetch Goals
  const todayStr = new Date().toISOString().split("T")[0];
  const { data: dbGoals } = await insforge.database
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", todayStr);

  if (dbGoals) {
    setState("goals", dbGoals.map(g => ({
      id: g.id,
      date: g.date,
      text: g.text,
      status: g.status,
    })));
  }

  // 3. Fetch Watched App Limits
  const { data: dbApps } = await insforge.database
    .from("watched_apps")
    .select("*")
    .eq("user_id", user.id);

  const APP_ICONS = { Instagram: 'IG', LinkedIn: 'IN', Facebook: 'FB', WhatsApp: 'WA', TikTok: 'TT', YouTube: 'YT', X: 'X', Twitter: 'X' };
  if (dbApps && dbApps.length > 0) {
    setState("watchedApps", dbApps.map(a => ({
      id: a.id,
      appName: a.app_name,
      icon: APP_ICONS[a.app_name] || a.app_name.slice(0, 2).toUpperCase(),
      dailyMinutesLimit: a.daily_minutes_limit,
      dailyOpenLimit: a.daily_open_limit,
    })));
  }

  // 4. Fetch Usage Events
  const { data: dbUsage } = await insforge.database
    .from("usage_events")
    .select("*")
    .eq("user_id", user.id);

  if (dbUsage) {
    setState("usageEvents", dbUsage.map(e => ({
      id: e.id,
      appName: e.app_name,
      openedAt: e.opened_at,
      durationSec: e.duration_sec,
      overLimit: e.over_limit,
    })));
  }

  // 5. Fetch Interventions
  const { data: dbInterventions } = await insforge.database
    .from("interventions")
    .select("*")
    .eq("user_id", user.id);

  if (dbInterventions) {
    setState("interventions", dbInterventions.map(i => ({
      id: i.id,
      createdAt: i.created_at,
      agentMessage: i.agent_message,
      recommendedAction: i.recommended_action,
      userAction: i.user_action,
    })));
  }

  // 6. Fetch Stake Ledger Transactions
  const { data: dbLedger } = await insforge.database
    .from("stake_ledger")
    .select("*")
    .eq("user_id", user.id);

  if (dbLedger) {
    const allTx = dbLedger.map(tx => ({
      id: tx.id,
      amount: Number(tx.amount),
      destination: tx.destination,
      reason: tx.reason,
      isTest: tx.is_test,
      createdAt: tx.created_at,
    }));

    // Credits (negative amounts) seed the balance; positive amounts are debits.
    // Only debit rows are shown in the visible transaction history.
    const seedTotal = allTx.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const debitTransactions = allTx.filter(tx => tx.amount > 0);
    const spentTotal = debitTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const balance = Math.max(0, seedTotal - spentTotal);

    setState("stakeLedger", {
      balance,
      currency: "$",
      transactions: debitTransactions,
    });
  }

  // 7. Fetch Memories
  const { data: dbMemories } = await insforge.database
    .from("memories")
    .select("*")
    .eq("user_id", user.id);

  if (dbMemories) {
    setState("memories", dbMemories.map(m => ({
      id: m.id,
      text: m.content,
      metadata: m.metadata,
      timestamp: m.created_at,
    })));
  }

  console.log("[InsForge Sync] State synchronization completed successfully!");
  return true;
}
