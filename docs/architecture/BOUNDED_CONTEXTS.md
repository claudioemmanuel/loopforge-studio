# Bounded Contexts

This document defines the bounded contexts in Loopforge Studio's Domain-Driven Design (DDD) architecture.

## Overview

Loopforge Studio is organized into **5 core bounded contexts**, each with clear responsibilities and boundaries:

1. **Identity & Access Management (IAM)** - User authentication and API key management
2. **Repository Management** - GitHub integration and repository operations
3. **Task Orchestration & Workflow** - Task lifecycle and dependency management
4. **AI Execution & Code Generation** - Ralph loop and autonomous code generation
5. **Usage & Billing** - Subscription and usage tracking

Additionally, there is a cross-cutting concern:

6. **Analytics & Activity** - Event aggregation and metrics

---

## 1. Identity & Access Management (IAM)

**Purpose:** Manage user identities, authentication, and encrypted provider API keys.

### Ubiquitous Language

| Term | Definition |
|------|------------|
| **User** | An authenticated GitHub user with encrypted provider API keys |
| **Session** | A temporary authentication token (NextAuth.js session) |
| **API Key** | An encrypted provider credential (Anthropic/OpenAI/Gemini) |
| **Provider** | An AI service provider configuration (Anthropic, OpenAI, Google) |

### Aggregates

#### User Aggregate
- **Root:** User
- **Invariants:**
  - Unique GitHub ID
  - At least one configured provider
  - Valid encrypted keys (AES-256-GCM)
- **Operations:**
  - `registerUser()` - Register new user via GitHub OAuth
  - `configureProvider()` - Set provider API key
  - `updatePreferences()` - Update preferred model/provider
  - `revokeProvider()` - Remove provider API key

### Domain Events

- `UserRegistered` - New user signed up via GitHub OAuth
- `ProviderConfigured` - User added/updated provider API key
- `ProviderRemoved` - User removed provider API key
- `SessionExpired` - User session timed out

### File Mapping

| File | Purpose |
|------|---------|
| `lib/contexts/iam/domain/user-aggregate.ts` | User aggregate root |
| `lib/contexts/iam/domain/events.ts` | IAM domain events |
| `lib/contexts/iam/application/user-service.ts` | User application service |
| `lib/contexts/iam/infrastructure/user-repository.ts` | Database access layer |
| `lib/contexts/iam/infrastructure/crypto.ts` | Encryption utilities |
| `lib/contexts/iam/api/index.ts` | Public API (backward compatible) |

### Change Frequency

**LOW** - Stable domain, infrequent changes.

---

## 2. Repository Management

**Purpose:** Connect to GitHub repositories, clone locally, and index codebase metadata.

### Ubiquitous Language

| Term | Definition |
|------|------------|
| **Repository** | A connected GitHub repository with local clone |
| **Clone** | Local git copy with status tracking (pending → cloning → completed → failed) |
| **Index** | Parsed repository metadata (tech stack, symbols, dependencies) |
| **Test Configuration** | Repo-specific test commands, timeouts, gate policies |

### Aggregates

#### Repository Aggregate
- **Root:** Repository
- **Invariants:**
  - Valid GitHub repo ID
  - Clone path exists if cloned
  - Unique per user (user_id + github_repo_id)
- **Operations:**
  - `connectRepo()` - Connect GitHub repository
  - `cloneRepo()` - Clone repository locally
  - `updateClone()` - Pull latest changes
  - `configureTests()` - Set test configuration

#### Repository Index Aggregate
- **Root:** RepoIndex
- **Invariants:**
  - Single index per repository
  - Valid tech stack detected
  - Non-empty file index
- **Operations:**
  - `indexRepo()` - Index repository metadata
  - `updateSymbols()` - Update symbol index
  - `detectEntryPoints()` - Find main entry points

### Domain Events

- `RepositoryConnected` - Repository linked to user account
- `CloneStarted` - Clone operation initiated
- `CloneCompleted` - Clone finished successfully
- `CloneFailed` - Clone failed with error
- `IndexingStarted` - Indexing operation initiated
- `IndexingCompleted` - Indexing finished successfully
- `TestConfigurationUpdated` - Test settings changed

### File Mapping

| File | Purpose |
|------|---------|
| `lib/contexts/repository/domain/repository-aggregate.ts` | Repository aggregate root |
| `lib/contexts/repository/domain/repo-index-aggregate.ts` | Repository index aggregate |
| `lib/contexts/repository/domain/events.ts` | Repository domain events |
| `lib/contexts/repository/application/repository-service.ts` | Repository application service |
| `lib/contexts/repository/application/indexing-service.ts` | Indexing service (from repo-scanner) |
| `lib/contexts/repository/infrastructure/repository-repository.ts` | Database access layer |
| `lib/contexts/repository/infrastructure/github-client.ts` | GitHub API wrapper |

