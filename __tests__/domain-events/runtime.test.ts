import { beforeEach, describe, expect, it, vi } from "vitest";

const redisInstance = {
  set: vi.fn(),
  del: vi.fn(),
  publish: vi.fn(),
} as const;

const billingStart = vi.fn().mockResolvedValue(undefined);
const billingStop = vi.fn().mockResolvedValue(undefined);
const analyticsStart = vi.fn().mockResolvedValue(undefined);
const analyticsStop = vi.fn().mockResolvedValue(undefined);
const subscriberStart = vi.fn().mockResolvedValue(undefined);
const subscriberStop = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/queue", () => ({
  getRedis: vi.fn(() => redisInstance),
}));

vi.mock("@/lib/contexts/billing/infrastructure/event-handlers", () => ({
  BillingEventHandlers: vi.fn(() => ({
    start: billingStart,
    stop: billingStop,
  })),
}));

vi.mock("@/lib/contexts/analytics/infrastructure/event-subscribers", () => ({
  AnalyticsEventSubscriber: vi.fn(() => ({
    start: analyticsStart,
    stop: analyticsStop,
  })),
}));

vi.mock("@/lib/contexts/domain-events/event-subscriber", () => ({
  EventSubscriber: {
    getInstance: vi.fn(() => ({
      start: subscriberStart,
      stop: subscriberStop,
    })),
  },
}));

describe("domain event runtime", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("does not start subscribers for non-owner role", async () => {
    const { startDomainEventRuntime } =
      await import("@/lib/contexts/domain-events/runtime");

    await startDomainEventRuntime({
      role: "web",
      consumerRole: "worker",
    });

    expect(billingStart).not.toHaveBeenCalled();
    expect(analyticsStart).not.toHaveBeenCalled();
    expect(subscriberStart).not.toHaveBeenCalled();
  });

  it("starts runtime once for owner role and ignores duplicate start", async () => {
    const { startDomainEventRuntime } =
      await import("@/lib/contexts/domain-events/runtime");

    await startDomainEventRuntime({
      role: "worker",
      consumerRole: "worker",
    });
    await startDomainEventRuntime({
      role: "worker",
      consumerRole: "worker",
    });

    expect(billingStart).toHaveBeenCalledTimes(1);
    expect(analyticsStart).toHaveBeenCalledTimes(1);
    expect(subscriberStart).toHaveBeenCalledTimes(1);
  });
});
