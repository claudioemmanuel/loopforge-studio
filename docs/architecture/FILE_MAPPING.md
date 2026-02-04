# File Mapping: Current Codebase → Bounded Contexts

This document maps the current codebase structure to the new DDD bounded contexts.

## Overview

Each file in the current codebase belongs to one of the 5 core bounded contexts or the Analytics cross-cutting concern.

---

## Context 1: Identity & Access Management (IAM)

### Current Files → New Location

| Current File                            | New Location                                         | Status        |
| --------------------------------------- | ---------------------------------------------------- | ------------- |
| `lib/api/helpers.ts` (auth functions)   | `lib/contexts/iam/application/user-service.ts`       | **REFACTOR**  |
| `lib/crypto/index.ts`                   | `lib/contexts/iam/infrastructure/crypto.ts`          | **MOVE**      |
| `lib/db/schema/tables.ts` (users table) | `lib/contexts/iam/infrastructure/user-repository.ts` | **EXTRACT**   |
| `app/(auth)/login/page.tsx`             | Keep as-is (UI layer)                                | **NO CHANGE** |
| `app/(auth)/onboarding/page.tsx`        | Keep as-is (UI layer)                                | **NO CHANGE** |
| `app/api/auth/[...nextauth]/route.ts`   | Keep as-is (NextAuth.js)                             | **NO CHANGE** |

### New Files to Create

| File                                                 | Purpose                          |
| ---------------------------------------------------- | -------------------------------- |
| `lib/contexts/iam/domain/user-aggregate.ts`          | User aggregate root              |
| `lib/contexts/iam/domain/events.ts`                  | IAM domain events                |
| `lib/contexts/iam/application/user-service.ts`       | User application service         |
| `lib/contexts/iam/infrastructure/user-repository.ts` | Database access layer            |
| `lib/contexts/iam/api/index.ts`                      | Public API (backward compatible) |

---

## Context 2: Repository Management

### Current Files → New Location

| Current File                                 | New Location                                                      | Status                          |
| -------------------------------------------- | ----------------------------------------------------------------- | ------------------------------- |
| `lib/github/index.ts`                        | `lib/contexts/repository/infrastructure/github-client.ts`         | **MOVE**                        |
| `lib/github/repo-scanner.ts`                 | `lib/contexts/repository/application/indexing-service.ts`         | **MOVE**                        |
| `lib/db/schema/tables.ts` (repos table)      | `lib/contexts/repository/infrastructure/repository-repository.ts` | **EXTRACT**                     |
| `lib/db/schema/tables.ts` (repo_index table) | `lib/contexts/repository/infrastructure/repository-repository.ts` | **EXTRACT**                     |
| `app/api/repos/[repoId]/route.ts`            | Keep as-is (API route)                                            | **REFACTOR** (call context API) |
| `app/api/repos/[repoId]/clone/route.ts`      | Keep as-is (API route)                                            | **REFACTOR** (call context API) |
| `app/api/repos/[repoId]/index/route.ts`      | Keep as-is (API route)                                            | **REFACTOR** (call context API) |

### New Files to Create

| File                                                              | Purpose                              |
| ----------------------------------------------------------------- | ------------------------------------ |
| `lib/contexts/repository/domain/repository-aggregate.ts`          | Repository aggregate root            |
| `lib/contexts/repository/domain/repo-index-aggregate.ts`          | Repository index aggregate           |
| `lib/contexts/repository/domain/events.ts`                        | Repository domain events             |
| `lib/contexts/repository/application/repository-service.ts`       | Repository application service       |
| `lib/contexts/repository/application/indexing-service.ts`         | Indexing service (from repo-scanner) |
| `lib/contexts/repository/infrastructure/repository-repository.ts` | Database access layer                |

---

## Context 3: Task Orchestration & Workflow

### Current Files → New Location

| Current File                                        | New Location                                          | Status                          |
| --------------------------------------------------- | ----------------------------------------------------- | ------------------------------- |
| `lib/db/schema/tables.ts` (tasks table)             | `lib/contexts/task/infrastructure/task-repository.ts` | **EXTRACT**                     |
| `lib/db/schema/tables.ts` (task_dependencies table) | `lib/contexts/task/infrastructure/task-repository.ts` | **EXTRACT**                     |
| `lib/queue/brainstorm-queue.ts`                     | Keep location, refactor to use events                 | **REFACTOR**                    |
| `lib/queue/plan-queue.ts`                           | Keep location, refactor to use events                 | **REFACTOR**                    |
| `lib/queue/execution-queue.ts`                      | Keep location, refactor to use events                 | **REFACTOR**                    |
| `app/api/tasks/route.ts`                            | Keep as-is (API route)                                | **REFACTOR** (call context API) |
| `app/api/tasks/[taskId]/route.ts`                   | Keep as-is (API route)                                | **REFACTOR** (call context API) |
| `app/api/tasks/[taskId]/brainstorm/route.ts`        | Keep as-is (API route)                                | **REFACTOR** (call context API) |
| `app/api/tasks/[taskId]/plan/route.ts`              | Keep as-is (API route)                                | **REFACTOR** (call context API) |
| `app/api/tasks/[taskId]/execute/route.ts`           | Keep as-is (API route)                                | **REFACTOR** (call context API) |

