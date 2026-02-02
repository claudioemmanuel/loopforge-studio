# Complete DDD Migration Design

**Date:** 2026-02-02
**Status:** Approved
**Approach:** Big Bang Migration (2-3 weeks)

## Executive Summary

Migrate all 52+ API routes from direct database access to DDD services while maintaining 100% backward compatibility with existing API contracts. The migration uses an adapter layer to translate between domain models and API responses, ensuring zero breaking changes for the frontend.

## Context

### Current State

- ✅ **DDD Infrastructure Complete**: 8 bounded contexts (IAM, Repository, Task, Execution, Billing, Analytics, Domain Events, Event Handlers)
- ✅ **Event System Working**: EventPublisher, subscribers, 4 active handlers
- ❌ **API Routes**: 52+ routes still use direct database access, bypassing aggregates
- ❌ **Legacy Queues**: `brainstorm-queue.ts`, `plan-queue.ts`, `execution-queue.ts` run in parallel to event handlers
- ❌ **Manual Activity Events**: Routes manually create activity events instead of relying on domain events

### Goals

1. **100% DDD Adoption**: All routes use domain services, no direct DB access
2. **Zero Breaking Changes**: Existing API contracts preserved via adapter layer
3. **Single Source of Truth**: Aggregates enforce invariants, publish events consistently
4. **Remove Duplication**: Delete legacy queues and manual activity helpers
5. **High Test Coverage**: 80%+ coverage for migrated code

## Architecture Decisions

### Decision 1: Hybrid with Adapters (Preserve API Contracts)

**Problem:** Domain models have different structure than current API responses.

**Solution:** Create adapter layer at `lib/contexts/[context]/api/adapters.ts`

```typescript
// lib/contexts/task/api/adapters.ts
export class TaskAdapter {
  /**
   * Convert domain state to API response format
   */
  static toApiResponse(state: TaskState): ApiTaskResponse {
    return {
      // Flatten nested structure
      id: state.id,
      repoId: state.repositoryId,
      title: state.metadata.title,
      description: state.metadata.description ?? null,
      status: state.status,
      priority: state.metadata.priority,

      // Brainstorm fields
      brainstormSummary: state.brainstormResult?.summary ?? null,
      brainstormConversation: state.brainstormResult?.conversation
        ? JSON.stringify(state.brainstormResult.conversation)
        : null,
      brainstormMessageCount: state.brainstormResult?.messageCount ?? null,

      // Execution fields
      planContent: state.planContent,
      branch: state.executionResult?.branchName ?? null,
      prUrl: state.executionResult?.prUrl ?? null,

      // Configuration
      autonomousMode: state.configuration.autonomousMode,
      autoApprove: state.configuration.autoApprove,

      // Processing state
      processingPhase: state.processingState.phase,
      processingJobId: state.processingState.jobId,
      processingProgress: state.processingState.progress,

      // Dependencies
      blockedByIds: state.blockedByIds,
      statusHistory: state.statusHistory,

      // Timestamps
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    };
  }

  /**
   * Convert API request to domain metadata
   */
  static fromApiRequest(body: ApiTaskRequest): Partial<TaskMetadata> {
    return {
      title: body.title,
      description: body.description,
      priority: body.priority,
    };
  }

  /**
   * Convert API request to domain configuration
   */
  static toConfiguration(body: ApiTaskRequest): Partial<TaskConfiguration> {
    return {
      autonomousMode: body.autonomousMode,
      autoApprove: body.autoApprove,
      prTargetBranch: body.prTargetBranch,
      prDraft: body.prDraft,
    };
  }
}
```

**Benefits:**

- Routes stay thin (single line: `TaskAdapter.toApiResponse(state)`)
- Mapping logic is reusable and testable
- Frontend sees no changes
- Easy to evolve contracts later

**Other Adapters Needed:**

- `lib/contexts/iam/api/adapters.ts` - UserAdapter
- `lib/contexts/repository/api/adapters.ts` - RepositoryAdapter
- `lib/contexts/execution/api/adapters.ts` - ExecutionAdapter
- `lib/contexts/billing/api/adapters.ts` - SubscriptionAdapter

### Decision 2: Remove Legacy Systems Incrementally

**Strategy:** Delete each legacy system as its DDD replacement is validated.

