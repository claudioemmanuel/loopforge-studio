# KERNEL Framework - Loopforge

> A prompt engineering methodology for creating effective, reproducible prompts.

## What is KERNEL?

KERNEL is a mnemonic for crafting prompts that consistently produce quality results:

| Letter | Principle | Description |
|--------|-----------|-------------|
| **K** | Keep it simple | One clear goal per prompt |
| **E** | Easy to verify | Include checkable success criteria |
| **R** | Reproducible | Be specific, avoid "latest" or vague terms |
| **N** | Narrow scope | One task per prompt, split if needed |
| **E** | Explicit constraints | Tell AI what NOT to do |
| **L** | Logical structure | Context → Task → Constraints → Format |

---

## Tech Stack Context

```
Stack: Next.js 15 + React 19 + TypeScript 5.7
Database: PostgreSQL 16 + Drizzle ORM
Queue: Redis 7 + BullMQ 5.40
AI: Anthropic, OpenAI, Google Gemini (unified AIClient)
Auth: NextAuth.js v5
Testing: Vitest + Testing Library
Styling: Tailwind CSS
```

---

## The 6 Principles

### K - Keep it Simple

Write one clear goal. Don't explain everything about the system.

**Bad:**
```
I need you to understand our entire AI pipeline which uses a unified
AIClient with Anthropic, OpenAI, and Gemini providers, and the worker
processes jobs from BullMQ queues, and then add a new brainstorm endpoint
that validates input and checks auth and also updates the task status
and sends SSE events...
```

**Good:**
```
Add a POST endpoint `/api/tasks/[taskId]/brainstorm/start` that queues
a brainstorm job for the task.
```

### E - Easy to Verify

Include criteria you can actually check. Avoid "make it nice" or "optimize well."

**Bad:**
```
Write a good test for the planning flow.
```

**Good:**
```
Write a Vitest test for `generatePlan()` that verifies:
- [ ] Returns valid plan structure with steps array
- [ ] Each step has id, title, and description
- [ ] Handles empty brainstorm result gracefully
- [ ] Run with: `npm run test:run`
```

### R - Reproducible Results

Be specific. Avoid "current," "latest," or context-dependent language.

**Bad:**
```
Update the task model to match the latest schema.
```

**Good:**
```
Add field `processingPhase: processingPhaseEnum` to the tasks table
in lib/db/schema.ts with default value `null`.
```

### N - Narrow Scope

One prompt = one task. Split complex work into steps.

**Bad:**
```
Implement the complete autonomous execution feature including brainstorming,
planning, execution, SSE events, and error recovery.
```

**Good:**
```
Step 1: Add `autonomousMode: boolean` column to tasks table in lib/db/schema.ts
with default value `false`.
```
Then follow up with Step 2, Step 3, etc.

### E - Explicit Constraints

Tell AI what NOT to do. Prevents unwanted additions.

**Bad:**
```
Add a new API route for fetching worker status.
```

**Good:**
```
Add a new API route for fetching worker status.

Constraints:
- DO: Use withAuth middleware from lib/api/middleware.ts
- DO: Return NextResponse.json with explicit status code
- DON'T: Add new database queries (use existing workerJobs table)
- DON'T: Modify existing routes
- DON'T: Add caching (will be done separately)
```

### L - Logical Structure

Organize prompts with clear sections: Context → Task → Constraints → Format

**Template:**
```markdown
## Context
[Brief background - what exists, what's relevant]

## Task
[One clear goal]

## Constraints
- DO: [specific actions]
- DON'T: [explicit restrictions]

## Success Criteria
- [ ] [Verifiable outcome 1]
- [ ] [Verifiable outcome 2]

## Output Format
[What you expect back]
```

---

## Pattern-Specific Templates

### API Route Pattern

