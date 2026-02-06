# DDD Migration – Complete Status

> **Last updated:** 2026-02-06 (Ralph loop checkpoint 2)
> **Branch:** `main` (single branch – all work consolidated)
> **Migration state:** Clean Architecture use cases complete ✅ | Task & Execution aggregates wired ✅ | Diff/review routes migrated to `ExecutionService` ✅ | Repository clone-status/verify-local routes migrated to `RepositoryService` ✅ | All API routes migrated off direct `@/lib/db` imports ✅ | Worker/queue backend internals migrated to context services/adapters ✅ | `lib/domain/` deleted ✅
> **Completion Roadmap:** See [`DDD-COMPLETION-ROADMAP.md`](./DDD-COMPLETION-ROADMAP.md) for final cleanup items.

---

## Continuation Checkpoint (Resume Later)

**Current stop point:** backend migration is merged to `main` and operationally complete for API + queue/worker import boundaries.

### Ralph Loop Checkpoint – 2026-02-06 (Backend Test-Contract Alignment)

Completed this iteration:

1. Removed `@ts-nocheck` and migrated API route tests to current clean-architecture contracts:
   - `__tests__/api/brainstorm-start-route.test.ts`
   - `__tests__/api/plan-start-route.test.ts`
   - `__tests__/api/tasks-get-route.test.ts`
2. Removed `@ts-nocheck` and retyped domain event infrastructure tests:
   - `__tests__/domain-events/event-infrastructure.test.ts`
3. Replaced legacy analytics integration test suite with current `AnalyticsService` contract coverage:
   - `__tests__/analytics/analytics-service.test.ts`
4. Verified compile gate:
   - `npx tsc --noEmit --pretty false` ✅

Remaining debt snapshot:

- `@ts-nocheck` in `__tests__`: **29 files**.
- Next recommended context: `__tests__/task/task-service.test.ts` + `__tests__/execution/execution-service.test.ts`.

**Next session focus (remaining technical debt):**

1. Resolve pre-existing repo-wide TypeScript/test debt listed in roadmap (outside this migration merge).
2. Re-run worker/queue lint + TS verification before next merge.

**Quick resume verification commands:**

- `npx eslint workers/execution-worker.ts lib/queue/autonomous-flow.ts lib/workers/events.ts`
- `npx tsc --noEmit --pretty false`
- `rg -n "from \"@/lib/db\"|from '@/lib/db'|from \"../lib/db\"|from '../lib/db'" app/api lib/queue lib/workers workers -g'*.ts'`

## Architecture Overview

Loopforge Studio is migrating to Domain-Driven Design across **6 bounded contexts**. The migration has two layers that were developed in parallel and are now merged into `main`:

| Layer             | What it is                                                                                                                                             | Status                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **Service layer** | Application-level services (`*Service`) called directly by API routes. Each context exposes a factory (`get*Service()`) via its `api/index.ts` barrel. | Complete – 25+ routes migrated                                     |
| **Domain layer**  | Aggregates, repositories, domain events, adapters inside each context. Proper DDD objects that enforce invariants and publish events.                  | Task + Execution: **wired**. IAM, Repo, Billing, Analytics: staged |

`lib/domain/` (the legacy cross-context aggregate layer) has been **deleted**. All routes now go through bounded-context services.

---

## Directory Layout