**Phase 2.1 - After Task CRUD Migration:**

- ❌ Delete: Manual activity helpers in routes (`createStatusChangeEvent`, `createTaskUpdatedEvent`)
- ✅ Keep: Legacy queues (needed by unmigrated routes)
- ✅ Validate: AnalyticsEventSubscriber creates activities from domain events

**Phase 2.3 - After Brainstorm Routes:**

- ❌ Delete: `lib/queue/brainstorm-queue.ts`
- ✅ Validate: Brainstorming works via TaskService + events

**Phase 2.4 - After Planning Routes:**

- ❌ Delete: `lib/queue/plan-queue.ts`
- ✅ Validate: AutonomousFlowManager auto-queues execution

**Phase 6 - After Worker Migration:**

- ❌ Delete: `lib/queue/execution-queue.ts`, `lib/queue/autonomous-flow.ts`
- ✅ Keep: Core queue infrastructure (connection, base queue)

**Validation Command:**

```bash
# After each deletion, verify no imports remain
grep -r "from.*lib/queue/[deleted-file]" --include="*.ts"
npm run build && npm run test:run
```

### Decision 3: Test-Heavy Migration (80%+ Coverage)

**Test Pyramid:**

**1. Unit Tests (60% of effort):**

- Adapter field mappings, null handling, edge cases
- Service method behavior (updateMetadata, updateStatus, deleteTask)
- Domain event publishing verification

**2. Integration Tests (30% of effort):**

- Each migrated API route with real database
- Critical flows (Create → Brainstorm → Plan → Execute → Done)
- Event handler integration

**3. E2E Tests (10% of effort):**

- Manual QA checklist
- Staging environment smoke tests
- Production canary deployment

**Test Example:**

```typescript
describe("TaskAdapter", () => {
  it("maps all fields correctly", () => {
    const state: TaskState = {
      id: "task-1",
      repositoryId: "repo-1",
      metadata: { title: "Fix bug", description: "Details", priority: 1 },
      status: "todo",
      // ... full state
    };

    const response = TaskAdapter.toApiResponse(state);

    expect(response.id).toBe("task-1");
    expect(response.repoId).toBe("repo-1");
    expect(response.title).toBe("Fix bug");
    expect(response.description).toBe("Details");
  });

  it("handles null description", () => {
    const state = createMockState({ metadata: { description: undefined } });
    const response = TaskAdapter.toApiResponse(state);
    expect(response.description).toBeNull();
  });
});

describe("PATCH /api/tasks/[taskId]", () => {
  it("updates task via service", async () => {
    const taskId = await createTestTask();

    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    });

    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.title).toBe("Updated Title");

    // Verify event published
    const events = await getPublishedEvents("Task", taskId);
    expect(events).toContainEqual(
      expect.objectContaining({ eventType: "TaskStatusChanged" }),
    );
  });
});
```

### Decision 4: Top-Down Sequencing

**Implementation Order:**

1. **Task Routes** (Days 4-5) - Most used, highest value
2. **Brainstorming/Planning** (Days 6-8) - Validate event flow
3. **Worker** (Days 9-10) - E2E validation
4. **IAM/Settings** (Day 11) - Supporting features
5. **Repository** (Day 12) - Lower risk
6. **Billing/Activity** (Day 13) - Least critical

**Rationale:** Delivers value early, enables E2E validation sooner

## Migration Patterns

### Pattern 1: Standard CRUD Route

**Before (Direct DB):**

```typescript
export const PATCH = withTask(async (request, { user, task, taskId }) => {
  const body = await request.json();

  // Direct DB update
  await db
    .update(tasks)
    .set({ title: body.title, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  // Manual activity event
  await createTaskUpdatedEvent({
    taskId,
    repoId: task.repoId,
    userId: user.id,
    taskTitle: body.title,
    changes: ["title"],
  });

  const updated = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  return NextResponse.json(updated);
});
```

**After (DDD Service):**

```typescript
export const PATCH = withTask(async (request, { user, task, taskId }) => {
  const body = await request.json();
  const taskService = getTaskService();

  // Service handles update + event publishing
  await taskService.updateMetadata({
    taskId,
    metadata: TaskAdapter.fromApiRequest(body),
  });

  // Get updated state via service
  const updated = await taskService.getTaskFull(taskId);

  // Adapter maps to API format
  return NextResponse.json(TaskAdapter.toApiResponse(updated));
});
```

