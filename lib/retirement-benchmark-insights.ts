/**
 * Lightweight, rule-of-thumb benchmarks by age (no external data).
 * Copy is encouraging; numbers are illustrative planning guides, not statistics.
 */

export type BenchmarkInsightLine = {
  text: string;
  /** Visual emphasis in UI */
  variant: "positive" | "neutral" | "nudge";
};

type AgeBand = {
  /** e.g. "your 30s" */
  phrase: string;
  /** Goals “invest %” many plans cite as a starting range */
  investLow: number;
  investHigh: number;
  /** Employee retirement $ as % of gross salary — same ballpark order */
  deferralLow: number;
  deferralHigh: number;
  /** save% + invest% of take-home — common “pay yourself first” ballpark */
  combinedLow: number;
  combinedHigh: number;
};

function ageBand(age: number): AgeBand {
  const a = Math.max(18, Math.min(100, Math.floor(age)));
  if (a < 30) {
    return {
      phrase: "people in their 20s",
      investLow: 10,
      investHigh: 15,
      deferralLow: 10,
      deferralHigh: 15,
      combinedLow: 15,
      combinedHigh: 22,
    };
  }
  if (a < 40) {
    return {
      phrase: "people in their 30s",
      investLow: 12,
      investHigh: 18,
      deferralLow: 12,
      deferralHigh: 18,
      combinedLow: 18,
      combinedHigh: 25,
    };
  }
  if (a < 50) {
    return {
      phrase: "people in their 40s",
      investLow: 12,
      investHigh: 18,
      deferralLow: 15,
      deferralHigh: 20,
      combinedLow: 20,
      combinedHigh: 28,
    };
  }
  if (a < 60) {
    return {
      phrase: "people in their 50s",
      investLow: 12,
      investHigh: 20,
      deferralLow: 18,
      deferralHigh: 25,
      combinedLow: 22,
      combinedHigh: 32,
    };
  }
  return {
    phrase: "people nearing retirement",
    investLow: 10,
    investHigh: 15,
    deferralLow: 15,
    deferralHigh: 22,
    combinedLow: 18,
    combinedHigh: 28,
  };
}

function compareToRange(value: number, low: number, high: number): "above" | "in" | "below" {
  if (value > high) return "above";
  if (value < low) return "below";
  return "in";
}

/**
 * Short comparison bullets for the Retirement planner.
 * Uses goals % (take-home) and deferrals % of gross when available.
 */
export function getRetirementBenchmarkInsightLines(input: {
  currentAge: number;
  investPercentGoals: number | undefined | null;
  savePercentGoals: number | undefined | null;
  /** Employee retirement contributions as % of gross annual salary; null if unknown */
  retirementDeferralPercentOfGross: number | null;
}): BenchmarkInsightLine[] {
  const band = ageBand(input.currentAge);
  const lines: BenchmarkInsightLine[] = [];

  const invest = Math.max(0, Math.round(Number(input.investPercentGoals) || 0));
  const save = Math.max(0, Math.round(Number(input.savePercentGoals) || 0));
  const combined = save + invest;
  const deferral = input.retirementDeferralPercentOfGross;

  // 1 — Invest % (Goals), always when we can phrase it clearly
  {
    const rel = compareToRange(invest, band.investLow, band.investHigh);
    if (invest > 0) {
      let text: string;
      let variant: BenchmarkInsightLine["variant"];
      if (rel === "above") {
        text = `Many guides suggest roughly ${band.investLow}–${band.investHigh}% of income toward investing for ${band.phrase}. You’re investing ${invest}% in Goals—ahead of that ballpark.`;
        variant = "positive";
      } else if (rel === "in") {
        text = `Typical targets for ${band.phrase} are often around ${band.investLow}–${band.investHigh}% toward investing. Your ${invest}% in Goals sits right in that range.`;
        variant = "neutral";
      } else {
        text = `A common starting band for ${band.phrase} is about ${band.investLow}–${band.investHigh}% toward investing. You’re at ${invest}% in Goals—even small nudges add up.`;
        variant = "nudge";
      }
      lines.push({ text, variant });
    } else {
      lines.push({
        text: `Many plans use about ${band.investLow}–${band.investHigh}% of income toward investing as a rough target for ${band.phrase}. Your Goals invest % is 0—worth a look when you’re ready.`,
        variant: "nudge",
      });
    }
  }

  // 2 — Deferral % of gross (planner accounts)
  if (deferral != null && Number.isFinite(deferral)) {
    const d = Math.round(deferral);
    const rel = compareToRange(d, band.deferralLow, band.deferralHigh);
    let text: string;
    let variant: BenchmarkInsightLine["variant"];
    if (rel === "above") {
      text = `You’re directing about ${d}% of salary into retirement accounts—often more than the ${band.deferralLow}–${band.deferralHigh}% ballpark people use in ${band.phrase}.`;
      variant = "positive";
    } else if (rel === "in") {
      text = `Your retirement contributions are about ${d}% of salary—in line with a common ${band.deferralLow}–${band.deferralHigh}% reference for ${band.phrase}.`;
      variant = "neutral";
    } else {
      text = `A simple reference for ${band.phrase} is often ${band.deferralLow}–${band.deferralHigh}% of salary into retirement accounts. You’re at about ${d}%—every step forward helps.`;
      variant = "nudge";
    }
    lines.push({ text, variant });
  }

  // 3 — Combined save + invest (Goals) vs take-home benchmark
  if (combined > 0) {
    const rel = compareToRange(combined, band.combinedLow, band.combinedHigh);
    let text: string;
    let variant: BenchmarkInsightLine["variant"];
    if (rel === "above") {
      text = `Your save and invest targets in Goals add up to ${combined}% of take-home—above the ${band.combinedLow}–${band.combinedHigh}% range many folks aim for at your stage.`;
      variant = "positive";
    } else if (rel === "in") {
      text = `Together, your Goals save and invest rates (${combined}% of take-home) match a common ${band.combinedLow}–${band.combinedHigh}% band for ${band.phrase}.`;
      variant = "neutral";
    } else {
      text = `Many people aim for roughly ${band.combinedLow}–${band.combinedHigh}% of take-home across saving and investing. You’re at ${combined}% in Goals—room to grow when it fits your budget.`;
      variant = "nudge";
    }
    lines.push({ text, variant });
  }

  return lines.slice(0, 4);
}

/** One encouraging headline from generated lines (no extra “data” claims). */
export function getRetirementBenchmarkHeadline(lines: BenchmarkInsightLine[]): string {
  if (!lines.length) {
    return "Add salary and goals to see loose benchmarks.";
  }
  const positives = lines.filter((l) => l.variant === "positive").length;
  const nudges = lines.filter((l) => l.variant === "nudge").length;
  if (positives >= 2) {
    return "You’re beating several simple planning ballparks for someone your age—nice work.";
  }
  if (positives === 1) {
    return "You’re ahead on at least one common benchmark—keep that momentum.";
  }
  if (nudges === lines.length) {
    return "Compared with typical rule-of-thumb ranges, there’s room to grow when it fits your budget.";
  }
  return "You’re in the ballpark on some common planning ranges—tune as your life changes.";
}
