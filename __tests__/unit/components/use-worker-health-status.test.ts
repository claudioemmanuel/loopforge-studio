import { describe, expect, it } from "vitest";
import {
  isWorkerHealthUnhealthy,
  type WorkerHealthStatusSnapshot,
} from "@/components/hooks/use-worker-health-status";

function buildHealth(
  overrides: Partial<WorkerHealthStatusSnapshot> = {},
): WorkerHealthStatusSnapshot {
  return {
    worker: {
      status: "running",
    },
    redis: {
      connected: true,
    },
    queues: {
      brainstorm: { waiting: 0 },
      plan: { waiting: 0 },
      execution: { waiting: 0 },
    },
    stuck: {
      count: 0,
    },
    ...overrides,
  };
}

describe("isWorkerHealthUnhealthy", () => {
  it("returns false for a healthy snapshot", () => {
    expect(isWorkerHealthUnhealthy(buildHealth())).toBe(false);
  });

  it("returns true when worker is stopped", () => {
    expect(
      isWorkerHealthUnhealthy(buildHealth({ worker: { status: "stopped" } })),
    ).toBe(true);
  });

  it("returns true when worker is in error", () => {
    expect(
      isWorkerHealthUnhealthy(buildHealth({ worker: { status: "error" } })),
    ).toBe(true);
  });

  it("returns true when redis is disconnected", () => {
    expect(
      isWorkerHealthUnhealthy(buildHealth({ redis: { connected: false } })),
    ).toBe(true);
  });

  it("returns true when waiting queue backlog is above threshold", () => {
    expect(
      isWorkerHealthUnhealthy(
        buildHealth({
          queues: {
            brainstorm: { waiting: 6 },
            plan: { waiting: 4 },
            execution: { waiting: 1 },
          },
        }),
      ),
    ).toBe(true);
  });

  it("returns true when there are stuck tasks", () => {
    expect(isWorkerHealthUnhealthy(buildHealth({ stuck: { count: 1 } }))).toBe(
      true,
    );
  });
});
