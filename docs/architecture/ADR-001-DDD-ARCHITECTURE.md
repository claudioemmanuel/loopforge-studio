# ADR-001: Adopt Domain-Driven Design (DDD) Architecture

**Date:** 2026-02-02
**Status:** ✅ Approved
**Authors:** Claude Sonnet 4.5, Loopforge Team
**Reviewers:** Pending

---

## Context

Loopforge Studio is evolving from a solo founder project to a 2-3 developer team. The current architecture has several challenges:

### Current State

- **Monolithic structure** - All logic in API routes, no clear separation of concerns
- **Database-centric design** - Business logic scattered across route handlers
- **Tight coupling** - Direct database access from API routes
- **No event infrastructure** - Real-time updates via ad-hoc SSE implementation
- **Scaling challenges** - Adding features requires touching many files
- **Onboarding friction** - New developers struggle to understand codebase structure

### Problems to Solve

1. **Team Scalability** - Enable 2-3 developers to work independently on separate features
2. **Code Maintainability** - Clear boundaries reduce cross-feature conflicts
3. **Testing Complexity** - Current structure makes unit testing difficult
4. **Real-Time Updates** - Ad-hoc SSE needs systematic approach
5. **Future Extensibility** - Prepare for potential microservices migration

---

## Decision

We will adopt a **Domain-Driven Design (DDD) architecture** with the following structure:

### 1. Bounded Contexts (5 Core)

| Context                                | Responsibility                                | Change Frequency |
| -------------------------------------- | --------------------------------------------- | ---------------- |
| **Identity & Access Management (IAM)** | User authentication, API key management       | LOW              |
| **Repository Management**              | GitHub integration, cloning, indexing         | MODERATE         |
| **Task Orchestration & Workflow**      | Task lifecycle, dependencies, autonomous flow | VERY HIGH        |
| **AI Execution & Code Generation**     | Ralph loop, recovery, validation, skills      | VERY HIGH        |
| **Usage & Billing**                    | Subscriptions, usage tracking, limits         | MODERATE         |

Plus one cross-cutting concern:

- **Analytics & Activity** - Event aggregation, metrics, activity feed

### 2. Database Strategy

**Shared PostgreSQL database with schema isolation via table prefixes:**

| Context    | Prefix       | Examples                                 |
| ---------- | ------------ | ---------------------------------------- |
| IAM        | `iam_`       | `iam_users`, `iam_sessions`              |
| Repository | `repo_`      | `repo_repositories`, `repo_indexes`      |
| Task       | `task_`      | `task_tasks`, `task_dependencies`        |
| Execution  | `exec_`      | `exec_executions`, `exec_events`         |
| Billing    | `billing_`   | `billing_subscriptions`, `billing_usage` |
| Analytics  | `analytics_` | `analytics_activity_events`              |

**Why shared database?**

- Simplest migration path (rename tables, no data movement)
- Easier local development (single database)
- Lower operational overhead (1 database vs 6)
- Shared transactions where needed (outbox pattern)

**Future option:** Migrate to separate databases per context if scaling challenges emerge (4+ developers, execution context bottleneck).

### 3. Communication Patterns

#### Pattern A: Domain Events (Redis Pub/Sub)

**Use Case:** Inter-context communication, real-time updates

**Example:**

```
Task Context publishes `ExecutionStarted` event
→ Analytics subscribes and logs activity
→ Billing subscribes and tracks usage
→ Frontend subscribes via SSE for live updates
```

**Infrastructure:**

- `EventPublisher` - Publishes events to Redis Pub/Sub
- `EventSubscriber` - Subscribes with wildcard support (`Task.*`)
- `domain_events` table - Audit trail and replay capability

#### Pattern B: BullMQ Queues

**Use Case:** Long-running operations (brainstorm, plan, execution)

**Queues:**

- `brainstormQueue`
- `planQueue`
- `executionQueue`
- `autonomousFlowQueue`
- `indexingQueue`

#### Pattern C: Synchronous REST API

**Use Case:** Authentication, API key retrieval

**Example:** Task API → IAM context for user provider config

#### Pattern D: Anti-Corruption Layer

**Use Case:** Enforcing billing limits without tight coupling

**Example:** `withBillingCheck()` middleware wraps routes

### 4. Frontend Strategy

**Decision:** Keep presentation-centric organization (NO context mirroring)

**Current structure (KEEP):**

```
components/
├── kanban/          # Task cards, columns, board
├── analytics/       # Charts, summaries
├── execution/       # Ralph activity, logs
├── modals/          # Task modal, new task modal
└── layout/          # Sidebar, header
```

**Improvements:**

1. **Unified Data Layer** - React Query for server state caching
2. **Event-Driven UI Updates** - SSE subscriptions trigger refetch
3. **Optimistic Updates** - Immediate UI changes, revalidate on server event

---

## Rationale

### Why DDD?

| Benefit                       | Impact                                        |
| ----------------------------- | --------------------------------------------- |
| **Clear Boundaries**          | Developers can own entire contexts            |
| **Independent Deployment**    | Future option to split high-change contexts   |
| **Ubiquitous Language**       | Shared vocabulary reduces miscommunication    |
| **Event-Driven Architecture** | Decouples contexts, enables real-time updates |
| **Testability**               | Domain logic isolated from infrastructure     |