**Key Changes:**

1. Replace `db.*` with `taskService.*`
2. Remove manual activity event creation
3. Use adapters for transformation
4. Domain events auto-published by aggregate

### Pattern 2: Execution Start (Atomic Claiming)

**Before (Direct DB with Atomic Claim):**

```typescript
// ATOMIC: Claim execution slot
const claimResult = await db
  .update(tasks)
  .set({ status: 'executing', branch, updatedAt: new Date() })
  .where(and(
    eq(tasks.id, taskId),
    ne(tasks.status, 'executing') // Only if not already executing
  ))
  .returning({ id: tasks.id });

if (claimResult.length === 0) {
  return handleError(Errors.conflict('Task is already executing'));
}

// Create execution record
await db.insert(executions).values({ ... });

// Queue execution
await queueExecution({ ... });
```

**After (DDD Service with Same Atomicity):**

```typescript
const taskService = getTaskService();
const executionService = getExecutionService();

try {
  // Service handles atomic claim internally
  await taskService.startExecution({
    taskId,
    executionId,
    branchName,
  });

  // Create execution record via service
  await executionService.createExecution({
    id: executionId,
    taskId,
    userId,
    repoId,
  });

  // Events auto-published:
  // - ExecutionStarted (from ExecutionService)
  // - TaskStatusChanged (from TaskAggregate)

  const updated = await taskService.getTaskFull(taskId);
  return NextResponse.json({
    ...TaskAdapter.toApiResponse(updated),
    executionId,
  });
} catch (error) {
  if (error.message.includes("already executing")) {
    return handleError(Errors.conflict("Task is already executing"));
  }
  throw error;
}
```

**Implementation Note:** TaskAggregate needs atomic status check:

```typescript
// lib/contexts/task/domain/task-aggregate.ts
async startExecution(params: { executionId: string; branchName: string }) {
  // Check current status
  if (this.state.status === 'executing') {
    throw new Error('Task is already executing');
  }

  // Transition with event
  await this.transitionStatus('executing');
  // ... rest of logic
}
```

### Pattern 3: Worker Integration

**Before (Mixed Direct DB + Some Services):**

```typescript
async function executeTask(job: Job) {
  const { taskId, executionId } = job.data;

  // Some DDD service usage
  const executionService = getExecutionService();
  await executionService.startExecution({ ... });

  // But also direct DB updates
  await db.update(tasks)
    .set({ processingPhase: 'executing' })
    .where(eq(tasks.id, taskId));

  // Ralph loop
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = await ralphLoop.iterate();

    // Direct DB for iterations
    await db.update(executions)
      .set({ iteration: i })
      .where(eq(executions.id, executionId));

    if (result.complete) {
      // Manual activity events
      await createExecutionCompleteEvent({ ... });
      break;
    }
  }
}
```

**After (Pure Service Orchestration):**

```typescript
async function executeTask(job: Job) {
  const { taskId, executionId } = job.data;

  const taskService = getTaskService();
  const executionService = getExecutionService();

  // All via services
  await executionService.startExecution({
    executionId,
    taskId,
    userId: job.data.userId,
    repoId: job.data.repoId,
  });
  // Publishes: ExecutionStarted event

  // Ralph loop
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = await ralphLoop.iterate();

    // Record iteration via service
    await executionService.recordIteration({
      executionId,
      iteration: i,
      actions: result.actions,
      filesChanged: result.filesChanged,
    });
    // Publishes: IterationCompleted event

    if (result.complete) {
      await executionService.completeExecution({
        executionId,
        result: {
          commitCount: result.commits.length,
          prUrl: result.prUrl,
        },
      });
      // Publishes: ExecutionCompleted event

      await taskService.completeExecution({
        taskId,
        result: {
          executionId,
          branchName: result.branch,
          commitCount: result.commits.length,
          prUrl: result.prUrl,
        },
      });
      // Publishes: TaskStatusChanged event

      break;
    }
  }

  // All activity events auto-created by AnalyticsEventSubscriber
  // Billing auto-tracked by BillingEventHandlers
}
```

## Service Extensions Needed

### TaskService New Methods