```
lib/
├── contexts/                        # Bounded contexts (DDD)
│   ├── domain-events/               # Cross-cutting event bus
│   │   ├── types.ts                 # DomainEvent, IEventPublisher, IEventSubscriber
│   │   ├── event-publisher.ts       # Redis Pub/Sub publisher
│   │   ├── event-subscriber.ts      # Wildcard-pattern subscriber
│   │   └── index.ts
│   ├── event-initialization.ts      # Starts all subscribers on app boot
│   ├── analytics/                   # Analytics & Activity context
│   │   ├── api/index.ts             # getAnalyticsService() factory
│   │   ├── application/analytics-service.ts
│   │   ├── domain/                  # activity-stream, events, types (STAGED)
│   │   └── infrastructure/          # activity-repository, event-subscribers, sse-stream (STAGED)
│   ├── billing/                     # Billing & Usage context
│   │   ├── api/index.ts             # getBillingService() factory
│   │   ├── api/adapters.ts          # (STAGED)
│   │   ├── application/billing-service.ts
│   │   ├── application/usage-service.ts  # (STAGED)
│   │   ├── domain/                  # subscription-aggregate, usage-aggregate, events, types (STAGED)
│   │   └── infrastructure/          # subscription-repository, usage-repository, event-handlers (STAGED)
│   ├── execution/                   # AI Execution context
│   │   ├── api/index.ts             # getExecutionService() factory
│   │   ├── api/adapters.ts          # (STAGED)
│   │   ├── application/execution-service.ts  # createQueued wired ✅
│   │   ├── domain/                  # execution-aggregate, events, types (WIRED)
│   │   └── infrastructure/          # execution-repository (WIRED)
│   ├── iam/                         # Identity & Access context
│   │   ├── api/index.ts             # getUserService() factory
│   │   ├── api/adapters.ts          # (STAGED)
│   │   ├── application/user-service.ts
│   │   ├── domain/                  # user-aggregate, provider-config, events (STAGED)
│   │   ├── infrastructure/          # user-repository, crypto (STAGED)
│   │   └── index.ts
│   ├── repository/                  # Repository Management context
│   │   ├── api/index.ts             # getRepositoryService() factory
│   │   ├── api/adapters.ts          # (STAGED)
│   │   ├── application/repository-service.ts
│   │   ├── application/indexing-service.ts  # (STAGED)
│   │   ├── domain/                  # repository-aggregate, repo-index-aggregate, events, types (STAGED)
│   │   └── infrastructure/          # repository-repository, repo-index-repository (STAGED)
│   └── task/                        # Task Orchestration context
│       ├── api/index.ts             # getTaskService() factory
│       ├── api/adapters.ts          # (STAGED)
│       ├── application/task-service.ts  # aggregate-backed methods wired ✅
│       ├── domain/                  # task-aggregate, dependency-graph, events, types (WIRED)
│       └── infrastructure/          # task-repository (+ saveWithStatusGuard), event-handlers (WIRED)
```

---

## What Is Done

### Phase 0 – Infrastructure (complete)

- Domain event bus: `EventPublisher` (Redis Pub/Sub), `EventSubscriber` (wildcard patterns)
- `domain_events` table migration (`drizzle/0043`)
- Architecture docs: ADR-001, Bounded Contexts, File Mapping, Ubiquitous Language glossary (150+ terms)

### Phases 1-8 – Context scaffolding (complete)

All 6 bounded contexts have been scaffolded with the full four-layer structure (`domain/`, `application/`, `infrastructure/`, `api/`). Domain aggregates, events, and infrastructure repositories exist in every context. 20+ test files cover adapters, services, and event infrastructure.

New migrations brought in by this work:

- `0041` – worker heartbeats table
- `0042` – recovering processing phase
- `0043` – domain events table

New UI added:

- Worker health page + heartbeat/health API endpoints
- Stuck-tasks dashboard widget
- Recovery popover and status badge on Kanban cards
- System-status banner, segmented-control UI component
- Worker status cards (queue metrics, Redis status, recent failures)

### Service-layer route migrations (complete – 25+ routes)

Every API route that does simple CRUD or single-context reads/writes now goes through a bounded-context service. The routes import `get*Service()` from `lib/contexts/<context>/api` and call service methods instead of querying the database directly.

#### Routes migrated by batch

