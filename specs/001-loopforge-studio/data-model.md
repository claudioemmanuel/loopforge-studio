# Data Model: Loopforge Studio

**Phase**: 1 — Design
**Date**: 2026-02-12

---

## Entities

### User

Represents an authenticated user (via GitHub OAuth).

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK, auto-generated |
| githubId | String | Unique, from GitHub OAuth |
| username | String | From GitHub profile |
| avatarUrl | String | From GitHub profile |
| encryptedGithubToken | String | AES-256-GCM encrypted at rest |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

**Relationships**: has many Repositories, Tasks, ProviderConfigs, AnalyticsEvents

---

### Repository

A GitHub repository connected by a user.

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → User |
| githubRepoId | String | Unique GitHub repo ID |
| owner | String | GitHub org or username |
| name | String | Repo name |
| fullName | String | `owner/name` |
| defaultBranch | String | e.g., `main` |
| connectedAt | DateTime | Auto |

**Relationships**: belongs to User, has many Tasks

---

### Task

The core workflow unit. Progresses through the seven-stage state machine.

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → User |
| repositoryId | UUID | FK → Repository, nullable (unassigned) |
| title | String | Required, max 200 chars |
| description | Text | Required |
| stage | Enum | See Stage enum below |
| featureBranch | String | Nullable; set when Executing starts |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

**Stage enum**: `TODO`, `BRAINSTORMING`, `PLANNING`, `READY`, `EXECUTING`, `DONE`, `STUCK`

**Valid transitions**:
```
TODO → BRAINSTORMING
BRAINSTORMING → PLANNING
PLANNING → READY (requires approved ExecutionPlan)
PLANNING → BRAINSTORMING (rejected plan)
READY → EXECUTING (worker picks up)
EXECUTING → DONE
EXECUTING → STUCK
STUCK → BRAINSTORMING (user re-queues)
```

**Relationships**: belongs to User and Repository, has many ChatMessages, one ExecutionPlan,
many ExecutionLogs, many Commits

---

### ExecutionPlan

AI-generated plan attached to a Task. Requires explicit user approval.

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| taskId | UUID | FK → Task, unique (one plan per task) |
| steps | JSON | Array of `{stepNumber, description, estimatedChanges}` |
| status | Enum | `PENDING_REVIEW`, `APPROVED`, `REJECTED` |
| rejectionFeedback | Text | Nullable; set when user rejects |
| approvedAt | DateTime | Nullable |
| createdAt | DateTime | Auto |

**Constraint**: Task MUST NOT transition to `READY` unless `ExecutionPlan.status = APPROVED`.

---

### ChatMessage

A single message in the brainstorming conversation for a Task.

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| taskId | UUID | FK → Task |
| role | Enum | `USER`, `ASSISTANT` |
| content | Text | Message body |
| provider | String | Nullable; which AI provider generated this |
| model | String | Nullable; which model |
| tokenCount | Int | Nullable; tokens consumed |
| createdAt | DateTime | Auto |

---

### ProviderConfig

User's encrypted API key and model preference per AI provider.

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → User |
| provider | Enum | `ANTHROPIC`, `OPENAI`, `GOOGLE` |
| encryptedApiKey | String | AES-256-GCM encrypted |
| defaultModel | String | e.g., `claude-sonnet-4-5-20250929` |
| isDefault | Boolean | One global default per user |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

**Constraint**: unique on `(userId, provider)`.

---

### ExecutionLog

Streaming log entry emitted during AI code execution.

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| taskId | UUID | FK → Task |
| sequence | Int | Ordering within task execution |
| level | Enum | `INFO`, `ACTION`, `ERROR`, `COMMIT` |
| message | Text | Human-readable log line |
| metadata | JSON | Nullable; e.g., file changed, tokens used |
| createdAt | DateTime | Auto (high-resolution timestamp) |

---

### Commit

A GitHub commit created during AI execution, linked to a Task.

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| taskId | UUID | FK → Task |
| repositoryId | UUID | FK → Repository |
| sha | String | GitHub commit SHA |
| branch | String | Feature branch name (never main/master) |
| message | String | Commit message |
| filesChanged | Int | Count of files modified |
| committedAt | DateTime | From GitHub |

---

### AnalyticsEvent

Immutable record of a task lifecycle event for dashboard aggregation.

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → User |
| taskId | UUID | FK → Task |
| repositoryId | UUID | Nullable; FK → Repository |
| eventType | Enum | `TASK_CREATED`, `STAGE_CHANGED`, `PLAN_APPROVED`, `PLAN_REJECTED`, `EXECUTION_STARTED`, `EXECUTION_COMPLETED`, `STUCK_DETECTED`, `COMMIT_PUSHED` |
| fromStage | Enum | Nullable; previous stage |
| toStage | Enum | Nullable; new stage |
| provider | String | Nullable; AI provider used |
| model | String | Nullable |
| tokensUsed | Int | Nullable |
| metadata | JSON | Nullable |
| occurredAt | DateTime | Auto |

---

## State Machine Diagram

```
[TODO] ──────────────────────────────► [BRAINSTORMING]
                                              │
                                              │ AI generates plan
                                              ▼
                                         [PLANNING]
                                         /         \
                               Approve  /           \ Reject
                                       /             \
                                  [READY]        [BRAINSTORMING]
                                     │
                              Worker picks up
                                     │
                                     ▼
                               [EXECUTING]
                               /          \
                    Success   /            \ Stuck
                             /              \
                          [DONE]          [STUCK]
                                             │
                                    User re-queues
                                             │
                                             ▼
                                      [BRAINSTORMING]
```

---

## Indexes

- `tasks(userId, stage)` — board query
- `tasks(repositoryId, stage)` — serialization query for worker
- `chat_messages(taskId, createdAt)` — conversation retrieval
- `execution_logs(taskId, sequence)` — log streaming
- `analytics_events(userId, occurredAt)` — dashboard aggregation
- `analytics_events(repositoryId, occurredAt)` — per-repo activity
