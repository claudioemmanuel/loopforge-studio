import { describe, expect, it, vi } from "vitest";

const startPlanning = vi.fn();
const queuePlan = vi.fn().mockResolvedValue({ id: "job-2" });
const publishProcessingEvent = vi.fn();
const createProcessingEvent = vi.fn(() => ({ type: "processing_start" }));
const createStatusChangeEvent = vi.fn();
const createPlanningStartEvent = vi.fn();

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

vi.mock("@/lib/api", () => ({
  withTask: (
    handler: (request: Request, context: TaskContext) => Promise<Response>,
  ) => handler,
  getProviderApiKey: vi.fn(() => "encrypted"),
  findConfiguredProvider: vi.fn(() => "anthropic"),
}));

vi.mock("@/lib/contexts/task/api", () => ({
  getTaskService: () => ({ startPlanning }),
}));

vi.mock("@/lib/queue", () => ({
  queuePlan,
}));

vi.mock("@/lib/workers/events", () => ({
  publishProcessingEvent,
  createProcessingEvent,
}));

vi.mock("@/lib/activity", () => ({
  createStatusChangeEvent,
  createPlanningStartEvent,
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

    const response = await POST(new Request("http://localhost"), {
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

    expect(startPlanning).toHaveBeenCalledWith({
      taskId: task.id,
      jobId: "job-2",
    });

    expect(createStatusChangeEvent).not.toHaveBeenCalled();
    expect(createPlanningStartEvent).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body).toEqual({
      queued: true,
      jobId: "job-2",
      processingPhase: "planning",
    });
  });
});