### New Files to Create

| File                                                     | Purpose                             |
| -------------------------------------------------------- | ----------------------------------- |
| `lib/contexts/task/domain/task-aggregate.ts`             | Task aggregate root (state machine) |
| `lib/contexts/task/domain/dependency-graph.ts`           | Dependency graph aggregate          |
| `lib/contexts/task/domain/events.ts`                     | Task domain events                  |
| `lib/contexts/task/application/task-service.ts`          | Task application service            |
| `lib/contexts/task/application/workflow-orchestrator.ts` | Autonomous flow logic               |
| `lib/contexts/task/infrastructure/task-repository.ts`    | Database access layer               |

---

## Context 4: AI Execution & Code Generation

### Current Files → New Location

| Current File                                       | New Location                                                    | Status                      |
| -------------------------------------------------- | --------------------------------------------------------------- | --------------------------- |
| `lib/ralph/loop.ts` (684 lines)                    | `lib/contexts/execution/domain/execution-aggregate.ts`          | **MIGRATE**                 |
| `lib/ralph/prompt-generator.ts`                    | `lib/contexts/execution/domain/execution-aggregate.ts`          | **MERGE**                   |
| `lib/ralph/types.ts`                               | `lib/contexts/execution/domain/types.ts`                        | **MOVE**                    |
| `lib/ralph/smart-extractor.ts` (754 lines)         | `lib/contexts/execution/application/extraction-service.ts`      | **MIGRATE**                 |
| `lib/ralph/recovery-strategies.ts` (473 lines)     | `lib/contexts/execution/application/recovery-service.ts`        | **MIGRATE**                 |
| `lib/ralph/completion-validator.ts`                | `lib/contexts/execution/application/validation-service.ts`      | **MOVE**                    |
| `lib/ralph/stuck-detector.ts`                      | `lib/contexts/execution/domain/execution-aggregate.ts`          | **MERGE**                   |
| `lib/ralph/test-gate.ts`                           | `lib/contexts/execution/application/test-gate-service.ts`       | **MOVE**                    |
| `lib/skills/index.ts`                              | `lib/contexts/execution/application/skills-service.ts`          | **MOVE**                    |
| `lib/skills/core/`                                 | `lib/contexts/execution/domain/skills/core/`                    | **MOVE**                    |
| `lib/skills/loopforge/`                            | `lib/contexts/execution/domain/skills/loopforge/`               | **MOVE**                    |
| `lib/db/schema/tables.ts` (executions table)       | `lib/contexts/execution/infrastructure/execution-repository.ts` | **EXTRACT**                 |
| `lib/db/schema/tables.ts` (execution_events table) | `lib/contexts/execution/infrastructure/execution-repository.ts` | **EXTRACT**                 |
| `workers/execution-worker.ts`                      | Keep location                                                   | **REFACTOR** (thin wrapper) |

### New Files to Create

| File                                                            | Purpose                               |
| --------------------------------------------------------------- | ------------------------------------- |
| `lib/contexts/execution/domain/execution-aggregate.ts`          | Execution aggregate root (Ralph loop) |
| `lib/contexts/execution/domain/recovery-state.ts`               | Recovery state aggregate              |
| `lib/contexts/execution/domain/validation-report.ts`            | Validation report aggregate           |
| `lib/contexts/execution/domain/events.ts`                       | Execution domain events               |
| `lib/contexts/execution/application/extraction-service.ts`      | File extraction service               |
| `lib/contexts/execution/application/recovery-service.ts`        | Recovery strategies service           |
| `lib/contexts/execution/application/validation-service.ts`      | Completion validation service         |
| `lib/contexts/execution/application/skills-service.ts`          | Skills framework integration          |
| `lib/contexts/execution/infrastructure/execution-repository.ts` | Database access layer                 |
| `lib/contexts/execution/infrastructure/github-operations.ts`    | Git operations                        |

---

## Context 5: Usage & Billing

### Current Files → New Location

| Current File                                         | New Location                                                     | Status      |
| ---------------------------------------------------- | ---------------------------------------------------------------- | ----------- |
| `lib/db/schema/tables.ts` (billing columns in users) | `lib/contexts/billing/infrastructure/subscription-repository.ts` | **EXTRACT** |
| `lib/api/middleware.ts` (billing checks)             | `lib/contexts/billing/infrastructure/middleware.ts`              | **MOVE**    |

