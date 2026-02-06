# DDD Migration Completion Roadmap

> Current state: ~97% complete
> All 6 contexts: WIRED ✅
> Service-to-repository layer complete ✅
> Diff/review routes migrated to `ExecutionService` ✅
> All API routes migrated off direct `@/lib/db` imports ✅
> Worker/queue backend internals migrated to context services/adapters ✅
> Next: resolve pre-existing TypeScript/test errors and finalize shared-helper placement notes
> Latest checkpoint (2026-02-06): API/domain-events/analytics test-contract migration complete; remaining `@ts-nocheck` in `__tests__` = 29

## Resume Checklist (Next Session)

1. ✅ `workers/execution-worker.ts`: extracted remaining `tasks` / `executions` / `workerJobs` mutations into execution-context persistence helpers (`worker-runtime-persistence.ts`).
2. ✅ `lib/db/status-history.ts`: kept shared for now and documented rationale (currently used by task application service and execution worker runtime adapter).
3. ✅ `lib/db/transactions.ts`: reviewed consumer footprint (no active consumers); kept as shared utility for future transactional orchestration.
4. Fix pre-existing repo-wide TS/test issues after migration (not introduced by Phase 12 work).
5. Re-run verification before any new merge:
   - `npx eslint workers/execution-worker.ts lib/queue/autonomous-flow.ts lib/workers/events.ts`
   - `npx tsc --noEmit --pretty false`
   - targeted `vitest` once local DB is available.
6. Continue strict test migration in backend order:
   - `__tests__/task/task-service.test.ts`
   - `__tests__/execution/execution-service.test.ts`
   - integration API suites under `__tests__/integration/api/**`

## ✅ Priority 1: Wire Application Services to Repositories (COMPLETE)

**Completed:** 2026-02-06
**Effort:** 2 hours (2-3 hours estimated)

All application services now properly delegate to their infrastructure repositories:

- ✅ **Analytics**: Wired ActivityRepository, replaced db.insert/delete with repository methods
- ✅ **Billing**: Wired UsageRepository, added recordUsage/getEstimatedCost methods
- ✅ **Repository**: Already wired (uses RepositoryRepository throughout)
- ✅ **IAM**: Already wired (uses UserRepository throughout)

Commits: 414ec8c, 3b2083f

---

### Analytics Context (ARCHIVED)

**File:** `lib/contexts/analytics/application/analytics-service.ts`

Currently: 3+ direct `db.insert()` / `db.query()` calls (lines 52, 76, 150+)
Should: Delegate to `ActivityRepository` and `ActivityStreamRepository`

**Changes needed:**

1. Import repositories from infrastructure layer
2. Replace `db.insert(activities)` with `activityRepo.create(event)`
3. Replace `db.query.activities` with `activityRepo.findByUser(userId)`
4. Wire event subscribers (`event-subscribers.ts` exists but unused)

**Estimated effort:** 2-3 hours

### Billing Context

**File:** `lib/contexts/billing/application/billing-service.ts`

Currently: Direct `db.insert()` and `db.query()` for usage tracking
Should: Delegate to `SubscriptionRepository` and `UsageRepository`

**Changes needed:**

1. Wire `SubscriptionRepository` and `UsageRepository` (staged in infrastructure/)
2. Replace direct queries with repository methods
3. Add event handlers (`event-handlers.ts` exists but unused)

**Estimated effort:** 2-3 hours

### Repository Context

**File:** `lib/contexts/repository/application/repository-service.ts`

Currently: Direct `db.query()` for repo and index operations
Should: Delegate to `RepositoryRepository` and `RepoIndexRepository`

**Changes needed:**

1. Wire repositories (exist in infrastructure/)
2. Replace `db.query.repos` with `repoRepository.findByUser(userId)`
3. Replace direct inserts with `repoRepository.save(aggregate)`

**Estimated effort:** 2-3 hours

### IAM Context

**File:** `lib/contexts/iam/application/user-service.ts`

Currently: Direct `db.query.users`
Should: Delegate to `UserRepository`

**Blockers:**

- Pre-existing TS error: `user-repository.ts` has column mismatches
  - DB columns: `username`, `avatarUrl`
  - Repository maps to: `name`, `image`
- Must fix column mapping before wiring

**Changes needed:**

1. Fix column name mapping in `lib/contexts/iam/infrastructure/user-repository.ts`
2. Wire UserRepository into UserService
3. Replace all `db.query.users` with `userRepo.findById()`, etc.