| Batch    | Routes                                                                                                                             | Key service additions                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Scaffold | –                                                                                                                                  | 6 services created, 6 api barrels, domain re-exports               |
| 1        | `tasks/[id]` PATCH/DELETE, `brainstorm/start`, `plan/start`, `user/usage`, `onboarding/complete`, `billing/checkout`               | Deleted `lib/activity/*`                                           |
| 2        | `analytics`, `activity/*` (4 routes), `repos/*` (3 routes), `account/delete`, `user/locale`                                        | Deleted `lib/api/analytics.ts`, `lib/api/cached-queries.ts`        |
| 3        | `settings/*` (6 routes), `billing/portal-session`                                                                                  | `UserService.updateUserFields`, `updateLocale`                     |
| 4a       | `workers/[taskId]`, `executions/[id]/events`                                                                                       | `ExecutionService.getExecutionWithOwnership`, `getExecutionEvents` |
| 4b       | `workers/route`, `workers/sse` (initial-data query), `workers/history` (repo + task lookups)                                       | `TaskService.listActiveWorkerTasks`                                |
| 5        | `brainstorm/route`, `plan/route`, `brainstorm/chat`, `brainstorm/finalize`, `execution`, `processing`, `rollback/*`, `diff/reject` | `TaskService.claimProcessingSlot`, `clearProcessingSlot`           |
| 6        | `brainstorm/generate` (autonomous + manual)                                                                                        | –                                                                  |
| 7        | `diff/approve`                                                                                                                     | `TaskService.markCompleted`, `updateFields`, `getTaskFull`         |
| 8        | `diff/route` GET                                                                                                                   | `ExecutionService.getLatestForTask`                                |

#### Service method inventory

| Service               | Methods                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **AnalyticsService**  | `recordActivityEvent`, `taskCreated`, `statusChanged`, `brainstormStarted`, `brainstormCompleted`, `planningStarted`, `planningCompleted`, `taskUpdated`, `executionStarted`, `executionCompleted`, `getTaskMetrics`, `getTasksByStatus`, `getDailyCompletions`, `getRepoActivity`, `getTokenUsage`, `getCostBreakdown`, `getActivityFeed`, `getActivityHistory`, `getActivityChanges`, `getActivitySummary`, `deleteUserActivities` |
| **BillingService**    | `checkRepoLimit`, `checkTaskLimit`, `recordUsage`, `getUsageSummary`, `createCheckoutSession`, `createPortalSession`                                                                                                                                                                                                                                                                                                                 |
| **RepositoryService** | `getRepositoryFull`, `listUserRepositories`, `connectRepository`, `findByOwner`, `getRepositoryWithIndexByOwner`, `markRepositoryCloneVerified`, `updateRepository`, `deleteRepository`, `deleteAllByUser`                                                                                                                                                                                                                           |
| **TaskService**       | `getTaskFull`, `listByRepo`, `listByUserId`, `listActiveWorkerTasks`, `createTask`, `updateFields`, `claimProcessingSlot`, `clearProcessingSlot`, `deleteTask`, `verifyOwnership`, `getIdsByRepoIds`, `deleteByRepoIds`, **`claimExecutionSlot`**, **`revertExecutionSlot`**, **`saveBrainstormResult`**, **`addDependency`**, **`removeDependency`**, **`updateDependencySettings`**, **`enableAutonomousMode`**                    |
| **ExecutionService**  | `getLatestForTask`, `listByTask`, `getById`, `getExecutionWithOwnership`, `getExecutionEvents`, `create`, `markRunning`, `markCompleted`, `markFailed`, `markStuck`, `deleteByTaskIds`, **`createQueued`**                                                                                                                                                                                                                           |
| **UserService**       | `registerUser`, `configureProvider`, `removeProvider`, `updatePreferences`, `updateLocale`, `completeOnboarding`, `updateSubscription`, `getUserFull`, `deleteUser`, `updateUserFields`                                                                                                                                                                                                                                              |

---

## What Remains

### ✅ Completed – Clean Architecture Use Case Pattern (Phase 10)

**Date completed:** 2026-02-06

Migrated Task context from service-layer pattern to strict Clean Architecture use cases:

**Infrastructure created:**

- 31 use cases in `lib/contexts/task/use-cases/` with Input/Output DTOs
- `UseCaseFactory` with dependency injection for all use cases
- Port adapters: `AnalyticsServiceAdapter`, `LoggerAdapter` implementing domain ports
- `Result<T, E>` pattern for explicit error handling (no exceptions for business logic)

