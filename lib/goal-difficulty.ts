/**
 * Simple difficulty tier for a savings goal: time to fund vs size vs take-home pay.
 * Not financial advice—rough UX signal only.
 */

export type GoalDifficultyLevel = "easy" | "moderate" | "aggressive";

export function goalDifficultyLabel(level: GoalDifficultyLevel): string {
  switch (level) {
    case "easy":
      return "Easy";
    case "moderate":
      return "Moderate";
    case "aggressive":
      return "Aggressive";
  }
}

/**
 * @param monthsToFund – months this goal receives the full monthly savings (waterfall leg)
 * @param goalAmount – target dollars
 * @param monthlyTakeHome – monthly pay after budget math (same as Goals save % basis)
 */
export function getGoalDifficulty(input: {
  monthsToFund: number;
  goalAmount: number;
  monthlyTakeHome: number;
}): GoalDifficultyLevel | null {
  const months = Math.max(0, input.monthsToFund);
  const amount = Math.max(0, input.goalAmount);
  if (months <= 0 || amount <= 0) return null;

  const mh = Math.max(0, input.monthlyTakeHome);

  // How many months of take-home the target equals (if you saved 100% of paycheck).
  const monthsOfIncome = mh > 0 ? amount / mh : NaN;

  // Time pressure: longer funding window → harder.
  const timeTier = months <= 6 ? 0 : months <= 20 ? 1 : 2;

  // Size vs income: heavy goals → harder. If no income, use time only.
  let burdenTier = timeTier;
  if (Number.isFinite(monthsOfIncome)) {
    burdenTier = monthsOfIncome <= 4 ? 0 : monthsOfIncome <= 14 ? 1 : 2;
  }

  const tier = Math.max(timeTier, burdenTier);
  if (tier === 0) return "easy";
  if (tier === 1) return "moderate";
  return "aggressive";
}
