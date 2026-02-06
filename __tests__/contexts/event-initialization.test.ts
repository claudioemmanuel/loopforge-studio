import { afterAll, describe, expect, it } from "vitest";
import {
  areAllHandlersHealthy,
  getHandlerHealthStatus,
  initializeEventHandlers,
  isEventSystemInitialized,
  shutdownEventHandlers,
} from "@/lib/contexts/event-initialization";

describe("event-initialization", () => {
  afterAll(async () => {
    await shutdownEventHandlers();
  });

  it("initializes without throwing", async () => {
    await expect(initializeEventHandlers()).resolves.toBeUndefined();
  });

  it("returns a health status array", () => {
    const status = getHandlerHealthStatus();

    expect(Array.isArray(status)).toBe(true);
    expect(status.length).toBeGreaterThan(0);
  });

  it("exposes initialization and aggregate health flags", () => {
    expect(typeof isEventSystemInitialized()).toBe("boolean");
    expect(typeof areAllHandlersHealthy()).toBe("boolean");
  });

  it("shuts down without throwing", async () => {
    await expect(shutdownEventHandlers()).resolves.toBeUndefined();
    expect(isEventSystemInitialized()).toBe(false);
  });
});
