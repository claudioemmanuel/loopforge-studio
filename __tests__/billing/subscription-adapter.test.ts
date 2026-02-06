import { describe, expect, it } from "vitest";
import {
  SUBSCRIPTION_PLANS,
  getMonthlyBillingPeriod,
  getPlanConfig,
  isLimitExceeded,
  isUnlimited,
} from "@/lib/contexts/billing/domain/types";

describe("Billing domain types helpers", () => {
  it("exposes expected plan definitions", () => {
    expect(Object.keys(SUBSCRIPTION_PLANS)).toEqual([
      "free",
      "pro",
      "enterprise",
    ]);

    expect(getPlanConfig("free").limits).toEqual({
      maxRepos: 1,
      maxTasksPerMonth: 10,
      maxTokensPerMonth: 100_000,
    });
  });

  it("handles unlimited checks correctly", () => {
    expect(isUnlimited("enterprise", "repos")).toBe(true);
    expect(isUnlimited("enterprise", "tasks")).toBe(true);
    expect(isUnlimited("enterprise", "tokens")).toBe(true);
    expect(isUnlimited("free", "repos")).toBe(false);
  });

  it("treats exact limit values as exceeded", () => {
    expect(isLimitExceeded(100, 100)).toBe(true);
    expect(isLimitExceeded(99, 100)).toBe(false);
    expect(isLimitExceeded(100000, -1)).toBe(false);
  });

  it("builds month-aligned billing periods", () => {
    const period = getMonthlyBillingPeriod(
      new Date("2026-02-06T12:00:00.000Z"),
    );

    expect(period.start.getUTCFullYear()).toBe(2026);
    expect(period.start.getUTCMonth()).toBe(1);
    expect(period.start.getUTCDate()).toBe(1);
    expect(period.end.getUTCFullYear()).toBe(2026);
    expect(period.end.getUTCMonth()).toBe(1);
    expect(period.end.getUTCDate()).toBe(28);
  });
});
