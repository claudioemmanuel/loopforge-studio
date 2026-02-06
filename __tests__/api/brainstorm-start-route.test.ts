import { describe, expect, it, vi } from "vitest";

const claimExecute = vi.fn().mockResolvedValue({ isFailure: false });
const clearExecute = vi.fn().mockResolvedValue(undefined);
const claimBrainstormingSlot = vi.fn(() => ({ execute: claimExecute }));
const clearProcessingSlot = vi.fn(() => ({ execute: clearExecute }));
const updateFields = vi.fn().mockResolvedValue(undefined);
const queueBrainstorm = vi.fn().mockResolvedValue({ id: "job-1" });
const publishProcessingEvent = vi.fn();
const createProcessingEvent = vi.fn(() => ({ type: "processing_start" }));
const statusChanged = vi.fn().mockResolvedValue(undefined);
const brainstormStarted = vi.fn().mockResolvedValue(undefined);

type TaskContext = {
  user: { id: string };
  task: {
    id: string;
    repoId: string;
    status: string;
    title: string;
    autonomousMode: boolean;
    processingPhase: string | null;
    repo: { name: string };
  };
  taskId: string;
};

vi.mock("@/lib/api", () => ({
  withTask: (
    handler: (request: Request, context: TaskContext) => Promise<Response>,
  ) => handler,
  getProviderApiKey: vi.fn(() => "encrypted"),
  findConfiguredProvider: vi.fn(() => "anthropic"),
}));

vi.mock("@/lib/contexts/task/api", () => ({
  getTaskService: () => ({ updateFields }),
}));

vi.mock("@/lib/queue", () => ({
  queueBrainstorm,
}));

vi.mock("@/lib/workers/events", () => ({
  publishProcessingEvent,
  createProcessingEvent,
}));

vi.mock("@/lib/contexts/analytics/api", () => ({
  getAnalyticsService: () => ({
    statusChanged,
    brainstormStarted,
  }),
}));

vi.mock("@/lib/contexts/task/api/use-case-factory", () => ({
  UseCaseFactory: {
    claimBrainstormingSlot,
    clearProcessingSlot,
  },
}));

vi.mock("@/lib/errors", () => ({
  handleError: vi.fn(),
  Errors: {
    noProviderConfigured: vi.fn(),
    authError: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  apiLogger: {
    error: vi.fn(),
  },
}));

describe("POST /api/tasks/[taskId]/brainstorm/start", () => {
  it("queues a brainstorm job via services without manual activity events", async () => {
    const { POST } =
      await import("@/app/api/tasks/[taskId]/brainstorm/start/route");

    const task = {
      id: "00000000-0000-0000-0000-000000000001",
      repoId: "repo-1",
      status: "todo",
      title: "Test Task",
      autonomousMode: true,
      processingPhase: null,
      repo: { name: "test-repo" },
    };

    const response = await (
      POST as unknown as (
        request: Request,
        context: TaskContext,
      ) => Promise<Response>
    )(new Request("http://localhost"), {
      user: { id: "user-1" },
      task,
      taskId: task.id,
    });

    expect(queueBrainstorm).toHaveBeenCalledWith({
      taskId: task.id,
      userId: "user-1",
      repoId: task.repoId,
      continueToPlanning: true,
    });

    expect(claimBrainstormingSlot).toHaveBeenCalled();
    expect(claimExecute).toHaveBeenCalledWith({
      taskId: task.id,
      workerId: "user-1",
    });

    expect(statusChanged).toHaveBeenCalledWith({
      taskId: task.id,
      repoId: task.repoId,
      userId: "user-1",
      taskTitle: task.title,
      fromStatus: "todo",
      toStatus: "brainstorming",
    });

    expect(brainstormStarted).toHaveBeenCalledWith({
      taskId: task.id,
      repoId: task.repoId,
      userId: "user-1",
      taskTitle: task.title,
    });

    expect(updateFields).toHaveBeenCalledWith(task.id, {
      processingJobId: "job-1",
    });
    expect(publishProcessingEvent).toHaveBeenCalled();
    expect(clearProcessingSlot).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body).toEqual({
      queued: true,
      jobId: "job-1",
      processingPhase: "brainstorming",
    });
  });
});