**All API routes migrated (15 routes):**

1. `app/api/repos/[repoId]/tasks/route.ts` → CreateTask, ListTasksByRepo
2. `app/api/tasks/[taskId]/route.ts` → GetTask, UpdateTaskFields, DeleteTask, ClaimExecutionSlot, RevertExecutionSlot, UpdateTaskConfiguration, SaveBrainstormResult
3. `app/api/tasks/[taskId]/dependencies/route.ts` → AddTaskDependency, RemoveTaskDependency, UpdateDependencySettings, GetTaskDependencyGraph
4. `app/api/tasks/[taskId]/brainstorm/save/route.ts` → SaveBrainstormResult
5. `app/api/tasks/[taskId]/brainstorm/finalize/route.ts` → SaveBrainstormResult, FinalizeBrainstorm
6. `app/api/tasks/[taskId]/brainstorm/start/route.ts` → ClaimBrainstormingSlot, ClearProcessingSlot
7. `app/api/tasks/[taskId]/brainstorm/route.ts` → ClaimBrainstormingSlot, SaveBrainstormResult, ClearProcessingSlot, GetTaskWithRepo
8. `app/api/tasks/[taskId]/plan/route.ts` → ClaimPlanningSlot, SavePlan, FinalizePlanning, GetTaskWithRepo
9. `app/api/tasks/[taskId]/plan/start/route.ts` → ClaimPlanningSlot, ClearProcessingSlot
10. `app/api/tasks/[taskId]/execute/route.ts` → ClaimExecutionSlot, RevertExecutionSlot
11. `app/api/tasks/[taskId]/autonomous/resume/route.ts` → EnableAutonomousMode, ClaimExecutionSlot, RevertExecutionSlot
12. `app/api/tasks/[taskId]/execution/route.ts` → Already using ExecutionService ✅
13. `app/api/workers/[taskId]/route.ts` → GetTaskWithRepo
14. `app/api/tasks/[taskId]/brainstorm/init/route.ts` → No migration needed (conversation management only)
15. `app/api/dashboard/stuck-tasks/route.ts` → No migration needed (direct queries only)

**Task entity enhancements (10 business methods):**

- `updateFields`, `savePlan`, `markAsRunning`, `markAsCompleted`, `markAsFailed`, `markAsStuck`
- `setAutonomousMode`, `updatePriority`, `updateConfiguration`, `addDependency`, `removeDependency`
- All methods return `[Task, DomainEvent]` tuples for immutability

**Repository enhancements:**

- `TaskRepository.saveWithStatusGuard` (atomic status-guarded UPDATE for execution claiming)
- Explicit type assertions for proper domain/infrastructure boundary

**Commits:**

- 383965e: feat(ddd): implement all 31 use cases for Task context (Step 4)
- 484f606: feat(ddd): migrate first route to use cases
- faf212e: feat(ddd): migrate tasks/[taskId] and dependencies routes
- 9e2bdbb: feat(ddd): migrate brainstorm save and finalize routes
- 9bb7fb4: feat(ddd): complete API routes migration to use cases

**Design document:** `docs/plans/2026-02-05-clean-architecture-task-context-design.md`

### ✅ Completed – Wire Remaining Contexts to Repositories (Phase 11)

**Date completed:** 2026-02-06

Completed Priority 1 from DDD-COMPLETION-ROADMAP: wired all remaining bounded contexts to their infrastructure repositories.

**Analytics Context:**

- Wired `ActivityRepository` into `AnalyticsService`
- Replaced `db.insert(activityEvents)` with `activityRepository.recordActivity()`
- Added `deleteByUserId` method to repository
- Replaced direct delete with `activityRepository.deleteByUserId()`

**Billing Context:**

- Added `recordUsage` method to `UsageRepository` for detailed usage tracking
- Added `getEstimatedCost` method to `UsageRepository` for cost aggregation
- Replaced `db.insert(usageRecords)` with `usageRepository.recordUsage()`
- Replaced direct cost query with `usageRepository.getEstimatedCost()`

