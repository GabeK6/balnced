import { createHash } from "node:crypto";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  getCanonicalRetirementAdviceInputs,
  type RetirementAdviceGoalsSnapshot,
} from "@/lib/retirement-advice-inputs";
import { getProAccessForUser, proPlanRequiredResponse } from "@/lib/plan-server";

function n(v: unknown): number {
  if (v == null || v === "") return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function parseGoals(raw: unknown): RetirementAdviceGoalsSnapshot | null {
  if (raw == null || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  const savings = g.savings_goals;
  return {
    save_percent: n(g.save_percent),
    invest_percent: n(g.invest_percent),
    big_purchase_name:
      g.big_purchase_name == null ? null : String(g.big_purchase_name).trim() || null,
    big_purchase_amount:
      g.big_purchase_amount == null || g.big_purchase_amount === ""
        ? null
        : n(g.big_purchase_amount),
    retirement_age: g.retirement_age == null ? undefined : Math.floor(n(g.retirement_age)),
    savings_goals: Array.isArray(savings)
      ? savings.map((item) => {
          const s = item as Record<string, unknown>;
          return {
            name: s.name != null ? String(s.name) : "",
            target_amount: n(s.target_amount),
            priority: n(s.priority),
          };
        })
      : undefined,
  };
}

/**
 * POST JSON: full advice snapshot + optional `goals` for cache key.
 * Headers: Authorization: Bearer <supabase access_token>
 * Response: { insights: string[], cached?: boolean }
 */
export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    const raw = (await req.json()) as Record<string, unknown>;

    const currentAge = Math.max(0, Math.floor(n(raw.currentAge)));
    const retirementAge = Math.max(0, Math.floor(n(raw.retirementAge)));
    const annualSalary = n(raw.annualSalary);
    const suggestedMonthlyInvest = n(raw.suggestedMonthlyInvest);
    const projectedPortfolio = n(raw.projectedPortfolio);
    const targetPortfolio = n(raw.targetPortfolio);
    const healthScorePercent = Math.max(0, Math.min(100, Math.round(n(raw.healthScorePercent))));
    const healthBand = String(raw.healthBand || "Unknown").slice(0, 80);
    let yearsToRetirement = Math.max(0, Math.floor(n(raw.yearsToRetirement)));
    if (yearsToRetirement === 0 && retirementAge > currentAge) {
      yearsToRetirement = retirementAge - currentAge;
    }
    const monthlyRetirementIncome = n(raw.monthlyRetirementIncome);
    const gapToTarget = Math.round(targetPortfolio - projectedPortfolio);

    const goalsPayload = parseGoals(raw.goals);

    if (!apiKey) {
      return NextResponse.json(
        {
          insights: [
            "Add OPENAI_API_KEY to .env.local to enable personalized retirement coaching.",
          ],
          cached: false,
        },
        { status: 200 }
      );
    }

    const authHeader = req.headers.get("authorization");
    const token =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token) {
      return NextResponse.json(
        {
          insights: [],
          cached: false,
          error: "missing_auth",
        },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          insights: [
            "Server configuration incomplete — coaching cache unavailable.",
          ],
          cached: false,
        },
        { status: 200 }
      );
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
        { insights: [], cached: false, error: "invalid_session" },
        { status: 401 }
      );
    }

    const hasPro = await getProAccessForUser(supabase, user.id);
    if (!hasPro) {
      return proPlanRequiredResponse();
    }

    const canonical = getCanonicalRetirementAdviceInputs({
      annualSalary,
      suggestedMonthlyInvest,
      retirementAge,
      goals: goalsPayload,
    });
    const canonicalJson = JSON.stringify(canonical);
    const inputHash = createHash("sha256").update(canonicalJson).digest("hex");

    const { data: cachedRow, error: cacheReadError } = await supabase
      .from("retirement_ai_advice_cache")
      .select("input_hash, insights")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!cacheReadError && cachedRow && cachedRow.input_hash === inputHash) {
      const cachedInsights = Array.isArray(cachedRow.insights)
        ? cachedRow.insights.map((s: unknown) => String(s).trim()).filter(Boolean)
        : [];
      if (cachedInsights.length > 0) {
        return NextResponse.json({ insights: cachedInsights, cached: true });
      }
    }

    const openai = new OpenAI({ apiKey });

    const prompt = `You are a retirement planning coach inside a budgeting app. The user sees these exact numbers in the product. Use ONLY these facts—do not invent accounts, rates, or new dollar targets.

FACTS (all amounts USD):
- Current age: ${currentAge}
- Target retirement age: ${retirementAge}
- Years until retirement (approx): ${yearsToRetirement}
- Annual salary in planner: ${annualSalary}
- App-suggested monthly invest/save toward retirement: ${suggestedMonthlyInvest}
- Projected portfolio balance at retirement: ${projectedPortfolio}
- Target nest egg (replacement-income rule used by app): ${targetPortfolio}
- Progress toward target: ${healthScorePercent}%
- Readiness label: ${healthBand}
- Estimated total monthly income in retirement (app projection): ${monthlyRetirementIncome}
- Dollar gap (target minus projected portfolio): ${gapToTarget}

TASK: Return valid JSON only, no markdown, with this exact shape:
{"insights":["...","..."]}

Rules for each string in "insights":
- Produce exactly 2 to 4 strings.
- Each string is ONE short sentence (max ~160 characters), actionable and specific. Mention concrete numbers from the facts when helpful.
- If targetPortfolio is 0 or salary is 0, focus on filling in plan basics (salary, ages, accounts)—do not fabricate portfolio advice.
- No boilerplate disclaimers. No bulleted lists inside a string—each array element is one line the UI will show as a bullet.
- Avoid generic advice that ignores their numbers.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You respond with only a single JSON object. Keys: insights (array of 2-4 short strings). Be direct and practical. No markdown fences.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 400,
    });

    const text = response.choices[0]?.message?.content?.trim() || "{}";
    let parsed: { insights?: unknown };
    try {
      const cleaned = text.replace(/```json?\s*|\s*```/g, "").trim();
      parsed = JSON.parse(cleaned) as { insights?: unknown };
    } catch {
      parsed = {};
    }

    const rawInsights = Array.isArray(parsed.insights) ? parsed.insights : [];
    const insights = rawInsights
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 4);

    if (insights.length === 0) {
      return NextResponse.json({
        insights: [
          "We couldn’t parse coaching tips—try refreshing in a moment.",
        ],
        cached: false,
      });
    }

    const { error: upsertError } = await supabase.from("retirement_ai_advice_cache").upsert(
      {
        user_id: user.id,
        input_hash: inputHash,
        insights,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      console.error("retirement_ai_advice_cache upsert:", upsertError);
    }

    return NextResponse.json({ insights, cached: false });
  } catch (e) {
    console.error("retirement-advice route:", e);
    return NextResponse.json(
      {
        insights: [
          "Advice is temporarily unavailable. Your projection numbers in the planner are still up to date.",
        ],
        cached: false,
      },
      { status: 200 }
    );
  }
}