```markdown
## Context
Stack: Next.js 15 App Router, NextAuth v5
Relevant files: app/api/[feature]/route.ts, lib/api/middleware.ts

## Task
[Single clear goal]

## Constraints
DO: Use withAuth or withTask middleware
DO: Return NextResponse.json with explicit status
DO: Handle errors via handleError() from lib/errors
DO: Verify ownership via middleware context
DON'T: Skip authentication checks
DON'T: Use try/catch without handleError
DON'T: Return raw errors to client
DON'T: Access db directly without ownership check

## Success Criteria
- [ ] TypeScript: `npx tsc --noEmit`
- [ ] Tests: `npm run test:run`
- [ ] Lint: `npm run lint`
- [ ] Route responds correctly in dev
```

**Example - Good KERNEL Prompt:**
```markdown
## Context
Stack: Next.js 15 App Router, NextAuth v5, BullMQ
Files: app/api/tasks/[taskId]/, lib/queue/brainstorm-queue.ts

## Task
Add POST endpoint `/api/tasks/[taskId]/brainstorm/start` that queues
a brainstorm job for the specified task.

## Constraints
DO: Use withTask middleware for auth + ownership
DO: Use getAIClientConfig(user) for provider config
DO: Call queueBrainstorm() from lib/queue
DO: Update task status to 'brainstorming'
DO: Return 202 Accepted with job ID
DON'T: Process brainstorm synchronously
DON'T: Skip provider configuration check
DON'T: Return 200 (use 202 for async operations)

## Success Criteria
- [ ] TypeScript: `npx tsc --noEmit`
- [ ] Lint: `npm run lint`
- [ ] Returns 401 without auth
- [ ] Returns 404 for non-owned task
- [ ] Returns 202 with { jobId } on success
```

### BullMQ Worker Pattern

```markdown
## Context
Stack: BullMQ 5.40, tsx worker process
Relevant files: workers/execution-worker.ts, lib/queue/

## Task
[Single clear goal]

## Constraints
DO: Use createXxxWorker factory functions
DO: Create workerJob record for audit trail
DO: Insert workerEvents for each significant action
DO: Use job.updateProgress for UI updates
DO: Publish to Redis for SSE streaming
DO: Use atomic DB updates with WHERE conditions
DON'T: Process jobs synchronously
DON'T: Skip error event handlers (completed, failed, error)
DON'T: Store sensitive data in job payload unencrypted
DON'T: Forget to clean up processing state on error

## Success Criteria
- [ ] Worker starts: `npm run worker`
- [ ] Tests: `npm run test:run`
- [ ] Job progress visible via SSE
- [ ] Errors properly recorded in workerEvents
```

**Example - Good KERNEL Prompt:**
```markdown
## Context
Stack: BullMQ 5.40, Drizzle ORM
Files: workers/execution-worker.ts, lib/queue/plan-queue.ts

## Task
Add plan queue processor that generates execution plans from brainstorm results.

## Constraints
DO: Create workerJob record with phase='planning'
DO: Insert workerEvents for thinking/action/complete/error
DO: Call generatePlan() from lib/ai/plan.ts
DO: Update task.planContent with result
DO: Publish SSE events via publishProcessingEvent
DO: Support continueToExecution flag for autonomous mode
DON'T: Skip workerJob status updates
DON'T: Forget to clear processingPhase on completion/error
DON'T: Hardcode AI provider (use job.data.aiProvider)

## Success Criteria
- [ ] Worker starts: `npm run worker`
- [ ] Plan stored in tasks.planContent
- [ ] workerEvents show complete timeline
- [ ] Error recovery reverts task status
```

### React Component Pattern

```markdown
## Context
Stack: React 19, Next.js 15 (client components), Tailwind
Relevant files: components/[feature]/

## Task
[Single clear goal]

## Constraints
DO: Add "use client" directive for client components
DO: Use useMemo for expensive computations
DO: Follow statusConfig pattern for visual consistency
DO: Use @dnd-kit for drag-drop (if applicable)
DO: Handle loading and error states
DON'T: Mutate state directly
DON'T: Skip loading/error states
DON'T: Use inline styles (use Tailwind)
DON'T: Create new UI primitives (use components/ui/)

## Success Criteria
- [ ] Build: `npm run build`
- [ ] TypeScript: `npx tsc --noEmit`
- [ ] Component renders in dev
- [ ] No console errors
```

