# Clean Architecture Gap Report (Repo-Wide Strict Scope)

Date: 2026-02-06  
Status: Not fully migrated

## Scope

This report uses the repo-wide strict definition:

- In scope: `app/api/**`, `workers/**`, `lib/queue/**`, `lib/workers/**`, and server-rendered pages/layouts in `app/**`.
- Target rule: no direct `@/lib/db` imports outside infrastructure adapters/repositories.
- Target rule: route handlers and server-rendered pages use context public APIs, not raw persistence APIs.

## Executive Verdict

Clean Architecture migration is strong in backend runtime isolation, but not complete repo-wide. Major boundary leaks remain in server-rendered app pages/layouts and in several application-layer services.

## Evidence Snapshot

### Existing status docs are backend-runtime scoped

- `docs/architecture/DDD-MIGRATION-STATUS.md:9` states completion for "production runtime paths".
- `docs/architecture/DDD-MIGRATION-STATUS.md:24` limits boundary scan to `app/api`, `lib/queue`, `lib/workers`, `workers`.
- `docs/architecture/DDD-COMPLETION-ROADMAP.md:9` states completion for backend runtime paths.

### Server-rendered app pages/layouts still query DB directly

- `app/(dashboard)/layout.tsx:4`
- `app/(dashboard)/layout.tsx:34`
- `app/(dashboard)/dashboard/page.tsx:2`
- `app/(dashboard)/dashboard/page.tsx:41`
- `app/(dashboard)/repositories/page.tsx:2`
- `app/(dashboard)/repositories/page.tsx:30`
- `app/(dashboard)/settings/layout.tsx:3`
- `app/(dashboard)/settings/layout.tsx:20`
- `app/(dashboard)/activity/[id]/page.tsx:3`
- `app/(dashboard)/activity/[id]/page.tsx:31`

### Application-layer services still own persistence details

- `lib/contexts/task/application/task-service.ts:9`
- `lib/contexts/execution/application/execution-service.ts:8`
- `lib/contexts/iam/application/user-service.ts:12`
- `lib/contexts/repository/application/repository-service.ts:141`
- `lib/contexts/repository/application/repository-service.ts:175`

### API routes are partially hybrid (use cases plus direct service updates)

- `app/api/tasks/[taskId]/route.ts:15`
- `app/api/tasks/[taskId]/route.ts:231`
- `app/api/tasks/[taskId]/plan/start/route.ts:11`
- `app/api/tasks/[taskId]/plan/start/route.ts:73`
- `app/api/tasks/[taskId]/brainstorm/start/route.ts:11`
- `app/api/tasks/[taskId]/brainstorm/start/route.ts:94`

## Gap Matrix

| ID    | Gap                                                        | Evidence                                                                                                                                                          | Impact                                                        | Target                                                                        |
| ----- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| CA-01 | Server-rendered pages/layouts bypass context boundaries    | `app/(dashboard)/layout.tsx:4`, `app/(dashboard)/dashboard/page.tsx:2`, `app/(dashboard)/settings/layout.tsx:3`, `app/(dashboard)/activity/[id]/page.tsx:3`       | Domain and persistence coupling leaks into presentation layer | All server-rendered pages/layouts fetch via context read APIs/facades         |
| CA-02 | Application layer includes persistence implementation      | `lib/contexts/task/application/task-service.ts:9`, `lib/contexts/execution/application/execution-service.ts:8`, `lib/contexts/iam/application/user-service.ts:12` | Breaks dependency rule and makes testing/replacement harder   | Application layer depends on ports; infrastructure implements persistence     |
| CA-03 | Repository application service performs DB dynamic imports | `lib/contexts/repository/application/repository-service.ts:141`, `lib/contexts/repository/application/repository-service.ts:256`                                  | Hidden persistence dependency in app service                  | Move reads/writes into `infrastructure/*-repository.ts` ports                 |
| CA-04 | Route handlers use mixed orchestration styles              | `app/api/tasks/[taskId]/route.ts:15`, `app/api/tasks/[taskId]/route.ts:231`                                                                                       | Inconsistent transaction boundaries and behavior drift        | Routes delegate to use-cases only; no direct state mutation helpers in routes |
| CA-05 | Shared typing still tied to DB schema in edges             | `app/api/tasks/[taskId]/route.ts:3`, `app/api/workers/history/route.ts:3`                                                                                         | Leaks persistence schema into transport/presentation          | Introduce context-owned DTO types at `lib/contexts/*/domain/types.ts`         |

