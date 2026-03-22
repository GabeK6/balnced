import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { COPILOT_MAX_CHARS_PER_MESSAGE, COPILOT_MAX_MESSAGES } from "@/lib/copilot-conversation";
import { getProAccessForUser, proPlanRequiredResponse } from "@/lib/plan-server";

const MAX_CONTENT = COPILOT_MAX_CHARS_PER_MESSAGE;
/** Enough for structured snapshot + a few turns */
const MAX_CONTEXT_JSON = 14_000;

function sanitizeMessage(m: unknown): { role: "user" | "assistant"; content: string } | null {
  if (m == null || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  const role = o.role === "user" || o.role === "assistant" ? o.role : null;
  const content = typeof o.content === "string" ? o.content.trim() : "";
  if (!role || !content || content.length > MAX_CONTENT) return null;
  return { role, content };
}

function contextBlock(raw: unknown): string {
  if (raw == null || typeof raw !== "object") {
    return "(No financial snapshot was sent — say you don’t have their Balnced numbers and give only generic budgeting tips.)";
  }
  try {
    const s = JSON.stringify(raw);
    return s.length > MAX_CONTEXT_JSON ? s.slice(0, MAX_CONTEXT_JSON) + "…" : s;
  } catch {
    return "(Snapshot unavailable.)";
  }
}

/**
 * POST JSON: { messages: { role, content }[], context?: CopilotOverviewContext }
 * Headers: Authorization: Bearer <supabase access_token>
 * Response: { reply: string } or { error } (401)
 */
export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const body = (await req.json()) as Record<string, unknown>;
    const rawMessages = body.messages;
    const context = body.context;

    const authHeader = req.headers.get("authorization");
    const token =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token) {
      return NextResponse.json({ error: "missing_auth" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        reply:
          "The app server isn’t fully configured for AI chat. Your dashboard numbers are still accurate.",
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
      return NextResponse.json({ error: "invalid_session" }, { status: 401 });
    }

    const hasPro = await getProAccessForUser(supabase, user.id);
    if (!hasPro) {
      return proPlanRequiredResponse();
    }

    const list = Array.isArray(rawMessages) ? rawMessages : [];
    const cleaned = list
      .map(sanitizeMessage)
      .filter((m): m is { role: "user" | "assistant"; content: string } => m != null)
      .slice(-COPILOT_MAX_MESSAGES);

    if (cleaned.length === 0) {
      return NextResponse.json({ reply: "Send a message to continue." });
    }

    const lastUser = [...cleaned].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json({ reply: "Ask a question in your own words to get started." });
    }

    if (!apiKey) {
      return NextResponse.json({
        reply:
          "Add OPENAI_API_KEY to your server environment to enable AI answers. Until then, use Overview (safe to spend, bills, daily limit) as your guide.",
      });
    }

    const factsJson = contextBlock(context);

    const system = `You are a financial assistant helping a user manage their money inside Balnced, a budgeting app built around safe-to-spend between paychecks, bills, goals, and optional retirement projections.

You are in a **multi-turn conversation**. Use the message thread when the user gives follow-ups ("what about next month?", "what if I increase that?", "explain that")—stay consistent with what you already said, and always ground dollar amounts and dates in the JSON snapshot below (not from memory alone).

You ONLY have the facts below (USD). Treat them as authoritative for this user right now. Do not invent accounts, employers, debts, or investments not implied by the data.

STRUCTURED USER DATA (JSON):
${factsJson}

How to answer:
- Keep replies to **2–4 short sentences** total. No bullet lists unless the user explicitly asks for steps.
- Be **specific**: cite dollar amounts, percentages, days until payday, or goal names from the JSON when relevant.
- **Affordability** (e.g. "Can I afford $200?"): Compare the purchase to **cashAndPayPeriod.safeToSpend** and **dailySpendingLimitUntilPayday**. If safeToSpend is lower than the purchase, say so clearly and mention what would need to change (wait until after payday, reduce other spending, or adjust goals) using only what the data supports.
- **Goals** ("reach my goal faster"): Use **goals.savingsGoals** priorities, **goals.monthlyToSavingsAndInvest**, and **goals.savePercent / investPercent**. Suggest realistic levers (increase allocation, reprioritize, or extend timeline)—no fabricated rates of return.
- **Overspending**: Use **payPeriodSnapshot.summarySentence** / **sentenceVariant** when present, plus **cashAndPayPeriod.safeToSpendStatus**, **pace.dailySpendPaceThisMonth**, **pace.projectedBalanceAtPayday**, and **expenses.topCategoriesThisMonth**—call out tension between pace and runway before payday.
- **Retirement**: Only discuss numbers in **retirement.projectedPortfolioAtRetirementUsd** and related fields; if null, say the app doesn’t have a projection on file.
- Avoid generic platitudes ("stay on track", "be mindful") without tying them to **their** numbers.
- Remind briefly that you are educational, not a licensed advisor, only if giving trade-off or tax-adjacent guidance.

Tone: calm, direct, premium fintech—actionable, not preachy.`;

    const openai = new OpenAI({ apiKey });

    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      ...cleaned.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatMessages,
      temperature: 0.25,
      max_tokens: 320,
    });

    const reply =
      response.choices[0]?.message?.content?.trim() ||
      "I couldn’t generate a reply — try again in a moment.";

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("copilot route:", e);
    return NextResponse.json({
      reply: "Something went wrong reaching the assistant. Please try again.",
    });
  }
}
