import { beforeEach, describe, expect, it, vi } from "vitest";

const getWorkerStatus = vi.fn();
const getRecentFailures = vi.fn();
const getStuckTasks = vi.fn();

vi.mock("@/lib/api", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => handler,
}));

vi.mock("@/lib/contexts/execution/api", () => ({
  getWorkerMonitoringService: vi.fn(() => ({
    getWorkerStatus,
    getRecentFailures,
    getStuckTasks,
  })),
}));

vi.mock("ioredis", () => {
  class MockRedisSubscriber {
    async psubscribe() {
      return;
    }

    on() {
      return this;
    }

    async punsubscribe() {
      return;
    }

    removeAllListeners() {
      return this;
    }

    async quit() {
      return "OK";
    }
  }

  class MockRedis {
    duplicate() {
      return new MockRedisSubscriber();
    }

    multi() {
      return {
        llen: () => this.multi(),
        zcard: () => this.multi(),
        exec: async () =>
          [
            [null, 0],
            [null, 0],
            [null, 0],
            [null, 0],
            [null, 0],
            [null, 0],
            [null, 0],
            [null, 0],
          ] as Array<[Error | null, number]>,
      };
    }

    async ping() {
      return "PONG";
    }

    async info(section: string) {
      if (section === "server") {
        return "uptime_in_seconds:3600\n";
      }
      if (section === "memory") {
        return "used_memory_human:2.53M\n";
      }
      return "";
    }

    async quit() {
      return "OK";
    }

    async set() {
      return "OK";
    }

    async del() {
      return 1;
    }

    async publish() {
      return 1;
    }
  }

  return {
    Redis: MockRedis,
    default: MockRedis,
  };
});

describe("GET /api/workers/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkerStatus.mockResolvedValue({
      status: "running",
      uptime: 120_000,
      lastHeartbeat: new Date("2026-02-07T12:00:00.000Z"),
      restartCount: 0,
    });
    getRecentFailures.mockResolvedValue({
      count: 0,
      recent: [],
    });
    getStuckTasks.mockResolvedValue({
      count: 0,
      tasks: [],
    });
  });

  it("returns worker status from monitoring service with queue and redis metrics", async () => {
    const { GET } = await import("@/app/api/workers/health/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getWorkerStatus).toHaveBeenCalledTimes(1);
    expect(body.worker.status).toBe("running");
    expect(body.worker.lastHeartbeat).toBe("2026-02-07T12:00:00.000Z");
    expect(body.queues.brainstorm.waiting).toBe(0);
    expect(body.redis.connected).toBe(true);
    expect(body.failures.count).toBe(0);
    expect(body.stuck.count).toBe(0);
  });
});