## Required Public Interfaces And Type Changes

1. Add read-facade APIs for server-rendered pages:

- `lib/contexts/dashboard/api/index.ts`
- `lib/contexts/settings/api/index.ts`
- `lib/contexts/activity/api/index.ts`

2. Split application services into command/query ports:

- `lib/contexts/task/application/ports/*`
- `lib/contexts/execution/application/ports/*`
- `lib/contexts/iam/application/ports/*`
- `lib/contexts/repository/application/ports/*`

3. Define route-facing DTOs per context:

- `TaskDto`, `ExecutionDto`, `RepositoryDto`, `UserSettingsDto`
- Remove route/page dependency on `@/lib/db/schema` enums except inside infrastructure mappers.

## Migration Plan (Decision Complete)

### Phase 1 - Boundary Contracts

1. Document allowed import graph in `docs/architecture/BOUNDARY_RULES.md`.
2. Add ESLint boundary checks to block `@/lib/db` imports from:

- `app/(dashboard)/**`
- `app/(auth)/**`
- `lib/contexts/*/application/**`
- `app/api/**` (except explicit infrastructure adapters where required)

### Phase 2 - Server Page Read Facades

1. Create dashboard facade and migrate:

- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/repositories/page.tsx`

2. Create settings facade and migrate:

- `app/(dashboard)/settings/layout.tsx`

3. Create activity facade and migrate:

- `app/(dashboard)/activity/[id]/page.tsx`

### Phase 3 - Application Layer Port Refactor

1. Task context:

- move direct DB logic from `lib/contexts/task/application/task-service.ts` into infrastructure repository interfaces/impls.

2. Execution context:

- move direct DB logic from `lib/contexts/execution/application/execution-service.ts`.

3. IAM context:

- move `updateLocale` and `updateUserFields` persistence logic from `lib/contexts/iam/application/user-service.ts`.

4. Repository context:

- remove dynamic DB imports from `lib/contexts/repository/application/repository-service.ts`, use repository/infrastructure ports only.

### Phase 4 - Route Handler Orchestration Consistency

1. Normalize task route flows to use-case orchestration only:

- `app/api/tasks/[taskId]/route.ts`
- `app/api/tasks/[taskId]/plan/start/route.ts`
- `app/api/tasks/[taskId]/brainstorm/start/route.ts`

2. Keep transport validation in route handlers; move state transitions and side effects into use-cases.

### Phase 5 - Type Decoupling

1. Replace direct DB-schema type imports in routes with context DTO types.
2. Add mappers at adapter boundary for enum conversion.

## Acceptance Criteria

1. `rg -n "from ['\\\"]@/lib/db" app/(dashboard) app/(auth) lib/contexts/*/application app/api` returns no non-test findings.
2. Application services have no direct DB imports or dynamic DB imports.
3. Task orchestration routes do not call `taskService.updateFields(...)` directly.
4. Server-rendered pages/layouts fetch through context facade APIs.
5. Architecture boundary tests pass in CI.

## Validation Tests

1. Boundary lint checks (static).
2. Route integration tests for task state transitions:

- optimistic path
- conflict path (already processing)
- rollback path on queue/publish failure

3. Snapshot tests for dashboard/settings/activity server-rendered data payloads via facade DTOs.

## Risks And Mitigations

- Risk: behavior regressions during service port split.
- Mitigation: lock with integration tests before refactor and preserve route contract tests.

- Risk: accidental performance regression in page facades.
- Mitigation: add query benchmarks for dashboard and activity detail fetch paths.
