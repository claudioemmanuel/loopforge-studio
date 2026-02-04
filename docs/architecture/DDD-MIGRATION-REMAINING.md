# DDD Migration – Remaining Work

> **Branch:** `feat/ddd-bounded-contexts`
> **Last updated:** 2026-02-04
> **Resume instruction:** read this file, then run `git log --oneline -5` to see where you left off, then `continue`.

---

## What is done (committed)

| Commit    | What                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `968156c` | Context scaffolding: 6 services, 6 api barrels, domain re-exports                                                                                                   |
| `f39f475` | Batch 1 – tasks/[id] PATCH/DELETE, brainstorm/start, plan/start, user/usage, onboarding, billing checkout import swap. **Deleted** `lib/activity/*`                 |
| `3397dd3` | Batch 2 – analytics, activity/\*, repos/\*, account/delete, user/locale. Extended all 5 services. **Deleted** `lib/api/analytics.ts`, `lib/api/cached-queries.ts`   |
| `bed4033` | Batch 3 – settings/\*, billing/portal-session. Added UserService.updateUserFields, updateLocale                                                                     |
| `7099796` | Batch 4a – workers/[taskId], executions/[id]/events. Added ExecutionService.getExecutionWithOwnership, getExecutionEvents                                           |
| `3169a20` | Batch 5 – brainstorm/route, plan/route, chat, finalize, execution, processing, rollback/\*, diff/reject. Added TaskService.claimProcessingSlot, clearProcessingSlot |
| `7fa4aba` | brainstorm/generate – both autonomous + manual paths migrated                                                                                                       |
| `5386d90` | diff/approve – markCompleted + updateFields + getTaskFull                                                                                                           |
| `ec02b7d` | diff/route GET – getLatestForTask replaces raw executions relation join                                                                                             |

### Services that are fully extended and ready to use

| Service           | Key methods available                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AnalyticsService  | recordActivityEvent, 9 named helpers, 6 dashboard queries, 4 activity-feed queries, deleteUserActivities                                                            |
| BillingService    | checkRepoLimit, checkTaskLimit, recordUsage, getUsageSummary, createCheckoutSession, createPortalSession                                                            |
| RepositoryService | getRepositoryFull, listUserRepositories, connectRepository, findByOwner, updateRepository, deleteRepository, deleteAllByUser                                        |
| TaskService       | getTaskFull, listByRepo, createTask, updateFields, claimProcessingSlot, clearProcessingSlot, deleteTask, verifyOwnership, getIdsByRepoIds, deleteByRepoIds          |
| ExecutionService  | getLatestForTask, listByTask, getById, getExecutionWithOwnership, getExecutionEvents, create, markRunning/Completed/Failed/Stuck, deleteByTaskIds                   |
| UserService       | registerUser, configureProvider, removeProvider, updatePreferences, updateLocale, completeOnboarding, updateSubscription, getUserFull, deleteUser, updateUserFields |

---

## Remaining – intentionally kept as-is

### Routes using lib/domain aggregates (proper DDD – do not regress)

These routes already use `TaskAggregate`, `ExecutionAggregate`, `TaskRepository`, `ExecutionRepository` from `lib/domain`. They are _ahead_ of the service layer and should stay as-is until the aggregates are wired into the services.

| Route               | Why kept                                                                           |
| ------------------- | ---------------------------------------------------------------------------------- |
| `execute`           | Uses TaskAggregate.claimExecution + ExecutionAggregate.createQueued + atomic guard |
| `dependencies`      | Uses TaskAggregate.addDependency / removeDependency + circular-dep detection       |
| `autonomous/resume` | Uses TaskAggregate.claimExecution + queueTaskExecution helper                      |
| `brainstorm/save`   | Uses TaskAggregate.recordBrainstorm + TaskRepository.save                          |

### Routes with heavy infra that stay in-route

| Route             | Why kept                                                           |
| ----------------- | ------------------------------------------------------------------ |
| `brainstorm/init` | Deep AI client + GitHub repo scan + in-memory conversation restore |

### Complex worker routes (deferred – need significant new service methods)

| Route             | Notes                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `workers/route`   | Complex OR query (autonomousMode / processingPhase / stuck); needs listActiveWorkerTasks |
| `workers/sse`     | SSE infrastructure stays in route; only getInitialWorkers query moves to service         |
| `workers/history` | workerJobs + workerEvents pagination with aggregate stats; heavy service extension       |

### Later / low priority

| Route                  | Notes                                                  |
| ---------------------- | ------------------------------------------------------ |
| `billing/webhook`      | Full Stripe event handling is complex – leave for last |
| `user/subscription`    | Complex Drizzle relation query; low-traffic endpoint   |
| `repos/[repoId]/graph` | Depends on dependency-graph domain logic               |

---

## Pre-existing TypeScript errors (NOT caused by this migration – ignore)

- `lib/contexts/*/api/index.ts` — `getRedis` not exported from `@/lib/queue` (4 barrel files)
- `lib/contexts/iam/infrastructure/user-repository.ts` — column name mismatches (`name` vs `username`, `image` vs `avatarUrl`)
- `app/api/webhooks/stripe/route.ts` — `stripe` variable used outside its `try` block
- `__tests__/**` — fixture shape mismatches, missing test-db module paths

---

## Next steps

1. **Wire aggregates into services** – Connect TaskAggregate / ExecutionAggregate into TaskService / ExecutionService so `execute`, `dependencies`, `autonomous/resume`, `brainstorm/save` can route through services
2. **Complex worker routes** – Add listActiveWorkerTasks to TaskService, migrate workers/route; keep SSE shell
3. **Later** – billing/webhook, user/subscription, repos graph
4. **Final** – update `docs/architecture/IMPLEMENTATION_STATUS.md`, delete this file
