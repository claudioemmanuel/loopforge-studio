import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  areAllHandlersHealthy,
  getHandlerHealthStatus,
  initializeEventHandlers,
  isEventSystemInitialized,
  shutdownEventHandlers,
} from "@/lib/contexts/event-initialization";

const startBilling = vi.fn().mockResolvedValue(undefined);
const stopBilling = vi.fn().mockResolvedValue(undefined);
const startAnalytics = vi.fn().mockResolvedValue(undefined);
const stopAnalytics = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/queue", () => ({
  getRedis: vi.fn(() => ({})),
}));

vi.mock("@/lib/contexts/billing/infrastructure/event-handlers", () => ({
  BillingEventHandlers: vi.fn(() => ({
    start: startBilling,
    stop: stopBilling,
  })),
}));

vi.mock("@/lib/contexts/analytics/infrastructure/event-subscribers", () => ({
  AnalyticsEventSubscriber: vi.fn(() => ({
    start: startAnalytics,
    stop: stopAnalytics,
  })),
}));

describe("event-initialization", () => {
  beforeEach(async () => {
    startBilling.mockReset().mockResolvedValue(undefined);
    stopBilling.mockReset().mockResolvedValue(undefined);
    startAnalytics.mockReset().mockResolvedValue(undefined);
    stopAnalytics.mockReset().mockResolvedValue(undefined);

    if (isEventSystemInitialized()) {
      await shutdownEventHandlers();
    }
  });

  it("initializes both handlers and reports healthy", async () => {
    await initializeEventHandlers();

    const status = getHandlerHealthStatus();

    expect(isEventSystemInitialized()).toBe(true);
    expect(status).toHaveLength(2);
    expect(status.every((item) => item.healthy)).toBe(true);
    expect(areAllHandlersHealthy()).toBe(true);
  });

  it("does not initialize twice", async () => {
    await initializeEventHandlers();
    await initializeEventHandlers();

    expect(startBilling).toHaveBeenCalledTimes(1);
    expect(startAnalytics).toHaveBeenCalledTimes(1);
  });

  it("marks unhealthy handler without throwing when one fails", async () => {
    startAnalytics.mockRejectedValueOnce(new Error("analytics failed"));

    await expect(initializeEventHandlers()).resolves.toBeUndefined();

    const status = getHandlerHealthStatus();
    const analytics = status.find(
      (item) => item.name === "AnalyticsEventSubscriber",
    );

    expect(analytics?.healthy).toBe(false);
    expect(analytics?.error).toContain("analytics failed");
    expect(areAllHandlersHealthy()).toBe(false);
  });

  it("shuts down and resets state", async () => {
    await initializeEventHandlers();
    await shutdownEventHandlers();

    const status = getHandlerHealthStatus();

    expect(isEventSystemInitialized()).toBe(false);
    expect(stopBilling).toHaveBeenCalledTimes(1);
    expect(stopAnalytics).toHaveBeenCalledTimes(1);
    expect(status.every((item) => item.initialized === false)).toBe(true);
  });
});
