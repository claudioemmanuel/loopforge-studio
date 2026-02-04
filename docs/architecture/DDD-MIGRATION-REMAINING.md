# DDD Migration – Remaining Work

> **Branch:** `feat/ddd-bounded-contexts`
> **Last updated:** 2026-02-04
> **Resume instruction:** read this file, then run `git log --oneline -5` to see where you left off, then `continue`.

---

## What is done (committed)

| Commit    | What                                                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `968156c` | Context scaffolding: 6 services, 6 api barrels, domain re-exports                                                                                                 |
| `f39f475` | Batch 1 – tasks/[id] PATCH/DELETE, brainstorm/start, plan/start, user/usage, onboarding, billing checkout import swap. **Deleted** `lib/activity/*`               |
| `3397dd3` | Batch 2 – analytics, activity/\*, repos/\*, account/delete, user/locale. Extended all 5 services. **Deleted** `lib/api/analytics.ts`, `lib/api/cached-queries.ts` |

### Services that are fully extended and ready to use

| Service           | Key methods available                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| AnalyticsService  | recordActivityEvent, 9 named helpers, 6 dashboard queries, 4 activity-feed queries, deleteUserActivities                                          |
| BillingService    | checkRepoLimit, checkTaskLimit, recordUsage, getUsageSummary, createCheckoutSession, createPortalSession                                          |
| RepositoryService | getRepositoryFull, listUserRepositories, connectRepository, findByOwner, updateRepository, deleteRepository, deleteAllByUser                      |
| TaskService       | getTaskFull, listByRepo, createTask, updateFields, deleteTask, verifyOwnership, getIdsByRepoIds, deleteByRepoIds                                  |
| ExecutionService  | getLatestForTask, listByTask, getById, create, markRunning/Completed/Failed/Stuck, deleteByTaskIds                                                |
| UserService       | registerUser, configureProvider, removeProvider, updatePreferences, updateLocale, completeOnboarding, updateSubscription, getUserFull, deleteUser |

---

## Remaining routes (38 routes)

### Batch 3 – Quick wins (no new service methods needed)

| Route                           | Target service / method                                          | Notes                           |
| ------------------------------- | ---------------------------------------------------------------- | ------------------------------- |
| `dashboard/stuck-tasks`         | AnalyticsService                                                 | already has all queries         |
| `billing/create-portal-session` | BillingService.createPortalSession                               | method exists                   |
| `settings/provider`             | UserService.configureProvider / removeProvider                   | GET needs getUserProviderConfig |
| `settings/model`                | UserService.configureProvider                                    | update preferredModel only      |
| `settings/api-key`              | UserService.configureProvider / removeProvider                   | key rotation                    |
| `settings/clone-directory`      | UserService.updatePreferences                                    | cloneDirectory field            |
| `settings/test-defaults`        | UserService.updatePreferences                                    | testRunCommand + testGatePolicy |
| `settings/route` (GET)          | UserService.getUserFull + RepositoryService.listUserRepositories | mask keys client-side           |

### Batch 4 – Worker & execution routes (need new ExecutionService methods)

| Route                    | New method needed                         | ~lines |
| ------------------------ | ----------------------------------------- | ------ |
| `workers/health`         | `getWorkerHealth()`                       | 20     |
| `workers/heartbeat`      | `recordWorkerHeartbeat(workerId, status)` | 15     |
| `workers/sse`            | keep SSE shell, swap inner queries only   | –      |
| `executions/[id]/events` | `getExecutionEvents(executionId)`         | 15     |

### Batch 5 – Task orchestration (need new TaskService methods)

| Route                           | New method needed                          | ~lines |
| ------------------------------- | ------------------------------------------ | ------ |
| `brainstorm/route` (POST start) | `claimBrainstormSlot(taskId, jobId)`       | 25     |
| `brainstorm/chat`               | `appendChatMessage(taskId, msg)`           | 15     |
| `brainstorm/init`               | reuse appendChatMessage                    | –      |
| `brainstorm/generate`           | `queueAutonomousFlow(taskId, cfg)`         | 20     |
| `brainstorm/finalize`           | updateFields (exists)                      | –      |
| `brainstorm/save`               | updateFields (exists)                      | –      |
| `plan/route` (POST start)       | `claimPlanningSlot(taskId, jobId)`         | 25     |
| `execute`                       | updateFields + Redis push                  | –      |
| `execution`                     | ExecutionService.getLatestForTask (exists) | –      |
| `processing`                    | TaskService.getTaskFull (exists)           | –      |
| `dependencies`                  | updateFields (exists)                      | –      |
| `diff/route`                    | TaskService.getTaskFull (exists)           | –      |
| `diff/approve`                  | updateFields (exists)                      | –      |
| `diff/reject`                   | updateFields (exists)                      | –      |
| `rollback/route`                | updateFields (exists)                      | –      |
| `rollback/check`                | TaskService.getTaskFull (exists)           | –      |
| `recovery-status`               | ExecutionService.getLatestForTask (exists) | –      |
| `autonomous/resume`             | TaskService.getTaskFull + updateFields     | –      |

### Later / low priority

| Route                  | Notes                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `billing/webhook`      | currently import-path swap only; full Stripe event handling is complex – leave for last |
| `user/subscription`    | complex Drizzle relation query; low-traffic endpoint                                    |
| `repos/[repoId]/graph` | depends on dependency-graph domain logic                                                |

---

## Pre-existing TypeScript errors (NOT caused by this migration – ignore)

- `lib/contexts/*/api/index.ts` — `getRedis` not exported from `@/lib/queue` (4 barrel files)
- `lib/contexts/iam/infrastructure/user-repository.ts` — column name mismatches (`name` vs `username`, `image` vs `avatarUrl`)
- `app/api/webhooks/stripe/route.ts` — `stripe` variable used outside its `try` block
- `__tests__/**` — fixture shape mismatches, missing test-db module paths

---

## Suggested execution order for next session

1. **Batch 3** – settings + stuck-tasks + portal-session (all methods already exist, pure route rewrites)
2. **Batch 4** – extend ExecutionService with 3 methods, then migrate worker routes
3. **Batch 5** – extend TaskService with 4 methods, then migrate orchestration routes
4. **Later** – billing/webhook, user/subscription, repos graph
5. **Final** – update `docs/architecture/IMPLEMENTATION_STATUS.md`, delete this file
