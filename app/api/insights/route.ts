import { NextResponse } from "next/server";

/** Format dollars for display in guidance text. */
function fmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export type StructuredGuidance = {
  status: string;
  actions: string[];
  nextEvent: string;
  optionalOptimization: string | null;
};

type InsightPayload = {
  balance?: number;
  safeToSpend?: number;
  billsTotal?: number;
  expensesTotal?: number;
  dailySpendingLimit?: number;
  nextPayday?: string;
  daysUntilPayday?: number;
  expectedPaycheck?: number;
  /** Bills due before next payday: { name, amount, due_date } */
  upcomingBills?: { name: string; amount: number; due_date: string }[];
  retirementAge?: number;
  investPercent?: number;
  savePercent?: number;
  /** Optional: total monthly retirement contribution estimate for optimization copy */
  monthlyRetirementContribution?: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as InsightPayload;

    const safeToSpend = Number(body.safeToSpend) || 0;
    const dailyLimit = Number(body.dailySpendingLimit) || 0;
    const daysUntilPayday = Math.max(0, Number(body.daysUntilPayday) ?? 0);
    const expectedPaycheck = Number(body.expectedPaycheck) || 0;
    const upcomingBills = Array.isArray(body.upcomingBills) ? body.upcomingBills : [];
    const investPercent = Number(body.investPercent) || 0;
    const savePercent = Number(body.savePercent) || 0;
    const monthlyRetirement = Number(body.monthlyRetirementContribution) || 0;

    const hasPayday =
      (body.nextPayday && String(body.nextPayday).length > 0) ||
      expectedPaycheck > 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Next event: soonest of (next bill due, next payday)
    let nextEvent = "";
    const billsWithDays = upcomingBills
      .map((b) => ({
        ...b,
        daysUntil: Math.ceil(
          (new Date(b.due_date).setHours(0, 0, 0, 0) - today.getTime()) /
            (1000 * 60 * 60 * 24)
        ),
      }))
      .filter((b) => b.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    const nextBill = billsWithDays[0];
    const paydayBeforeBill =
      daysUntilPayday >= 0 &&
      (!nextBill || daysUntilPayday <= nextBill.daysUntil);

    if (paydayBeforeBill && daysUntilPayday >= 0 && hasPayday) {
      nextEvent = `Next payday in ${daysUntilPayday} day${daysUntilPayday === 1 ? "" : "s"} (+${fmt(expectedPaycheck)})`;
    } else if (nextBill) {
      nextEvent = `Bill due in ${nextBill.daysUntil} day${nextBill.daysUntil === 1 ? "" : "s"}: ${nextBill.name} — ${fmt(nextBill.amount)}`;
    } else if (daysUntilPayday >= 0 && expectedPaycheck > 0) {
      nextEvent = `Next payday in ${daysUntilPayday} day${daysUntilPayday === 1 ? "" : "s"} (+${fmt(expectedPaycheck)})`;
    } else {
      nextEvent = "No payday or bill date set.";
    }

    // Thresholds: use daily limit as runway when we have days until payday
    const runwayDays =
      dailyLimit > 0 && daysUntilPayday > 0
        ? safeToSpend / dailyLimit
        : safeToSpend > 0 ? 999 : 0;

    let status: string;
    let actions: string[];
    let optionalOptimization: string | null = null;

    if (safeToSpend <= 0) {
      status = "Spending is tight until next payday.";
      actions = [
        "Stop discretionary spending — focus on essentials only.",
        "Avoid any new purchases until after payday.",
        "Cover bills and necessities first; reassess after you get paid.",
      ];
    } else if (runwayDays < 5) {
      status = "You're in a cautious position until payday.";
      actions = [
        `Limit spending to ${fmt(dailyLimit)}/day or less.`,
        "Avoid large or non-essential purchases.",
        "Postpone optional subscriptions or extras until after payday.",
      ];
    } else if (runwayDays < 14) {
      status = "You're on track.";
      actions = [];
      if (dailyLimit > 0) {
        actions.push(`Stay under ${fmt(dailyLimit)}/day to keep buffer.`);
      }
      if (savePercent > 0 || investPercent > 0) {
        actions.push("Keep allocating to savings and investing per your goals.");
      }
      if (actions.length === 0) {
        actions.push("Keep spending within your daily limit.");
      }
      if (savePercent === 0 && investPercent === 0) {
        optionalOptimization =
          "Consider setting a small save % or invest % in Goals to build habits.";
      }
    } else {
      status = "You have a strong buffer until payday.";
      actions = [
        "Good time to allocate to savings or emergency fund.",
        "Consider investing or increasing retirement contributions if goals allow.",
      ];
      if (monthlyRetirement > 0 && investPercent < 15) {
        optionalOptimization = `You could increase retirement contributions (e.g. +1–2%) to grow long-term.`;
      } else if (savePercent > 0) {
        optionalOptimization = "You could add a bit more to savings this period.";
      }
    }

    // Cap at 3 actions
    actions = actions.slice(0, 3);

    const guidance: StructuredGuidance = {
      status,
      actions,
      nextEvent,
      optionalOptimization,
    };

    return NextResponse.json(guidance);
  } catch (error) {
    return NextResponse.json(
      {
        status: "We couldn’t load your guidance.",
        actions: ["Check your budget and try again."],
        nextEvent: "",
        optionalOptimization: null,
      } as StructuredGuidance,
      { status: 200 }
    );
  }
}
