# Clean Architecture Refactoring - Task Context Design

**Date:** 2026-02-05
**Status:** Approved
**Scope:** Complete rebuild of Task context with strict Clean Architecture principles

---

## Executive Summary

This design document outlines the complete restructuring of the Task bounded context from DDD-style layering to strict Clean Architecture. This is the first of six contexts to be migrated incrementally.

**Key Decisions:**

- **Architecture:** Hybrid Clean Architecture (keep bounded contexts, add Clean Architecture layers within)
- **Migration Strategy:** Incremental, one context at a time, starting with Task
- **Approach:** Hard cutover (delete old, rebuild from scratch)
- **Scope:** All 31 use cases covering complete task lifecycle
- **Strictness:** Pure Clean Architecture with full dependency inversion
- **Error Handling:** Result type pattern for explicit error handling
- **Testing:** Comprehensive coverage at all layers

**Estimated Effort:** 12-16 hours for complete Task context migration

---

## 1. Overall Architecture & Directory Structure

### New Task Context Structure

```
lib/contexts/task/
├── entities/                        # Domain Layer (Core)
│   ├── Task.ts                      # Main aggregate
│   ├── value-objects/
│   │   ├── TaskStatus.ts
│   │   ├── ProcessingPhase.ts
│   │   ├── TaskMetadata.ts
│   │   └── TaskConfiguration.ts
│   └── events/
│       ├── TaskCreated.ts
│       ├── TaskStatusChanged.ts
│       ├── BrainstormingCompleted.ts
│       ├── PlanningCompleted.ts
│       ├── ExecutionStarted.ts
│       ├── ExecutionCompleted.ts
│       ├── ExecutionFailed.ts
│       ├── TaskStuck.ts
│       └── TaskPriorityChanged.ts
│
├── use-cases/                       # Application Layer
│   ├── ports/                       # Interfaces (dependencies point inward)
│   │   ├── ITaskRepository.ts
│   │   ├── IEventPublisher.ts
│   │   ├── IAnalyticsService.ts
│   │   ├── IGitHubClient.ts
│   │   └── ILogger.ts
│   │
│   ├── create-task/
│   │   ├── CreateTaskUseCase.ts     # Contains: Input, Output, UseCase class
│   │   └── CreateTaskMapper.ts
│   ├── get-task/
│   │   ├── GetTaskUseCase.ts
│   │   └── GetTaskMapper.ts
│   ├── get-task-with-repo/
│   │   ├── GetTaskWithRepoUseCase.ts
│   │   └── GetTaskWithRepoMapper.ts
│   ├── update-task-fields/
│   │   ├── UpdateTaskFieldsUseCase.ts
│   │   └── UpdateTaskFieldsMapper.ts
│   ├── delete-task/
│   │   ├── DeleteTaskUseCase.ts
│   │   └── DeleteTaskMapper.ts
│   ├── list-tasks-by-repo/
│   │   ├── ListTasksByRepoUseCase.ts
│   │   └── ListTasksByRepoMapper.ts
│   ├── list-tasks-by-user/
│   │   ├── ListTasksByUserUseCase.ts
│   │   └── ListTasksByUserMapper.ts
│   │
│   ├── claim-brainstorming-slot/
│   │   ├── ClaimBrainstormingSlotUseCase.ts
│   │   └── ClaimBrainstormingSlotMapper.ts
│   ├── save-brainstorm-result/
│   │   ├── SaveBrainstormResultUseCase.ts
│   │   └── SaveBrainstormResultMapper.ts
│   ├── finalize-brainstorm/
│   │   ├── FinalizeBrainstormUseCase.ts
│   │   └── FinalizeBrainstormMapper.ts
│   ├── clear-processing-slot/
│   │   ├── ClearProcessingSlotUseCase.ts
│   │   └── ClearProcessingSlotMapper.ts
│   │
│   ├── claim-planning-slot/
│   │   ├── ClaimPlanningSlotUseCase.ts
│   │   └── ClaimPlanningSlotMapper.ts
│   ├── save-plan/
│   │   ├── SavePlanUseCase.ts
│   │   └── SavePlanMapper.ts
│   ├── finalize-planning/
│   │   ├── FinalizePlanningUseCase.ts
│   │   └── FinalizePlanningMapper.ts
│   │
│   ├── claim-execution-slot/
│   │   ├── ClaimExecutionSlotUseCase.ts
│   │   └── ClaimExecutionSlotMapper.ts
│   ├── revert-execution-slot/
│   │   ├── RevertExecutionSlotUseCase.ts
│   │   └── RevertExecutionSlotMapper.ts
│   ├── mark-task-running/
│   │   ├── MarkTaskRunningUseCase.ts
│   │   └── MarkTaskRunningMapper.ts
│   ├── mark-task-completed/
│   │   ├── MarkTaskCompletedUseCase.ts
│   │   └── MarkTaskCompletedMapper.ts
│   ├── mark-task-failed/
│   │   ├── MarkTaskFailedUseCase.ts
│   │   └── MarkTaskFailedMapper.ts
│   ├── mark-task-stuck/
│   │   ├── MarkTaskStuckUseCase.ts
│   │   └── MarkTaskStuckMapper.ts
│   │
│   ├── add-task-dependency/
│   │   ├── AddTaskDependencyUseCase.ts
│   │   └── AddTaskDependencyMapper.ts
│   ├── remove-task-dependency/
│   │   ├── RemoveTaskDependencyUseCase.ts
│   │   └── RemoveTaskDependencyMapper.ts
│   ├── update-dependency-settings/
│   │   ├── UpdateDependencySettingsUseCase.ts
│   │   └── UpdateDependencySettingsMapper.ts
│   ├── get-task-dependency-graph/
│   │   ├── GetTaskDependencyGraphUseCase.ts
│   │   └── GetTaskDependencyGraphMapper.ts
│   │
│   ├── enable-autonomous-mode/
│   │   ├── EnableAutonomousModeUseCase.ts
│   │   └── EnableAutonomousModeMapper.ts
│   ├── update-task-priority/
│   │   ├── UpdateTaskPriorityUseCase.ts
│   │   └── UpdateTaskPriorityMapper.ts
│   ├── update-task-configuration/
│   │   ├── UpdateTaskConfigurationUseCase.ts
│   │   └── UpdateTaskConfigurationMapper.ts
│   │
│   ├── verify-task-ownership/
│   │   ├── VerifyTaskOwnershipUseCase.ts
│   │   └── VerifyTaskOwnershipMapper.ts
│   ├── check-task-transition-valid/
│   │   ├── CheckTaskTransitionValidUseCase.ts
│   │   └── CheckTaskTransitionValidMapper.ts
│   │
│   ├── delete-tasks-by-repo-ids/
│   │   ├── DeleteTasksByRepoIdsUseCase.ts
│   │   └── DeleteTasksByRepoIdsMapper.ts
│   └── get-task-ids-by-repo-ids/
│       ├── GetTaskIdsByRepoIdsUseCase.ts
│       └── GetTaskIdsByRepoIdsMapper.ts
│
├── adapters/                        # Interface Adapters Layer
│   ├── repositories/
│   │   └── TaskRepository.ts        # Implements ITaskRepository
│   ├── controllers/
│   │   └── TaskController.ts        # API route handlers
│   └── presenters/
│       └── TaskPresenter.ts         # Format responses
│
└── api/                             # Public API (barrel exports)
    ├── index.ts                     # Factory: getTaskController()
    └── types.ts                     # Public DTOs
```

### Dependency Rules

**The Dependency Rule (CRITICAL):**

- Dependencies point **inward only**
- Entities have **zero external dependencies**
- Use-cases depend **only on entities and port interfaces**
- Adapters implement ports and can import from outer layers
- API routes can import from anywhere

**Allowed Imports by Layer:**

```
entities/       → NOTHING (pure TypeScript)
use-cases/      → entities/, use-cases/ports/
adapters/       → entities/, use-cases/, @/lib/* (external frameworks)
api/            → adapters/, use-cases/, entities/
```

---

