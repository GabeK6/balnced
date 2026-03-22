import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { CopilotOverviewContext } from "@/lib/copilot-types";
import { parseWhatIfQuery } from "@/lib/what-if-parse";
import {
  applyExtraMonthlyInvestToProfile,
  computeWhatIfSimulation,
  projectPortfolioForProfile,
  type WhatIfScenario,
} from "@/lib/what-if-simulate";
import type { RetirementProfile } from "@/lib/retirement-projection";
import { legacyToAccounts } from "@/lib/retirement-accounts";
import { trimMessagesForApi, type CopilotChatLine } from "@/lib/copilot-conversation";
import { getProAccessForUser, proPlanRequiredResponse } from "@/lib/plan-server";

function n(v: unknown): number {
  if (v == null || v === "") return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function clampAmount(a: number): number {
  if (!Number.isFinite(a) || a <= 0) return 0;
  return Math.min(a, 10_000_000);
}

function scenarioFromBody(body: Record<string, unknown>): WhatIfScenario | null {
  const raw = body.scenario as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") return null;
  const kind = raw.kind;
  const amount = clampAmount(n(raw.amount));
  if (amount <= 0) return null;
  if (kind === "one_time_spend") return { kind: "one_time_spend", amount };
  if (kind === "monthly_extra_to_goals") return { kind: "monthly_extra_to_goals", amount };
  if (kind === "monthly_extra_to_invest") return { kind: "monthly_extra_to_invest", amount };
  return null;
}

function parseConversationTail(raw: unknown): CopilotChatLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CopilotChatLine[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const role = o.role === "user" || o.role === "assistant" ? o.role : null;
    const content = typeof o.content === "string" ? o.content : "";
    if (!role || !content.trim()) continue;
    out.push({ role, content });
  }
  return trimMessagesForApi(out);
}

function buildExplanationPrompt(
  ctx: CopilotOverviewContext,
  result: ReturnType<typeof computeWhatIfSimulation>
): string {
  return JSON.stringify(
    {
      scenario: result.scenario,
      baseline: result.baseline,
      simulated: result.simulated,
      deltas: result.deltas,
      contextHints: {
        daysUntilPayday: ctx.cashAndPayPeriod.daysUntilPayday,
        monthlyTakeHome: ctx.income.monthlyTakeHome,
        savePercent: ctx.goals.savePercent,
        investPercent: ctx.goals.investPercent,
      },
    },
    null,
    0
  );
}

/**
 * POST JSON: { context: CopilotOverviewContext, scenario?: WhatIfScenario, query?: string }
 * Headers: Authorization: Bearer <token>
 * Response: { explanation: string, result: WhatIfSimulationResult }
 */