**Example - Good KERNEL Prompt:**
```markdown
## Context
Stack: React 19, Tailwind, Radix UI
Files: components/kanban/kanban-card.tsx, components/ui/

## Task
Add processing indicator to KanbanCard that shows when a task
is actively being processed (brainstorming, planning, or executing).

## Constraints
DO: Use processingPhase from task prop
DO: Show spinner from components/ui/
DO: Display processingStatusText when available
DO: Use Tailwind animate-pulse for visual feedback
DO: Make indicator clickable to open ProcessingPopover
DON'T: Add new dependencies
DON'T: Fetch processing status (use prop)
DON'T: Block card drag while processing

## Success Criteria
- [ ] Build: `npm run build`
- [ ] TypeScript: `npx tsc --noEmit`
- [ ] Indicator shows for processingPhase !== null
- [ ] Click opens ProcessingPopover
```

### Custom Hook Pattern

```markdown
## Context
Stack: React 19, SSE/EventSource
Relevant files: components/hooks/

## Task
[Single clear goal]

## Constraints
DO: Use useRef for connection state (prevent duplicate connections)
DO: Implement exponential backoff for reconnection
DO: Clean up in useEffect return
DO: Use useCallback for stable function references
DO: Handle StrictMode double-mount
DON'T: Store EventSource in useState
DON'T: Skip cleanup (memory leaks)
DON'T: Reconnect without backoff
DON'T: Ignore connection errors

## Success Criteria
- [ ] TypeScript: `npx tsc --noEmit`
- [ ] Hook works in StrictMode (double-mount)
- [ ] No memory leaks on unmount
- [ ] Reconnects on connection loss
```

**Example - Good KERNEL Prompt:**
```markdown
## Context
Stack: React 19, EventSource SSE
Files: components/hooks/use-worker-events.ts

## Task
Create useWorkerEvents hook that subscribes to worker SSE events
and returns current processing state.

## Constraints
DO: Connect to /api/workers/sse endpoint
DO: Use useRef for EventSource instance
DO: Parse event.data as JSON
DO: Implement reconnection with 5s delay
DO: Return { events, isConnected, lastUpdate }
DO: Clean up EventSource on unmount
DON'T: Store EventSource in state
DON'T: Reconnect immediately on error
DON'T: Skip error event handling

## Success Criteria
- [ ] TypeScript: `npx tsc --noEmit`
- [ ] Connects on mount
- [ ] Disconnects on unmount
- [ ] Reconnects after connection loss
- [ ] Works with React StrictMode
```

### Database Schema Pattern

```markdown
## Context
Stack: Drizzle ORM, PostgreSQL 16
Relevant files: lib/db/schema.ts, drizzle/

## Task
[Single clear goal]

## Constraints
DO: Use pgEnum for status/type fields
DO: Add unique constraints for race prevention
DO: Define relations for eager loading
DO: Use uuid().defaultRandom() for IDs
DO: Add createdAt/updatedAt timestamps
DON'T: Use serial IDs (use UUID)
DON'T: Skip foreign key cascades
DON'T: Store sensitive data unencrypted
DON'T: Create redundant indexes

## Success Criteria
- [ ] Generate: `npm run db:generate`
- [ ] Migrate: `npm run db:migrate`
- [ ] Schema visible in `npm run db:studio`
- [ ] TypeScript: `npx tsc --noEmit`
```

**Example - Good KERNEL Prompt:**
```markdown
## Context
Stack: Drizzle ORM, PostgreSQL 16
Files: lib/db/schema.ts

## Task
Add workerJobs table to track background job execution with phase,
status, timing, and result summary.

## Constraints
DO: Use uuid().defaultRandom() for id
DO: Reference tasks table with onDelete: 'cascade'
DO: Add pgEnum for phase (brainstorming, planning, executing)
DO: Add pgEnum for status (pending, running, completed, failed)
DO: Include startedAt, completedAt, errorMessage columns
DON'T: Use serial IDs
DON'T: Skip timestamps
DON'T: Create without foreign key

## Success Criteria
- [ ] Generate: `npm run db:generate`
- [ ] Migration file created in drizzle/
- [ ] Migrate: `npm run db:migrate`
- [ ] Table appears in db:studio
```

