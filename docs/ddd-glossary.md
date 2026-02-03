# DDD Glossary (Event-Storming)

This glossary captures the shared domain language surfaced during event-storming.
Use these terms in code, docs, UI copy, and PR descriptions to keep naming consistent.

## Core Concepts

### Repository (Repo)
The local and remote source repository connected to LoopForge Studio. A repo can be cloned,
indexed, and used as the execution target for AI tasks.

### Task
A unit of work that flows through brainstorming, planning, and execution. Tasks track status,
dependencies, and execution history.

### Execution
An execution is the concrete run that applies a plan to a repo. Executions are queued,
processed by workers, and emit execution events.

### Worker Job
A background job processed by the worker subsystem. Worker jobs include brainstorm, plan,
execution, autonomous flow, and indexing jobs.

### Experiment
An A/B testing container that holds variants, assignments, and metrics for evaluation.

## Domain Events (Event-Storming Output)

- **Repository Cloned** → Repo clone completed and is ready for indexing.
- **Repository Indexing Started/Completed** → Indexing pipeline transitions.
- **Task Brainstormed** → Initial ideas generated and stored.
- **Plan Generated** → Task plan is ready for execution approval.
- **Execution Queued** → Execution job enqueued for worker processing.
- **Execution Completed** → Execution finished successfully.
- **Task Stuck** → Task cannot progress without intervention.

## Status Language

### Task Statuses (`taskStatuses`)
- `todo`
- `brainstorming`
- `planning`
- `ready`
- `executing`
- `review`
- `done`
- `stuck`

### Execution Statuses (`executionStatus`)
- `queued`
- `running`
- `completed`
- `failed`
- `cancelled`

### Worker Job Statuses (`workerJobStatus`)
- `queued`
- `running`
- `completed`
- `failed`
- `cancelled`

### Repository Clone Statuses (`cloneStatus`)
- `pending`
- `cloning`
- `completed`
- `failed`

### Repository Indexing Statuses (`indexingStatus`)
- `pending`
- `indexing`
- `indexed`
- `failed`

### Subscription Statuses (`subscriptionStatus`)
- `active`
- `canceled`
- `past_due`
- `trialing`

### Experiment Statuses (`experimentStatus`)
- `draft`
- `active`
- `paused`
- `completed`

### Test Run Statuses (`testRunStatus`)
- `running`
- `passed`
- `failed`
- `timeout`
- `skipped`

## Queues & Services

Use these names when referencing queues, workers, or job types:

- **Brainstorm Queue** → `brainstorm`
- **Plan Queue** → `plan`
- **Execution Queue** → `execution`
- **Autonomous Flow Queue** → `autonomous-flow`
- **Indexing Queue** → `indexing`

## Review Checklist (Glossary Alignment)

Use this lightweight checklist when reviewing new PRs:

- [ ] New status values match the glossary (no new synonyms).
- [ ] Queue/service names use glossary terms (e.g., `execution`, not `execute`).
- [ ] UI copy and API responses use glossary terms (e.g., `completed`, not `success`).
- [ ] Type names and enums align with glossary spelling (`cancelled` vs `canceled`).