### New Files to Create

| File                                                             | Purpose                                   |
| ---------------------------------------------------------------- | ----------------------------------------- |
| `lib/contexts/billing/domain/subscription-aggregate.ts`          | Subscription aggregate root               |
| `lib/contexts/billing/domain/usage-tracking-aggregate.ts`        | Usage tracking aggregate                  |
| `lib/contexts/billing/domain/events.ts`                          | Billing domain events                     |
| `lib/contexts/billing/application/subscription-service.ts`       | Subscription application service          |
| `lib/contexts/billing/application/usage-service.ts`              | Usage tracking service (event subscriber) |
| `lib/contexts/billing/infrastructure/middleware.ts`              | Anti-Corruption Layer (ACL)               |
| `lib/contexts/billing/infrastructure/stripe-client.ts`           | Stripe integration                        |
| `lib/contexts/billing/infrastructure/subscription-repository.ts` | Database access layer                     |

---

## Context 6: Analytics & Activity

### Current Files → New Location

| Current File                                         | New Location                                                   | Status                          |
| ---------------------------------------------------- | -------------------------------------------------------------- | ------------------------------- |
| `lib/db/schema/tables.ts` (activity_events table)    | `lib/contexts/analytics/infrastructure/activity-repository.ts` | **EXTRACT**                     |
| `lib/db/schema/tables.ts` (activity_summaries table) | `lib/contexts/analytics/infrastructure/activity-repository.ts` | **EXTRACT**                     |
| `lib/workers/events.ts`                              | `lib/contexts/analytics/infrastructure/sse-stream.ts`          | **REFACTOR**                    |
| `app/api/workers/sse/route.ts`                       | Keep as-is (API route)                                         | **REFACTOR** (call context API) |

### New Files to Create

| File                                                           | Purpose                        |
| -------------------------------------------------------------- | ------------------------------ |
| `lib/contexts/analytics/domain/activity-stream.ts`             | Activity stream aggregate      |
| `lib/contexts/analytics/domain/events.ts`                      | Analytics domain events        |
| `lib/contexts/analytics/application/event-aggregator.ts`       | Event aggregation service      |
| `lib/contexts/analytics/infrastructure/event-subscribers.ts`   | Subscribe to all domain events |
| `lib/contexts/analytics/infrastructure/sse-stream.ts`          | Server-Sent Events streaming   |
| `lib/contexts/analytics/infrastructure/activity-repository.ts` | Database access layer          |

---

## Cross-Cutting: Domain Events

### New Files (Infrastructure)

| File                                             | Purpose                             |
| ------------------------------------------------ | ----------------------------------- | ---------- |
| `lib/contexts/domain-events/types.ts`            | Domain event types                  | ✅ CREATED |
| `lib/contexts/domain-events/event-publisher.ts`  | Event publisher (Redis Pub/Sub)     | ✅ CREATED |
| `lib/contexts/domain-events/event-subscriber.ts` | Event subscriber (pattern matching) | ✅ CREATED |
| `lib/contexts/domain-events/index.ts`            | Barrel exports                      | ✅ CREATED |

---

## Shared Utilities (Keep as-is)

| File                 | Purpose                   | Status                               |
| -------------------- | ------------------------- | ------------------------------------ |
| `lib/ai/client.ts`   | AI client factory         | **NO CHANGE** (used by all contexts) |
| `lib/ai/clients/`    | Provider-specific clients | **NO CHANGE**                        |
| `lib/errors/`        | Error handling utilities  | **NO CHANGE**                        |
| `lib/db/index.ts`    | Database connection       | **NO CHANGE**                        |
| `lib/queue/index.ts` | Queue setup               | **NO CHANGE**                        |

---

## Migration Status Legend

| Status         | Meaning                                           |
| -------------- | ------------------------------------------------- |
| ✅ **CREATED** | File created                                      |
| **MOVE**       | Move file to new location without changes         |
| **REFACTOR**   | Refactor file to use context APIs                 |
| **MIGRATE**    | Large refactoring, break into aggregates/services |
| **EXTRACT**    | Extract subset from existing file                 |
| **MERGE**      | Merge into another file                           |
| **NO CHANGE**  | Keep as-is                                        |

---

## Next Steps

1. ✅ Phase 0: Infrastructure Setup (domain events) - **COMPLETED**
2. ⬜ Phase 1: Extract IAM context module
3. ⬜ Phase 2: Extract Repository Management context
4. ⬜ Phase 3: Extract Task Orchestration context
5. ⬜ Phase 4: Extract AI Execution context
6. ⬜ Phase 5: Extract Billing context
7. ⬜ Phase 6: Extract Analytics context

---

## References

- [Bounded Contexts](./BOUNDED_CONTEXTS.md)
- [DDD Architecture Design Plan](../../PLAN.md)