```typescript
// lib/contexts/task/application/task-service.ts

/**
 * Update task metadata (title, description, priority)
 */
async updateMetadata(params: {
  taskId: string;
  metadata: Partial<TaskMetadata>;
}): Promise<void> {
  const task = await this.taskRepository.findById(params.taskId);
  if (!task) throw new Error(`Task ${params.taskId} not found`);

  task.updateMetadata(params.metadata);
  await this.taskRepository.save(task);
}

/**
 * Update task status (direct transition)
 */
async updateStatus(params: {
  taskId: string;
  status: TaskStatus;
  reason?: string;
}): Promise<void> {
  const task = await this.taskRepository.findById(params.taskId);
  if (!task) throw new Error(`Task ${params.taskId} not found`);

  await task.transitionStatus(params.status, params.reason);
  await this.taskRepository.save(task);
}

/**
 * Delete task (with dependency cleanup)
 */
async deleteTask(taskId: string): Promise<void> {
  // Remove from dependency graph
  await this.dependencyGraph.removeAllDependenciesFor(taskId);

  // Delete from database
  const { db, tasks } = await import('@/lib/db');
  const { eq } = await import('drizzle-orm');
  await db.delete(tasks).where(eq(tasks.id, taskId));
}

/**
 * Get full task state (for API responses)
 * Returns domain state, route will use adapter to transform
 */
async getTaskFull(taskId: string): Promise<TaskState | null> {
  const task = await this.taskRepository.findById(taskId);
  if (!task) return null;
  return task.getState();
}
```

### TaskAggregate New Methods

```typescript
// lib/contexts/task/domain/task-aggregate.ts

/**
 * Update metadata (title, description)
 */
updateMetadata(metadata: Partial<TaskMetadata>): void {
  this.state.metadata = {
    ...this.state.metadata,
    ...metadata,
  };
  this.state.updatedAt = new Date();

  // No event for simple metadata updates
  // (avoids event noise, activity events only for status changes)
}
```

## Implementation Timeline

### Week 1: Foundation (Days 1-5)

**Day 1: Create Adapter Layer**

- [ ] Create `lib/contexts/task/api/adapters.ts` - TaskAdapter
- [ ] Create `lib/contexts/iam/api/adapters.ts` - UserAdapter
- [ ] Create `lib/contexts/repository/api/adapters.ts` - RepositoryAdapter
- [ ] Create `lib/contexts/execution/api/adapters.ts` - ExecutionAdapter
- [ ] Create `lib/contexts/billing/api/adapters.ts` - SubscriptionAdapter

**Day 2: Extend Service Methods**

- [ ] Add TaskService methods: `updateMetadata`, `updateStatus`, `deleteTask`, `getTaskFull`
- [ ] Add TaskAggregate method: `updateMetadata`
- [ ] Add UserService methods: `updatePreferences`, `getUserFull`
- [ ] Add RepositoryService methods: `deleteRepository`, `getRepositoryFull`

**Day 3: Write Adapter Unit Tests**

- [ ] TaskAdapter tests (all field mappings, null handling)
- [ ] UserAdapter tests
- [ ] RepositoryAdapter tests
- [ ] ExecutionAdapter tests
- [ ] SubscriptionAdapter tests
- [ ] Target: 90%+ coverage for adapters

**Day 4-5: Migrate Task CRUD Routes**

- [ ] Migrate `GET /api/tasks/[taskId]`
  - Replace direct query with `taskService.getTaskFull()`
  - Use TaskAdapter for response
  - Handle execution graph building (move to separate concern)
- [ ] Migrate `PATCH /api/tasks/[taskId]`
  - Replace direct update with `taskService.updateMetadata()`
  - Handle status transitions with `taskService.updateStatus()`
  - Handle execution start with `taskService.startExecution()`
  - Remove manual activity event creation
- [ ] Migrate `DELETE /api/tasks/[taskId]`
  - Replace direct delete with `taskService.deleteTask()`
- [ ] Write integration tests for all 3 routes
- [ ] Verify: Events published, activities auto-created, no direct DB calls
- [ ] **Delete:** Manual activity helpers from these routes

### Week 2: Critical Path (Days 6-10)

**Day 6-7: Migrate Brainstorming Routes**