## 2. Entity Layer (Domain Core)

### Task Entity - Pure Domain Logic

The `Task` entity is rebuilt as a pure domain object with:

1. **No Framework Dependencies**: Zero imports from Drizzle, Redis, or Next.js
2. **Business Rule Enforcement**: All invariants protected
3. **Immutable Operations**: Methods return new state, not mutate
4. **Event Emission**: Business events returned, not published directly

### Example Entity Structure

```typescript
// entities/Task.ts
import type {
  TaskStatus,
  ProcessingPhase,
  TaskMetadata,
  TaskConfiguration,
} from "./value-objects";
import type {
  TaskCreated,
  BrainstormingStarted,
  ExecutionClaimed,
} from "./events";

export interface TaskState {
  id: string;
  repositoryId: string;
  metadata: TaskMetadata;
  status: TaskStatus;
  processingPhase: ProcessingPhase | null;
  brainstormResult: BrainstormResult | null;
  planContent: string | null;
  executionResult: ExecutionResult | null;
  configuration: TaskConfiguration;
  blockedByIds: string[];
  statusHistory: StatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export class Task {
  private constructor(private readonly state: TaskState) {}

  // Factory methods
  static create(params: {
    repoId: string;
    title: string;
    description: string;
    priority?: number;
  }): [Task, TaskCreated] {
    const id = generateId();
    const now = new Date();

    const state: TaskState = {
      id,
      repositoryId: params.repoId,
      metadata: {
        title: params.title,
        description: params.description,
        priority: params.priority ?? 0,
      },
      status: "todo",
      processingPhase: null,
      brainstormResult: null,
      planContent: null,
      executionResult: null,
      configuration: {
        autonomousMode: false,
        autoApprove: false,
      },
      blockedByIds: [],
      statusHistory: [{ status: "todo", timestamp: now }],
      createdAt: now,
      updatedAt: now,
    };

    const task = new Task(state);
    const event: TaskCreated = {
      type: "TaskCreated",
      aggregateId: id,
      occurredAt: now,
      data: { repoId: params.repoId, title: params.title },
    };

    return [task, event];
  }

  static reconstitute(state: TaskState): Task {
    return new Task(state);
  }

  // Business operations (return [newState, events])
  startBrainstorming(workerId: string): [Task, BrainstormingStarted] {
    // Validate transition
    if (!this.canTransitionTo("brainstorming")) {
      throw new BusinessRuleError(
        "INVALID_TRANSITION",
        `Cannot transition from ${this.state.status} to brainstorming`,
      );
    }

    const now = new Date();
    const newState = {
      ...this.state,
      status: "brainstorming" as TaskStatus,
      processingPhase: "brainstorming" as ProcessingPhase,
      statusHistory: [
        ...this.state.statusHistory,
        { status: "brainstorming" as TaskStatus, timestamp: now },
      ],
      updatedAt: now,
    };

    const event: BrainstormingStarted = {
      type: "BrainstormingStarted",
      aggregateId: this.state.id,
      occurredAt: now,
      data: { workerId },
    };

    return [new Task(newState), event];
  }

  completeBrainstorming(
    result: BrainstormResult,
  ): [Task, BrainstormingCompleted] {
    if (this.state.status !== "brainstorming") {
      throw new BusinessRuleError(
        "INVALID_STATE",
        "Task must be in brainstorming state",
      );
    }

    const now = new Date();
    const newState = {
      ...this.state,
      status: "planning" as TaskStatus,
      processingPhase: null,
      brainstormResult: result,
      statusHistory: [
        ...this.state.statusHistory,
        { status: "planning" as TaskStatus, timestamp: now },
      ],
      updatedAt: now,
    };

    const event: BrainstormingCompleted = {
      type: "BrainstormingCompleted",
      aggregateId: this.state.id,
      occurredAt: now,
      data: { summary: result.summary },
    };

    return [new Task(newState), event];
  }

  claimForExecution(workerId: string): [Task, ExecutionClaimed] {
    // Business rule: Can't execute without a plan
    if (!this.state.planContent) {
      throw new BusinessRuleError(
        "MISSING_PLAN",
        "Task must have a plan before execution",
      );
    }

    // Business rule: Can't execute if blocked
    if (this.state.blockedByIds.length > 0) {
      throw new BusinessRuleError(
        "BLOCKED_BY_DEPENDENCIES",
        "Task is blocked by dependencies",
      );
    }

    const now = new Date();
    const newState = {
      ...this.state,
      status: "executing" as TaskStatus,
      processingPhase: "executing" as ProcessingPhase,
      statusHistory: [
        ...this.state.statusHistory,
        { status: "executing" as TaskStatus, timestamp: now },
      ],
      updatedAt: now,
    };

    const event: ExecutionClaimed = {
      type: "ExecutionClaimed",
      aggregateId: this.state.id,
      occurredAt: now,
      data: { workerId },
    };

    return [new Task(newState), event];
  }

  // Queries (no side effects)
  canTransitionTo(status: TaskStatus): boolean {
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      todo: ["brainstorming"],
      brainstorming: ["planning", "todo"],
      planning: ["ready", "todo"],
      ready: ["executing", "todo"],
      executing: ["done", "stuck", "ready"],
      done: [],
      stuck: ["todo", "ready"],
    };

    return validTransitions[this.state.status]?.includes(status) ?? false;
  }

  isBlockedByDependencies(): boolean {
    return this.state.blockedByIds.length > 0;
  }

  // State access (immutable)
  getState(): Readonly<TaskState> {
    return this.state;
  }

  get id(): string {
    return this.state.id;
  }
}
```

### Value Objects

Stored in `entities/value-objects/`:

**TaskStatus.ts**

```typescript
export type TaskStatus =
  | "todo"
  | "brainstorming"
  | "planning"
  | "ready"
  | "executing"
  | "done"
  | "stuck";

export function isValidTaskStatus(value: string): value is TaskStatus {
  return [
    "todo",
    "brainstorming",
    "planning",
    "ready",
    "executing",
    "done",
    "stuck",
  ].includes(value);
}

export function validateTaskStatus(value: string): TaskStatus {
  if (!isValidTaskStatus(value)) {
    throw new ValidationError({ status: ["Invalid task status"] });
  }
  return value;
}
```

**ProcessingPhase.ts**

```typescript
export type ProcessingPhase = "brainstorming" | "planning" | "executing";

export function getProcessingPhaseForStatus(
  status: TaskStatus,
): ProcessingPhase | null {
  switch (status) {
    case "brainstorming":
      return "brainstorming";
    case "planning":
      return "planning";
    case "executing":
      return "executing";
    default:
      return null;
  }
}
```

**TaskMetadata.ts**

```typescript
export interface TaskMetadata {
  title: string;
  description: string;
  priority: number;
}

export function validateTaskMetadata(data: unknown): TaskMetadata {
  // Validation logic
  return data as TaskMetadata;
}
```

**TaskConfiguration.ts**

```typescript
export interface TaskConfiguration {
  autonomousMode: boolean;
  autoApprove: boolean;
}
```

### Domain Events

Stored in `entities/events/`:

```typescript
// Base event type
export interface DomainEvent {
  type: string;
  aggregateId: string;
  occurredAt: Date;
  data: Record<string, unknown>;
}

// Specific events
export interface TaskCreated extends DomainEvent {
  type: "TaskCreated";
  data: { repoId: string; title: string };
}

export interface TaskStatusChanged extends DomainEvent {
  type: "TaskStatusChanged";
  data: { oldStatus: TaskStatus; newStatus: TaskStatus };
}

export interface BrainstormingStarted extends DomainEvent {
  type: "BrainstormingStarted";
  data: { workerId: string };
}

export interface BrainstormingCompleted extends DomainEvent {
  type: "BrainstormingCompleted";
  data: { summary: string };
}

export interface PlanningStarted extends DomainEvent {
  type: "PlanningStarted";
  data: { workerId: string };
}

export interface PlanningCompleted extends DomainEvent {
  type: "PlanningCompleted";
  data: { planLength: number };
}

export interface ExecutionStarted extends DomainEvent {
  type: "ExecutionStarted";
  data: { workerId: string };
}

export interface ExecutionCompleted extends DomainEvent {
  type: "ExecutionCompleted";
  data: { commitSha?: string; prUrl?: string };
}

export interface ExecutionFailed extends DomainEvent {
  type: "ExecutionFailed";
  data: { error: string };
}

export interface TaskStuck extends DomainEvent {
  type: "TaskStuck";
  data: { reason: string };
}

export interface TaskPriorityChanged extends DomainEvent {
  type: "TaskPriorityChanged";
  data: { oldPriority: number; newPriority: number };
}

export interface ExecutionClaimed extends DomainEvent {
  type: "ExecutionClaimed";
  data: { workerId: string };
}
```

