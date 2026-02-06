# Architecture Migration Master Plan (Clean Architecture + EDA + SSR)

Date: 2026-02-06  
Scope: Repo-wide strict  
Status: Approved for execution

## Summary

This plan consolidates the three architecture gap reports into one execution sequence:

1. Restore EDA correctness first (runtime lifecycle and event contract).
2. Complete clean architecture boundary enforcement (application/services/routes/pages).
3. Align SSR implementation with server-first App Router guidance.

Detailed gap reports:

- `docs/architecture/2026-02-06-clean-architecture-gap-report.md`
- `docs/architecture/2026-02-06-eda-gap-report.md`
- `docs/architecture/2026-02-06-ssr-gap-report.md`

## Objectives

1. Remove cross-layer leaks so domain/application layers are infrastructure-agnostic.
2. Make domain events a reliable and primary integration mechanism.
3. Improve SSR behavior for dashboard routes with server-first data loading and clear streaming/error boundaries.

## Public API / Interface / Type Changes

1. Domain events

- Add canonical event taxonomy constants: `lib/contexts/domain-events/event-taxonomy.ts`
- Canonical key format: `<Aggregate>.<Action>` (example: `Execution.Completed`)
- Keep legacy compatibility map for migration window

2. Context read facades for server pages

- `lib/contexts/dashboard/api/index.ts`
- `lib/contexts/settings/api/index.ts`
- `lib/contexts/activity/api/index.ts`

3. Application-layer ports

- Add command/query ports for task, execution, iam, repository application layers
- Move persistence concerns to infrastructure implementations only

4. DTO types

- Introduce context-owned DTOs for routes/pages
- Remove route/page dependence on `@/lib/db/schema` where feasible

## Workstreams And Sequence

### Workstream A - EDA Correctness (Priority P0)

#### A1. Runtime lifecycle

Files:

- Create: `lib/contexts/domain-events/runtime.ts`
- Modify: `app/layout.tsx`
- Modify: `workers/execution-worker.ts`

Actions:

- Implement explicit `start/stop` orchestration for subscriber loop.
- Ensure one consumer role owns side-effect subscribers.

Acceptance:

- Subscriber loop starts exactly once per designated consumer process.

#### A2. Event contract migration

Files:

- Create: `lib/contexts/domain-events/event-taxonomy.ts`
- Modify: `lib/contexts/task/adapters/services/EventPublisherAdapter.ts`
- Modify: `lib/contexts/billing/infrastructure/event-handlers.ts`
- Modify: `lib/contexts/analytics/infrastructure/event-subscribers.ts`

Actions:

- Publish canonical event names.
- Subscribe through shared constants and compatibility aliases.

Acceptance:

- Billing receives execution-completed events through canonical contract.

#### A3. Side-effect dedup and reliability

Files:

- Modify: `lib/contexts/domain-events/event-publisher.ts`
- Modify: `lib/contexts/domain-events/event-subscriber.ts`

Actions:

- Add idempotency strategy/inbox contract for subscribers.
- Introduce retry/dead-letter policy for publish/persist failures.

Acceptance:

- Duplicate delivery does not duplicate billing/analytics side effects.

### Workstream B - Clean Architecture Completion (Priority P1)

#### B1. Boundary lint rules

Files:

- Modify: `eslint.config.mjs`
- Create: `docs/architecture/BOUNDARY_RULES.md`

Actions:

- Block direct `@/lib/db` imports from application/page/route layers (outside infrastructure).

Acceptance:

- Static scan fails on new boundary violations.

#### B2. Server-page facade migration

Files:

- Modify: `app/(dashboard)/layout.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `app/(dashboard)/repositories/page.tsx`
- Modify: `app/(dashboard)/settings/layout.tsx`
- Modify: `app/(dashboard)/activity/[id]/page.tsx`
- Create: `lib/contexts/dashboard/api/index.ts`
- Create: `lib/contexts/settings/api/index.ts`
- Create: `lib/contexts/activity/api/index.ts`

Actions:

- Replace direct DB queries with context read facades and DTOs.

Acceptance:

- No direct DB imports in server-rendered dashboard pages/layouts.

#### B3. Application service port refactor

Files:

- Modify: `lib/contexts/task/application/task-service.ts`
- Modify: `lib/contexts/execution/application/execution-service.ts`
- Modify: `lib/contexts/iam/application/user-service.ts`
- Modify: `lib/contexts/repository/application/repository-service.ts`
- Create or modify infrastructure repositories under each context

Actions:

- Move all persistence calls from application layer into infrastructure adapters behind interfaces.

Acceptance:

- Application services have zero direct DB imports.

#### B4. Route orchestration consistency

Files:

- Modify: `app/api/tasks/[taskId]/route.ts`
- Modify: `app/api/tasks/[taskId]/plan/start/route.ts`
- Modify: `app/api/tasks/[taskId]/brainstorm/start/route.ts`

Actions:

- Keep route-level validation.
- Move state transitions and side effects into use-cases only.

Acceptance:

- Routes no longer mix use-case orchestration with direct service mutation helpers.

### Workstream C - SSR Alignment (Priority P2)

#### C1. Server-first route entries

Files:

- Modify: `app/(dashboard)/analytics/page.tsx`
- Modify: `app/(dashboard)/activity/active/page.tsx`
- Modify: `app/(dashboard)/activity/history/page.tsx`
- Modify: `app/(dashboard)/activity/failed/page.tsx`
- Modify: `app/(dashboard)/settings/connections/page.tsx`

Actions:

- Convert to server-rendered page entries with client islands for interactive parts.

Acceptance:

- Initial dashboard content is server-rendered before hydration.

#### C2. Streaming/error boundaries

Files:

- Create: `app/(dashboard)/activity/loading.tsx`
- Create: `app/(dashboard)/activity/error.tsx`
- Create: `app/(dashboard)/settings/loading.tsx`
- Create: `app/(dashboard)/settings/error.tsx`
- Create: `app/(dashboard)/analytics/error.tsx`

Actions:

- Add consistent loading and error isolation at route-group boundaries.

Acceptance:

- Data-heavy routes have deterministic loading/error UI behavior.

#### C3. Cache policy contract

Files:

- Create: `docs/architecture/SSR-CACHE-POLICY.md`
- Modify route handlers/pages where needed

Actions:

- Explicitly define freshness and invalidation rules for each dashboard data source.

Acceptance:

- Every major data route documents and enforces cache/revalidate behavior.

## Test Plan

### EDA tests

1. Subscriber lifecycle integration test.
2. Event-contract compatibility test (canonical + legacy mapping).
3. Billing and analytics idempotency tests.
4. Replay test from persisted domain events.

### Clean architecture tests

1. Boundary import static checks.
2. Route integration tests for task lifecycle transitions and rollback behavior.
3. Context service tests with mocked ports.

### SSR tests

1. Route render-mode audit test.
2. Loading and error boundary behavior tests.
3. Initial render data availability checks for dashboard routes.
4. Performance regression checks (first paint/hydration baseline).

## Rollout And Risk Controls

1. Feature-flag new EDA consumer runtime and canonical event names.
2. Deploy in stages:

- Stage 1: lifecycle + compatibility
- Stage 2: clean architecture service/page migration
- Stage 3: SSR route conversion

3. Monitor:

- event processing lag
- duplicate side effects
- dashboard render latency
- route error rate

4. Keep rollback path per stage:

- revert consumer role changes
- revert route-level facade swaps
- fallback to existing client-fetch pages if severe regression occurs

## Assumptions And Defaults

1. Repo-wide strict scope is mandatory for migration completion.
2. App Router remains the rendering framework.
3. Existing bounded contexts remain; this plan does not introduce microservices.
4. Domain event persistence table (`domain_events`) remains the audit/replay source.
5. Legacy event keys are supported only during a temporary compatibility window.

## Completion Criteria

Migration is complete only when all are true:

1. EDA:

- subscriber lifecycle is correct
- canonical event taxonomy is active
- side effects are idempotent and non-duplicated across processes

2. Clean architecture:

- no direct DB imports outside infrastructure in scoped layers
- routes/pages consume context APIs

3. SSR:

- server-first data loading for dashboard routes
- loading/error boundaries present for major route groups
- cache policy documented and enforced