### AI Integration Pattern

```markdown
## Context
Stack: Unified AIClient, Anthropic/OpenAI/Gemini
Relevant files: lib/ai/client.ts, lib/ai/clients/

## Task
[Single clear goal]

## Constraints
DO: Use createAIClient factory from lib/ai/client.ts
DO: Handle provider-specific errors via parseProviderError
DO: Track token usage when available
DO: Use streaming for long responses
DO: Support all 3 providers uniformly
DON'T: Hardcode provider-specific logic outside clients/
DON'T: Skip rate limit handling
DON'T: Store API keys in logs or responses
DON'T: Ignore token limits

## Success Criteria
- [ ] Tests: `npm run test:run`
- [ ] Works with Anthropic, OpenAI, and Gemini
- [ ] Errors return actionable messages
- [ ] TypeScript: `npx tsc --noEmit`
```

**Example - Good KERNEL Prompt:**
```markdown
## Context
Stack: Unified AIClient, Zod validation
Files: lib/ai/brainstorm.ts, lib/ai/client.ts

## Task
Add brainstormTask function that analyzes a task and returns
structured requirements, questions, and implementation suggestions.

## Constraints
DO: Accept AIClient instance (not provider name)
DO: Use Zod schema for response validation
DO: Return typed BrainstormResult interface
DO: Handle streaming for long responses
DO: Include error context in thrown errors
DON'T: Create new AIClient inside function
DON'T: Skip response validation
DON'T: Hardcode model names

## Success Criteria
- [ ] Tests: `npm run test:run`
- [ ] Returns valid BrainstormResult
- [ ] Works with all 3 AI providers
- [ ] TypeScript: `npx tsc --noEmit`
```

---

## Verification Commands

| Task Type | Command |
|-----------|---------|
| Build | `npm run build` |
| TypeScript | `npx tsc --noEmit` |
| Tests (once) | `npm run test:run` |
| Tests (watch) | `npm run test` |
| Coverage | `npm run test:coverage` |
| Lint | `npm run lint` |
| Dev server | `npm run dev` |
| Worker | `npm run worker` |
| DB generate | `npm run db:generate` |
| DB migrate | `npm run db:migrate` |
| DB studio | `npm run db:studio` |
| Docker dev | `npm run dev:build` |

---

## Common Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| "Also optimize the queries" | Separate prompt for optimization |
| No middleware specified | Always specify withAuth/withTask |
| "Make the worker faster" | Specify what "faster" means (latency, throughput) |
| Missing error handling | Add explicit handleError() requirement |
| No success criteria | Add checkable verification commands |
| Skipping race conditions | Add atomic WHERE conditions or constraints |
| "Update all the tests" | List specific test files to update |
| "Follow best practices" | Specify which practices explicitly |
| No file paths | Always list relevant files |
| "Fix the bug" | Describe the bug, expected vs actual behavior |

---

## Good vs Bad Examples

### API Route Example

**Bad Prompt:**
```
Can you add an endpoint to start brainstorming? We use Next.js.
```

**KERNEL Prompt:**
```markdown
## Context
Stack: Next.js 15 App Router, NextAuth v5, BullMQ
Files: app/api/tasks/[taskId]/brainstorm/start/route.ts, lib/queue/brainstorm-queue.ts

## Task
Create POST handler that queues a brainstorm job for the authenticated user's task.

## Constraints
DO: Use withTask middleware for auth + ownership
DO: Use getAIClientConfig(user) from lib/api/helpers.ts
DO: Return Errors.noProviderConfigured() if no API key
DO: Update task processingPhase to 'brainstorming'
DO: Return 202 Accepted with { jobId }
DON'T: Process brainstorm synchronously
DON'T: Return 200 (use 202 for queued operations)

## Success Criteria
- [ ] TypeScript: `npx tsc --noEmit`
- [ ] Returns 401 without session
- [ ] Returns 404 for task not owned by user
- [ ] Returns 400 if no AI provider configured
- [ ] Returns 202 with jobId on success
```

