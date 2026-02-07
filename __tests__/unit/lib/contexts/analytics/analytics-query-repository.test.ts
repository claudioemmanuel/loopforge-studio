import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsQueryRepository } from "@/lib/contexts/analytics/infrastructure/analytics-query-repository";

const { limitMock, selectMock } = vi.hoisted(() => {
  const limitMock = vi.fn();
  const orderByMock = vi.fn(() => ({ limit: limitMock }));
  const whereMock = vi.fn(() => ({ orderBy: orderByMock }));
  const innerJoinMock = vi.fn(() => ({ where: whereMock }));
  const fromMock = vi.fn(() => ({ innerJoin: innerJoinMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));

  return {
    limitMock,
    selectMock,
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: selectMock,
  },
}));

describe("AnalyticsQueryRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns activity feed entries when createdAt is a string timestamp", async () => {
    limitMock.mockResolvedValueOnce([
      {
        id: "event-1",
        eventType: "execution_complete",
        title: "Execution complete",
        content: "Completed",
        createdAt: "2026-02-07T12:34:56.000Z",
        taskId: "task-1",
        taskTitle: "Task one",
        metadata: { runId: "run-1" },
      },
    ]);

    const repository = new AnalyticsQueryRepository();

    await expect(repository.getActivityFeed("repo-1", 50)).resolves.toEqual([
      {
        id: "event-1",
        eventType: "execution_complete",
        title: "Execution complete",
        content: "Completed",
        createdAt: "2026-02-07T12:34:56.000Z",
        task: { id: "task-1", title: "Task one" },
        metadata: { runId: "run-1" },
      },
    ]);
  });

  it("returns empty activity feed when activity_events table is missing", async () => {
    limitMock.mockRejectedValueOnce({
      code: "42P01",
      message: 'relation "activity_events" does not exist',
    });

    const repository = new AnalyticsQueryRepository();

    await expect(repository.getActivityFeed("repo-1", 50)).resolves.toEqual([]);
  });
});