### Change Frequency

**MODERATE** - Occasional changes for new GitHub features.

---

## 3. Task Orchestration & Workflow

**Purpose:** Manage task lifecycle, dependencies, and autonomous workflow progression.

### Ubiquitous Language

| Term | Definition |
|------|------------|
| **Task** | A user-defined work item with status lifecycle |
| **Workflow Phase** | Current processing stage (brainstorming, planning, executing, recovering) |
| **Dependency** | Task dependency relationship (blockedBy) |
| **Autonomous Flow** | Automatic progression through phases without user intervention |
| **Status Transition** | State change with history tracking |

### Task Status Lifecycle

```
todo → brainstorming → planning → ready → executing → review → done
                                                            ↓
                                                          stuck
```

### Aggregates

#### Task Aggregate
- **Root:** Task
- **Invariants:**
  - Valid status transitions (enforced state machine)
  - Processing phase matches status
  - Blocked tasks cannot execute
  - Unique branch per task (`loopforge/task-{id}`)
- **Operations:**
  - `createTask()` - Create new task
  - `startBrainstorm()` - Begin brainstorming phase
  - `completeBrainstorm()` - Finish brainstorming
  - `startPlanning()` - Begin planning phase
  - `approvePlan()` - Approve plan and mark ready
  - `executeTask()` - Start execution
  - `transitionStatus()` - Move to new status
  - `markStuck()` - Mark task as stuck

#### Task Dependency Graph Aggregate
- **Root:** TaskDependencies
- **Invariants:**
  - No circular dependencies (DAG)
  - All blocked tasks reference valid tasks
- **Operations:**
  - `addDependency()` - Add task dependency
  - `removeDependency()` - Remove dependency
  - `checkUnblocked()` - Check if task is unblocked
  - `autoExecuteUnblocked()` - Trigger execution when dependencies resolve

### Domain Events

- `TaskCreated` - New task created
- `TaskStatusChanged` - Task moved to new status
- `BrainstormingStarted` - Brainstorming phase initiated
- `BrainstormingCompleted` - Brainstorming finished
- `PlanningStarted` - Planning phase initiated
- `PlanningCompleted` - Planning finished
- `ExecutionStarted` - Execution phase initiated
- `ExecutionCompleted` - Execution finished successfully
- `ExecutionFailed` - Execution failed with error
- `TaskStuck` - Task marked as stuck
- `TaskUnblocked` - Dependency resolved, task unblocked
- `DependencyAdded` - New dependency relationship created

### File Mapping

| File | Purpose |
|------|---------|
| `lib/contexts/task/domain/task-aggregate.ts` | Task aggregate root (state machine) |
| `lib/contexts/task/domain/dependency-graph.ts` | Dependency graph aggregate |
| `lib/contexts/task/domain/events.ts` | Task domain events |
| `lib/contexts/task/application/task-service.ts` | Task application service |
| `lib/contexts/task/application/workflow-orchestrator.ts` | Autonomous flow logic |
| `lib/contexts/task/infrastructure/task-repository.ts` | Database access layer |
| `lib/queue/brainstorm-queue.ts` | Brainstorming queue (refactored) |
| `lib/queue/plan-queue.ts` | Planning queue (refactored) |

### Change Frequency

**VERY HIGH** - Core workflow logic, frequent changes.

---

## 4. AI Execution & Code Generation

**Purpose:** Execute Ralph loop, extract code, recover from errors, validate completions.

### Ubiquitous Language

| Term | Definition |
|------|------------|
| **Execution** | A Ralph loop run (queued → running → completed/failed) |
| **Iteration** | Single Ralph loop cycle (prompt → response → extraction → commit) |
| **Extraction** | Code parsing from AI output (strict → fuzzy → AI-assisted) |
| **Recovery** | Stuck resolution strategy (format guidance → simplified prompt → context reset → manual fallback) |
| **Validation** | Completion verification (marker + commits + plan matching + quality checks) |
| **Skill** | Best practice enforcement (TDD, debugging, verification) |
| **Stuck Signal** | Reliability indicator (consecutive errors, repeated patterns, timeout, quality degradation) |

### Aggregates

#### Execution Aggregate
- **Root:** Execution
- **Invariants:**
  - Unique branch per execution (`loopforge/task-{taskId}`)
  - Commits tracked in JSONB
  - Valid status transitions
  - Iteration count >= 0
