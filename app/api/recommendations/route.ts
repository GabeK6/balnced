import OpenAI from "openai";
import { NextResponse } from "next/server";
import { formatAccountLabel } from "@/lib/retirement-accounts";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          recommendation:
            "Add OPENAI_API_KEY to .env.local to get personalized allocation and investing advice.",
          suggestedMonthlyInvest: 0,
          suggestedMonthlySave: 0,
          allocation: {},
        },
        { status: 200 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const body = await req.json();

    const {
      monthlyPay,
      monthlyIncome,
      balance,
      monthlyBills,
      expensesTotal,
      retirementAge,
      currentAge,
      bigPurchaseName,
      bigPurchaseAmount,
      savingsGoalsSummary,
      savePercent,
      investPercent,
      retirement,
    } = body as {
      monthlyPay?: number;
      monthlyIncome?: number;
      balance?: number;
      monthlyBills?: number;
      expensesTotal?: number;
      retirementAge?: number;
      currentAge?: number;
      bigPurchaseName?: string | null;
      bigPurchaseAmount?: number | null;
      savingsGoalsSummary?: string | null;
      savePercent?: number;
      investPercent?: number;
      retirement?: {
        enabledAccounts?: string[];
        retirementStatus?: string | null;
      };
    };

    const enabledAccounts = Array.isArray(retirement?.enabledAccounts)
      ? retirement?.enabledAccounts
      : [];
    const status = retirement?.retirementStatus ?? null;
    const monthlyPayNum = Number(monthlyPay ?? monthlyIncome) || 0;
    const savePct = Number(savePercent) || 0;
    const investPct = Number(investPercent) || 0;

    const hasAnyAccount = enabledAccounts.length > 0;
    const enabledAccountLabels = enabledAccounts
      .map((t) => formatAccountLabel(t))
      .filter(Boolean);

    const retirementContext = hasAnyAccount
      ? `
Retirement accounts (user has enabled): ${enabledAccountLabels.join("; ")}. Retirement health status: ${status || "not yet calculated"}. Weave only these enabled accounts into the invest recommendation. Explain how to prioritize these accounts given their plan (do not invent new dollar amounts or percentages).`
      : `
The user has not enabled any retirement accounts yet. Do NOT assume they already contribute to retirement. Recommend they consider starting with the most accessible option (for example, a Roth IRA or workplace retirement plan if available) and explain a sensible order of operations without inventing new dollar amounts or percentages.`;

    const prompt = `You are a friendly financial advisor. Given this snapshot and the user's existing plan, explain and prioritize what they should focus on.

IMPORTANT: Allocation order - 1) Bills. 2) Save (emergency/big purchase). 3) Invest (retirement). 4) Discretionary (going out, food, activities). Do NOT suggest new dollar amounts or percentages; instead, explain how to use the plan they already have. All dollar amounts below are monthly.

Monthly take-home pay: $${monthlyPayNum}
Current balance: $${balance ?? 0}
Monthly recurring bills (rent, utilities, subscriptions, etc.): $${monthlyBills ?? 0}
Typical monthly expenses (spending): $${expensesTotal ?? 0}
Amount left after bills: $${Math.max(0, monthlyPayNum - (monthlyBills ?? 0))}
Planned savings for goals/emergency: ${savePct}%
Planned investing for retirement: ${investPct}%
Target retirement age: ${retirementAge ?? 65}
Current age (estimate if missing): ${currentAge ?? 35}
Savings goals (priority 1 is funded first): ${savingsGoalsSummary || `${bigPurchaseName || "None"} ${bigPurchaseAmount ? `$${bigPurchaseAmount}` : ""}`}
${retirementContext}

Respond with a JSON object only, no other text, with this exact key:
- "recommendation": 2-4 sentences of clear, encouraging advice. Emphasize allocation order (bills, then save, then invest, then discretionary). Mention retirement (and Roth/401k if provided) and big purchase if relevant, referencing the existing plan where helpful. Do NOT invent new dollar amounts or percentages.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You respond only with valid JSON. Be practical and conservative. Allocation order: 1) Bills. 2) Save (emergency/big purchase). 3) Invest (retirement). 4) Discretionary (dining out, activities, fun). Reserve meaningful room for discretionary; never leave zero for going out, food, and activities.",
        },
        { role: "user", content: prompt },
      ],
    });

    const text =
      response.choices[0]?.message?.content?.trim() || "{}";
    let parsed: { recommendation?: string };
    try {
      const cleaned = text.replace(/```json?\s*|\s*```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {};
    }

    return NextResponse.json({
      recommendation:
        parsed.recommendation ||
        "Aim to cover bills first, then build an emergency fund, then invest for retirement.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        recommendation:
          "We couldn’t generate a custom plan right now. A good rule of thumb: put 50% toward needs, 30% toward wants, and 20% toward savings and investing.",
      },
      { status: 200 }
    );
  }
}
