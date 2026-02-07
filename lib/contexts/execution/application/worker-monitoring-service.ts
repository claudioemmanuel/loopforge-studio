/**
 * Worker Monitoring Service (Application Layer)
 *
 * Encapsulates worker operational read/write models used by worker APIs.
 */

import type { Redis } from "ioredis";
import { WorkerMonitoringRepository } from "../infrastructure/worker-monitoring-repository";

type WorkerJobPhase = "brainstorming" | "planning" | "executing";

export interface WorkerHistoryFilters {
  taskIds: string[];
  phase?: WorkerJobPhase | "all" | null;
  status?: "completed" | "failed" | "all" | null;
  repoTaskIds?: string[];
  searchTaskIds?: string[];
  limit: number;
  offset: number;
}

export class WorkerMonitoringService {
  private repository: WorkerMonitoringRepository;

  constructor(redis: Redis, repository?: WorkerMonitoringRepository) {
    void redis;
    this.repository = repository || new WorkerMonitoringRepository();
  }

  async recordHeartbeat(params: {
    workerId: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    await this.repository.recordHeartbeat(params);
  }

  async getLatestHeartbeat() {
    return this.repository.getLatestHeartbeat();
  }

  async getWorkerStatus() {
    const latest = await this.repository.getRecentHeartbeats(1);

    if (!latest || latest.length === 0) {
      return {
        status: "stopped" as const,
        uptime: null,
        lastHeartbeat: null,
        restartCount: 0,
      };
    }

    const lastHeartbeat = latest[0].timestamp;
    const now = new Date();
    const twoMinutes = 2 * 60 * 1000;

    if (now.getTime() - lastHeartbeat.getTime() > twoMinutes) {
      return {
        status: "stopped" as const,
        uptime: null,
        lastHeartbeat,
        restartCount: 0,
      };
    }

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oldestRecent = await this.repository.getHeartbeatsSince(oneHourAgo);

    const uptime = oldestRecent[0]
      ? now.getTime() - oldestRecent[0].timestamp.getTime()
      : null;

    return {
      status: "running" as const,
      uptime,
      lastHeartbeat,
      restartCount: 0,
    };
  }

  async getRecentFailures(limit = 10) {
    const failures = await this.repository.getRecentFailures(limit);

    return {
      count: failures.length,
      recent: failures
        .filter((f) => f.error && f.timestamp)
        .map((f) => ({
          taskId: f.taskId,
          phase: f.phase,
          error: f.error || "Unknown error",
          timestamp: f.timestamp!,
        })),
    };
  }

  async getStuckTasks(thresholdMinutes = 10, limit = 20) {
    const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);
    const stuckRows = await this.repository.getStuckTasks(threshold, limit);

    const taskRows = stuckRows.rows.map((row: unknown) => {
      const r = row as { taskId: string; title: string; stuckMinutes: number };
      return {
        taskId: r.taskId,
        title: r.title,
        stuckDuration: `${Math.floor(r.stuckMinutes)} minutes`,
      };
    });

    return {
      count: taskRows.length,
      tasks: taskRows,
    };
  }

  async getHistory(filters: WorkerHistoryFilters) {
    const conditions = this.repository.buildHistoryConditions(filters);
    const totalCount = await this.repository.getJobCount(conditions);
    const jobs = await this.repository.getJobHistory({
      conditions,
      limit: filters.limit,
      offset: filters.offset,
    });

    return {
      jobs,
      totalCount,
    };
  }

  async getHistoryStats(params: {
    taskIds: string[];
    repoTaskIds?: string[];
    searchTaskIds?: string[];
  }) {
    const conditions = this.repository.buildHistoryConditions({
      taskIds: params.taskIds,
      status: "all",
      phase: "all",
      repoTaskIds: params.repoTaskIds,
      searchTaskIds: params.searchTaskIds,
    });

    const stats = await this.repository.getJobStats(conditions);

    return {
      total: Number(stats?.total || 0),
      completed: Number(stats?.completed || 0),
      failed: Number(stats?.failed || 0),
      brainstorming: Number(stats?.brainstorming || 0),
      planning: Number(stats?.planning || 0),
      executing: Number(stats?.executing || 0),
    };
  }
}
