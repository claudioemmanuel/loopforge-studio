# Ubiquitous Language Glossary

This glossary defines the **ubiquitous language** used across all bounded contexts in Loopforge Studio's DDD architecture.

## Purpose

The ubiquitous language is a shared vocabulary used by:

- **Developers** writing code
- **Domain experts** (users, product owners)
- **Documentation** (code comments, docs, tests)

Each term should be used consistently across code, conversations, and documentation within its bounded context.

---

## Core Concepts (All Contexts)

### Aggregate

A cluster of domain objects that can be treated as a single unit. Each aggregate has an **aggregate root** (the entry point for all operations).

### Domain Event

An immutable record of something that happened in the domain. Events are published to Redis Pub/Sub for inter-context communication.

### Repository

An abstraction layer for accessing and persisting aggregates. Hides database implementation details.

### Bounded Context

A logical boundary within which a particular domain model is defined and applicable.

---

## Context 1: Identity & Access Management (IAM)

### User

An authenticated GitHub user with encrypted provider API keys.

**Properties:**

- GitHub ID (unique identifier)
- Username and email
- Avatar URL
- Encrypted API keys (per provider)
- Preferred provider and model
- Onboarding status

**Operations:**

- Register user
- Configure provider
- Update preferences
- Revoke provider

### Session

A temporary authentication token managed by NextAuth.js.

**Properties:**

- User ID
- Session token
- Expires at

### API Key

An encrypted provider credential (Anthropic/OpenAI/Gemini) stored with AES-256-GCM encryption.

**Properties:**

- Encrypted value
- Initialization vector (IV)
- Provider type

### Provider

An AI service provider configuration.

**Values:**

- `anthropic` - Anthropic (Claude models)
- `openai` - OpenAI (GPT models)
- `gemini` - Google (Gemini models)

### Encryption Key

A secret key used to encrypt/decrypt API keys. Stored in `ENCRYPTION_KEY` environment variable.

---

## Context 2: Repository Management

### Repository

A connected GitHub repository with local clone.

**Properties:**

- GitHub repo ID (unique)
- Name and full name
- Default branch
- Clone URL
- Clone status
- Local path
- Test configuration

**Operations:**

- Connect repository
- Clone repository
- Update clone
- Configure tests
- Index repository

### Clone

A local git copy with status tracking.

**Status Values:**

- `not_cloned` - Not yet cloned
- `cloning` - Clone in progress
- `cloned` - Clone completed successfully
- `failed` - Clone failed with error
- `updating` - Pull in progress

**Properties:**

- Clone path (local filesystem)
- Clone started at
- Clone completed at
- Clone error (if failed)

### Index

Parsed repository metadata (tech stack, symbols, dependencies).

**Properties:**

- File count
- Symbol count
- Tech stack (JSONB)
- Entry points (JSONB)
- Dependencies (JSONB)
- File index (JSONB)
- Symbol index (JSONB)

**Indexing Status:**

- `pending` - Not yet indexed
- `indexing` - Indexing in progress
- `indexed` - Indexing completed
- `failed` - Indexing failed

### Test Configuration

Repository-specific test settings.

**Properties:**

- Test command (e.g., `npm test`)
- Test timeout (milliseconds)
- Tests enabled (boolean)
- Test gate policy (strict/warn/skip/autoApprove)
- Critical test patterns (JSONB array)

### Test Gate Policy

Controls how test failures are handled.

**Values:**

- `strict` - All tests must pass, no PR without green
- `warn` - Tests can fail, warning added
- `skip` - No test enforcement
- `autoApprove` - Log results, create PR regardless

---

## Context 3: Task Orchestration & Workflow

### Task

A user-defined work item with status lifecycle.

**Status Values:**

- `todo` - Created, not started
- `brainstorming` - Brainstorming in progress
- `planning` - Planning in progress
- `ready` - Approved, ready to execute
- `executing` - Execution in progress
- `review` - Under review
- `done` - Completed successfully
- `stuck` - Stuck, requires manual intervention

**Properties:**

- Repository ID
- Title and description
- Status
- Priority (integer, lower = higher priority)
- Brainstorm conversation (JSONB)
- Plan content (markdown)
- Branch name
- PR URL and number
- Autonomous mode (boolean)
- Processing phase
- Status history (JSONB)
- Blocked by IDs (JSONB array)

**Operations:**

- Create task
- Start brainstorming
- Complete brainstorming
- Start planning
- Approve plan
- Execute task
- Transition status
- Mark stuck

### Workflow Phase

Current processing stage.

**Values:**

- `brainstorming` - AI is brainstorming approach
- `planning` - AI is generating execution plan
- `executing` - AI is executing changes
- `recovering` - AI is recovering from stuck state