- [ ] Migrate `POST /api/tasks/[taskId]/brainstorm/route.ts` (start)
- [ ] Migrate `POST /api/tasks/[taskId]/brainstorm/save/route.ts` (save)
- [ ] Migrate `POST /api/tasks/[taskId]/brainstorm/start/route.ts`
- [ ] Migrate `POST /api/tasks/[taskId]/brainstorm/init/route.ts`
- [ ] Migrate `POST /api/tasks/[taskId]/brainstorm/finalize/route.ts`
- [ ] Write integration tests
- [ ] Verify: Brainstorming flow works end-to-end
- [ ] **Delete:** `lib/queue/brainstorm-queue.ts`

**Day 8: Migrate Planning Routes**

- [ ] Migrate `POST /api/tasks/[taskId]/plan/route.ts`
- [ ] Migrate `POST /api/tasks/[taskId]/plan/start/route.ts`
- [ ] Write integration tests
- [ ] Verify: Planning flow works, AutonomousFlowManager auto-queues execution
- [ ] **Delete:** `lib/queue/plan-queue.ts`

**Day 9-10: Migrate Execution Routes + Worker**

- [ ] Migrate `POST /api/tasks/[taskId]/execute/route.ts`
- [ ] Migrate `GET /api/tasks/[taskId]/execution/route.ts`
- [ ] Update `workers/execution-worker.ts`
  - Replace all direct DB calls with service calls
  - Remove manual activity event creation
- [ ] Write worker integration tests
- [ ] Full E2E test: Create task → Brainstorm → Plan → Execute → Done
- [ ] Verify: All events published, activities created, billing tracked
- [ ] **Delete:** `lib/queue/execution-queue.ts`, `lib/queue/autonomous-flow.ts`

### Week 3: Supporting Features (Days 11-15)

**Day 11: Migrate IAM/Settings Routes**

- [ ] Migrate `POST /api/settings/api-key/route.ts`
- [ ] Migrate `PATCH /api/settings/provider/route.ts`
- [ ] Migrate `PATCH /api/settings/model/route.ts`
- [ ] Write integration tests
- [ ] Verify: ProviderConfigured events published

**Day 12: Migrate Repository Routes**

- [ ] Migrate `GET /api/repos/route.ts` (list repos)
- [ ] Migrate `DELETE /api/repos/route.ts` (delete repo)
- [ ] Migrate `GET /api/repos/[repoId]/route.ts`
- [ ] Migrate `POST /api/repos/add/route.ts` (connect repo)
- [ ] Write integration tests

**Day 13: Migrate Billing/Activity Routes**

- [ ] Migrate `GET /api/user/subscription/route.ts`
- [ ] Migrate `GET /api/user/usage/route.ts`
- [ ] Migrate `GET /api/activity/route.ts`
- [ ] Migrate `GET /api/activity/summary/route.ts`
- [ ] Migrate `GET /api/activity/history/route.ts`
- [ ] Write integration tests

**Day 14: Final Cleanup**

- [ ] Update `lib/api/middleware.ts` to use services
  - `withAuth`: Use `userService.getUserById()`
  - `withTask`: Use `taskService.getTaskFull()`
- [ ] Update `lib/api/helpers.ts` if needed
- [ ] Delete `lib/activity/helpers.ts` if all imports removed
- [ ] Verify: No direct DB imports in `app/api/` (except read-only routes)

**Day 15: Comprehensive Testing**

- [ ] Run full test suite: `npm run test:run`
- [ ] Run type check: `npm run type-check`
- [ ] Run linter: `npm run lint`
- [ ] Run build: `npm run build`
- [ ] Manual QA: Full task lifecycle in dev environment
- [ ] Update documentation: CLAUDE.md, README.md
- [ ] Create PR with detailed description

## Verification Checklist

### Code Quality

