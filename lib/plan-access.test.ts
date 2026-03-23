import { describe, expect, it } from "vitest";
import { computeProAccessFromRow } from "@/lib/plan-access";

const NOW = 1_700_000_000_000;
const TRIAL_END_FUTURE = new Date(NOW + 7 * 86_400_000).toISOString();

describe("computeProAccessFromRow", () => {
  it("pro + inactive => access (manual / comped)", () => {
    expect(
      computeProAccessFromRow(
        { plan: "pro", subscription_status: "inactive", trial_ends_at: null },
        NOW
      )
    ).toBe(true);
  });

  it("pro + canceled => no access", () => {
    expect(
      computeProAccessFromRow(
        { plan: "pro", subscription_status: "canceled", trial_ends_at: null },
        NOW
      )
    ).toBe(false);
  });

  it("free + inactive => no access", () => {
    expect(
      computeProAccessFromRow(
        { plan: "free", subscription_status: "inactive", trial_ends_at: null },
        NOW
      )
    ).toBe(false);
  });

  it("free + trialing + future trial_ends_at => access (active trial)", () => {
    expect(
      computeProAccessFromRow(
        { plan: "free", subscription_status: "trialing", trial_ends_at: TRIAL_END_FUTURE },
        NOW
      )
    ).toBe(true);
  });

  it("pro + active => access", () => {
    expect(
      computeProAccessFromRow(
        { plan: "pro", subscription_status: "active", trial_ends_at: null },
        NOW
      )
    ).toBe(true);
  });

  it("pro + past_due => access", () => {
    expect(
      computeProAccessFromRow(
        { plan: "pro", subscription_status: "past_due", trial_ends_at: null },
        NOW
      )
    ).toBe(true);
  });
});