### Worker Job Example

**Bad Prompt:**
```
The worker should process brainstorm jobs.
```

**KERNEL Prompt:**
```markdown
## Context
Stack: BullMQ 5.40, Drizzle ORM
Files: workers/execution-worker.ts, lib/queue/brainstorm-queue.ts

## Task
Add processBrainstorm function that handles BrainstormJobData jobs.

## Constraints
DO: Create workerJob record with phase='brainstorming'
DO: Insert workerEvents for thinking/action/complete/error
DO: Call brainstormTask() from lib/ai/brainstorm.ts
DO: Update task.brainstormResult with JSON result
DO: Clear processingPhase on completion or error
DO: Support continueToPlanning flag for autonomous flow
DON'T: Forget error event handlers (completed, failed, error)
DON'T: Skip workerJob status updates
DON'T: Process other job types in this function

## Success Criteria
- [ ] Worker starts: `npm run worker`
- [ ] workerEvents table shows job timeline
- [ ] task.brainstormResult contains valid JSON
- [ ] Error sets task status back to 'todo'
```

### Component Example

**Bad Prompt:**
```
Add a loading indicator to the card.
```

**KERNEL Prompt:**
```markdown
## Context
Stack: React 19, Tailwind CSS, Lucide icons
Files: components/kanban/kanban-card.tsx

## Task
Add processing indicator to KanbanCard when task.processingPhase is not null.

## Constraints
DO: Import Loader2 from lucide-react
DO: Show indicator only when processingPhase !== null
DO: Display task.processingStatusText if available
DO: Use animate-spin class for spinner
DO: Position indicator in top-right corner of card
DON'T: Add new state (use props only)
DON'T: Block card interactions while processing
DON'T: Create new icon components

## Success Criteria
- [ ] Build: `npm run build`
- [ ] TypeScript: `npx tsc --noEmit`
- [ ] Indicator visible when processingPhase set
- [ ] Indicator hidden when processingPhase null
- [ ] Card still draggable while processing
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────┐
│           KERNEL Quick Check            │
├─────────────────────────────────────────┤
│ K - One goal per prompt? .............. │
│ E - Verifiable with npm commands? ..... │
│ R - Specific files, columns, types? ... │
│ N - Split complex AI features? ........ │
│ E - DO/DON'T for loopforge patterns? .. │
│ L - Context → Task → Constraints? ..... │
└─────────────────────────────────────────┘
```

**Quick Memory Aid:**
```
K - One goal per prompt
E - Verifiable with npm commands
R - Specific files, columns, types
N - Split complex AI features
E - Say what NOT to do
L - Structure: Context → Task → Constraints → Format
```

---

## Key File Reference

| Category | Files |
|----------|-------|
| API Middleware | `lib/api/middleware.ts` (withAuth, withTask) |
| API Helpers | `lib/api/helpers.ts` (getAIClientConfig, createUserAIClient) |
| Error Handling | `lib/errors/` (handleError, Errors, parseProviderError) |
| AI Client | `lib/ai/client.ts` (createAIClient) |
| AI Operations | `lib/ai/brainstorm.ts`, `lib/ai/plan.ts` |
| Queue Setup | `lib/queue/index.ts`, `lib/queue/connection.ts` |
| Worker | `workers/execution-worker.ts` |
| DB Schema | `lib/db/schema.ts` |
| Kanban UI | `components/kanban/` |
| Hooks | `components/hooks/` |
| Worker Events | `lib/workers/events.ts` |

---

## Template Reference

Ready-to-use templates for common tasks:

| Template | Use For |
|----------|---------|
| API Route Pattern | Creating Next.js API routes |
| BullMQ Worker Pattern | Background job processing |
| React Component Pattern | UI components |
| Custom Hook Pattern | React hooks with SSE/state |
| Database Schema Pattern | Drizzle schema changes |
| AI Integration Pattern | AI client usage |

---

*Last Updated: 2026-01-24*
