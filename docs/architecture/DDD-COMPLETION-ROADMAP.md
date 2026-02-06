# DDD Migration Completion Roadmap

> Current state: ~95% complete
> All 6 contexts: WIRED ✅
> Service-to-repository layer complete ✅
> Diff/review routes migrated to `ExecutionService` ✅
> All API routes migrated off direct `@/lib/db` imports ✅
> Worker/queue backend internals migrated to context services/adapters ✅
> Next: finish remaining worker orchestration persistence extraction and resolve pre-existing TypeScript errors

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
5. ⏳ Remaining: move final task/execution/worker-job update mutations in `workers/execution-worker.ts` behind dedicated context service/repository methods
6. ⏳ Move `status-history.ts` into `lib/contexts/task/infrastructure/` (or keep justified shared)
7. ⏳ Keep `transactions.ts` shared utility (or inline into repositories where beneficial)

**Estimated effort remaining:** 1-2 hours

## Priority 5: Fix Pre-existing TS Errors (LOW)

| File                  | Error                   | Fix                                           |
| --------------------- | ----------------------- | --------------------------------------------- |
| `user-repository.ts`  | Column mismatches       | Rename `name`→`username`, `image`→`avatarUrl` |
| `lib/graph/layout.ts` | Missing edge properties | Add `.from` and `.to` to `GraphEdge` type     |
| `lib/ralph/loop.ts`   | Missing skill fields    | Add `message`, `timestamp` to `SkillResult[]` |

**Estimated effort:** 2-3 hours

## Completion Criteria

✅ All service methods delegate to repositories (0 direct `db.*` calls in application layer)
✅ All API routes use `get*Service()`/use-cases (0 `app/api/**` routes import `@/lib/db`)
✅ Legacy helpers absorbed into contexts or deleted
✅ Pre-existing TS errors resolved
✅ Domain events published from all 6 contexts

**Total estimated effort:** 18-24 hours
