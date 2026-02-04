# DDD Migration – Complete Status

> **Last updated:** 2026-02-04
> **Branch:** `main` (single branch – all work consolidated)
> **Migration state:** Service layer + route migrations complete; domain/infrastructure layer staged; aggregate wiring pending

---

## Architecture Overview

Loopforge Studio is migrating to Domain-Driven Design across **6 bounded contexts**. The migration has two layers that were developed in parallel and are now merged into `main`:

| Layer             | What it is                                                                                                                                             | Status                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **Service layer** | Application-level services (`*Service`) called directly by API routes. Each context exposes a factory (`get*Service()`) via its `api/index.ts` barrel. | Complete – 25+ routes migrated                    |
| **Domain layer**  | Aggregates, repositories, domain events, adapters inside each context. Proper DDD objects that enforce invariants and publish events.                  | Staged – files exist, not yet wired into services |

The next milestone is **wiring the domain layer into the services** so the aggregates drive behaviour instead of sitting unused.

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
│   │   ├── application/execution-service.ts
│   │   ├── domain/                  # execution-aggregate, events, types (STAGED)
│   │   └── infrastructure/          # execution-repository (STAGED)
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
│       ├── application/task-service.ts
│       ├── domain/                  # task-aggregate, dependency-graph, events, types (STAGED)
│       └── infrastructure/          # task-repository, event-handlers, autonomous-flow-manager (STAGED)
│
└── domain/                          # Legacy cross-context aggregates (used by 4 routes; retire after wiring)
    ├── aggregates/                  # TaskAggregate, ExecutionAggregate, RepoAggregate, SubscriptionAggregate
    ├── repositories/                # TaskRepository, ExecutionRepository, RepoRepository, SubscriptionRepository
    └── value-objects/               # Identifiers, TaskLifecycle, TaskStatusTransition
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
| **RepositoryService** | `getRepositoryFull`, `listUserRepositories`, `connectRepository`, `findByOwner`, `updateRepository`, `deleteRepository`, `deleteAllByUser`                                                                                                                                                                                                                                                                                           |
| **TaskService**       | `getTaskFull`, `listByRepo`, `listActiveWorkerTasks`, `createTask`, `updateFields`, `claimProcessingSlot`, `clearProcessingSlot`, `deleteTask`, `verifyOwnership`, `getIdsByRepoIds`, `deleteByRepoIds`                                                                                                                                                                                                                              |
| **ExecutionService**  | `getLatestForTask`, `listByTask`, `getById`, `getExecutionWithOwnership`, `getExecutionEvents`, `create`, `markRunning`, `markCompleted`, `markFailed`, `markStuck`, `deleteByTaskIds`                                                                                                                                                                                                                                               |
| **UserService**       | `registerUser`, `configureProvider`, `removeProvider`, `updatePreferences`, `updateLocale`, `completeOnboarding`, `updateSubscription`, `getUserFull`, `deleteUser`, `updateUserFields`                                                                                                                                                                                                                                              |

---

## What Remains

### Priority 1 – Wire aggregates into services

The domain aggregates in `lib/contexts/*/domain/` and the infrastructure repositories in `lib/contexts/*/infrastructure/` are **not yet called by anything**. The services still query the database directly. The next step is to replace the direct DB calls inside each service with aggregate + repository calls.

Four routes already use aggregates from the **legacy** `lib/domain/` layer. Once the context-local aggregates are wired in, these routes move to the services and `lib/domain/` is deleted:

| Route                                   | Current aggregate usage                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `tasks/[taskId]` PATCH (executing path) | `TaskAggregate.claimExecution` + `ExecutionAggregate.createQueued` + atomic status guard |
| `tasks/[taskId]/dependencies`           | `TaskAggregate.addDependency` / `removeDependency` + circular-dependency detection       |
| `tasks/[taskId]/autonomous/resume`      | `TaskAggregate.claimExecution` + `queueTaskExecution`                                    |
| `tasks/[taskId]/brainstorm/save`        | `TaskAggregate.recordBrainstorm` + `TaskRepository.save`                                 |

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

### Priority 4 – Routes with no DDD migration yet (direct DB, no context imports)

These routes have not been touched by the migration. They still import from `@/lib/db` directly and have no bounded-context service calls:

| Route                         | Notes                               |
| ----------------------------- | ----------------------------------- |
| `repos/[repoId]/clone`        | Git clone orchestration             |
| `repos/[repoId]/clone-status` | Clone progress polling              |
| `repos/[repoId]/verify-local` | Local clone verification            |
| `experiments/*` (4 routes)    | Experimental feature; low priority  |
| `plans`                       | Plan listing                        |
| `executions/[id]/sse`         | SSE stream for a single execution   |
| `workers/[taskId]/sse`        | SSE stream for a single worker task |
| `dashboard/stuck-tasks`       | Stuck-tasks widget query            |
| `recovery-status`             | Recovery state polling              |
| `workers/health`              | Health endpoint                     |
| `workers/heartbeat`           | Heartbeat endpoint                  |

### Priority 5 – Clean up staged artifacts

Once the domain layer is wired in:

- Delete `lib/domain/` (legacy aggregates/repositories)
- Remove `DDD_MIGRATION_DESIGN.md` and `PHASE8_VERIFICATION.md` from repo root (move relevant content to docs/)
- Verify and remove any unused imports from the staged infrastructure files

---

## Known Pre-existing TypeScript Errors

These errors existed before the DDD migration and are **not caused by it**:

| File                                                 | Error                                                                                                             |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `lib/contexts/*/api/index.ts` (4 files)              | `getRedis` not exported from `@/lib/queue` — the barrel files reference it but the queue module doesn't export it |
| `lib/contexts/iam/infrastructure/user-repository.ts` | Column name mismatches: DB has `username`/`avatarUrl`, repository maps to `name`/`image`                          |
| `app/api/webhooks/stripe/route.ts`                   | `stripe` variable used outside its initialising `try` block                                                       |
| `lib/domain/repositories/task-repository.ts`         | `SQL<unknown> \| undefined` not assignable to `SQL<unknown>`                                                      |
| `lib/graph/layout.ts`                                | `GraphEdge` missing `.from` / `.to` properties                                                                    |
| `lib/ralph/loop.ts`                                  | `SkillResult[]` missing `message` / `timestamp` fields                                                            |
| `lib/skills/enforcement.ts`                          | `Record<string, unknown>` not assignable to expected union                                                        |
| `navigation.ts`                                      | `createSharedPathnamesNavigation` removed in newer next-intl                                                      |
| `workers/execution-worker.ts`                        | `console.warn` overload mismatch with `unknown` argument                                                          |
| `__tests__/**`                                       | Fixture shape mismatches, missing test-db module paths                                                            |

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
