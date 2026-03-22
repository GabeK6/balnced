/**
 * Structured snapshot passed from Overview so the copilot grounds answers in real numbers.
 * Keep JSON-serializable; avoid free-text PII beyond bill/goal names the app already stores.
 */
export type CopilotBillLine = {
  name: string;
  amount: number;
  dueDate: string;
};

export type CopilotCategorySpend = {
  category: string;
  amount: number;
};

export type CopilotSavingsGoalLine = {
  name: string;
  targetAmount: number;
  priority: number;
};

export type CopilotOverviewContext = {
  /** Display hint for freshness */
  asOf: string;
  cashAndPayPeriod: {
    nextPaydayLabel: string | null;
    daysUntilPayday: number;
    walletBalanceAfterLoggedExpenses: number;
    safeToSpend: number;
    dailySpendingLimitUntilPayday: number;
    safeToSpendStatus: string;
  };
  income: {
    expectedPaycheckPerPayPeriod: number;
    monthlyTakeHome: number;
    annualTakeHomeEstimate: number;
  };
  bills: {
    totalCommittedBeforePayday: number;
    upcomingBeforePayday: CopilotBillLine[];
  };
  expenses: {
    /** Calendar month-to-date logged spending */
    spendingThisMonth: number;
    topCategoriesThisMonth: CopilotCategorySpend[];
  };
  /** Same model as Overview “money flow” strip */
  monthlyMoneyFlow: {
    incomeMonthly: number;
    recurringBillsMonthlyEstimate: number;
    savingsAndInvestAllocatedMonthly: number;
    spendingThisMonth: number;
    walletBalance: number;
  } | null;
  /** “This pay period” snapshot when computable */
  payPeriodSnapshot: {
    incomeThisPeriod: number;
    billsCommitted: number;
    savingsAllocated: number;
    remainingBalance: number;
    safeToSpendThisPeriod: number;
    summarySentence: string;
    sentenceVariant: "on_track" | "tight" | "overspending";
  } | null;
  goals: {
    savePercent: number;
    investPercent: number;
    monthlyToSavingsAndInvest: number;
    savingsGoals: CopilotSavingsGoalLine[];
    targetRetirementAge: number | null;
  };
  retirement: {
    projectedPortfolioAtRetirementUsd: number | null;
  };
  health: {
    score: number;
    label: string;
  };
  pace: {
    projectedBalanceAtPayday: number;
    dailySpendPaceThisMonth: number;
  };
};

export type CopilotChatMessagePayload = {
  role: "user" | "assistant";
  content: string;
};