**Estimated effort:** 3-4 hours (includes fixing TS errors)

## ✅ Priority 2: Add Missing ExecutionService Methods (COMPLETE)

**Completed:** 2026-02-06

Added/used service methods for diff-review flow:

- `getPendingChanges(taskId)`
- `getPendingChangesSummary(executionId)`
- `deletePendingChanges(taskId)`
- `recordCommit(...)`
- `getCommits(executionId)`
- `rollbackCommits(...)`
- `canRollback(executionId)`
- `getTestRunForExecution(executionId)`
- `deleteTestRunsForExecution(executionId)`

These methods now delegate to execution-context infrastructure repositories (`pending-changes-repository`, `commit-repository`, `test-run-repository`).

---

## ✅ Priority 3: Convert Diff/Review Routes (COMPLETE)

**Completed:** 2026-02-06

Migrated routes:

- `app/api/tasks/[taskId]/diff/route.ts`
- `app/api/tasks/[taskId]/diff/approve/route.ts`
- `app/api/tasks/[taskId]/diff/reject/route.ts`
- `app/api/tasks/[taskId]/rollback/route.ts`
- `app/api/tasks/[taskId]/rollback/check/route.ts`

All now call `getExecutionService()` and no longer import legacy diff/commit/test helpers directly.

---

## Priority 4: Absorb Legacy Backend Internals (IN PROGRESS)

Execution helper absorption is complete. Worker/queue migration progress:

| File                           | Scope                                  | Target Context                |
| ------------------------------ | -------------------------------------- | ----------------------------- |
| `workers/execution-worker.ts`  | execution orchestration + state writes | Execution/Task infrastructure |
| `lib/queue/autonomous-flow.ts` | autonomous brainstorm/plan queue flow  | Task/Execution services       |
| `lib/workers/events.ts`        | processing/recovery persistence        | Task application service      |
| `status-history.ts`            | status history append helper           | Task infrastructure           |
| `transactions.ts`              | shared tx helpers                      | keep shared (or inline)       |

**Status:**

1. ✅ `lib/queue/autonomous-flow.ts` migrated to `TaskService`/`RepositoryService`/`ExecutionService`/`UserService`
2. ✅ `lib/workers/events.ts` task persistence delegated to `TaskService`
3. ✅ `workers/execution-worker.ts` removed direct `lib/db` imports and now uses context services for user/task/repo/execution lookups
4. ✅ `taskDependencies` reads and `activityEvents` writes moved behind `TaskService` + `AnalyticsService` in `workers/execution-worker.ts`
5. ✅ Final task/execution/worker-job update/insert mutations in `workers/execution-worker.ts` now route through dedicated execution infrastructure helper methods
6. ✅ `status-history.ts` kept shared with explicit rationale (cross-context helper used by task + execution internals)
7. ✅ `transactions.ts` reviewed and kept shared; no current consumers to inline

**Estimated effort remaining:** 1-2 hours

## Priority 5: Fix Pre-existing TS Errors (LOW)

| File                         | Error                                | Fix                                                   |
| ---------------------------- | ------------------------------------ | ----------------------------------------------------- | --------------------- |
| `user-repository.ts`         | Column mismatches                    | ✅ Resolved (`username` / `avatarUrl` mapping)        |
| `lib/shared/graph-layout.ts` | Graph edge field mismatch            | ✅ Resolved (use `source` / `target`)                 |
| `lib/ralph/loop.ts`          | Missing skill fields                 | ✅ Resolved (`SkillResult[]` now includes full shape) |
| `lib/skills/enforcement.ts`  | `skillExecutions` type mismatch      | ✅ Resolved (typed `skillExecutions` persistence)     |
| `navigation.ts`              | next-intl API change                 | ✅ Resolved (`createNavigation`)                      |
| `lib/workers/events.ts`      | `recovering` processing phase typing | ✅ Resolved (explicit `ProcessingPhase                | "recovering"` record) |

**Estimated effort:** 2-3 hours

## Completion Criteria

✅ All service methods delegate to repositories (0 direct `db.*` calls in application layer)
✅ All API routes use `get*Service()`/use-cases (0 `app/api/**` routes import `@/lib/db`)
✅ Legacy helpers absorbed into contexts or deleted
✅ Pre-existing TS errors resolved
✅ Domain events published from all 6 contexts

**Total estimated effort:** 18-24 hours