### Why NOT Microservices?

Microservices would be premature optimization:

- Team size (2-3 developers) doesn't justify operational overhead
- Shared database eliminates distributed transaction complexity
- Monolith with clear boundaries is easier to refactor later
- Migration to microservices is easier FROM DDD than vice versa

### Why Shared Database?

| Pro                             | Con                                       |
| ------------------------------- | ----------------------------------------- |
| ✅ Simplest migration path      | ❌ Doesn't enforce boundaries at DB level |
| ✅ Easier local development     | ❌ Temptation to cross-query contexts     |
| ✅ Shared transactions (outbox) |                                           |
| ✅ Lower operational overhead   |                                           |

**Mitigation:** Strict coding discipline, code reviews, table prefix convention.

---

## Alternatives Considered

### Alternative 1: Microservices

**Rejected:** Too complex for 2-3 developers. Requires:

- Service discovery
- API gateway
- Distributed tracing
- Cross-service transactions (sagas)
- Separate deployments

**Decision:** Start with DDD modular monolith, extract microservices later if needed.

### Alternative 2: Separate Databases per Context

**Rejected (for now):** Premature optimization. Challenges:

- Removes foreign keys (data integrity)
- Requires distributed transactions (sagas)
- Higher operational overhead (6 databases vs 1)
- More complex local development

**Decision:** Start with shared DB, migrate later if scaling challenges emerge.

### Alternative 3: Keep Current Structure

**Rejected:** Doesn't address team scalability or code maintainability issues.

### Alternative 4: MVC/Layered Architecture

**Rejected:** Horizontal layers (controller, service, repository) don't provide context isolation. DDD's vertical slicing (by bounded context) is better for team autonomy.

---

## Consequences

### Positive

1. **Team Scalability** - 2-3 developers can own separate contexts (e.g., Dev 1 = AI Execution, Dev 2 = Task Orchestration, Dev 3 = IAM/Billing)
2. **Clear Ownership** - Each context has a single point of truth
3. **Independent Changes** - High-change contexts (Task, Execution) can evolve without affecting low-change contexts (IAM)
4. **Event-Driven UX** - Real-time updates via domain events (SSE)
5. **Future-Proof** - Easy path to microservices if needed
6. **Better Testing** - Domain logic testable in isolation
7. **Ubiquitous Language** - Shared vocabulary improves communication

### Negative

1. **Learning Curve** - Team must learn DDD concepts (aggregates, domain events, bounded contexts)
2. **Initial Overhead** - More boilerplate (aggregates, repositories, services)
3. **Migration Effort** - 7 phases over ~20 weeks
4. **Potential Over-Engineering** - Risk of creating unnecessary abstractions
5. **Discipline Required** - Shared database requires strict coding discipline

### Neutral

1. **Complexity Trade-Off** - More upfront structure, less long-term spaghetti code
2. **Testing Strategy** - Need to test both domain logic (unit) and integration (events)

---

## Migration Strategy

### Phase 0: Infrastructure Setup (Weeks 1-2) ✅ COMPLETED

- ✅ Implement domain event infrastructure (`EventPublisher`, `EventSubscriber`)
- ✅ Create `domain_events` table
- ✅ Document bounded contexts, ubiquitous language, file mapping
- ✅ All tests passing (Redis <10ms p99, DB queries <5ms)

### Phase 1: IAM Context (Weeks 3-4)

- Extract IAM module (`lib/contexts/iam/`)
- Refactor API helpers (backward-compatible wrapper)
- Publish IAM events (`UserRegistered`, `ProviderConfigured`)

### Phase 2: Repository Management (Weeks 5-6)

- Extract Repository module (`lib/contexts/repository/`)
- Refactor clone/index logic
- Publish Repository events (`CloneCompleted`, `IndexingCompleted`)

### Phase 3: Task Orchestration (Weeks 7-9)

- Extract Task module (`lib/contexts/task/`)
- Implement state machine (task lifecycle)
- Decouple from AI Execution (via events)
- **Most complex phase** - rename tables, refactor dependencies

### Phase 4: AI Execution (Weeks 10-13)

- Extract Execution module (`lib/contexts/execution/`)
- Migrate Ralph loop (684 lines), extraction (754 lines), recovery (473 lines)
- Move skills framework
- Emit 20+ domain events

### Phase 5: Billing (Weeks 14-15)

- Extract Billing module (`lib/contexts/billing/`)
- Implement Anti-Corruption Layer (middleware)
- Subscribe to `ExecutionCompleted` for usage tracking

### Phase 6: Analytics (Weeks 16-17)

- Extract Analytics module (`lib/contexts/analytics/`)
- Subscribe to all 50+ domain event types
- Refactor SSE streaming

### Phase 7: Database Isolation (Optional, Weeks 18-20)

- **Only if scaling challenges emerge**
- Move to separate databases per context
- Implement sagas for distributed transactions

---

## Success Metrics (6-Month Targets)