export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const body = (await req.json()) as Record<string, unknown>;
    const context = body.context as CopilotOverviewContext | undefined;

    const authHeader = req.headers.get("authorization");
    const token =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token) {
      return NextResponse.json({ error: "missing_auth" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "server_config" }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "invalid_session" }, { status: 401 });
    }

    const hasPro = await getProAccessForUser(supabase, user.id);
    if (!hasPro) {
      return proPlanRequiredResponse();
    }

    if (!context || typeof context !== "object") {
      return NextResponse.json({ error: "missing_context" }, { status: 400 });
    }

    let scenario: WhatIfScenario | null = scenarioFromBody(body);
    if (!scenario && typeof body.query === "string") {
      scenario = parseWhatIfQuery(body.query);
    }

    if (!scenario) {
      return NextResponse.json(
        {
          error: "unrecognized_scenario",
          message: "Ask like: “What if I spend $300?” or “What if I save $200 more per month?”",
        },
        { status: 422 }
      );
    }

    scenario = {
      ...scenario,
      amount: clampAmount(scenario.amount),
    };
    if (scenario.amount <= 0) {
      return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
    }

    let retirementSimulatedUsd: number | null | undefined;

    if (scenario.kind === "monthly_extra_to_invest") {
      const { data, error } = await supabase
        .from("retirement_profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const accountsFromDb =
          data.retirement_accounts && typeof data.retirement_accounts === "object"
            ? data.retirement_accounts
            : legacyToAccounts(data);

        const annualFallback = context.income.annualTakeHomeEstimate;
        const profile: RetirementProfile = {
          current_age: n(data.current_age),
          retirement_age: n(data.retirement_age),
          current_salary: n(data.current_salary) || annualFallback,
          annual_raise_percent: n(data.annual_raise_percent),
          accounts: accountsFromDb,
          annual_return_percent: n(data.annual_return_percent),
          withdrawal_rate_percent: n(data.withdrawal_rate_percent),
          social_security_monthly_estimate: n(data.social_security_monthly_estimate),
          inflation_percent: n(data.inflation_percent),
        };

        const modified = applyExtraMonthlyInvestToProfile(profile, scenario.amount);
        retirementSimulatedUsd = projectPortfolioForProfile(modified);
      }
    }

    const result = computeWhatIfSimulation(context, scenario, {
      retirementSimulatedUsd:
        scenario.kind === "monthly_extra_to_invest"
          ? retirementSimulatedUsd !== undefined
            ? retirementSimulatedUsd
            : context.retirement.projectedPortfolioAtRetirementUsd
          : undefined,
    });

    const facts = buildExplanationPrompt(context, result);
    const conversationTail = parseConversationTail(body.conversationTail);

    if (!apiKey) {
      return NextResponse.json({
        explanation: templateExplain(result),
        result,
      });
    }

    const openai = new OpenAI({ apiKey });

    let explainUserContent = `Explain this temporary simulation to the user:\n${facts}`;
    if (conversationTail.length > 0) {
      const thread = conversationTail
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n");
      explainUserContent =
        `Recent conversation (for continuity—tie your answer to the simulation JSON below, not invented numbers):\n${thread}\n\n---\n\n` +
        explainUserContent;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Balnced Copilot. The JSON is a deterministic what-if simulation (not saved). Write 2–4 short sentences. Lead with the outcome (safe-to-spend, goal timing, or retirement portfolio). Cite specific dollar amounts from the JSON. If prior messages are provided, acknowledge follow-ups naturally. No markdown. No generic advice.",
        },
        {
          role: "user",
          content: explainUserContent,
        },
      ],
      temperature: 0.25,
      max_tokens: 220,
    });

    const explanation =
      completion.choices[0]?.message?.content?.trim() || templateExplain(result);

    return NextResponse.json({ explanation, result });
  } catch (e) {
    console.error("copilot/simulate route:", e);
    return NextResponse.json(
      { error: "server", explanation: "Simulation failed — try again." },
      { status: 200 }
    );
  }
}

function templateExplain(result: ReturnType<typeof computeWhatIfSimulation>): string {
  const { scenario, baseline, simulated, deltas } = result;
  const fmt = (x: number) =>
    x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  if (scenario.kind === "one_time_spend") {
    return `After a one-time ${fmt(scenario.amount)}, safe-to-spend would drop from ${fmt(baseline.safeToSpend)} to ${fmt(simulated.safeToSpend)} and your daily room to about ${fmt(simulated.dailyLimit)} until payday. Goal timelines stay the same unless you fund this from savings.`;
  }
  if (scenario.kind === "monthly_extra_to_goals") {
    const g = simulated.firstGoal;
    const bg = baseline.firstGoal;
    const delta = deltas.firstGoalMonthsDelta;
    const timeNote =
      g && bg && delta != null && delta !== 0
        ? ` Your first priority goal (“${g.name}”) moves by about ${delta > 0 ? `${delta} months later` : `${Math.abs(delta)} months sooner`}.`
        : g
          ? ` First goal “${g.name}” target moves to ${new Date(g.targetDateISO).toLocaleDateString(undefined, { month: "short", year: "numeric" })}.`
          : "";
    return `Adding ${fmt(scenario.amount)}/month to savings goals speeds the waterfall; safe-to-spend stays ${fmt(baseline.safeToSpend)}.${timeNote}`;
  }
  const dr = deltas.retirementUsdDelta;
  if (dr != null && baseline.projectedRetirementUsd != null && simulated.projectedRetirementUsd != null) {
    return `Investing ${fmt(scenario.amount)} more per month raises the projected retirement portfolio from about ${fmt(baseline.projectedRetirementUsd)} to about ${fmt(simulated.projectedRetirementUsd)} (${dr >= 0 ? "+" : ""}${fmt(dr)}). Safe-to-spend is unchanged in this model.`;
  }
  return `Extra investing is modeled on your retirement profile; add or complete accounts in Retirement for a full projection.`;
}