---

## 3. Use Case Layer (Application Logic)

### Use Case Pattern

Each use case follows a consistent pattern with strict dependency rules.

### Example: CreateTaskUseCase

```typescript
// use-cases/create-task/CreateTaskUseCase.ts

import { Task } from "../../entities/Task";
import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import type { IAnalyticsService } from "../ports/IAnalyticsService";
import { Result } from "@/lib/shared/Result";
import {
  ValidationError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";

// Input DTO (interface in same file)
export interface CreateTaskInput {
  repoId: string;
  title: string;
  description: string;
  priority?: number;
}

// Output DTO (interface in same file)
export interface CreateTaskOutput {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  createdAt: string;
}

// Use Case class (depends ONLY on ports + entities)
export class CreateTaskUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
    private readonly analytics: IAnalyticsService,
  ) {}

  async execute(
    input: CreateTaskInput,
  ): Promise<Result<CreateTaskOutput, UseCaseError>> {
    // 1. Validate input
    const validation = this.validateInput(input);
    if (!validation.isValid) {
      return Result.fail(new ValidationError(validation.errors));
    }

    // 2. Create entity (pure domain logic)
    const [task, event] = Task.create({
      repoId: input.repoId,
      title: input.title,
      description: input.description,
      priority: input.priority,
    });

    // 3. Persist via port
    const saveResult = await this.taskRepo.save(task);
    if (saveResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to save task", saveResult.error),
      );
    }

    // 4. Publish event via port
    const publishResult = await this.eventPublisher.publish(event);
    if (publishResult.isFailure) {
      // Log but don't fail (event publishing is not critical for task creation)
      console.error("Failed to publish TaskCreated event", publishResult.error);
    }

    // 5. Track analytics via port
    await this.analytics.taskCreated(task.id, input.repoId);

    // 6. Map to output DTO
    const output = CreateTaskMapper.toOutput(task);
    return Result.ok(output);
  }

  private validateInput(input: CreateTaskInput): {
    isValid: boolean;
    errors: Record<string, string[]>;
  } {
    const errors: Record<string, string[]> = {};

    if (!input.repoId || input.repoId.trim() === "") {
      errors.repoId = ["Repository ID is required"];
    }

    if (!input.title || input.title.trim() === "") {
      errors.title = ["Title is required"];
    }

    if (input.title && input.title.length > 200) {
      errors.title = ["Title must be less than 200 characters"];
    }

    if (
      input.priority !== undefined &&
      (input.priority < 0 || input.priority > 10)
    ) {
      errors.priority = ["Priority must be between 0 and 10"];
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
```

### Example: Mapper

```typescript
// use-cases/create-task/CreateTaskMapper.ts

import type { Task } from "../../entities/Task";
import type { CreateTaskOutput } from "./CreateTaskUseCase";

export class CreateTaskMapper {
  static toOutput(task: Task): CreateTaskOutput {
    const state = task.getState();

    return {
      id: state.id,
      title: state.metadata.title,
      description: state.metadata.description,
      status: state.status,
      priority: state.metadata.priority,
      createdAt: state.createdAt.toISOString(),
    };
  }
}
```

### Port Interfaces

Each port is a separate file in `use-cases/ports/`:

**ITaskRepository.ts**

```typescript
import type { Task } from "../../entities/Task";
import type { Result } from "@/lib/shared/Result";
import type { RepositoryError } from "@/lib/shared/errors";

export interface ITaskRepository {
  save(task: Task): Promise<Result<void, RepositoryError>>;
  findById(id: string): Promise<Result<Task | null, RepositoryError>>;
  findByRepo(repoId: string): Promise<Result<Task[], RepositoryError>>;
  findByUser(userId: string): Promise<Result<Task[], RepositoryError>>;
  delete(id: string): Promise<Result<void, RepositoryError>>;
  deleteByRepoIds(repoIds: string[]): Promise<Result<void, RepositoryError>>;
  getIdsByRepoIds(
    repoIds: string[],
  ): Promise<Result<string[], RepositoryError>>;
  existsById(id: string): Promise<Result<boolean, RepositoryError>>;
}
```

**IEventPublisher.ts**

```typescript
import type { DomainEvent } from "../../entities/events";
import type { Result } from "@/lib/shared/Result";
import type { PublisherError } from "@/lib/shared/errors";

export interface IEventPublisher {
  publish(event: DomainEvent): Promise<Result<void, PublisherError>>;
  publishAll(events: DomainEvent[]): Promise<Result<void, PublisherError>>;
}
```

**IAnalyticsService.ts**

```typescript
import type { Result } from "@/lib/shared/Result";
import type { UseCaseError } from "@/lib/shared/errors";

export interface IAnalyticsService {
  taskCreated(
    taskId: string,
    repoId: string,
  ): Promise<Result<void, UseCaseError>>;
  taskStatusChanged(
    taskId: string,
    oldStatus: string,
    newStatus: string,
  ): Promise<Result<void, UseCaseError>>;
  brainstormingStarted(taskId: string): Promise<Result<void, UseCaseError>>;
  brainstormingCompleted(taskId: string): Promise<Result<void, UseCaseError>>;
  planningStarted(taskId: string): Promise<Result<void, UseCaseError>>;
  planningCompleted(taskId: string): Promise<Result<void, UseCaseError>>;
  executionStarted(taskId: string): Promise<Result<void, UseCaseError>>;
  executionCompleted(taskId: string): Promise<Result<void, UseCaseError>>;
}
```

**ILogger.ts**

```typescript
export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}
```

---

## 4. Adapter Layer (Interface Adapters)

### Repository Adapter

