import type { SavingsGoalItem, SavingsGoalKind } from "@/lib/dashboard-data";

export const GOAL_KIND_ORDER: SavingsGoalKind[] = [
  "house",
  "car",
  "emergency_fund",
  "custom",
];

export const GOAL_KIND_META: Record<
  SavingsGoalKind,
  { label: string; kicker: string; hint: string }
> = {
  house: {
    label: "House",
    kicker: "Down payment",
    hint: "Enter a typical home price and down payment %. We calculate what you need to save.",
  },
  car: {
    label: "Car",
    kicker: "Big purchase",
    hint: "Set the vehicle price you’re saving for and a target timeline to check your pace.",
  },
  emergency_fund: {
    label: "Emergency fund",
    kicker: "Safety net",
    hint: "Most people aim for 3–6 months of take-home; adjust to match your comfort.",
  },
  custom: {
    label: "Custom",
    kicker: "Anything else",
    hint: "Name and target amount—full control.",
  },
};

export function effectiveGoalKind(g: SavingsGoalItem): SavingsGoalKind {
  return g.goal_kind ?? "custom";
}

export function computeHouseDownAmount(
  housePrice: number,
  downPct: number
): number {
  const hp = Math.max(0, housePrice);
  const p = Math.min(100, Math.max(0, downPct));
  return Math.round((hp * p) / 100);
}

const CLEARED_KIND_FIELDS: Pick<
  SavingsGoalItem,
  "house_price" | "down_payment_percent" | "car_target_months" | "emergency_months"
> = {
  house_price: undefined,
  down_payment_percent: undefined,
  car_target_months: undefined,
  emergency_months: undefined,
};

/** Prefill when user selects a big-purchase type (merge after clearing kind-specific fields). */
export function prefillForGoalKind(
  kind: SavingsGoalKind,
  monthlyTakeHome: number
): Partial<SavingsGoalItem> {
  const take = Math.max(0, monthlyTakeHome);
  switch (kind) {
    case "house": {
      const house_price = 350_000;
      const down_payment_percent = 20;
      return {
        ...CLEARED_KIND_FIELDS,
        goal_kind: "house",
        name: "House down payment",
        house_price,
        down_payment_percent,
        amount: computeHouseDownAmount(house_price, down_payment_percent),
      };
    }
    case "car": {
      const amount = 28_000;
      return {
        ...CLEARED_KIND_FIELDS,
        goal_kind: "car",
        name: "Next vehicle",
        amount,
        car_target_months: 36,
      };
    }
    case "emergency_fund": {
      const emergency_months = 6;
      const amount =
        take > 0 ? Math.round(take * emergency_months) : 15_000;
      return {
        ...CLEARED_KIND_FIELDS,
        goal_kind: "emergency_fund",
        name: "Emergency fund",
        emergency_months,
        amount,
      };
    }
    case "custom":
    default:
      return {
        ...CLEARED_KIND_FIELDS,
        goal_kind: "custom",
      };
  }
}
