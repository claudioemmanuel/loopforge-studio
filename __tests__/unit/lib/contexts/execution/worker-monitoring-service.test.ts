import { describe, expect, it, vi } from "vitest";
import { WorkerMonitoringService } from "@/lib/contexts/execution/application/worker-monitoring-service";

type HeartbeatRow = { timestamp: Date };

function createService(rows: {
  recentHeartbeats?: HeartbeatRow[];
  oldestSince?: HeartbeatRow[];
}) {
  const repository = {
    getRecentHeartbeats: vi.fn().mockResolvedValue(rows.recentHeartbeats ?? []),
    getHeartbeatsSince: vi.fn().mockResolvedValue(rows.oldestSince ?? []),
    getRecentFailures: vi.fn().mockResolvedValue([]),
    getStuckTasks: vi.fn().mockResolvedValue({ rows: [] }),
    buildHistoryConditions: vi.fn(),
    getJobCount: vi.fn(),
    getJobHistory: vi.fn(),
    getJobStats: vi.fn(),
    recordHeartbeat: vi.fn(),
    getLatestHeartbeat: vi.fn(),
  };

  const service = new WorkerMonitoringService({} as never, repository as never);

  return { service, repository };
}

describe("WorkerMonitoringService.getWorkerStatus", () => {
  it("returns stopped when no heartbeats exist", async () => {
    const { service, repository } = createService({
      recentHeartbeats: [],
    });

    const status = await service.getWorkerStatus();

    expect(status).toEqual({
      status: "stopped",
      uptime: null,
      lastHeartbeat: null,
      restartCount: 0,
    });
    expect(repository.getRecentHeartbeats).toHaveBeenCalledWith(1);
  });

  it("returns stopped when latest heartbeat is stale", async () => {
    const stale = new Date(Date.now() - 3 * 60 * 1000);
    const { service, repository } = createService({
      recentHeartbeats: [{ timestamp: stale }],
    });

    const status = await service.getWorkerStatus();

    expect(status).toEqual({
      status: "stopped",
      uptime: null,
      lastHeartbeat: stale,
      restartCount: 0,
    });
    expect(repository.getHeartbeatsSince).not.toHaveBeenCalled();
  });

  it("returns running with uptime when a fresh heartbeat exists", async () => {
    const lastHeartbeat = new Date(Date.now() - 30 * 1000);
    const oldestRecent = new Date(Date.now() - 5 * 60 * 1000);
    const { service, repository } = createService({
      recentHeartbeats: [{ timestamp: lastHeartbeat }],
      oldestSince: [{ timestamp: oldestRecent }],
    });

    const status = await service.getWorkerStatus();

    expect(status.status).toBe("running");
    expect(status.lastHeartbeat?.toISOString()).toBe(
      lastHeartbeat.toISOString(),
    );
    expect(status.uptime).toBeTypeOf("number");
    expect(status.uptime).toBeGreaterThanOrEqual(4 * 60 * 1000);
    expect(status.uptime).toBeLessThanOrEqual(6 * 60 * 1000);
    expect(status.restartCount).toBe(0);
    expect(repository.getHeartbeatsSince).toHaveBeenCalledTimes(1);
  });
});