```typescript
// adapters/repositories/TaskRepository.ts

import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema/tables";
import { eq, and, inArray } from "drizzle-orm";
import type { ITaskRepository } from "../../use-cases/ports/ITaskRepository";
import { Task, type TaskState } from "../../entities/Task";
import { Result } from "@/lib/shared/Result";
import { RepositoryError } from "@/lib/shared/errors";

export class TaskRepository implements ITaskRepository {
  async save(task: Task): Promise<Result<void, RepositoryError>> {
    try {
      const state = task.getState();
      const dbRow = this.toDbRow(state);

      await db.insert(tasks).values(dbRow).onConflictDoUpdate({
        target: tasks.id,
        set: dbRow,
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(new RepositoryError("Failed to save task", error));
    }
  }

  async findById(id: string): Promise<Result<Task | null, RepositoryError>> {
    try {
      const row = await db.query.tasks.findFirst({
        where: eq(tasks.id, id),
      });

      if (!row) {
        return Result.ok(null);
      }

      const task = this.toDomain(row);
      return Result.ok(task);
    } catch (error) {
      return Result.fail(new RepositoryError("Failed to find task", error));
    }
  }

  async findByRepo(repoId: string): Promise<Result<Task[], RepositoryError>> {
    try {
      const rows = await db.query.tasks.findMany({
        where: eq(tasks.repoId, repoId),
        orderBy: (t, { asc }) => [asc(t.priority), asc(t.createdAt)],
      });

      const taskList = rows.map((row) => this.toDomain(row));
      return Result.ok(taskList);
    } catch (error) {
      return Result.fail(
        new RepositoryError("Failed to find tasks by repo", error),
      );
    }
  }

  async findByUser(userId: string): Promise<Result<Task[], RepositoryError>> {
    try {
      const rows = await db.query.tasks.findMany({
        where: (t, { eq, exists }) =>
          exists(
            db
              .select()
              .from(repos)
              .where(and(eq(repos.id, t.repoId), eq(repos.userId, userId))),
          ),
        orderBy: (t, { asc }) => [asc(t.priority), asc(t.createdAt)],
      });

      const taskList = rows.map((row) => this.toDomain(row));
      return Result.ok(taskList);
    } catch (error) {
      return Result.fail(
        new RepositoryError("Failed to find tasks by user", error),
      );
    }
  }

  async delete(id: string): Promise<Result<void, RepositoryError>> {
    try {
      await db.delete(tasks).where(eq(tasks.id, id));
      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(new RepositoryError("Failed to delete task", error));
    }
  }

  async deleteByRepoIds(
    repoIds: string[],
  ): Promise<Result<void, RepositoryError>> {
    try {
      await db.delete(tasks).where(inArray(tasks.repoId, repoIds));
      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        new RepositoryError("Failed to delete tasks by repo IDs", error),
      );
    }
  }

  async getIdsByRepoIds(
    repoIds: string[],
  ): Promise<Result<string[], RepositoryError>> {
    try {
      const rows = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(inArray(tasks.repoId, repoIds));

      return Result.ok(rows.map((r) => r.id));
    } catch (error) {
      return Result.fail(
        new RepositoryError("Failed to get task IDs by repo IDs", error),
      );
    }
  }

  async existsById(id: string): Promise<Result<boolean, RepositoryError>> {
    try {
      const row = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);

      return Result.ok(row.length > 0);
    } catch (error) {
      return Result.fail(
        new RepositoryError("Failed to check task existence", error),
      );
    }
  }

  // Mappers: domain ↔ database
  private toDbRow(state: TaskState): any {
    return {
      id: state.id,
      repoId: state.repositoryId,
      title: state.metadata.title,
      description: state.metadata.description,
      status: state.status,
      priority: state.metadata.priority,
      brainstormSummary: state.brainstormResult?.summary ?? null,
      brainstormConversation: state.brainstormResult?.conversation
        ? JSON.stringify(state.brainstormResult.conversation)
        : null,
      brainstormMessageCount: state.brainstormResult?.messageCount ?? null,
      brainstormCompactedAt: state.brainstormResult?.compactedAt ?? null,
      planContent: state.planContent,
      branch: state.executionResult?.branchName ?? null,
      autonomousMode: state.configuration.autonomousMode,
      autoApprove: state.configuration.autoApprove,
      processingPhase: state.processingPhase,
      processingJobId: null, // Legacy field
      processingStartedAt: null, // Legacy field
      processingStatusText: null, // Legacy field
      processingProgress: null, // Legacy field
      statusHistory: state.statusHistory,
      prUrl: state.executionResult?.prUrl ?? null,
      prNumber: state.executionResult?.prNumber ?? null,
      prTargetBranch: state.executionResult?.prTargetBranch ?? null,
      prDraft: state.executionResult?.prDraft ?? null,
      blockedByIds: state.blockedByIds,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    };
  }

  private toDomain(row: any): Task {
    const state: TaskState = {
      id: row.id,
      repositoryId: row.repoId,
      metadata: {
        title: row.title,
        description: row.description ?? "",
        priority: row.priority,
      },
      status: row.status,
      processingPhase: row.processingPhase,
      brainstormResult: row.brainstormSummary
        ? {
            summary: row.brainstormSummary,
            conversation: row.brainstormConversation
              ? JSON.parse(row.brainstormConversation)
              : [],
            messageCount: row.brainstormMessageCount ?? 0,
            compactedAt: row.brainstormCompactedAt,
          }
        : null,
      planContent: row.planContent,
      executionResult: row.branch
        ? {
            branchName: row.branch,
            prUrl: row.prUrl,
            prNumber: row.prNumber,
            prTargetBranch: row.prTargetBranch,
            prDraft: row.prDraft,
          }
        : null,
      configuration: {
        autonomousMode: row.autonomousMode,
        autoApprove: row.autoApprove,
      },
      blockedByIds: row.blockedByIds ?? [],
      statusHistory: row.statusHistory ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return Task.reconstitute(state);
  }
}
```

### Controller Adapter

```typescript
// adapters/controllers/TaskController.ts

import { NextRequest, NextResponse } from "next/server";
import type { CreateTaskUseCase } from "../../use-cases/create-task/CreateTaskUseCase";
import type { GetTaskUseCase } from "../../use-cases/get-task/GetTaskUseCase";
import type { DeleteTaskUseCase } from "../../use-cases/delete-task/DeleteTaskUseCase";
// ... import all 31 use cases
import { TaskPresenter } from "../presenters/TaskPresenter";
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  UseCaseError,
} from "@/lib/shared/errors";

export class TaskController {
  constructor(
    private readonly createTask: CreateTaskUseCase,
    private readonly getTask: GetTaskUseCase,
    private readonly deleteTask: DeleteTaskUseCase,
    // ... inject all 31 use cases
  ) {}

  async create(req: NextRequest, repoId: string): Promise<NextResponse> {
    try {
      const body = await req.json();

      const result = await this.createTask.execute({
        repoId,
        title: body.title,
        description: body.description,
        priority: body.priority,
      });

      if (result.isFailure) {
        return this.handleError(result.error);
      }

      return NextResponse.json(TaskPresenter.toJson(result.value), {
        status: 201,
      });
    } catch (error) {
      return this.handleUnexpectedError(error);
    }
  }

  async getById(req: NextRequest, taskId: string): Promise<NextResponse> {
    try {
      const result = await this.getTask.execute({ taskId });

      if (result.isFailure) {
        return this.handleError(result.error);
      }

      if (!result.value) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      return NextResponse.json(TaskPresenter.toJson(result.value));
    } catch (error) {
      return this.handleUnexpectedError(error);
    }
  }

  async deleteById(req: NextRequest, taskId: string): Promise<NextResponse> {
    try {
      const result = await this.deleteTask.execute({ taskId });

      if (result.isFailure) {
        return this.handleError(result.error);
      }

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      return this.handleUnexpectedError(error);
    }
  }

  // ... 28 more controller methods

  private handleError(error: UseCaseError): NextResponse {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.validationErrors,
          code: error.code,
        },
        { status: 400 },
      );
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 404 },
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 403 },
      );
    }

    // Generic error fallback
    console.error("Use case error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }

  private handleUnexpectedError(error: unknown): NextResponse {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

### Presenter Adapter

```typescript
// adapters/presenters/TaskPresenter.ts

import type { CreateTaskOutput } from "../../use-cases/create-task/CreateTaskUseCase";
import type { GetTaskOutput } from "../../use-cases/get-task/GetTaskUseCase";

export class TaskPresenter {
  static toJson(output: CreateTaskOutput | GetTaskOutput): object {
    return {
      id: output.id,
      title: output.title,
      description: output.description,
      status: output.status,
      priority: output.priority,
      createdAt: output.createdAt,
      // Format dates, enums, etc. for JSON response
    };
  }

  static toListJson(outputs: GetTaskOutput[]): object {
    return {
      tasks: outputs.map((output) => this.toJson(output)),
      total: outputs.length,
    };
  }

  static toDetailedJson(output: GetTaskOutput): object {
    return {
      ...this.toJson(output),
      // Add additional fields for detailed view
    };
  }
}
```

---

## 5. Error Handling & Result Type

### Result Type Implementation

```typescript
// lib/shared/Result.ts

export class Result<T, E extends Error> {
  private constructor(
    private readonly _value?: T,
    private readonly _error?: E,
    private readonly _isSuccess: boolean = true,
  ) {}

  static ok<T, E extends Error>(value: T): Result<T, E> {
    return new Result<T, E>(value, undefined, true);
  }

  static fail<T, E extends Error>(error: E): Result<T, E> {
    return new Result<T, E>(undefined, error, false);
  }