- **Operations:**
  - `startExecution()` - Initialize execution
  - `processIteration()` - Execute single Ralph loop cycle
  - `extractFiles()` - Parse code from AI output
  - `commitChanges()` - Commit changes to GitHub
  - `completeExecution()` - Mark execution complete
  - `markStuck()` - Mark execution stuck

#### Recovery State Aggregate
- **Root:** RecoveryAttempts
- **Invariants:**
  - Max 4 tiers
  - Escalation order enforced (tier 1 → 2 → 3 → 4)
- **Operations:**
  - `attemptRecovery()` - Try recovery strategy
  - `escalateTier()` - Move to next tier
  - `recordAttempt()` - Log recovery attempt

#### Validation Report Aggregate
- **Root:** ValidationReport
- **Invariants:**
  - Score 0-100 (weighted)
  - Passing threshold 80%
  - All criteria evaluated
- **Operations:**
  - `validateCompletion()` - Check completion criteria
  - `scoreCriteria()` - Calculate weighted score
  - `generateReport()` - Create validation report

### Domain Events

- `ExecutionStarted` - Ralph loop initiated
- `IterationCompleted` - Single iteration finished
- `FilesExtracted` - Code extracted from AI output
- `CommitCreated` - Changes committed to GitHub
- `StuckSignalDetected` - Reliability signal triggered
- `RecoveryStarted` - Recovery strategy initiated
- `RecoverySucceeded` - Recovery resolved issue
- `RecoveryFailed` - Recovery unable to resolve
- `CompletionValidated` - Validation checks passed
- `ExecutionCompleted` - Execution finished successfully
- `ExecutionFailed` - Execution failed permanently
- `SkillInvoked` - Skill enforced
- `SkillBlocked` - Skill blocked execution

### File Mapping

| File | Purpose |
|------|---------|
| `lib/contexts/execution/domain/execution-aggregate.ts` | Execution aggregate root (Ralph loop) |
| `lib/contexts/execution/domain/recovery-state.ts` | Recovery state aggregate |
| `lib/contexts/execution/domain/validation-report.ts` | Validation report aggregate |
| `lib/contexts/execution/domain/events.ts` | Execution domain events |
| `lib/contexts/execution/application/extraction-service.ts` | File extraction service |
| `lib/contexts/execution/application/recovery-service.ts` | Recovery strategies service |
| `lib/contexts/execution/application/validation-service.ts` | Completion validation service |
| `lib/contexts/execution/application/skills-service.ts` | Skills framework integration |
| `lib/contexts/execution/infrastructure/execution-repository.ts` | Database access layer |
| `lib/contexts/execution/infrastructure/github-operations.ts` | Git operations |
| `workers/execution-worker.ts` | Worker process (thin wrapper) |

### Change Frequency

**VERY HIGH** - Prompt engineering, reliability improvements, frequent iterations.

---

## 5. Usage & Billing

**Purpose:** Track token usage, manage subscriptions, enforce limits.

### Ubiquitous Language

| Term | Definition |
|------|------------|
| **Billing Mode** | BYOK (bring your own key) vs Managed (Loopforge provides API keys) |
| **Subscription** | A plan with limits (free/pro/enterprise) |
| **Usage Record** | Token consumption per execution |
| **Plan Limit** | Constraint (max repos, max tasks, max tokens) |
| **Billing Period** | Monthly/yearly cycle |

### Aggregates

#### User Subscription Aggregate
- **Root:** UserSubscription
- **Invariants:**
  - Valid plan (free/pro/enterprise)
  - Active status (active/canceled/past_due)
  - Period dates consistent
- **Operations:**
  - `subscribeToPlan()` - Subscribe to new plan
  - `cancelSubscription()` - Cancel subscription
  - `changePlan()` - Upgrade/downgrade plan

#### Usage Tracking Aggregate
- **Root:** UsageRecord
- **Invariants:**
  - Positive token counts
  - Valid billing period
  - Links to execution
- **Operations:**
  - `recordUsage()` - Log token usage
  - `aggregatePeriod()` - Sum usage for period
  - `checkLimit()` - Verify under limit

### Domain Events

- `SubscriptionCreated` - New subscription started
- `SubscriptionUpgraded` - Plan upgraded
- `SubscriptionCanceled` - Subscription canceled
- `UsageRecorded` - Token usage logged
- `LimitExceeded` - Usage limit exceeded
- `BillingPeriodEnded` - Period closed

### File Mapping

