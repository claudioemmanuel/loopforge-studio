# DDD Migration Completion Roadmap

> Current state: ~60% complete
> Task + Execution contexts: WIRED ✅
> IAM, Repository, Billing, Analytics: STAGED (not wired)

## Priority 1: Wire Application Services to Repositories (HIGH)

### Analytics Context

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

## Priority 2: Add Missing ExecutionService Methods (MEDIUM)

**5 diff/review routes** need new service methods:

| Method                              | Used By                   | Implementation                   |
| ----------------------------------- | ------------------------- | -------------------------------- |
| `getPendingChanges(taskId)`         | `diff/route.ts`           | Wrap `lib/db/pending-changes.ts` |
| `deletePendingChanges(taskId)`      | `diff/reject/route.ts`    | Wrap helper                      |
| `createCommit(executionId, commit)` | `diff/approve/route.ts`   | Wrap helper                      |
| `getCommits(executionId)`           | `rollback/route.ts`       | Wrap helper                      |
| `canRollback(taskId)`               | `rollback/check/route.ts` | Wrap helper                      |
| `getLatestTestRun(taskId)`          | `diff/route.ts`           | Wrap `test-runs.ts`              |

**Implementation:**

1. Add 6 new methods to `ExecutionService`
2. Each method delegates to existing helpers in `lib/db/`
3. Once wired, helpers become internal to Execution context

**Estimated effort:** 2-3 hours

## Priority 3: Convert Diff/Review Routes (MEDIUM)

**5 routes** still import from `@/lib/db/` helpers:

- `app/api/tasks/[taskId]/diff/route.ts`
- `app/api/tasks/[taskId]/diff/approve/route.ts`
- `app/api/tasks/[taskId]/diff/reject/route.ts`
- `app/api/tasks/[taskId]/rollback/route.ts`
- `app/api/tasks/[taskId]/rollback/check/route.ts`

**Changes:**

1. Import `getExecutionService()` instead of `@/lib/db/*`
2. Call new service methods from Priority 2
3. Remove legacy helper imports

**Estimated effort:** 1-2 hours (after Priority 2 complete)

## Priority 4: Absorb Legacy Infrastructure (LOW)

**29 exported functions in `lib/db/`** that should move into contexts:

| File                   | Functions   | Target Context           |
| ---------------------- | ----------- | ------------------------ |
| `execution-commits.ts` | 6 functions | Execution infrastructure |
| `pending-changes.ts`   | 7 functions | Execution infrastructure |
| `test-runs.ts`         | 4 functions | Execution infrastructure |
| `status-history.ts`    | 1 function  | Task infrastructure      |
| `transactions.ts`      | 6 functions | Keep as shared utility   |

**Implementation:**

1. Move commit/pending/test helpers into `lib/contexts/execution/infrastructure/`
2. Move status-history into `lib/contexts/task/infrastructure/`
3. Keep `transactions.ts` as shared utility (or inline into repositories)
4. Update service imports
5. Delete `lib/db/` helper files

**Estimated effort:** 3-4 hours

## Priority 5: Fix Pre-existing TS Errors (LOW)

| File                          | Error                   | Fix                                            |
| ----------------------------- | ----------------------- | ---------------------------------------------- |
| `user-repository.ts`          | Column mismatches       | Rename `name`→`username`, `image`→`avatarUrl`  |
| `lib/contexts/*/api/index.ts` | `getRedis` not exported | Export from `@/lib/queue` or remove references |
| `lib/graph/layout.ts`         | Missing edge properties | Add `.from` and `.to` to `GraphEdge` type      |
| `lib/ralph/loop.ts`           | Missing skill fields    | Add `message`, `timestamp` to `SkillResult[]`  |

**Estimated effort:** 2-3 hours

## Completion Criteria

✅ All service methods delegate to repositories (0 direct `db.*` calls in application layer)
✅ All routes use `get*Service()` factories (0 routes import `@/lib/db`)
✅ Legacy helpers absorbed into contexts or deleted
✅ Pre-existing TS errors resolved
✅ Domain events published from all 6 contexts

**Total estimated effort:** 15-20 hours