### Dependency

A task dependency relationship (task A depends on task B).

**Properties:**

- Task ID (the dependent task)
- Blocked by ID (the blocking task)

**Invariants:**

- No circular dependencies (DAG)
- All references point to valid tasks

### Autonomous Flow

Automatic progression through workflow phases without user intervention.

**Behavior:**

- Task created → auto-start brainstorming
- Brainstorming complete → auto-start planning
- Plan approved → auto-execute
- Dependencies resolved → auto-execute unblocked tasks

### Status Transition

A change from one status to another with history tracking.

**Properties:**

- From status
- To status
- Timestamp
- Reason (optional)

### Blocked Task

A task that cannot execute because it has unresolved dependencies.

**Properties:**

- Blocked by IDs (array of task IDs)
- Auto-execute when unblocked (boolean)
- Dependency priority (integer)

---

## Context 4: AI Execution & Code Generation

### Execution

A Ralph loop run (queued → running → completed/failed).

**Status Values:**

- `queued` - Waiting to execute
- `running` - Currently executing
- `completed` - Finished successfully
- `failed` - Failed permanently
- `cancelled` - User cancelled

**Properties:**

- Task ID
- Status
- Iteration count
- Started at
- Completed at
- Error message (if failed)
- Commits (JSONB array)
- Branch name
- PR URL and number
- Stuck signals (JSONB)
- Recovery attempts (JSONB)
- Validation report (JSONB)

**Operations:**

- Start execution
- Process iteration
- Extract files
- Commit changes
- Complete execution
- Mark stuck

### Iteration

A single Ralph loop cycle (prompt → response → extraction → commit).

**Steps:**

1. Generate prompt with context
2. Send to AI provider
3. Parse response (extract files, commands)
4. Execute file operations
5. Commit changes (if any)
6. Log events

### Extraction

Code parsing from AI output.

**Strategies:**

1. **Strict** (0.95 confidence) - Regex for well-formatted blocks
2. **Fuzzy** (0.75 confidence) - Looser patterns
3. **AI-JSON** (0.7 confidence) - Structured JSON
4. **AI-Single-File** (0.8 confidence) - One file at a time
5. **AI-Code-Mapping** (0.5 confidence) - File paths + descriptions
6. **AI-Assisted** (0.6 confidence) - Legacy fallback

### Recovery

Stuck resolution strategy with escalation.

**Tiers:**

1. **Format Guidance** - Provide concrete examples
2. **Simplified Prompt** - Single-file focus
3. **Context Reset** - Fresh start with minimal context
4. **Manual Fallback** - Step-by-step instructions for user

**Properties:**

- Current tier (1-4)
- Attempts per tier
- Success/failure status

### Validation

Completion verification with weighted scoring.

**Criteria (0-100 score):**

- Has marker (20%) - `RALPH_COMPLETE` found
- Has commits (20%) - Commits created
- Matches plan (30%) - ≥50% file coverage
- Quality threshold (15%) - 1-10k lines changed
- Tests executed (5%) - Test artifacts present
- No critical errors (10%) - No `CRITICAL_ERROR`

**Passing Threshold:** 80%

### Skill

Best practice enforcement.

**Types:**

- **Blocking** - Prevents execution if violated
- **Warning** - Warns but allows execution
- **Guidance** - Provides recommendations

**Examples:**

- Test-Driven Development (TDD)
- Systematic Debugging
- Verification Before Completion
- Brainstorming
- Writing Plans

### Stuck Signal

A reliability indicator that suggests execution is stuck.

**Signals:**

1. **Consecutive Errors** (threshold: 3)
2. **Repeated Patterns** (>80% similarity via Levenshtein)
3. **Iteration Timeout** (10 minutes)
4. **Quality Degradation** (<40% success over 5 iterations)
5. **No Progress** (3 iterations without commits)

**Severity Levels:**

- Critical (immediate stuck)
- High (2+ signals → stuck)
- Medium (3+ signals → stuck)
- Low (monitored)

### Commit

A git commit created by Ralph.

**Properties:**

- Commit hash (SHA)
- Message
- Files changed
- Lines added/removed
- Timestamp

### Branch

A git branch created for task execution.

**Naming Convention:**

- `loopforge/task-{taskId}`

### Pull Request (PR)

A GitHub pull request created after execution.

**Properties:**

- PR number
- PR URL
- Title
- Body/description
- Draft status
- Target branch

---

## Context 5: Usage & Billing

### Billing Mode

How API keys are managed.

**Values:**

- `byok` - Bring Your Own Key (user provides API keys)
- `managed` - Loopforge provides API keys (future)

### Subscription

A plan with limits.