  get isSuccess(): boolean {
    return this._isSuccess;
  }

  get isFailure(): boolean {
    return !this._isSuccess;
  }

  get value(): T {
    if (!this._isSuccess) {
      throw new Error("Cannot get value from failed Result");
    }
    return this._value!;
  }

  get error(): E {
    if (this._isSuccess) {
      throw new Error("Cannot get error from successful Result");
    }
    return this._error!;
  }

  // Functional helpers
  map<U>(fn: (value: T) => U): Result<U, E> {
    return this.isSuccess ? Result.ok(fn(this.value)) : Result.fail(this.error);
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return this.isSuccess ? fn(this.value) : Result.fail(this.error);
  }

  mapError<F extends Error>(fn: (error: E) => F): Result<T, F> {
    return this.isFailure ? Result.fail(fn(this.error)) : Result.ok(this.value);
  }

  unwrapOr(defaultValue: T): T {
    return this.isSuccess ? this.value : defaultValue;
  }
}
```

### Error Hierarchy

```typescript
// lib/shared/errors.ts

// Base error for all use case errors
export abstract class UseCaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation error
export class ValidationError extends UseCaseError {
  constructor(
    public readonly validationErrors: Record<string, string[]>,
    message: string = "Validation failed",
  ) {
    super(message, "VALIDATION_ERROR");
  }
}

// Not found error
export class NotFoundError extends UseCaseError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, "NOT_FOUND");
  }
}

// Unauthorized error
export class UnauthorizedError extends UseCaseError {
  constructor(message: string = "Unauthorized access") {
    super(message, "UNAUTHORIZED");
  }
}

// Business rule violation
export class BusinessRuleError extends UseCaseError {
  constructor(rule: string, message: string) {
    super(
      `Business rule violated: ${rule}. ${message}`,
      "BUSINESS_RULE_VIOLATION",
    );
  }
}

// Repository error
export class RepositoryError extends UseCaseError {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message, "REPOSITORY_ERROR");
  }
}

// Event publisher error
export class PublisherError extends UseCaseError {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message, "PUBLISHER_ERROR");
  }
}

// External service error
export class ExternalServiceError extends UseCaseError {
  constructor(
    service: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(
      `External service error (${service}): ${message}`,
      "EXTERNAL_SERVICE_ERROR",
    );
  }
}
```

---

## 6. Data Flow & Dependency Injection

### End-to-End Request Flow

```
HTTP Request
    ↓
API Route (app/api/)
    ↓
Controller (adapters/controllers/)
    ↓ Input DTO
Use Case (use-cases/)
    ↓ Entity
Repository Port → Adapter
    ↓ DB Row
Database
    ↓ Success
Entity → Output DTO
    ↓
Presenter (adapters/presenters/)
    ↓
HTTP Response JSON
```

### Dependency Injection Factory

```typescript
// api/index.ts

import { getRedis } from "@/lib/queue";
import { TaskRepository } from "../adapters/repositories/TaskRepository";
import { EventPublisher } from "@/lib/contexts/domain-events/event-publisher";
import { AnalyticsServiceAdapter } from "../adapters/services/AnalyticsServiceAdapter";
import { TaskController } from "../adapters/controllers/TaskController";

// Import all 31 use cases
import { CreateTaskUseCase } from "../use-cases/create-task/CreateTaskUseCase";
import { GetTaskUseCase } from "../use-cases/get-task/GetTaskUseCase";
// ... all others

/**
 * Factory that creates TaskController with all dependencies injected
 */
export async function getTaskController(): Promise<TaskController> {
  const redis = await getRedis();

  // Create adapters (implement ports)
  const taskRepo = new TaskRepository();
  const eventPublisher = new EventPublisher(redis);
  const analytics = new AnalyticsServiceAdapter();

  // Create all 31 use cases (inject ports)
  const createTask = new CreateTaskUseCase(taskRepo, eventPublisher, analytics);
  const getTask = new GetTaskUseCase(taskRepo);
  const getTaskWithRepo = new GetTaskWithRepoUseCase(taskRepo);
  const updateTaskFields = new UpdateTaskFieldsUseCase(
    taskRepo,
    eventPublisher,
  );
  const deleteTask = new DeleteTaskUseCase(taskRepo, eventPublisher);
  const listTasksByRepo = new ListTasksByRepoUseCase(taskRepo);
  const listTasksByUser = new ListTasksByUserUseCase(taskRepo);

  const claimBrainstormingSlot = new ClaimBrainstormingSlotUseCase(
    taskRepo,
    eventPublisher,
  );
  const saveBrainstormResult = new SaveBrainstormResultUseCase(
    taskRepo,
    eventPublisher,
  );
  const finalizeBrainstorm = new FinalizeBrainstormUseCase(
    taskRepo,
    eventPublisher,
  );
  const clearProcessingSlot = new ClearProcessingSlotUseCase(
    taskRepo,
    eventPublisher,
  );

  const claimPlanningSlot = new ClaimPlanningSlotUseCase(
    taskRepo,
    eventPublisher,
  );
  const savePlan = new SavePlanUseCase(taskRepo, eventPublisher);
  const finalizePlanning = new FinalizePlanningUseCase(
    taskRepo,
    eventPublisher,
  );

  const claimExecutionSlot = new ClaimExecutionSlotUseCase(
    taskRepo,
    eventPublisher,
  );
  const revertExecutionSlot = new RevertExecutionSlotUseCase(
    taskRepo,
    eventPublisher,
  );
  const markTaskRunning = new MarkTaskRunningUseCase(taskRepo, eventPublisher);
  const markTaskCompleted = new MarkTaskCompletedUseCase(
    taskRepo,
    eventPublisher,
    analytics,
  );
  const markTaskFailed = new MarkTaskFailedUseCase(taskRepo, eventPublisher);
  const markTaskStuck = new MarkTaskStuckUseCase(taskRepo, eventPublisher);

  const addTaskDependency = new AddTaskDependencyUseCase(taskRepo);
  const removeTaskDependency = new RemoveTaskDependencyUseCase(taskRepo);
  const updateDependencySettings = new UpdateDependencySettingsUseCase(
    taskRepo,
  );
  const getTaskDependencyGraph = new GetTaskDependencyGraphUseCase(taskRepo);

  const enableAutonomousMode = new EnableAutonomousModeUseCase(taskRepo);
  const updateTaskPriority = new UpdateTaskPriorityUseCase(
    taskRepo,
    eventPublisher,
  );
  const updateTaskConfiguration = new UpdateTaskConfigurationUseCase(taskRepo);

  const verifyTaskOwnership = new VerifyTaskOwnershipUseCase(taskRepo);
  const checkTaskTransitionValid = new CheckTaskTransitionValidUseCase(
    taskRepo,
  );

  const deleteTasksByRepoIds = new DeleteTasksByRepoIdsUseCase(taskRepo);
  const getTaskIdsByRepoIds = new GetTaskIdsByRepoIdsUseCase(taskRepo);

  // Create controller (inject all use cases)
  return new TaskController(
    createTask,
    getTask,
    getTaskWithRepo,
    updateTaskFields,
    deleteTask,
    listTasksByRepo,
    listTasksByUser,
    claimBrainstormingSlot,
    saveBrainstormResult,
    finalizeBrainstorm,
    clearProcessingSlot,
    claimPlanningSlot,
    savePlan,
    finalizePlanning,
    claimExecutionSlot,
    revertExecutionSlot,
    markTaskRunning,
    markTaskCompleted,
    markTaskFailed,
    markTaskStuck,
    addTaskDependency,
    removeTaskDependency,
    updateDependencySettings,
    getTaskDependencyGraph,
    enableAutonomousMode,
    updateTaskPriority,
    updateTaskConfiguration,
    verifyTaskOwnership,
    checkTaskTransitionValid,
    deleteTasksByRepoIds,
    getTaskIdsByRepoIds,
  );
}

/**
 * Alternative: Individual use case factories for granular access
 */
