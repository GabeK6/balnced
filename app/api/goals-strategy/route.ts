import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getProAccessForUser, proPlanRequiredResponse } from "@/lib/plan-server";

function n(v: unknown): number {
  if (v == null || v === "") return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

type GoalRow = {
  priority: number;
  name: string;
  amount: number;
  monthsToFund: number | null;
  targetMonthLabel: string | null;
};

function parseGoalsPayload(raw: unknown): GoalRow[] {
  if (!Array.isArray(raw)) return [];
  const out: GoalRow[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = o.name != null ? String(o.name).trim() : "";
    if (!name) continue;
    out.push({
      priority: Math.max(1, Math.floor(n(o.priority)) || 1),
      name: name.slice(0, 120),
      amount: Math.max(0, n(o.amount)),
      monthsToFund:
        o.monthsToFund == null || o.monthsToFund === ""
          ? null
          : Math.max(0, Math.floor(n(o.monthsToFund))),
      targetMonthLabel:
        o.targetMonthLabel == null || o.targetMonthLabel === ""
          ? null
          : String(o.targetMonthLabel).slice(0, 40),
    });
  }
  return out.sort((a, b) => a.priority - b.priority);
}

/**
 * POST JSON: { monthlyTakeHome, savePercent, monthlySavingsPlan, goals: [...] }
 * Headers: Authorization: Bearer <supabase access_token>
 * Response: { suggestions: string[] }
 */
export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const raw = (await req.json()) as Record<string, unknown>;

    const monthlyTakeHome = Math.max(0, n(raw.monthlyTakeHome));
    const savePercent = Math.max(0, Math.min(100, n(raw.savePercent)));
    const monthlySavingsPlan = Math.max(0, n(raw.monthlySavingsPlan));
    const goals = parseGoalsPayload(raw.goals);

    if (!apiKey) {
      return NextResponse.json({
        suggestions: [
          "Add OPENAI_API_KEY to .env.local to enable AI strategy suggestions for your goals.",
        ],
      });
    }

    const authHeader = req.headers.get("authorization");
    const token =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token) {
      return NextResponse.json(
        { suggestions: [], error: "missing_auth" },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        suggestions: ["Server configuration incomplete — AI strategy unavailable."],
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { suggestions: [], error: "invalid_session" },
        { status: 401 }
      );
    }

    const hasPro = await getProAccessForUser(supabase, user.id);
    if (!hasPro) {
      return proPlanRequiredResponse();
    }

    if (goals.length === 0) {
      return NextResponse.json({
        suggestions: [
          "Add at least one named goal with an amount to get tailored strategy ideas.",
        ],
      });
    }

    const goalsFacts = goals
      .map(
        (g) =>
          `#${g.priority} ${g.name}: $${Math.round(g.amount)}` +
          (g.monthsToFund != null
            ? ` — ~${g.monthsToFund} mo of full savings to fund this leg`
            : "") +
          (g.targetMonthLabel ? ` — target ~${g.targetMonthLabel}` : "")
      )
      .join("\n");

    const prompt = `You are a concise savings coach in a budgeting app. The app uses a WATERFALL: 100% of monthly savings goes to priority #1 until that goal is fully funded, then 100% shifts to #2, etc.

FACTS (USD, from the user's screen — amounts are exact):
- Monthly take-home (from budget): ${Math.round(monthlyTakeHome)}
- Save % they entered: ${savePercent}%
- Monthly savings going to goals (from that save %): ${Math.round(monthlySavingsPlan)}

GOALS (priority order):
${goalsFacts}

TASK: Return valid JSON only, no markdown, shape:
{"suggestions":["...","..."]}

Rules for each string in "suggestions":
- Exactly 2 to 4 strings.
- ONE short sentence each (max ~155 characters). Actionable and specific — cite their goal NAMES, dollar amounts, months, or save % from FACTS when you make a point.
- If monthlySavingsPlan is 0, focus only on setting a save % / increasing income to unlock timelines; do not invent dollars.
- You MAY suggest reordering priorities only when it clearly changes who gets funded first under waterfall (e.g., smaller emergency fund before vacation).
- You MAY suggest increasing monthly savings by a round dollar amount and tie it to months earlier on a named goal — use rough math consistent with waterfall (do not claim precision past ~1 month).
- No generic filler ("stay disciplined"). No disclaimers. No markdown. No bullets inside a string.`;

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Reply with only one JSON object: { \"suggestions\": string[] }. 2-4 items. No markdown code fences.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 450,
    });

    const text = response.choices[0]?.message?.content?.trim() || "{}";
    let parsed: { suggestions?: unknown };
    try {
      const cleaned = text.replace(/```json?\s*|\s*```/g, "").trim();
      parsed = JSON.parse(cleaned) as { suggestions?: unknown };
    } catch {
      parsed = {};
    }

    const rawList = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const suggestions = rawList
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 4);

    if (suggestions.length === 0) {
      return NextResponse.json({
        suggestions: [
          "We couldn’t parse suggestions — try again in a moment.",
        ],
      });
    }

    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("goals-strategy route:", e);
    return NextResponse.json({
      suggestions: [
        "AI strategy is temporarily unavailable — your goal numbers on the page are still up to date.",
      ],
    });
  }
}