**Tiers:**

- `free` - Free tier (1 repo, basic limits)
- `pro` - Pro tier (20 repos, higher limits)
- `enterprise` - Enterprise tier (unlimited repos)

**Status:**

- `active` - Subscription active
- `canceled` - Subscription canceled
- `past_due` - Payment past due

**Properties:**

- Tier
- Status
- Stripe customer ID
- Period end date

### Usage Record

Token consumption per execution.

**Properties:**

- Execution ID
- Provider (anthropic/openai/gemini)
- Tokens used (input + output)
- Cost (calculated)
- Timestamp

### Plan Limit

A constraint based on subscription tier.

**Limits:**

- Max repositories
- Max tasks per month
- Max tokens per month
- Max concurrent executions

### Billing Period

A monthly or yearly cycle.

**Properties:**

- Start date
- End date
- Usage total
- Limit exceeded (boolean)

---

## Context 6: Analytics & Activity

### Activity Event

A logged event for the activity feed.

**Event Categories:**

- `ai_action` - AI performed an action
- `git` - Git operation (commit, PR)
- `system` - System event (task created, status changed)
- `test` - Test execution
- `review` - Code review

**Properties:**

- Event type
- Category
- Title
- Content
- Metadata (JSONB)
- Task ID (optional)
- Repo ID (optional)
- User ID (optional)
- Execution ID (optional)

### Activity Summary

A daily rollup of activity.

**Properties:**

- Date
- User ID (optional)
- Repo ID (optional)
- Tasks completed
- Tasks failed
- Commits
- Files changed
- Tokens used
- Summary text

### Metric

A tracked value for analytics.

**Examples:**

- Execution success rate
- Average execution time
- Token usage by provider
- Tasks completed per day

### Experiment

An A/B test for feature experimentation.

**Properties:**

- Experiment ID
- Name
- Variant A
- Variant B
- Start date
- End date
- Metric to track

### Variant

A version in an A/B test.

**Properties:**

- Variant ID
- Name
- Configuration (JSONB)
- Assignment percentage

---

## Shared Terms (All Contexts)

### Aggregate Root

The entry point for an aggregate. All operations on the aggregate must go through the root.

### Value Object

An immutable object that is defined by its attributes (e.g., email address, money amount).

### Entity

An object with a unique identity that persists over time.

### Service

An operation that doesn't naturally belong to an entity or value object.

**Types:**

- **Domain Service** - Business logic that spans multiple aggregates
- **Application Service** - Orchestration layer (use cases)
- **Infrastructure Service** - Technical concerns (database, Redis, HTTP)

### Event Bus

The infrastructure for publishing and subscribing to domain events (Redis Pub/Sub).

### Event Handler

A function that reacts to a domain event.

### Read Model

A denormalized view optimized for queries (CQRS pattern).

### Command

A request to perform an operation (e.g., "Create Task", "Approve Plan").

### Query

A request to retrieve data (e.g., "Get Task by ID", "List Tasks by Status").

---

## Anti-Patterns to Avoid

### ❌ Context Leakage

Using terms from one context in another context (e.g., saying "Task" in the IAM context).

**Fix:** Use context-specific terminology or create an Anti-Corruption Layer.

### ❌ Ambiguous Terms

Using vague terms like "thing", "data", "object", "record".

**Fix:** Use precise domain language (e.g., "Task", "Execution", "Commit").

### ❌ Technical Jargon in Domain Language

Using database terms like "table", "row", "foreign key" in domain models.

**Fix:** Use domain terms (e.g., "Task" not "task_row", "Repository" not "repos_table").

### ❌ Mixing Abstraction Levels

Using high-level and low-level terms interchangeably.

**Fix:** Separate concerns (e.g., "User" vs "UserRecord" vs "UserDTO").

---

## Usage Guidelines

### In Code

```typescript
// ✅ Good: Use domain terms
class TaskAggregate {
  transitionStatus(newStatus: TaskStatus): void {
    // Business logic here
  }
}

// ❌ Bad: Generic terms
class TaskObject {
  updateField(field: string, value: any): void {
    // Generic logic
  }
}
```

### In Conversations

```
✅ Good: "The Task transitioned from 'brainstorming' to 'planning' status."
❌ Bad: "The thing changed its field to a new value."
```

### In Documentation

```
✅ Good: "When a Task's dependencies are resolved, it publishes a TaskUnblocked event."
❌ Bad: "When dependencies are done, the system sends a message."
```

---

## References

- [Bounded Contexts](./BOUNDED_CONTEXTS.md)
- [File Mapping](./FILE_MAPPING.md)
- [Domain-Driven Design (Eric Evans)](https://www.domainlanguage.com/ddd/)