export async function getCreateTaskUseCase(): Promise<CreateTaskUseCase> {
  const redis = await getRedis();
  const taskRepo = new TaskRepository();
  const eventPublisher = new EventPublisher(redis);
  const analytics = new AnalyticsServiceAdapter();

  return new CreateTaskUseCase(taskRepo, eventPublisher, analytics);
}
```

### API Route Integration

```typescript
// app/api/repos/[repoId]/tasks/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getTaskController } from "@/lib/contexts/task/api";
import { auth } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { repoId: string } },
) {
  // Authentication
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get controller and delegate
  const controller = await getTaskController();
  return controller.create(req, params.repoId);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { repoId: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const controller = await getTaskController();
  return controller.listByRepo(req, params.repoId);
}
```

---

## 7. Testing Strategy & Migration Execution

### Testing Strategy - Test Each Layer in Isolation

**1. Entity Tests (Pure Unit Tests - No Dependencies)**

```typescript
// __tests__/contexts/task/entities/Task.test.ts

import { Task } from "@/lib/contexts/task/entities/Task";
import { BusinessRuleError } from "@/lib/shared/errors";

describe("Task Entity", () => {
  describe("create", () => {
    it("should create task with valid data", () => {
      const [task, event] = Task.create({
        repoId: "repo-123",
        title: "Test task",
        description: "Test description",
      });

      const state = task.getState();
      expect(state.metadata.title).toBe("Test task");
      expect(state.status).toBe("todo");
      expect(event.type).toBe("TaskCreated");
      expect(event.aggregateId).toBe(state.id);
    });

    it("should set default priority to 0", () => {
      const [task] = Task.create({
        repoId: "repo-123",
        title: "Test",
        description: "Desc",
      });

      expect(task.getState().metadata.priority).toBe(0);
    });
  });

  describe("startBrainstorming", () => {
    it("should transition from todo to brainstorming", () => {
      const [task] = Task.create({
        repoId: "repo-123",
        title: "Test",
        description: "Desc",
      });

      const [newTask, event] = task.startBrainstorming("worker-1");

      expect(newTask.getState().status).toBe("brainstorming");
      expect(newTask.getState().processingPhase).toBe("brainstorming");
      expect(event.type).toBe("BrainstormingStarted");
      expect(event.data.workerId).toBe("worker-1");
    });

    it("should not allow invalid transition", () => {
      const [task] = Task.create({
        repoId: "repo-123",
        title: "Test",
        description: "Desc",
      });

      const [taskInBrainstorming] = task.startBrainstorming("worker-1");

      // Can't go from brainstorming to executing
      expect(() => taskInBrainstorming.claimForExecution("worker-2")).toThrow(
        BusinessRuleError,
      );
    });
  });

  describe("claimForExecution", () => {
    it("should enforce business rule: must have plan", () => {
      const [task] = Task.create({
        repoId: "repo-123",
        title: "Test",
        description: "Desc",
      });

      expect(() => task.claimForExecution("worker-1")).toThrow(
        new BusinessRuleError(
          "MISSING_PLAN",
          "Task must have a plan before execution",
        ),
      );
    });

    it("should enforce business rule: cannot be blocked", () => {
      // Create task with plan but blocked by dependency
      const state = {
        /* ... state with plan and blockedByIds */
      };
      const task = Task.reconstitute(state);

      expect(() => task.claimForExecution("worker-1")).toThrow(
        new BusinessRuleError(
          "BLOCKED_BY_DEPENDENCIES",
          "Task is blocked by dependencies",
        ),
      );
    });
  });

  describe("canTransitionTo", () => {
    it("should validate allowed transitions", () => {
      const [task] = Task.create({
        repoId: "repo-123",
        title: "Test",
        description: "Desc",
      });

      expect(task.canTransitionTo("brainstorming")).toBe(true);
      expect(task.canTransitionTo("executing")).toBe(false);
      expect(task.canTransitionTo("done")).toBe(false);
    });
  });
});
```

**2. Use Case Tests (Mock Ports)**

```typescript
// __tests__/contexts/task/use-cases/CreateTaskUseCase.test.ts

import { CreateTaskUseCase } from "@/lib/contexts/task/use-cases/create-task/CreateTaskUseCase";
import type { ITaskRepository } from "@/lib/contexts/task/use-cases/ports/ITaskRepository";
import type { IEventPublisher } from "@/lib/contexts/task/use-cases/ports/IEventPublisher";
import type { IAnalyticsService } from "@/lib/contexts/task/use-cases/ports/IAnalyticsService";
import { Result } from "@/lib/shared/Result";
import { ValidationError, RepositoryError } from "@/lib/shared/errors";

describe("CreateTaskUseCase", () => {
  let mockRepo: jest.Mocked<ITaskRepository>;
  let mockPublisher: jest.Mocked<IEventPublisher>;
  let mockAnalytics: jest.Mocked<IAnalyticsService>;
  let useCase: CreateTaskUseCase;

  beforeEach(() => {
    mockRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByRepo: jest.fn(),
      findByUser: jest.fn(),
      delete: jest.fn(),
      deleteByRepoIds: jest.fn(),
      getIdsByRepoIds: jest.fn(),
      existsById: jest.fn(),
    };

    mockPublisher = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    };

    mockAnalytics = {
      taskCreated: jest.fn(),
      taskStatusChanged: jest.fn(),
      brainstormingStarted: jest.fn(),
      brainstormingCompleted: jest.fn(),
      planningStarted: jest.fn(),
      planningCompleted: jest.fn(),
      executionStarted: jest.fn(),
      executionCompleted: jest.fn(),
    };

    useCase = new CreateTaskUseCase(mockRepo, mockPublisher, mockAnalytics);
  });

  describe("execute", () => {
    it("should create task and publish event", async () => {
      mockRepo.save.mockResolvedValue(Result.ok(undefined));
      mockPublisher.publish.mockResolvedValue(Result.ok(undefined));
      mockAnalytics.taskCreated.mockResolvedValue(Result.ok(undefined));

      const result = await useCase.execute({
        repoId: "repo-123",
        title: "Test task",
        description: "Test description",
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.title).toBe("Test task");
      expect(result.value.status).toBe("todo");

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: "TaskCreated" }),
      );
      expect(mockAnalytics.taskCreated).toHaveBeenCalledWith(
        expect.any(String),
        "repo-123",
      );
    });

    it("should validate input and return error", async () => {
      const result = await useCase.execute({
        repoId: "",
        title: "",
        description: "Desc",
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ValidationError);
      expect((result.error as ValidationError).validationErrors).toHaveProperty(
        "repoId",
      );
      expect((result.error as ValidationError).validationErrors).toHaveProperty(
        "title",
      );

      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it("should handle repository failure", async () => {
      mockRepo.save.mockResolvedValue(
        Result.fail(new RepositoryError("Database error")),
      );

      const result = await useCase.execute({
        repoId: "repo-123",
        title: "Test",
        description: "Desc",
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(RepositoryError);
      expect(result.error.message).toContain("Failed to save task");
    });

    it("should not fail if event publishing fails", async () => {
      mockRepo.save.mockResolvedValue(Result.ok(undefined));
      mockPublisher.publish.mockResolvedValue(
        Result.fail(new PublisherError("Redis error")),
      );
      mockAnalytics.taskCreated.mockResolvedValue(Result.ok(undefined));

      const result = await useCase.execute({
        repoId: "repo-123",
        title: "Test",
        description: "Desc",
      });

      // Should still succeed (event publishing is not critical)
      expect(result.isSuccess).toBe(true);
    });
  });
});
```

**3. Repository Tests (Real Database)**

```typescript
// __tests__/contexts/task/adapters/TaskRepository.test.ts

import { TaskRepository } from "@/lib/contexts/task/adapters/repositories/TaskRepository";
import { Task } from "@/lib/contexts/task/entities/Task";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema/tables";
import { setupTestDb, cleanupTestDb } from "@/__tests__/setup/test-db";

describe("TaskRepository", () => {
  let repo: TaskRepository;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  beforeEach(async () => {
    // Clean tasks table
    await db.delete(tasks);
    repo = new TaskRepository();
  });

  describe("save", () => {
    it("should persist task entity", async () => {
      const [task] = Task.create({
        repoId: "repo-123",
        title: "Test task",
        description: "Test description",
      });

      const result = await repo.save(task);

      expect(result.isSuccess).toBe(true);

      // Verify in database
      const rows = await db.select().from(tasks);
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe("Test task");
    });

    it("should update existing task on conflict", async () => {
      const [task] = Task.create({
        repoId: "repo-123",
        title: "Original title",
        description: "Desc",
      });

      await repo.save(task);

      // Update title
      const [updatedTask] = task.updateTitle("Updated title");
      await repo.save(updatedTask);

      // Verify only one row exists with updated title
      const rows = await db.select().from(tasks);
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe("Updated title");
    });
  });

  describe("findById", () => {
    it("should retrieve task by ID", async () => {
      const [task] = Task.create({
        repoId: "repo-123",
        title: "Test",
        description: "Desc",
      });

      await repo.save(task);

      const result = await repo.findById(task.id);

      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value?.getState().metadata.title).toBe("Test");
    });

    it("should return null if task not found", async () => {
      const result = await repo.findById("nonexistent-id");

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });
  });

  describe("findByRepo", () => {
    it("should retrieve all tasks for a repository", async () => {
      const [task1] = Task.create({
        repoId: "repo-1",
        title: "Task 1",
        description: "Desc",
      });
      const [task2] = Task.create({
        repoId: "repo-1",
        title: "Task 2",
        description: "Desc",
      });
      const [task3] = Task.create({
        repoId: "repo-2",
        title: "Task 3",
        description: "Desc",
      });

      await repo.save(task1);
      await repo.save(task2);
      await repo.save(task3);

      const result = await repo.findByRepo("repo-1");

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2);
    });

    it("should order tasks by priority then createdAt", async () => {
      const [task1] = Task.create({
        repoId: "repo-1",
        title: "Low",
        description: "Desc",
        priority: 5,
      });
      const [task2] = Task.create({
        repoId: "repo-1",
        title: "High",
        description: "Desc",
        priority: 1,
      });

      await repo.save(task1);
      await repo.save(task2);

      const result = await repo.findByRepo("repo-1");

      expect(result.value[0].getState().metadata.title).toBe("High");
      expect(result.value[1].getState().metadata.title).toBe("Low");
    });
  });

  describe("delete", () => {
    it("should delete task", async () => {
      const [task] = Task.create({
        repoId: "repo-1",
        title: "Test",
        description: "Desc",
      });
      await repo.save(task);

      const result = await repo.delete(task.id);

      expect(result.isSuccess).toBe(true);

      const findResult = await repo.findById(task.id);
      expect(findResult.value).toBeNull();
    });
  });
});
```

**4. Integration Tests (Full Flow)**

```typescript
// __tests__/contexts/task/integration/create-task-flow.test.ts

