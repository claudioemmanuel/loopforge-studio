import { describe, it, expect, vi, beforeEach } from "vitest";
import { BillingService } from "@/lib/contexts/billing/application/billing-service";
import type { PlanTier } from "@/lib/contexts/billing/domain/types";
import type { PlanLimits } from "@/lib/db/schema";

function createLimits(overrides?: Partial<PlanLimits>): PlanLimits {
  return {
    maxRepos: 1,
    maxTasksPerMonth: 10,
    maxTokensPerMonth: 100_000,
    ...overrides,
  };
}

describe("BillingService", () => {
  let subscriptionRepository: {
    findByUserId: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let usageRepository: {
    recordUsage: ReturnType<typeof vi.fn>;
    getSummary: ReturnType<typeof vi.fn>;
    getEstimatedCost: ReturnType<typeof vi.fn>;
    getCurrentMonthlyUsage: ReturnType<typeof vi.fn>;
  };
  let taskService: { countByUser: ReturnType<typeof vi.fn> };
  let repositoryService: { countByUser: ReturnType<typeof vi.fn> };
  let billingService: BillingService;

  beforeEach(() => {
    subscriptionRepository = {
      findByUserId: vi.fn(),
      save: vi.fn(),
    };

    usageRepository = {
      recordUsage: vi.fn(),
      getSummary: vi.fn(),
      getEstimatedCost: vi.fn(),
      getCurrentMonthlyUsage: vi.fn(),
    };

    taskService = { countByUser: vi.fn() };
    repositoryService = { countByUser: vi.fn() };

    billingService = new BillingService(
      subscriptionRepository as never,
      usageRepository as never,
      taskService as never,
      repositoryService as never,
    );
  });

  it("builds usage summary with limits and percentages", async () => {
    const limits = createLimits({
      maxRepos: 20,
      maxTasksPerMonth: 100,
      maxTokensPerMonth: 5_000_000,
    });

    subscriptionRepository.findByUserId.mockResolvedValue({
      getState: () => ({
        planTier: "pro",
        billingMode: "managed",
        limits,
      }),
    });

    usageRepository.getSummary.mockResolvedValue({
      totalTokens: 1_250_000,
      totalExecutions: 0,
      byProvider: {},
      byModel: {},
    });
    usageRepository.getEstimatedCost.mockResolvedValue(4500);
    taskService.countByUser.mockResolvedValue(25);
    repositoryService.countByUser.mockResolvedValue(5);

    const summary = await billingService.getUsageSummary("user-1");

    expect(summary.tokens.used).toBe(1_250_000);
    expect(summary.tokens.limit).toBe(5_000_000);
    expect(summary.tasks.created).toBe(25);
    expect(summary.tasks.limit).toBe(100);
    expect(summary.repos.count).toBe(5);
    expect(summary.repos.limit).toBe(20);
    expect(summary.billingMode).toBe("managed");
    expect(summary.plan).toEqual({ name: "Pro", tier: "pro" });
  });

  it("upgrades and persists subscription", async () => {
    const upgrade = vi.fn().mockResolvedValue(undefined);
    const subscription = { upgrade };
    subscriptionRepository.findByUserId.mockResolvedValue(subscription);

    await billingService.upgradeSubscription("user-1", "pro");

    expect(upgrade).toHaveBeenCalledWith("pro");
    expect(subscriptionRepository.save).toHaveBeenCalledWith(subscription);
  });

  it("checks limits using delegated services", async () => {
    subscriptionRepository.findByUserId.mockResolvedValue({
      getLimits: () =>
        createLimits({
          maxRepos: 2,
          maxTasksPerMonth: 3,
          maxTokensPerMonth: 1000,
        }),
    });

    taskService.countByUser.mockResolvedValue(4);
    repositoryService.countByUser.mockResolvedValue(1);
    usageRepository.getCurrentMonthlyUsage.mockResolvedValue(500);

    const result = await billingService.checkLimits("user-1");

    expect(result.withinLimits).toBe(false);
    expect(result.usage.tasks).toBe(4);
    expect(result.usage.repos).toBe(1);
    expect(result.usage.tokens).toBe(500);
  });

  it.each<[PlanTier, PlanTier]>([
    ["pro", "free"],
    ["enterprise", "pro"],
  ])("downgrades to %s from %s and saves", async (nextTier, currentTier) => {
    const downgrade = vi.fn().mockResolvedValue(undefined);
    const subscription = {
      getState: () => ({ planTier: currentTier }),
      downgrade,
    };
    subscriptionRepository.findByUserId.mockResolvedValue(subscription);

    await billingService.downgradeSubscription("user-1", nextTier);

    expect(downgrade).toHaveBeenCalledWith(nextTier);
    expect(subscriptionRepository.save).toHaveBeenCalledWith(subscription);
  });
});
