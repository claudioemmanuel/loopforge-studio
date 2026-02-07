import { describe, expect, it, vi } from "vitest";

const claimExecute = vi.fn().mockResolvedValue({ isFailure: false });
const clearExecute = vi.fn().mockResolvedValue(undefined);
const updateStateExecute = vi.fn().mockResolvedValue(undefined);
const claimPlanningSlot = vi.fn(() => ({ execute: claimExecute }));
const clearProcessingSlot = vi.fn(() => ({ execute: clearExecute }));
const updateProcessingState = vi.fn(() => ({ execute: updateStateExecute }));
const queuePlan = vi.fn().mockResolvedValue({ id: "job-2" });
const publishProcessingEvent = vi.fn();
const createProcessingEvent = vi.fn(() => ({ type: "processing_start" }));
const statusChanged = vi.fn().mockResolvedValue(undefined);
const planningStarted = vi.fn().mockResolvedValue(undefined);

type TaskContext = {
  user: { id: string };
  task: {
    id: string;
    repoId: string;
    status: string;
    title: string;
    autonomousMode: boolean;
    processingPhase: string | null;
    brainstormResult: string;
    repo: { name: string; fullName: string; defaultBranch: string | null };
  };
  taskId: string;
};

type RouteHandler = (
  request: Request,
  context: TaskContext,
) => Promise<Response>;

vi.mock("@/lib/api", () => ({
  withTask: (
    handler: (request: Request, context: TaskContext) => Promise<Response>,
  ) => handler,
  getProviderApiKey: vi.fn(() => "encrypted"),
  findConfiguredProvider: vi.fn(() => "anthropic"),
}));

// TaskService not directly used in this route anymore

vi.mock("@/lib/queue", () => ({
  queuePlan,
}));

vi.mock("@/lib/workers/events", () => ({
  publishProcessingEvent,
  createProcessingEvent,
}));

vi.mock("@/lib/contexts/analytics/api", () => ({
  getAnalyticsService: () => ({
    statusChanged,
    planningStarted,
  }),
}));

vi.mock("@/lib/contexts/task/api/use-case-factory", () => ({
  UseCaseFactory: {
    claimPlanningSlot,
    clearProcessingSlot,
    updateProcessingState,
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

describe("POST /api/tasks/[taskId]/plan/start", () => {
  it("queues a plan job via services without manual activity events", async () => {
    const { POST } = await import("@/app/api/tasks/[taskId]/plan/start/route");

    const task = {
      id: "00000000-0000-0000-0000-000000000002",
      repoId: "repo-1",
      status: "brainstorming",
      title: "Test Task",
      autonomousMode: true,
      processingPhase: null,
      brainstormResult: '{"summary":"test"}',
      repo: {
        name: "test-repo",
        fullName: "test-user/test-repo",
        defaultBranch: "main",
      },
    };

    const testHandler = POST as unknown as RouteHandler;
    const response = await testHandler(new Request("http://localhost"), {
      user: { id: "user-1" },
      task,
      taskId: task.id,
    });

    expect(queuePlan).toHaveBeenCalledWith({
      taskId: task.id,
      userId: "user-1",
      repoId: task.repoId,
      brainstormResult: task.brainstormResult,
      continueToExecution: true,
      repoName: task.repo.name,
      repoFullName: task.repo.fullName,
      repoDefaultBranch: task.repo.defaultBranch,
    });

    expect(claimPlanningSlot).toHaveBeenCalled();
    expect(claimExecute).toHaveBeenCalledWith({
      taskId: task.id,
      workerId: "user-1",
    });

    expect(updateProcessingState).toHaveBeenCalled();
    expect(updateStateExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        status: "planning",
        processingStartedAt: expect.any(Date),
        processingStatusText: "Reviewing brainstorm...",
      }),
    );
    expect(updateStateExecute).toHaveBeenCalledWith({
      taskId: task.id,
      processingJobId: "job-2",
    });

    expect(statusChanged).toHaveBeenCalledWith({
      taskId: task.id,
      repoId: task.repoId,
      userId: "user-1",
      taskTitle: task.title,
      fromStatus: "brainstorming",
      toStatus: "planning",
    });
    expect(planningStarted).toHaveBeenCalledWith({
      taskId: task.id,
      repoId: task.repoId,
      userId: "user-1",
      taskTitle: task.title,
    });
    expect(publishProcessingEvent).toHaveBeenCalled();
    expect(clearProcessingSlot).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body).toEqual({
      queued: true,
      jobId: "job-2",
      processingPhase: "planning",
    });
  });
});