| File | Purpose |
|------|---------|
| `lib/contexts/billing/domain/subscription-aggregate.ts` | Subscription aggregate root |
| `lib/contexts/billing/domain/usage-tracking-aggregate.ts` | Usage tracking aggregate |
| `lib/contexts/billing/domain/events.ts` | Billing domain events |
| `lib/contexts/billing/application/subscription-service.ts` | Subscription application service |
| `lib/contexts/billing/application/usage-service.ts` | Usage tracking service (event subscriber) |
| `lib/contexts/billing/infrastructure/middleware.ts` | Anti-Corruption Layer (ACL) |
| `lib/contexts/billing/infrastructure/stripe-client.ts` | Stripe integration |

### Change Frequency

**MODERATE** - Occasional changes for new plans or limits.

---

## 6. Analytics & Activity (Cross-Cutting Concern)

**Purpose:** Aggregate events from all contexts, generate activity feed, track metrics.

### Domain Events Consumed

- All events from all contexts (50+ event types)

### Domain Events Published

- `ActivityLogged` - Activity feed entry created
- `DailySummaryGenerated` - Daily rollup completed
- `ExperimentStarted` - A/B test started
- `VariantAssigned` - User assigned to variant
- `MetricRecorded` - Metric value captured

### File Mapping

| File | Purpose |
|------|---------|
| `lib/contexts/analytics/domain/activity-stream.ts` | Activity stream aggregate |
| `lib/contexts/analytics/domain/events.ts` | Analytics domain events |
| `lib/contexts/analytics/application/event-aggregator.ts` | Event aggregation service |
| `lib/contexts/analytics/infrastructure/event-subscribers.ts` | Subscribe to all domain events |
| `lib/contexts/analytics/infrastructure/sse-stream.ts` | Server-Sent Events streaming |

### Change Frequency

**GROWING** - New metrics and experiments frequently added.

---

## Context Relationships (Context Map)

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

### Relationship Types

| Relationship | Description |
|--------------|-------------|
| **Conformist** | Downstream context conforms to upstream's model |
| **Shared Kernel** | Tight coupling justified, shared data structures |
| **Customer/Supplier** | Downstream (customer) negotiates with upstream (supplier) |
| **Published Language** | Events published for any context to consume |
| **Open Host Service** | Provides API for other contexts |
| **Anti-Corruption Layer** | Protects context from external influences |

---

## Database Strategy

**Approach:** Shared PostgreSQL database with **schema isolation via table prefixes**.

### Table Prefixes by Context

| Context | Prefix | Example Tables |
|---------|--------|----------------|
| IAM | `iam_` | `iam_users`, `iam_sessions` |
| Repository | `repo_` | `repo_repositories`, `repo_indexes` |
| Task | `task_` | `task_tasks`, `task_dependencies` |
| Execution | `exec_` | `exec_executions`, `exec_events` |
| Billing | `billing_` | `billing_subscriptions`, `billing_usage` |
| Analytics | `analytics_` | `analytics_activity_events`, `analytics_summaries` |
| Domain Events | N/A | `domain_events` (cross-cutting) |

### Why Shared Database?

- ✅ Simplest migration path (rename tables, no data movement)
- ✅ Easier local development (single database)
- ✅ Shared transactions where needed (outbox pattern)
- ✅ Lower operational overhead (1 database vs 6)

### Future: Separate Databases per Context

If scaling challenges emerge (4+ developers, execution context bottleneck), migrate to separate databases:

- `iam_db`
- `repo_db`
- `task_db`
- `exec_db`
- `billing_db`
- `analytics_db`

---

## Communication Patterns

### 1. Synchronous REST API

**Use Case:** Authentication, API key retrieval
**Example:** Task API → IAM context for user provider config

### 2. BullMQ Queues

**Use Case:** Long-running operations
**Queues:**
- `brainstormQueue`
- `planQueue`
- `executionQueue`
- `autonomousFlowQueue`
- `indexingQueue`

### 3. Domain Events via Redis Pub/Sub

**Use Case:** Real-time updates, event-driven workflows
**Example:** AI Execution publishes `ExecutionCompleted` → Analytics/Billing subscribe

### 4. Anti-Corruption Layer

**Use Case:** Enforcing billing limits without tight coupling
**Example:** `withBillingCheck()` middleware wraps routes

---

## References

- [DDD Architecture Design Plan](../../PLAN.md)
- [Context Map Diagram](./CONTEXT_MAP.md)
- [Ubiquitous Language Glossary](./UBIQUITOUS_LANGUAGE.md)
- [Migration Strategy](./MIGRATION_STRATEGY.md)