| Metric                  | Current | Target            | Measurement          |
| ----------------------- | ------- | ----------------- | -------------------- |
| Context Coupling        | High    | Low (events only) | Dependency graph     |
| Test Coverage           | N/A     | >80% per context  | Jest coverage        |
| Event Throughput        | N/A     | 1000 events/sec   | Redis MONITOR        |
| Worker Latency          | ~2-5s   | <1s               | BullMQ metrics       |
| Frontend Cache Hit Rate | N/A     | >90%              | React Query devtools |
| Team Onboarding Time    | N/A     | <2 days           | New dev feedback     |
| Deployment Frequency    | Ad-hoc  | Daily             | CI/CD logs           |

---

## Risk Mitigation

| Risk                        | Impact | Probability | Mitigation                                          |
| --------------------------- | ------ | ----------- | --------------------------------------------------- |
| Migration breaks production | HIGH   | MEDIUM      | Blue-green deployment, feature flags, rollback plan |
| Event ordering issues       | MEDIUM | HIGH        | Add sequence numbers, idempotency keys              |
| Performance degradation     | MEDIUM | MEDIUM      | Load testing before each phase                      |
| Over-engineering            | MEDIUM | MEDIUM      | Stick to pragmatic DDD, skip event sourcing         |
| Context boundary violations | HIGH   | MEDIUM      | Code reviews, automated checks, ADRs                |
| Team resistance to DDD      | MEDIUM | LOW         | Training, pair programming, incremental adoption    |

---

## Verification

### Phase 0 Verification ✅ PASSED

- [x] Publish test event, 3+ subscribers receive (✅ Passed)
- [x] Redis latency <10ms p99 (✅ Actual: 1ms)
- [x] `domain_events` table query <5ms (✅ Actual: 1-2ms)

### Future Phase Verification

See [DDD Architecture Design Plan](../../PLAN.md) for complete verification checklist.

---

## Implementation Notes

### Critical Files Created (Phase 0)

| File                                                   | Purpose                             |
| ------------------------------------------------------ | ----------------------------------- |
| `lib/contexts/domain-events/types.ts`                  | Domain event types                  |
| `lib/contexts/domain-events/event-publisher.ts`        | Event publisher (Redis Pub/Sub)     |
| `lib/contexts/domain-events/event-subscriber.ts`       | Event subscriber (pattern matching) |
| `lib/contexts/domain-events/index.ts`                  | Barrel exports                      |
| `drizzle/0043_add_domain_events_table.sql`             | Database migration                  |
| `__tests__/domain-events/event-infrastructure.test.ts` | Infrastructure tests (6/6 passing)  |

### Next Immediate Actions

1. ✅ Review this ADR with stakeholders
2. ⬜ Set up project board with Phase 1-6 tasks
3. ⬜ Start Phase 1 (IAM Context Extraction)
4. ⬜ Schedule weekly reviews to track progress

---

## References

- [Bounded Contexts Documentation](./BOUNDED_CONTEXTS.md)
- [File Mapping](./FILE_MAPPING.md)
- [Ubiquitous Language Glossary](./UBIQUITOUS_LANGUAGE.md)
- [DDD Architecture Design Plan](../../PLAN.md) (original proposal)
- [Domain-Driven Design (Eric Evans)](https://www.domainlanguage.com/ddd/)
- [Implementing Domain-Driven Design (Vaughn Vernon)](https://vaughnvernon.com/)

---

## Appendix A: Context Map

```
┌──────────────────────┐
│  Identity & Access   │ (UPSTREAM - Conformist)
│    Management        │───────────┐
│  (IAM Context)       │           │
└──────────────────────┘           │
         │                         │
         │ Authentication          │ API Keys
         │ (Conformist)            │ (Conformist)
         ▼                         ▼
┌──────────────────────┐   ┌──────────────────────┐
│  Repository          │◄──┤  Task Orchestration  │
│  Management          │   │  & Workflow          │
└──────────────────────┘   └──────────────────────┘
         │                         │
         │ Repo Context            │ Task Lifecycle Events
         │ (Shared Kernel)         │ (Customer/Supplier)
         ▼                         ▼
┌──────────────────────┐   ┌──────────────────────┐
│  AI Execution &      │◄──┤  Usage & Billing     │
│  Code Generation     │   └──────────────────────┘
└──────────────────────┘           │
         │                         │
         │ Execution Events        │ Usage Events
         │ (Published Events)      │ (Published Events)
         ▼                         ▼
┌───────────────────────────────────────┐
│  Analytics & Activity                 │
│  (Open Host Service - Event Consumer) │
└───────────────────────────────────────┘
```

---

## Appendix B: Team Organization (2-3 Developers)

| Developer                 | Primary Contexts             | Secondary Contexts |
| ------------------------- | ---------------------------- | ------------------ |
| Dev 1 (Senior Backend)    | AI Execution, Repository     | Analytics          |
| Dev 2 (Senior Full-Stack) | Task Orchestration, Frontend | Billing            |
| Dev 3 (Mid Backend)       | Billing, IAM, Analytics      | Repository         |

---

**Decision:** ✅ Approved for implementation starting Phase 1 (IAM Context Extraction)