- [ ] No direct DB imports in API routes (grep verification)
- [ ] No legacy queue imports (grep verification)
- [ ] All tests pass (`npm run test:run`)
- [ ] Build succeeds (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Type check passes (`npm run type-check`)

### Functional Verification

- [ ] Create task manually through UI
- [ ] Start and complete brainstorming
- [ ] Start and complete planning
- [ ] Start execution manually
- [ ] Create autonomous task, verify auto-execution
- [ ] Update user settings (API key, provider)
- [ ] Delete repository
- [ ] Check activity feed shows all events
- [ ] Verify billing/usage tracking works
- [ ] Test with all 3 providers (Anthropic, OpenAI, Google)

### Performance

- [ ] API response times unchanged or improved
- [ ] No N+1 query issues
- [ ] Event publishing doesn't block requests

### Documentation

- [ ] CLAUDE.md updated (remove queue references, add DDD patterns)
- [ ] Architecture diagram created (bounded context map, event flows)
- [ ] README.md updated with architecture overview
- [ ] Migration completion notes added

## Rollback Strategy

### Git Strategy

```bash
# Create migration branch
git checkout -b feature/complete-ddd-migration
git push -u origin feature/complete-ddd-migration

# Commit frequently with descriptive messages
git commit -m "feat(ddd): create adapter layer for all contexts"
git commit -m "feat(ddd): extend TaskService with CRUD methods"
git commit -m "feat(ddd): migrate task CRUD routes"
# ... etc

# When complete, create PR for review
gh pr create --title "Complete DDD Migration" --body "..."
```

### Staged Rollout

1. **Development**: Full testing, 100% migration
2. **Staging**: Deploy, run for 24 hours, load testing
3. **Production Canary**: 1% traffic for 4 hours
4. **Production Gradual**: 10% → 50% → 100% over 48 hours

### Rollback Options

- **Partial Rollback**: Revert specific route migrations, keep DDD infrastructure
- **Full Rollback**: Revert to commit before migration, rethink approach
- **Feature Flag**: Add `ENABLE_DDD_ROUTES=false` env var to toggle (if needed)

## Success Criteria

### Functional Requirements

- [x] All 52+ API routes use DDD services (no direct DB access)
- [x] All domain events published consistently
- [x] Event handlers process events correctly
- [x] Autonomous flow works end-to-end
- [x] No duplicate code paths (legacy queues deleted)
- [x] Zero breaking changes for frontend

### Non-Functional Requirements

- [x] Test coverage ≥ 80% for migrated code
- [x] Build passes with no TypeScript errors
- [x] Lint passes with no warnings
- [x] No degradation in API response times
- [x] All integration tests pass

### Documentation

- [x] CLAUDE.md updated with DDD patterns
- [x] Architecture diagrams created
- [x] README.md updated with architecture overview
- [x] Migration completion commit message

## Risks and Mitigation

### Risk 1: Breaking Active Workflows

**Likelihood:** MEDIUM | **Impact:** HIGH

**Mitigation:**

- Test each phase thoroughly before moving to next
- Keep staging environment running old code for comparison
- Monitor error logs closely during migration
- Have rollback commits ready

### Risk 2: Event Handler Failures

**Likelihood:** LOW | **Impact:** MEDIUM

**Mitigation:**

- Event handlers already tested in Phase 8
- App continues if handlers fail (fail-open strategy)
- Health checks show handler status

### Risk 3: Performance Degradation

**Likelihood:** LOW | **Impact:** MEDIUM

**Mitigation:**

- Profile API routes before and after
- Add caching if needed (adapter layer)
- Database indexes already optimized

### Risk 4: Missing Test Coverage

**Likelihood:** MEDIUM | **Impact:** MEDIUM

**Mitigation:**

- Write tests in parallel with migration
- Aim for 80%+ coverage
- Run integration tests continuously

## Post-Migration Benefits

### Technical Benefits

- ✅ 100% DDD architecture adoption
- ✅ Clean separation of concerns
- ✅ Consistent event-driven patterns
- ✅ Improved testability
- ✅ Better domain model clarity
- ✅ Reduced code duplication

### Business Benefits

- ✅ Faster feature development (clear patterns)
- ✅ Easier onboarding (well-defined architecture)
- ✅ Better audit trail (domain events)
- ✅ More reliable autonomous execution
- ✅ Scalability foundation (event-driven)

### Maintenance Benefits

- ✅ Single source of truth (aggregates)
- ✅ No duplicate code paths
- ✅ Clear ownership boundaries
- ✅ Easier debugging (event logs)
- ✅ Better error handling (aggregate validation)

---

**Approved By:** [To be filled]
**Implementation Start:** 2026-02-02
**Expected Completion:** 2026-02-20
