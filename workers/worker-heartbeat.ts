export interface WorkerHeartbeatService {
  recordHeartbeat(params: {
    workerId: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
}

export interface WorkerHeartbeatMonitor {
  stop: () => void;
  flush: () => Promise<void>;
}

export interface StartWorkerHeartbeatOptions {
  service: WorkerHeartbeatService;
  workerId?: string;
  intervalMs?: number;
  getUptime?: () => number;
  getVersion?: () => string;
  onError?: (error: unknown) => void;
}

const DEFAULT_WORKER_ID = "worker-1";
const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_VERSION = "unknown";

function normalizeIntervalMs(intervalMs?: number): number {
  if (
    typeof intervalMs === "number" &&
    Number.isFinite(intervalMs) &&
    intervalMs > 0
  ) {
    return intervalMs;
  }

  return DEFAULT_INTERVAL_MS;
}

export function startWorkerHeartbeat(
  options: StartWorkerHeartbeatOptions,
): WorkerHeartbeatMonitor {
  const workerId = options.workerId || DEFAULT_WORKER_ID;
  const intervalMs = normalizeIntervalMs(options.intervalMs);
  const getUptime = options.getUptime || (() => process.uptime());
  const getVersion =
    options.getVersion ||
    (() => process.env.npm_package_version || DEFAULT_VERSION);

  const flush = async () => {
    try {
      await options.service.recordHeartbeat({
        workerId,
        metadata: {
          version: getVersion(),
          uptime: getUptime(),
        },
      });
    } catch (error) {
      options.onError?.(error);
    }
  };

  void flush();

  const interval = setInterval(() => {
    void flush();
  }, intervalMs);

  interval.unref?.();

  return {
    stop: () => {
      clearInterval(interval);
    },
    flush,
  };
}
