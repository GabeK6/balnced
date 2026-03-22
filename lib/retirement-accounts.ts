export type RetirementAccountType =
  | "trad_401k"
  | "roth_401k"
  | "403b"
  | "457b"
  | "pension"
  | "trad_ira"
  | "roth_ira"
  | "sep_ira"
  | "simple_ira"
  | "solo_401k"
  | "taxable_brokerage";

export type RetirementAccountBucket = "tax_deferred" | "roth" | "taxable";

export type InvestedAccountConfig = {
  balance: number;
  /** Salary-based contributions (e.g. 401k/403b/etc). Stored as percent (0-100). */
  contribution_percent_of_salary?: number;
  /** Annual contributions for accounts that accept yearly dollars (e.g. IRAs, brokerage). */
  annual_contribution?: number;
  /** If true, annual_contribution grows with salary each year. */
  contribution_grows_with_salary?: boolean;
  /** Optional employer match (percent of salary). */
  employer_match_percent?: number;
};

export type PensionAccountConfig = {
  /** Monthly retirement income (not invested balance). */
  monthly_income: number;
};

export type RetirementAccounts = Partial<
  Record<RetirementAccountType, InvestedAccountConfig | PensionAccountConfig>
>;

export function isPensionAccount(
  type: RetirementAccountType
): type is "pension" {
  return type === "pension";
}

export function getAccountBucket(
  type: RetirementAccountType
): RetirementAccountBucket | null {
  switch (type) {
    case "trad_401k":
    case "403b":
    case "457b":
    case "trad_ira":
    case "sep_ira":
    case "simple_ira":
    case "solo_401k":
      return "tax_deferred";
    case "roth_401k":
    case "roth_ira":
      return "roth";
    case "taxable_brokerage":
      return "taxable";
    case "pension":
      return null;
    default:
      return null;
  }
}

export function formatAccountLabel(type: RetirementAccountType | string): string {
  switch (type) {
    case "trad_401k":
      return "Traditional 401(k)";
    case "roth_401k":
      return "Roth 401(k)";
    case "403b":
      return "403(b)";
    case "457b":
      return "457(b)";
    case "pension":
      return "Pension";
    case "trad_ira":
      return "Traditional IRA";
    case "roth_ira":
      return "Roth IRA";
    case "sep_ira":
      return "SEP IRA";
    case "simple_ira":
      return "SIMPLE IRA";
    case "solo_401k":
      return "Solo 401(k)";
    case "taxable_brokerage":
      return "Taxable brokerage";
    default:
      return type;
  }
}

export function getInvestedAccountDefaults(): InvestedAccountConfig {
  return {
    balance: 0,
    contribution_percent_of_salary: 0,
    annual_contribution: 0,
    contribution_grows_with_salary: false,
    employer_match_percent: 0,
  };
}

export function getPensionAccountDefaults(): PensionAccountConfig {
  return {
    monthly_income: 0,
  };
}

export function getAccountDefaults(
  type: RetirementAccountType
): InvestedAccountConfig | PensionAccountConfig {
  if (type === "pension") return getPensionAccountDefaults();
  return getInvestedAccountDefaults();
}

const n = (v: unknown): number => (v == null || v === "" ? 0 : Number(v));

/**
 * Planned annual retirement dollars from enabled accounts (employee deferrals, fixed annual
 * contributions like IRA limits, and employer match as % of salary). Pension is excluded.
 */
export function plannedRetirementContributionsAnnual(
  accounts: RetirementAccounts | undefined | null,
  annualSalary: number
): number {
  if (!accounts) return 0;
  const salary = Math.max(0, n(annualSalary));
  let total = 0;
  for (const [type, raw] of Object.entries(accounts)) {
    if (type === "pension") continue;
    const inv = raw as InvestedAccountConfig;
    const pct = Math.max(0, Math.min(100, n(inv.contribution_percent_of_salary)));
    total += (salary * pct) / 100;
    total += Math.max(0, n(inv.annual_contribution));
    const match = Math.max(0, Math.min(100, n(inv.employer_match_percent)));
    total += (salary * match) / 100;
  }
  return total;
}

/** Monthly average of {@link plannedRetirementContributionsAnnual} (fixed annual amounts / 12). */
export function plannedRetirementContributionsMonthly(args: {
  accounts?: RetirementAccounts | null;
  annualSalary?: number;
}): number {
  return plannedRetirementContributionsAnnual(args.accounts, n(args.annualSalary)) / 12;
}

/**
 * Employee-plan dollars only (deferral % + fixed annual); excludes employer match.
 * Used for the contribution simulator slider baseline.
 */
export function employeeRetirementContributionsAnnual(
  accounts: RetirementAccounts | undefined | null,
  annualSalary: number
): number {
  if (!accounts) return 0;
  const salary = Math.max(0, n(annualSalary));
  let total = 0;
  for (const [type, raw] of Object.entries(accounts)) {
    if (type === "pension") continue;
    const inv = raw as InvestedAccountConfig;
    const pct = Math.max(0, Math.min(100, n(inv.contribution_percent_of_salary)));
    total += (salary * pct) / 100;
    total += Math.max(0, n(inv.annual_contribution));
  }
  return total;
}

/** Monthly average of {@link employeeRetirementContributionsAnnual}. */
export function employeeRetirementContributionsMonthly(args: {
  accounts?: RetirementAccounts | null;
  annualSalary?: number;
}): number {
  return employeeRetirementContributionsAnnual(args.accounts, n(args.annualSalary)) / 12;
}

/**
 * Convert legacy retirement profile columns (has_roth_ira/has_401k...) into the new accounts object.
 * This keeps existing saved users working after we migrate schema.
 */
export function legacyToAccounts(data: Record<string, unknown>): RetirementAccounts {
  const accounts: RetirementAccounts = {};

  if (Boolean(data?.["has_roth_ira"])) {
    accounts.roth_ira = {
      balance: n(data["roth_balance"]),
      annual_contribution: n(data["roth_annual_contribution"]),
      contribution_grows_with_salary: Boolean(data["roth_contribution_grows"]),
    };
  }

  if (Boolean(data?.["has_401k"])) {
    accounts.trad_401k = {
      balance: n(data["k401_balance"]),
      contribution_percent_of_salary: n(data["k401_contribution_percent"]),
      employer_match_percent: Boolean(data?.["has_employer_match"])
        ? n(data["employer_match_percent"])
        : 0,
    };
  }

  return accounts;
}

/**
 * Convert accounts back into the legacy column shape.
 * Used so existing columns remain roughly consistent after users start saving with the new UI.
 */
export function accountsToLegacyColumns(accounts: RetirementAccounts): Record<string, unknown> {
  const roth = accounts.roth_ira as InvestedAccountConfig | undefined;
  const k401 = accounts.trad_401k as InvestedAccountConfig | undefined;

  return {
    has_roth_ira: Boolean(roth),
    roth_balance: roth ? n(roth.balance) : 0,
    roth_annual_contribution: roth ? n(roth.annual_contribution) : 0,
    roth_contribution_grows: roth ? Boolean(roth.contribution_grows_with_salary) : false,

    has_401k: Boolean(k401),
    k401_balance: k401 ? n(k401.balance) : 0,
    k401_contribution_percent: k401 ? n(k401.contribution_percent_of_salary) : 0,
    has_employer_match: k401 ? n(k401.employer_match_percent) > 0 : false,
    employer_match_percent: k401 ? n(k401.employer_match_percent) : 0,
  };
}

