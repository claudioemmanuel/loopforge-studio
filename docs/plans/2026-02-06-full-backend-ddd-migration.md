# Full Backend DDD Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove remaining direct database access from backend API routes and worker-facing backend handlers by routing all operations through bounded-context application services.

**Architecture:** Expand context application services (Task, Repository, Execution) with missing orchestration/query methods and introduce a Worker monitoring service for operational worker data. Keep route files focused on transport and response-shaping while delegating persistence and ownership checks to services. Preserve existing behavior and API contracts.

**Tech Stack:** Next.js Route Handlers, TypeScript, Drizzle ORM, Redis/BullMQ, existing bounded contexts under `lib/contexts/*`.

### Task 1: Add TaskService application layer implementation

**Files:**

- Create: `lib/contexts/task/application/task-service.ts`
- Modify: `lib/contexts/task/api/index.ts`
- Test: `__tests__/task/task-service.smoke.test.ts`

### Task 2: Extend RepositoryService for onboarding/add/clone orchestration persistence helpers

**Files:**

- Modify: `lib/contexts/repository/application/repository-service.ts`
- Test: `__tests__/repository/repository-service.clone-updates.test.ts`

### Task 3: Add WorkerMonitoringService for worker heartbeat/history/health read-models

**Files:**

- Create: `lib/contexts/execution/application/worker-monitoring-service.ts`
- Modify: `lib/contexts/execution/api/index.ts`

### Task 4: Migrate all remaining direct-DB API routes

**Files:**

- Modify: `app/api/**/route.ts` files still importing `@/lib/db`

### Task 5: Verify and update DDD migration documentation

**Files:**

- Modify: `docs/architecture/DDD-MIGRATION-STATUS.md`
- Modify: `docs/architecture/DDD-COMPLETION-ROADMAP.md`

---

## Execution Handoff (Updated)

### Completed in this run

1. Added Task application service implementation and API factory wiring.
2. Extended Repository service for onboarding/clone lifecycle orchestration.
3. Added WorkerMonitoringService and execution API wiring.
4. Migrated all remaining API routes off direct `@/lib/db` imports.
5. Migrated `lib/queue/autonomous-flow.ts` to context services.
6. Migrated `workers/execution-worker.ts` off direct `lib/db` imports to execution-context persistence adapter + context service lookups.
7. Updated architecture docs to reflect migration status and remaining follow-up.
8. Aligned backend API route tests with current use-case/service contracts and removed `@ts-nocheck`:
   - `__tests__/api/brainstorm-start-route.test.ts`
   - `__tests__/api/plan-start-route.test.ts`
   - `__tests__/api/tasks-get-route.test.ts`
9. Retyped domain event infrastructure tests (removed `@ts-nocheck`):
   - `__tests__/domain-events/event-infrastructure.test.ts`
10. Replaced legacy analytics integration tests with current `AnalyticsService` contract coverage:

- `__tests__/analytics/analytics-service.test.ts`

11. Re-verified compile gate: `npx tsc --noEmit --pretty false` passes.

### Remaining for follow-up session

1. ✅ Move final worker orchestration mutation writes (`tasks`, `executions`, `workerJobs`) behind dedicated context methods.
2. ✅ Keep and document `status-history.ts` as shared helper for current cross-context usage.
3. ✅ Keep `transactions.ts` shared (no active call sites to inline today).
4. Address pre-existing repo-wide TypeScript and test debt unrelated to this migration pass.
5. Continue removing `@ts-nocheck` from backend-centric suites (current remaining in `__tests__`: 29 files).

### Resume commands

- `git checkout main`
- `npx eslint workers/execution-worker.ts lib/queue/autonomous-flow.ts lib/workers/events.ts`
- `npx tsc --noEmit --pretty false`
- `rg -n "from \"@/lib/db\"|from '@/lib/db'|from \"../lib/db\"|from '../lib/db'" app/api lib/queue lib/workers workers -g'*.ts'`
