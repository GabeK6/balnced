import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  computeAffordability,
  templateAffordabilityExplanation,
  type AffordabilityComputation,
} from "@/lib/affordability-check";
import type { CopilotOverviewContext } from "@/lib/copilot-types";
import { getProAccessForUser, proPlanRequiredResponse } from "@/lib/plan-server";

function n(v: unknown): number {
  if (v == null || v === "") return NaN;
  const x = Number(v);
  return Number.isFinite(x) ? x : NaN;
}

function summarizeForPrompt(c: AffordabilityComputation): string {
  return [
    `verdict=${c.verdict}`,
    `purchase=${c.amount}`,
    `safeToSpend=${c.safeToSpend}`,
    `remainingAfter=${c.remainingAfter}`,
    `billsBeforePayday=${c.billsCommittedBeforePayday}`,
    `monthlyToGoals=${c.monthlyToGoals}`,
    `dailyLimit=${c.dailySpendingLimit}`,
    `daysUntilPayday=${c.daysUntilPayday}`,
  ].join("; ");
}

/**
 * POST JSON: { amount: number, context: CopilotOverviewContext }
 * Headers: Authorization: Bearer <supabase access_token>
 * Response: { verdict: "yes"|"no"|"risky", explanation: string }
 */
export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const body = (await req.json()) as Record<string, unknown>;
    const amount = n(body.amount);
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
      return NextResponse.json(
        { error: "missing_context", verdict: "no", explanation: "Refresh the page and try again." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({
        verdict: "no" as const,
        explanation: "Enter a dollar amount greater than zero.",
      });
    }

    const computed = computeAffordability(amount, context);
    if (!computed) {
      return NextResponse.json({
        verdict: "no" as const,
        explanation: "Invalid amount.",
      });
    }

    const fallback = templateAffordabilityExplanation(computed);

    if (!apiKey) {
      return NextResponse.json({
        verdict: computed.verdict,
        explanation: fallback,
      });
    }

    const openai = new OpenAI({ apiKey });

    const oneLiner = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Balnced Copilot. The verdict (yes/no/risky) is already computed from the user’s safe-to-spend, bills, and goals — do NOT change it or contradict it. Write ONE or TWO short sentences (max 45 words total). Plain text, no markdown, no labels like 'Verdict:'. Be specific with their dollar amounts.",
        },
        {
          role: "user",
          content: `Computed: ${summarizeForPrompt(computed)}\n\nTemplate (for tone/numbers): ${fallback}\n\nRewrite in your own words, same meaning.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 100,
    });

    const text = oneLiner.choices[0]?.message?.content?.trim();
    const explanation =
      text && text.length > 0 && text.length < 500 ? text : fallback;

    return NextResponse.json({
      verdict: computed.verdict,
      explanation,
    });
  } catch (e) {
    console.error("copilot/afford route:", e);
    return NextResponse.json({
      verdict: "no" as const,
      explanation: "Couldn’t check affordability — try again.",
    });
  }
}
