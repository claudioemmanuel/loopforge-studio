import { afterEach, describe, expect, it, vi } from "vitest";
import { startWorkerHeartbeat } from "@/workers/worker-heartbeat";

describe("startWorkerHeartbeat", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("records a heartbeat immediately and on every interval", async () => {
    vi.useFakeTimers();

    const recordHeartbeat = vi.fn().mockResolvedValue(undefined);
    const monitor = startWorkerHeartbeat({
      service: { recordHeartbeat },
      workerId: "worker-test",
      intervalMs: 1_000,
      getUptime: () => 42,
      getVersion: () => "1.2.3",
    });

    await vi.waitFor(() => {
      expect(recordHeartbeat).toHaveBeenCalledTimes(1);
    });

    await vi.advanceTimersByTimeAsync(3_000);
    await vi.waitFor(() => {
      expect(recordHeartbeat).toHaveBeenCalledTimes(4);
    });

    expect(recordHeartbeat).toHaveBeenLastCalledWith({
      workerId: "worker-test",
      metadata: {
        version: "1.2.3",
        uptime: 42,
      },
    });

    monitor.stop();
  });

  it("stops emitting heartbeats after stop is called", async () => {
    vi.useFakeTimers();

    const recordHeartbeat = vi.fn().mockResolvedValue(undefined);
    const monitor = startWorkerHeartbeat({
      service: { recordHeartbeat },
      workerId: "worker-test",
      intervalMs: 1_000,
    });

    await vi.waitFor(() => {
      expect(recordHeartbeat).toHaveBeenCalledTimes(1);
    });

    monitor.stop();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(recordHeartbeat).toHaveBeenCalledTimes(1);
  });

  it("swallows heartbeat errors and forwards them to onError", async () => {
    vi.useFakeTimers();

    const failure = new Error("heartbeat write failed");
    const recordHeartbeat = vi.fn().mockRejectedValue(failure);
    const onError = vi.fn();
    const monitor = startWorkerHeartbeat({
      service: { recordHeartbeat },
      workerId: "worker-test",
      intervalMs: 1_000,
      onError,
    });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(failure);
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => {
      expect(recordHeartbeat).toHaveBeenCalledTimes(2);
    });

    monitor.stop();
  });
});
