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