**Repository Context:**

- Already wired ✅ (uses `RepositoryRepository` throughout)
- Only remaining direct query is cross-context (fetching tasks)

**IAM Context:**

- Already wired ✅ (uses `UserRepository` throughout)
- Only minor direct updates remain (`updateLocale`, `updateUserFields` - can be addressed later)

**Commits:**

- 414ec8c: feat(ddd): wire Analytics context to ActivityRepository
- 3b2083f: feat(ddd): wire Billing context to UsageRepository

All four remaining contexts now properly delegate to their infrastructure repositories. Service-to-repository wiring complete across all 6 bounded contexts.

### ✅ Completed – Repository Clone Status & Verification Route Migration (Phase 12a)

**Date completed:** 2026-02-06

Migrated repository clone lifecycle read/verification endpoints to `RepositoryService`:

- `app/api/repos/[repoId]/clone-status/route.ts` now calls `repositoryService.getRepositoryWithIndexByOwner()`
- `app/api/repos/[repoId]/verify-local/route.ts` now calls:
  - `repositoryService.findByOwner()`
  - `repositoryService.markRepositoryCloneVerified()`

New RepositoryService methods added:

- `getRepositoryWithIndexByOwner(repoId, userId)` for clone/indexing status reads
- `markRepositoryCloneVerified(repoId, localPath)` for verified-local path persistence

Result: route handlers no longer import `@/lib/db` directly for these two endpoints.

### ✅ Completed – Full Backend API Route Migration (Phase 12b)

**Date completed:** 2026-02-06

Migrated all remaining API route handlers away from direct `@/lib/db` imports.

Additional routes migrated in this phase include:

- `app/api/tasks/[taskId]/route.ts`
- `app/api/tasks/[taskId]/execute/route.ts`
- `app/api/tasks/[taskId]/autonomous/resume/route.ts`
- `app/api/tasks/[taskId]/brainstorm/save/route.ts`
- `app/api/tasks/[taskId]/brainstorm/start/route.ts`
- `app/api/tasks/[taskId]/plan/start/route.ts`
- `app/api/tasks/[taskId]/dependencies/route.ts`
- `app/api/tasks/[taskId]/recovery-status/route.ts`
- `app/api/repos/[repoId]/tasks/route.ts`
- `app/api/repos/[repoId]/graph/route.ts`
- `app/api/repos/[repoId]/clone/route.ts`
- `app/api/repos/add/route.ts`
- `app/api/onboarding/complete/route.ts`
- `app/api/dashboard/stuck-tasks/route.ts`
- `app/api/executions/[executionId]/sse/route.ts`
- `app/api/workers/[taskId]/sse/route.ts`
- `app/api/workers/history/route.ts`
- `app/api/workers/health/route.ts`
- `app/api/workers/heartbeat/route.ts`
- `app/api/health/route.ts`

New service layer additions to support this:

- `TaskService` restored under `lib/contexts/task/application/task-service.ts`
- `WorkerMonitoringService` added under `lib/contexts/execution/application/worker-monitoring-service.ts`
- `SystemHealthService` added under `lib/contexts/system/application/system-health-service.ts`

Result: `app/api/**` no longer contains direct `@/lib/db` imports.

### ✅ Completed – Worker/Queue Backend Internal Migration (Phase 12c)

**Date completed:** 2026-02-06

Migrated worker and queue backend internals away from direct shared `lib/db` route-style coupling:

- `lib/queue/autonomous-flow.ts` now uses:
  - `getUserService()`
  - `getTaskService()`
  - `getRepositoryService()`
  - `getExecutionService()`
- `workers/execution-worker.ts` now:
  - imports persistence primitives from `lib/contexts/execution/infrastructure/worker-runtime-persistence.ts`
  - uses context services for user/task/repository/execution lookups
  - routes dependency lookups through `TaskService`
  - routes activity logging through `AnalyticsService`
  - routes execution event and worker event inserts through infrastructure helper functions