import { getTaskController } from "@/lib/contexts/task/api";
import { setupTestDb, cleanupTestDb } from "@/__tests__/setup/test-db";
import { mockRequest } from "@/__tests__/helpers/mock-request";

describe("Create Task Flow (Integration)", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  it("should create task end-to-end", async () => {
    const controller = await getTaskController();
    const req = mockRequest({
      body: {
        repoId: "repo-123",
        title: "Integration test task",
        description: "Test description",
      },
    });

    const response = await controller.create(req, "repo-123");

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.title).toBe("Integration test task");
    expect(body.status).toBe("todo");
  });

  it("should handle validation errors", async () => {
    const controller = await getTaskController();
    const req = mockRequest({
      body: {
        repoId: "",
        title: "",
        description: "Desc",
      },
    });

    const response = await controller.create(req, "");

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(body.details).toHaveProperty("repoId");
    expect(body.details).toHaveProperty("title");
  });
});
```

---

### Migration Execution Plan - Hard Cutover

**Total Estimated Time: 12-16 hours**

---

#### Step 1: Prepare Shared Infrastructure (30 minutes)

**Create Result type and error hierarchy:**

```bash
# Create Result utility
touch lib/shared/Result.ts

# Create error hierarchy
touch lib/shared/errors.ts
```

**Files to create:**

- `lib/shared/Result.ts` - Result<T, E> class with ok/fail/map/flatMap
- `lib/shared/errors.ts` - UseCaseError, ValidationError, NotFoundError, UnauthorizedError, BusinessRuleError, RepositoryError, PublisherError

---

#### Step 2: Delete Old Task Context (2 minutes)

**Delete existing layers:**

```bash
cd lib/contexts/task

# Delete old structure
rm -rf domain/
rm -rf application/
rm -rf infrastructure/
rm api/adapters.ts

# Keep api/index.ts (will be completely rewritten)
```

---

#### Step 3: Create New Structure (2 hours)

**Create directory structure:**

```bash
cd lib/contexts/task

