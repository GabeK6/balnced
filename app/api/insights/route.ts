import OpenAI from "openai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          insight: "Missing OPENAI_API_KEY in .env.local",
        },
        { status: 200 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const body = await req.json();

    const {
      balance,
      safeToSpend,
      billsTotal,
      expensesTotal,
      dailySpendingLimit,
      nextPayday,
      categories,
    } = body;

    const prompt = `
You are a helpful budgeting assistant.

User financial snapshot:
Balance: $${balance}
Bills before payday: $${billsTotal}
Expenses so far: $${expensesTotal}
Safe to spend: $${safeToSpend}
Daily spending limit: $${dailySpendingLimit}
Next payday: ${nextPayday}

Expense categories:
${JSON.stringify(categories, null, 2)}

Give a short practical insight in 1-2 sentences.
Be supportive, specific, and concise.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful financial budgeting assistant.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const insight =
      response.choices[0]?.message?.content?.trim() ||
      "No AI insight was generated.";

    return NextResponse.json({ insight });
  } catch (error) {
    return NextResponse.json(
      {
        insight:
          error instanceof Error
            ? `AI error: ${error.message}`
            : "AI error: Unknown error",
      },
      { status: 200 }
    );
  }
}