Service additions made for this phase:

- `TaskService.getTaskWithLatestExecution(taskId)`
- `RepositoryService.getById(repoId)`
- `RepositoryService.getRepoIndexByRepoId(repoId)`
- `ExecutionService.deleteById(executionId)`
- `ExecutionService.updateFields(executionId, fields)`

Result: `app/api`, `lib/queue`, `lib/workers`, and `workers` no longer import `@/lib/db` or `../lib/db` directly.

### ✅ Completed – Wire Task & Execution aggregates + delete lib/domain/ (Phase 9)

- `TaskRepository.saveWithStatusGuard` added (atomic execution claiming)
- `TaskService` extended: `claimExecutionSlot`, `revertExecutionSlot`, `saveBrainstormResult`, `addDependency`, `removeDependency`, `updateDependencySettings`, `enableAutonomousMode`
- `ExecutionService` extended: `createQueued`
- All 6 routes that used `lib/domain` aggregates migrated to services:
  `execute/route`, `brainstorm/save/route`, `dependencies/route`, `autonomous/resume/route`, `tasks/[taskId]/route` (PATCH executing + GET graph-cache), `repos/[repoId]/tasks/route` (POST create)
- `lib/domain/` deleted (13 files)

### Priority 1 – Migrate Remaining Non-route Backend DB Access

Service-to-repository wiring is complete across all six contexts and API routes are migrated. Remaining work is backend internals (workers/queue/utilities) that still use direct DB access.

### Priority 2 – Routes with heavy in-route infrastructure (keep as-is for now)

| Route             | What stays in route                                                        | Why                                                                |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `brainstorm/init` | AI client instantiation, GitHub repo scan, in-memory conversation restore  | Tightly coupled to streaming AI session lifecycle                  |
| `workers/sse`     | `ReadableStream`, Redis pub/sub channel, heartbeat timer, polling fallback | SSE transport is route-level infrastructure                        |
| `workers/history` | `workerJobs` + `workerEvents` pagination, aggregate-stats queries          | Response shape is tightly coupled to the specific pagination logic |

### Priority 3 – Low-priority / complex routes

| Route                      | Notes                                                                  |
| -------------------------- | ---------------------------------------------------------------------- |
| `billing/webhook` (Stripe) | Full Stripe event-type handling; high complexity, low change frequency |
| `user/subscription`        | Complex Drizzle relation query; very low traffic                       |
| `repos/[repoId]/graph`     | Depends on dependency-graph domain logic that isn't wired yet          |

### Priority 4 – Backend internals migration status

