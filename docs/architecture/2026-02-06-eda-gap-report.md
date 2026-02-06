# Event-Driven Architecture Gap Report

Date: 2026-02-06  
Status: Not fully migrated

## Scope

This report evaluates whether domain events are the primary cross-context integration mechanism across:

- `lib/contexts/domain-events/**`
- runtime initialization paths (`app/layout.tsx`, `workers/execution-worker.ts`)
- cross-context consumers in billing/analytics/worker orchestration

## Executive Verdict

Event infrastructure exists (publisher, subscriber, event table), but current runtime behavior does not satisfy a robust EDA baseline. Critical lifecycle and contract inconsistencies remain.

## Evidence Snapshot

### Domain event infrastructure exists

- Event persistence + Redis publish:
  - `lib/contexts/domain-events/event-publisher.ts:36`
  - `lib/contexts/domain-events/event-publisher.ts:65`
  - `lib/contexts/domain-events/event-publisher.ts:86`
- Subscriber supports registration and wildcard matching:
  - `lib/contexts/domain-events/event-subscriber.ts:38`
  - `lib/contexts/domain-events/event-subscriber.ts:83`
  - `lib/contexts/domain-events/event-subscriber.ts:167`

### Runtime bootstraps register handlers but do not start subscriber loop

- Web process startup:
  - `app/layout.tsx:10`
  - `app/layout.tsx:11`
- Worker process startup:
  - `workers/execution-worker.ts:88`
  - `workers/execution-worker.ts:89`
- Handler startup only calls `subscribe(...)`, not `subscriber.start()`:
  - `lib/contexts/analytics/infrastructure/event-subscribers.ts:32`
  - `lib/contexts/analytics/infrastructure/event-subscribers.ts:44`
  - `lib/contexts/billing/infrastructure/event-handlers.ts:28`
  - `lib/contexts/billing/infrastructure/event-handlers.ts:30`

### Event naming/contract inconsistency exists

- Global event contract examples are non-namespaced:
  - `lib/contexts/domain-events/types.ts:15` (`UserRegistered`, `TaskCreated`)
  - `lib/contexts/execution/domain/events.ts:137` (`ExecutionCompleted`)
  - `lib/contexts/task/entities/events/index.ts:80` (`ExecutionCompleted`)
- Billing subscribes to namespaced key that is not emitted:
  - `lib/contexts/billing/infrastructure/event-handlers.ts:31` (`Execution.ExecutionCompleted`)

### Cross-context behavior is still often synchronous and service-driven

- Direct orchestration in worker:
  - `workers/execution-worker.ts:600` (`handleCascadingFailure`)
  - `workers/execution-worker.ts:662` (`handleTaskOrchestration`)
- Side-channel event streams for UI bypass domain-event bus:
  - `lib/workers/events.ts:102`
  - `lib/workers/events.ts:108`
  - `lib/workers/events.ts:394`
  - `lib/workers/events.ts:408`

## Gap Matrix

| ID     | Gap                                            | Evidence                                                                                        | Impact                                                                        | Target                                                                                              |
| ------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| EDA-01 | Subscriber lifecycle incomplete                | `event-subscriber.ts:83` defines `start()`, but no call in handler startup paths                | Registered handlers may not consume published events                          | Centralized runtime bootstrap must call `EventSubscriber.start()` exactly once per consumer process |
| EDA-02 | Billing subscription key mismatch              | `event-handlers.ts:31` uses `Execution.ExecutionCompleted`; producers emit `ExecutionCompleted` | Billing usage tracking can miss completion events                             | Canonical event naming and compatibility map                                                        |
| EDA-03 | Duplicate side-effect risk after lifecycle fix | `app/layout.tsx:10` and `workers/execution-worker.ts:88` both initialize handlers               | Multi-process duplicate writes (billing/activity) once subscriber loop starts | Run side-effect subscribers in one dedicated consumer role                                          |
| EDA-04 | EDA not primary orchestration path             | `execution-worker.ts:600`, `execution-worker.ts:662` perform cross-context actions directly     | Tight coupling, hard-to-evolve dependencies                                   | Emit domain events and handle with subscribers/use-cases                                            |
| EDA-05 | Dual event systems increase inconsistency      | `lib/workers/events.ts` publishes `worker-events:*` channels                                    | Multiple contracts and duplicated semantics                                   | Keep UI realtime channel as projection only; domain events remain source of truth                   |
| EDA-06 | Persistence reliability weak                   | `event-publisher.ts:75` logs and continues on persist failure                                   | Event-store gap, reduced replay/audit confidence                              | Outbox/inbox or retry policy with alerting                                                          |
| EDA-07 | Billing stop lifecycle comment is stale        | `event-handlers.ts:119` says unsubscribe unsupported though subscriber has it                   | Maintenance confusion and potential leak                                      | Implement explicit unsubscribe in `stop()`                                                          |

## Required Public Contract Changes

1. Canonical event naming standard:

- `eventType = "<Aggregate>.<Action>"` (example: `Execution.Completed`)

2. Transitional compatibility policy:

- During migration, subscriber matcher accepts both legacy and canonical keys.
- Compatibility window is finite and documented.

3. Runtime role contract:

- `WEB` role: publishes domain events, serves UI.
- `EVENT_CONSUMER` role: subscribes and executes side effects.
- `WORKER` role: publishes and processes jobs; does not run analytics/billing side-effect subscribers.

## Migration Plan (Decision Complete)

### Phase 1 - Lifecycle Correctness

1. Introduce `lib/contexts/domain-events/runtime.ts`:

- owns singleton startup/shutdown
- calls `EventSubscriber.start()`
- tracks initialized state and role ownership

2. Replace ad-hoc handler init calls in:

- `app/layout.tsx`
- `workers/execution-worker.ts`

### Phase 2 - Event Taxonomy Migration

1. Define canonical keys and mapping table in `lib/contexts/domain-events/event-taxonomy.ts`.
2. Update publishers to emit canonical keys.
3. Update subscribers (billing/analytics) to subscribe via taxonomy constants, not hardcoded strings.
4. Add compatibility matcher for legacy keys until all producers are migrated.

### Phase 3 - Side Effect Isolation

1. Move billing and analytics subscribers to dedicated consumer runtime process.
2. Ensure only one consumer group applies side effects to DB.
3. Keep web process free of write-side event consumers.

### Phase 4 - Orchestration Decoupling

1. Replace synchronous cross-context calls in `workers/execution-worker.ts` with domain events for:

- blocker failure notifications
- auto-triggering dependent task execution

2. Implement dedicated handlers/use-cases per event.

### Phase 5 - Reliability Hardening

1. Implement outbox or reliable publish retry policy.
2. Add idempotency keys/inbox checks for subscribers.
3. Add dead-letter queue strategy and replay CLI.

## Acceptance Criteria

1. Startup logs confirm subscriber loop starts exactly once per consumer process.
2. Billing usage record is created from execution completion event in integration tests.
3. No duplicate analytics or billing rows when web + worker + consumer run together.
4. All subscribers use taxonomy constants, not inline event strings.
5. Domain event replay test can rebuild analytics activity projections.

## Validation Tests

1. `event-lifecycle.integration.test.ts`

- verifies `start()` called and events are consumed.

2. `billing-event-contract.integration.test.ts`

- verifies `Execution.Completed` and legacy key mapping.

3. `analytics-idempotency.integration.test.ts`

- duplicate event delivery does not create duplicate side effects.

4. `event-replay.integration.test.ts`

- rebuild activity projection from persisted `domain_events`.