# Create new directories
mkdir -p entities/value-objects
mkdir -p entities/events
mkdir -p use-cases/ports
mkdir -p adapters/repositories
mkdir -p adapters/controllers
mkdir -p adapters/presenters
```

**Build entities layer (1 hour):**

- `entities/Task.ts` - Main aggregate with business logic
- `entities/value-objects/TaskStatus.ts`
- `entities/value-objects/ProcessingPhase.ts`
- `entities/value-objects/TaskMetadata.ts`
- `entities/value-objects/TaskConfiguration.ts`
- `entities/events/*.ts` - All 9 domain events

**Define ports (30 minutes):**

- `use-cases/ports/ITaskRepository.ts`
- `use-cases/ports/IEventPublisher.ts`
- `use-cases/ports/IAnalyticsService.ts`
- `use-cases/ports/ILogger.ts`

**Build adapters (30 minutes):**

- `adapters/repositories/TaskRepository.ts` - Implements ITaskRepository
- `adapters/controllers/TaskController.ts` - HTTP handlers
- `adapters/presenters/TaskPresenter.ts` - Response formatting

---

#### Step 4: Build All 31 Use Cases (6-8 hours)

**Each use case takes ~15-20 minutes.**

**Priority order:**

**1. Core CRUD (7 use cases - 2 hours)**

- create-task/
- get-task/
- get-task-with-repo/
- update-task-fields/
- delete-task/
- list-tasks-by-repo/
- list-tasks-by-user/

**2. Brainstorming Flow (4 use cases - 1 hour)**

- claim-brainstorming-slot/
- save-brainstorm-result/
- finalize-brainstorm/
- clear-processing-slot/

**3. Planning Flow (3 use cases - 1 hour)**

- claim-planning-slot/
- save-plan/
- finalize-planning/

**4. Execution Flow (6 use cases - 2 hours)**

- claim-execution-slot/
- revert-execution-slot/
- mark-task-running/
- mark-task-completed/
- mark-task-failed/
- mark-task-stuck/

**5. Dependencies (4 use cases - 1 hour)**

- add-task-dependency/
- remove-task-dependency/
- update-dependency-settings/
- get-task-dependency-graph/

**6. Configuration (3 use cases - 1 hour)**

- enable-autonomous-mode/
- update-task-priority/
- update-task-configuration/

**7. Validation (2 use cases - 30 minutes)**

- verify-task-ownership/
- check-task-transition-valid/

**8. Bulk Operations (2 use cases - 30 minutes)**

- delete-tasks-by-repo-ids/
- get-task-ids-by-repo-ids/

---

#### Step 5: Update API Routes (2 hours)

**Routes to update (~15 routes):**

```bash
app/api/repos/[repoId]/tasks/route.ts           # POST, GET
app/api/tasks/[taskId]/route.ts                 # GET, PATCH, DELETE
app/api/tasks/[taskId]/brainstorm/start/route.ts
app/api/tasks/[taskId]/brainstorm/save/route.ts
app/api/tasks/[taskId]/brainstorm/finalize/route.ts
app/api/tasks/[taskId]/plan/start/route.ts
app/api/tasks/[taskId]/plan/route.ts
app/api/tasks/[taskId]/execute/route.ts
app/api/tasks/[taskId]/dependencies/route.ts
app/api/tasks/[taskId]/processing/route.ts
app/api/tasks/[taskId]/autonomous/resume/route.ts
# ... etc
```

**Pattern for each route:**

```typescript
// Before
import { getTaskService } from "@/lib/contexts/task/api";
const service = getTaskService();
const task = await service.getTaskFull(taskId);

// After
import { getTaskController } from "@/lib/contexts/task/api";
const controller = await getTaskController();
return controller.getById(req, taskId);
```

---

#### Step 6: Write Tests (3 hours)

**Test files to create:**

**Entity tests (1 hour):**

- `__tests__/contexts/task/entities/Task.test.ts`
- `__tests__/contexts/task/entities/value-objects/TaskStatus.test.ts`

**Use case tests (1 hour):**

- `__tests__/contexts/task/use-cases/CreateTaskUseCase.test.ts`
- `__tests__/contexts/task/use-cases/GetTaskUseCase.test.ts`
- `__tests__/contexts/task/use-cases/ClaimExecutionSlotUseCase.test.ts`

**Repository tests (30 minutes):**

- `__tests__/contexts/task/adapters/TaskRepository.test.ts`

**Integration tests (30 minutes):**

- `__tests__/contexts/task/integration/create-task-flow.test.ts`
- `__tests__/contexts/task/integration/execution-flow.test.ts`

---

#### Step 7: Verify & Fix (1-2 hours)

**Run verification commands:**

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Run tests
npm run test:run

# Start dev server
npm run dev

# Manual testing in browser
# - Create task
# - Start brainstorming
# - Complete workflow
# - Check error handling
```

**Fix any issues found.**

---

#### Step 8: Commit & Push

```bash
git add .

git commit -m "feat(clean-arch): rebuild Task context with Clean Architecture

- Delete old domain/application/infrastructure layers
- Implement strict Clean Architecture with entities/use-cases/adapters
- Add Result type for explicit error handling
- Create 31 use cases covering all task operations:
  - Core CRUD (7): create, get, update, delete, list
  - Brainstorming flow (4): claim, save, finalize, clear
  - Planning flow (3): claim, save, finalize
  - Execution flow (6): claim, revert, running, completed, failed, stuck
  - Dependencies (4): add, remove, update, get graph
  - Configuration (3): autonomous mode, priority, config
  - Validation (2): ownership, transition
  - Bulk operations (2): delete by repos, get IDs by repos
- Full DTO layer with mappers
- Port interfaces for all external dependencies
- Complete test coverage (entities, use cases, repositories, integration)
- Update 15+ API routes to use new controller

BREAKING CHANGE: Task context completely restructured with Clean Architecture"

git push origin main
```

---

## Appendix A: Complete Use Case List

### 31 Use Cases for Task Context

| #   | Use Case                 | Input                                 | Output                  | Notes                    |
| --- | ------------------------ | ------------------------------------- | ----------------------- | ------------------------ |
| 1   | CreateTask               | repoId, title, description, priority? | Task DTO                | Creates new task         |
| 2   | GetTask                  | taskId                                | Task DTO \| null        | Retrieves single task    |
| 3   | GetTaskWithRepo          | taskId                                | Task + Repo DTO \| null | Includes repo details    |
| 4   | UpdateTaskFields         | taskId, fields                        | Task DTO                | Updates arbitrary fields |
| 5   | DeleteTask               | taskId                                | void                    | Soft/hard delete         |
| 6   | ListTasksByRepo          | repoId, filters?                      | Task DTO[]              | Paginated list           |
| 7   | ListTasksByUserId        | userId, filters?                      | Task DTO[]              | All user's tasks         |
| 8   | ClaimBrainstormingSlot   | taskId, workerId                      | Task DTO                | Atomic claim             |
| 9   | SaveBrainstormResult     | taskId, result                        | Task DTO                | Saves conversation       |
| 10  | FinalizeBrainstorm       | taskId                                | Task DTO                | Moves to planning        |
| 11  | ClearProcessingSlot      | taskId                                | Task DTO                | Releases slot            |
| 12  | ClaimPlanningSlot        | taskId, workerId                      | Task DTO                | Atomic claim             |
| 13  | SavePlan                 | taskId, plan                          | Task DTO                | Saves execution plan     |
| 14  | FinalizePlanning         | taskId                                | Task DTO                | Moves to ready           |
| 15  | ClaimExecutionSlot       | taskId, workerId                      | Task DTO                | Atomic claim with guards |
| 16  | RevertExecutionSlot      | taskId                                | Task DTO                | Rollback on failure      |
| 17  | MarkTaskRunning          | taskId, executionId                   | Task DTO                | Status transition        |
| 18  | MarkTaskCompleted        | taskId, result                        | Task DTO                | Final success state      |
| 19  | MarkTaskFailed           | taskId, error                         | Task DTO                | Execution failure        |
| 20  | MarkTaskStuck            | taskId, reason                        | Task DTO                | Stuck detection          |
| 21  | AddTaskDependency        | taskId, dependsOnId                   | Task DTO                | Create dependency        |
| 22  | RemoveTaskDependency     | taskId, dependsOnId                   | Task DTO                | Remove dependency        |
| 23  | UpdateDependencySettings | taskId, settings                      | Task DTO                | Dependency config        |
| 24  | GetTaskDependencyGraph   | taskId                                | Graph DTO               | Dependency tree          |
| 25  | EnableAutonomousMode     | taskId, enabled                       | Task DTO                | Toggle autonomous        |
| 26  | UpdateTaskPriority       | taskId, priority                      | Task DTO                | Change priority          |
| 27  | UpdateTaskConfiguration  | taskId, config                        | Task DTO                | Update config            |
| 28  | VerifyTaskOwnership      | taskId, userId                        | boolean                 | Ownership check          |
| 29  | CheckTaskTransitionValid | taskId, toStatus                      | boolean                 | Transition validation    |
| 30  | DeleteTasksByRepoIds     | repoIds[]                             | void                    | Bulk delete              |
| 31  | GetTaskIdsByRepoIds      | repoIds[]                             | taskIds[]               | Bulk query               |

---

## Appendix B: Comparison - Before vs After

### Before (DDD-style)

```
lib/contexts/task/
├── domain/
│   ├── task-aggregate.ts        # 500 lines
│   ├── events.ts
│   └── types.ts
├── application/
│   └── task-service.ts          # 800 lines, 25 methods
├── infrastructure/
│   ├── task-repository.ts
│   └── event-handlers.ts
└── api/
    └── index.ts                 # getTaskService()
```

**Issues:**

- TaskService has 25 methods (violates SRP)
- Service mixes use case logic with DB queries
- Hard to test (service has many responsibilities)
- Dependencies not inverted (service imports concrete repository)
- No explicit DTOs (returns domain entities)
- Error handling via exceptions (not type-safe)

### After (Clean Architecture)

```
lib/contexts/task/
├── entities/                    # Pure domain
│   ├── Task.ts
│   ├── value-objects/
│   └── events/
├── use-cases/                   # Application logic
│   ├── ports/                   # Interfaces only
│   ├── create-task/
│   ├── get-task/
│   └── ... (31 use cases)
├── adapters/                    # Framework code
│   ├── repositories/
│   ├── controllers/
│   └── presenters/
└── api/
    └── index.ts                 # getTaskController()
```

**Benefits:**

- Each use case has single responsibility
- True dependency inversion (use cases depend on ports)
- Highly testable (mock ports easily)
- Explicit DTOs at all boundaries
- Type-safe error handling with Result
- Clean separation of concerns
- Framework-independent entities

---

## Next Steps

After Task context is complete, apply the same pattern to the remaining 5 contexts:

1. ✅ **Task** (31 use cases) - FIRST
2. **Execution** (~15 use cases) - SECOND
3. **IAM** (~12 use cases)
4. **Repository** (~10 use cases)
5. **Billing** (~8 use cases)
6. **Analytics** (~10 use cases)

**Total:** ~86 use cases across all contexts

---

**End of Design Document**