| Module                         | Status   | Notes                                                                                                                                                    |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workers/execution-worker.ts`  | Complete | Task/execution/worker-job mutations now route through execution-context runtime persistence helper methods (no inline table mutation queries in worker). |
| `lib/queue/autonomous-flow.ts` | Complete | Fully migrated to Task/Repository/Execution/User services.                                                                                               |
| `lib/workers/events.ts`        | Complete | Task persistence writes delegated to `TaskService.updateFields()`.                                                                                       |

### Priority 5 – Clean up staged artifacts

- ~~Delete `lib/domain/`~~ **Done** ✅
- Remove `DDD_MIGRATION_DESIGN.md` and `PHASE8_VERIFICATION.md` from repo root (move relevant content to docs/)
- Verify and remove any unused imports from the staged infrastructure files

---

## Known Pre-existing TypeScript Errors

These errors existed before the DDD migration and are **not caused by it**:

| File                               | Error                                                       |
| ---------------------------------- | ----------------------------------------------------------- |
| `app/api/webhooks/stripe/route.ts` | `stripe` variable used outside its initialising `try` block |
| `workers/execution-worker.ts`      | `console.warn` overload mismatch with `unknown` argument    |
| `__tests__/**`                     | Fixture shape mismatches, missing test-db module paths      |

Resolved since 2026-02-06:

- `lib/contexts/iam/infrastructure/user-repository.ts` column mapping mismatch
- `lib/shared/graph-layout.ts` edge field mismatch (`source`/`target`)
- `lib/ralph/loop.ts` incomplete `SkillResult[]` typing
- `lib/skills/enforcement.ts` `skillExecutions` persistence type mismatch
- `navigation.ts` next-intl navigation API migration (`createNavigation`)
- `lib/workers/events.ts` processing phase map typing for `"recovering"`
- `lib/contexts/execution/infrastructure/execution-repository.ts` typed insert/update row mapping
- `lib/contexts/repository/infrastructure/repository-repository.ts` clone status/domain mapping + typed row mapping
- `lib/contexts/task/adapters/repositories/TaskRepository.ts` status-history mapping + typed row mapping

---

## Domain Events System

The event bus is built on Redis Pub/Sub:

- **Publisher** (`lib/contexts/domain-events/event-publisher.ts`): `publish(event)`, `publishAll(events[])`
- **Subscriber** (`lib/contexts/domain-events/event-subscriber.ts`): wildcard pattern matching (e.g. `Task.*`), priority-ordered handlers
- **Persisted events**: written to `domain_events` table with `recordId`, `persistedAt`, `version`
- **Metadata**: `correlationId`, `causationId`, `userId` for workflow tracing

Each context defines its own events in `domain/<context>/events.ts`. None of these are published yet — that happens when the aggregates are wired in.

---

## Execution Reliability Domain (staged)

`lib/contexts/execution/domain/types.ts` defines the full reliability model that will govern the Ralph loop once wired:

| Feature                   | Detail                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Stuck detection**       | 5 signals: consecutive errors, repeated patterns (>80% Levenshtein similarity), iteration timeout (10 min), quality degradation (<40% over 5 iterations), no progress (3 iterations without commits). Critical severity → immediate stuck; 2+ high → stuck; 3+ medium → stuck. |
| **Recovery**              | 4-tier escalation: format guidance → simplified prompts → context reset → manual fallback                                                                                                                                                                                      |
| **Completion validation** | 6 weighted checks totalling 100 points, passing at 80: hasMarker (20), hasCommits (20), matchesPlan (30), qualityThreshold (15), testsExecuted (5), noCriticalErrors (10)                                                                                                      |
| **File extraction**       | 6 progressive strategies with confidence scores: strict (0.95), fuzzy (0.75), ai-json (0.7), ai-single-file (0.8), ai-code-mapping (0.5), ai-assisted (0.6)                                                                                                                    |

---

## Test Coverage

| Area                         | Test files                                                                                                        | Status                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Domain events infrastructure | `__tests__/domain-events/event-infrastructure.test.ts`                                                            | 6 tests – passed at creation |
| Adapters                     | `task-adapter`, `execution-adapter`, `repository-adapter`, `user-adapter`, `subscription-adapter`                 | Written; require DB to run   |
| Services                     | `analytics-service`, `billing-service`, `execution-service`, `repository-service`, `task-service`, `user-service` | Written; require DB to run   |
| Event initialization         | `__tests__/contexts/event-initialization.test.ts`                                                                 | Written; requires Redis      |
| Route integration            | `brainstorm-start-route`, `plan-start-route`, `tasks-get-route`                                                   | Written; require DB          |

Tests require a running PostgreSQL instance (`DATABASE_URL`) and some require Redis (`REDIS_URL`). Run with:

```bash
npm run test:run
```

---

## References

- `docs/architecture/ADR-001-DDD-ARCHITECTURE.md` – why DDD, trade-offs considered
- `docs/architecture/BOUNDED_CONTEXTS.md` – context definitions and responsibilities
- `docs/architecture/FILE_MAPPING.md` – current file → future context mapping
- `docs/architecture/UBIQUITOUS_LANGUAGE.md` – glossary (150+ terms)
- `docs/architecture/IMPLEMENTATION_STATUS.md` – phase-by-phase tracking (update below)
- `DDD_MIGRATION_DESIGN.md` – original design document (root; to be moved to docs/)
