# Claude Context for Loopforge Studio

This document provides context and guidelines for Claude when working on the Loopforge Studio codebase.

## Project Overview

Loopforge Studio is an AI-powered autonomous development platform that connects AI coding agents (like Ralph) to GitHub repositories. Users create tasks through a Kanban interface, and AI agents brainstorm, plan, and execute code changes, pushing commits directly to GitHub branches.

## Key Architecture Decisions

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript 5.7, Tailwind CSS
- **Backend**: Next.js API Routes, NextAuth.js v5, Drizzle ORM
- **Database**: PostgreSQL 16 with encrypted token storage (AES-256-GCM)
- **Queue**: Redis 7 + BullMQ for background job processing
- **AI Providers**: Anthropic (Claude), OpenAI (GPT), Google (Gemini)

### Core Workflow
1. User creates a task on the Kanban board
2. Task moves to "Brainstorming" → AI analyzes codebase and discusses approach
3. Task moves to "Planning" → AI generates execution plan
4. User approves → Task moves to "Ready"
5. Background worker picks up task → "Executing" → AI implements changes
6. AI commits code to GitHub → Task moves to "Done"

### Important Directories

```
app/
├── (auth)/           # Authentication pages (login, onboarding, setup)
├── (dashboard)/      # Main app (analytics, repos, settings, workers)
└── api/              # API routes (tasks, repos, github, analytics, workers)

lib/
├── api/              # Shared API utilities
│   ├── helpers.ts            # AI provider helpers (getProviderApiKey, getPreferredModel, etc.)
│   ├── middleware.ts         # Route middleware (withAuth, withTask)
│   └── index.ts              # Barrel exports
├── ai/               # AI client implementations
│   ├── brainstorm-chat.ts    # Conversational brainstorming logic
│   ├── client.ts             # AI client factory
│   └── clients/              # Provider-specific implementations
├── crypto/           # Token encryption (AES-256-GCM)
├── db/               # Drizzle ORM schema and migrations
├── errors/           # Standardized error handling
│   ├── api-error.ts          # APIError class and Errors factory
│   ├── provider-errors.ts    # AI provider error parsers
│   ├── response.ts           # Response utilities (handleError, errorResponse)
│   └── types.ts              # Error types and codes
├── github/           # GitHub API client and operations
│   ├── index.ts              # Main GitHub client
│   └── repo-scanner.ts       # Repository analysis
├── queue/            # BullMQ queue management
│   ├── index.ts              # Main queue setup
│   ├── brainstorm-queue.ts   # Brainstorming jobs
│   └── plan-queue.ts         # Planning jobs
├── ralph/            # AI loop execution (core autonomous agent)
│   ├── loop.ts               # Main execution loop
│   ├── prompt-generator.ts   # System prompts
│   └── types.ts              # Type definitions
└── workers/
    └── events.ts     # SSE event streaming for real-time updates

workers/
└── execution-worker.ts   # Background worker process

components/
├── brainstorm/       # Brainstorming UI components
├── layout/           # Dashboard layout components
├── modals/           # Modal dialogs (TaskModal, NewTaskModal)
├── onboarding/       # Onboarding and tutorial components
├── providers/        # Provider components and icons
├── sidebar/          # Sidebar components (desktop and mobile)
├── kanban/           # Drag-and-drop Kanban board
│   ├── kanban-board.tsx      # Main board component
│   ├── kanban-card.tsx       # Task cards
│   ├── kanban-column.tsx     # Columns (Todo, Brainstorming, etc.)
│   └── processing-popover.tsx # Real-time AI activity indicator
├── analytics/        # Analytics dashboard components
├── dashboard/        # Main dashboard components
├── settings/         # Settings page components
├── workers/          # Worker status components
├── hooks/            # Custom React hooks
└── ui/               # shadcn/ui components

__tests__/
├── setup/            # Shared test infrastructure
│   ├── global-setup.ts       # Creates test database (runs once)
│   ├── setup.ts              # Per-file setup (schema, truncation)
│   └── test-db.ts            # Shared pool and utilities
└── ...               # Test files
```

## Database Schema (lib/db/schema.ts)

### Key Tables
- **users**: User accounts (linked to GitHub via OAuth), includes encrypted AI provider API keys
- **repos**: Connected GitHub repositories
- **tasks**: Individual tasks on the Kanban board
- **executionLogs**: Detailed logs of AI execution steps

### Task Lifecycle Fields
- `status`: todo, brainstorming, planning, ready, executing, done, stuck
- `processingPhase`: null, brainstorming, planning, executing (indicates active processing)
- `brainstormConversation`: JSON array of chat messages during brainstorming
- `plan`: Generated execution plan (markdown string)
- `branchName`: Git branch where changes are made

## Critical Security Considerations

### Token Encryption
All GitHub tokens and AI provider API keys are encrypted at rest using AES-256-GCM:
- Encryption key stored in `ENCRYPTION_KEY` environment variable
- Each value has unique IV stored alongside encrypted data
- See `lib/crypto/index.ts` for implementation

### GitHub Permissions
- OAuth scopes: `read:user`, `user:email`, `repo`
- Never commit to main/master directly
- Always create feature branches for AI changes
- Branch naming: `loopforge/task-{taskId}`

### API Route Protection
All API routes in `app/api/` require authentication via NextAuth.js session.

## API Route Patterns

### Authentication Middleware

Use `withAuth` for routes that only need authenticated user:
```typescript
import { withAuth } from "@/lib/api";

export const GET = withAuth(async (request, { user, session }) => {
  // user and session are guaranteed to exist
  return NextResponse.json({ userId: user.id });
});
```

Use `withTask` for routes that need task with ownership verification:
```typescript
import { withTask, getAIClientConfig } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";

export const POST = withTask(async (request, { user, task, taskId }) => {
  // task is guaranteed to exist and belong to user
  const config = getAIClientConfig(user);
  if (!config) {
    return handleError(Errors.noProviderConfigured());
  }

  // Use config.provider, config.model, config.apiKey
});
```

### AI Client Configuration

```typescript
import { getAIClientConfig, createUserAIClient } from "@/lib/api";

// Option 1: Get config manually
const config = getAIClientConfig(user);
// config = { provider, model, apiKey } or null

// Option 2: Create client directly
const client = await createUserAIClient(user);
// client = AIClient instance or null
```

### Error Handling

Use standardized error handling from `lib/errors`:
```typescript
import { handleError, Errors, parseProviderError } from "@/lib/errors";

// Factory methods for common errors
return handleError(Errors.noProviderConfigured());
return handleError(Errors.taskNotFound(taskId));
return handleError(Errors.unauthorized());

// Parse AI provider-specific errors
try {
  await aiClient.chat(messages);
} catch (error) {
  const apiError = parseProviderError(error, "anthropic");
  return handleError(apiError);
}
```

## AI Integration

### Provider Configuration
Users can choose their preferred provider and model:
- **Anthropic**: claude-sonnet-4, claude-opus-4, claude-haiku-3
- **OpenAI**: gpt-4o, gpt-4-turbo, gpt-4o-mini
- **Google**: gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash

### API Key Model
Loopforge uses BYOK (Bring Your Own Key) - users provide their own AI provider API keys. Keys are encrypted at rest using AES-256-GCM.

### The Ralph Loop (lib/ralph/loop.ts)
The core autonomous agent that executes tasks:
1. Gathers context from repository (uses repo-scanner.ts)
2. Receives task description and plan
3. Iteratively generates actions (read files, edit code, run commands)
4. Executes actions via simulated tool calls
5. Commits changes to GitHub
6. Detects when stuck (max iterations or repeated failures)

## Real-Time Updates

### SSE Streaming (app/api/workers/sse/route.ts)
- Long-running GET request for Server-Sent Events
- Streams AI thoughts, actions, and status updates
- Used by processing-popover.tsx to show live activity

### Worker Events (lib/workers/events.ts)
- Emits events during brainstorming, planning, and execution
- Events: progress, thought, action, tool_use, status_change, error
- Frontend subscribes to events for specific tasks

## Testing

### Test Suite (__tests__/)
- **Unit Tests**: AI clients, crypto, schema, utils
- **Integration Tests**: Queue operations, GitHub client, Ralph loop
- **Coverage**: Run `npm run test:coverage` to see coverage report

### Running Tests
```bash
npm run test          # Watch mode
npm run test:run      # Run once
npm run test:coverage # With coverage
```

## Common Tasks When Working on Loopforge

### Adding a New AI Provider
1. Create client in `lib/ai/clients/`
2. Implement `AIClient` interface
3. Add provider to `lib/ai/client.ts` factory
4. Update settings UI to support new provider
5. Add tests in `__tests__/`

### Adding a New Task Status
1. Update `taskStatus` enum in `lib/db/schema.ts`
2. Run `npm run db:generate` to create migration
3. Update Kanban column configuration in `components/kanban/kanban-board.tsx`
4. Update status transitions in task API routes

### Modifying the Ralph Loop
1. Edit `lib/ralph/loop.ts` for core logic changes
2. Update `lib/ralph/prompt-generator.ts` for prompt changes
3. Test thoroughly with real tasks (no unit tests can fully simulate this)
4. Consider iteration limits and stuck detection

### Working with GitHub API
1. All GitHub operations go through `lib/github/index.ts`
2. Never expose GitHub tokens in logs or responses
3. Always decrypt tokens just-in-time using `lib/crypto/index.ts`
4. Use `simple-git` for local repository operations

## Environment Variables Required

### Minimum for Local Development
```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/loopforge

# Redis
REDIS_URL=redis://localhost:6379

# Auth
NEXTAUTH_SECRET=<generate with openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# GitHub OAuth
GITHUB_CLIENT_ID=<from GitHub OAuth app>
GITHUB_CLIENT_SECRET=<from GitHub OAuth app>

# Encryption
ENCRYPTION_KEY=<generate with openssl rand -hex 32>
```

### Optional
- `NODE_ENV`: development, test (defaults to development)

## Development Workflow

### Starting Development
```bash
# Start services (if using Docker)
docker compose up -d postgres redis

# Run migrations
npm run db:migrate

# Start dev server
npm run dev

# In another terminal, start worker
npm run worker
```

### Making Changes
1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes
3. Run tests: `npm run test:run`
4. Lint: `npm run lint`
5. Commit and push

### Database Changes
1. Modify `lib/db/schema.ts`
2. Generate migration: `npm run db:generate`
3. Review migration in `drizzle/` directory
4. Apply migration: `npm run db:migrate`
5. Restart app and worker

## Common Pitfalls

### 1. Worker Not Running
The worker (`workers/execution-worker.ts`) must be running separately for tasks to execute. Check:
- `npm run worker` is running in a separate process
- Redis is accessible
- Worker logs show successful queue connection

### 2. GitHub Token Expiration
GitHub OAuth tokens can be revoked. If GitHub API calls fail:
- Check if token is still valid
- User may need to re-authenticate
- Look for 401/403 errors in logs

### 3. AI Provider Rate Limits
Each provider has different rate limits:
- Anthropic: varies by tier
- OpenAI: varies by tier
- Google: generous free tier, then paid
Handle rate limit errors gracefully with retries.

### 4. Task Status Transitions
Not all transitions are valid:
- Can't go from "done" back to "executing"
- "stuck" requires manual intervention
- See `app/api/tasks/[taskId]/route.ts` for validation logic

### 5. Real-Time Updates Not Working
SSE connection can break:
- Check network timeouts
- Ensure SSE endpoint stays open (no middleware closing it)
- Frontend should reconnect on disconnect

## Code Style Preferences

### TypeScript
- Use strict mode
- Prefer interfaces over types for object shapes
- Use Zod schemas for runtime validation
- Avoid `any`; use `unknown` and type guards

### React Components
- Use Server Components by default (Next.js 15)
- Client Components only when needed (`"use client"`)
- Prefer functional components
- Use hooks (useState, useEffect, custom hooks)

### File Organization
- One component per file
- Co-locate related files (e.g., `kanban-board.tsx`, `kanban-card.tsx` in `components/kanban/`)
- Keep API routes focused (one resource per route)

### Naming Conventions
- Components: PascalCase (e.g., `KanbanBoard.tsx`)
- Utilities: camelCase (e.g., `encryptData`)
- API routes: kebab-case folder names (e.g., `api/tasks/[taskId]/`)
- Database columns: camelCase

## Performance Considerations

### Database Queries
- Use Drizzle ORM to build efficient queries
- Index columns used in WHERE clauses and JOINs
- Limit result sets (especially for logs and conversations)

### Real-Time Updates
- SSE is efficient for one-way streaming
- Don't send large payloads in SSE events
- Batch updates when possible

### AI Token Usage
- Context gathering can be expensive (large files)
- repo-scanner.ts limits file sizes and counts
- Monitor token usage in analytics dashboard

## Future Enhancements

### Planned Features
- Multi-agent collaboration (multiple AIs on one task)
- Human-in-the-loop approvals during execution
- Custom tool definitions for Ralph
- Integration with issue trackers (Jira, Linear)
- Team workspaces with shared repositories

### Known Limitations
- No support for monorepos (single repo per task)
- Limited to text-based code changes (no binary files)
- No support for running tests before committing
- Worker runs on single machine (no horizontal scaling yet)

## Troubleshooting Guide

### Worker Errors
```bash
# Check worker logs
docker compose logs worker

# Manually connect to Redis
redis-cli -h localhost -p 6379
> PING
> LLEN bull:execution-queue:wait
```

### Database Issues
```bash
# Check Postgres logs
docker compose logs postgres

# Connect to database
psql $DATABASE_URL
> \dt   # list tables
> SELECT * FROM tasks;
```

### AI Provider Errors
- Check provider status pages
- Verify API keys are valid and not expired
- Check for sufficient credits/quota
- Review error messages in `executionLogs` table

## Resources

### Documentation
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [BullMQ](https://docs.bullmq.io/)
- [NextAuth.js v5](https://authjs.dev/)

### AI Provider Docs
- [Anthropic API](https://docs.anthropic.com/)
- [OpenAI API](https://platform.openai.com/docs)
- [Google Gemini](https://ai.google.dev/docs)

### GitHub
- [GitHub REST API](https://docs.github.com/en/rest)
- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)

## Notes for Claude

### When Adding Features
- Always check existing patterns before creating new ones
- Keep security top-of-mind (encryption, authentication)
- Consider impact on both web app and worker
- Update this document if architecture changes

### When Debugging
- Check both web app logs and worker logs
- Verify database state matches expectations
- Test with real GitHub repositories (use a test repo)
- Monitor token usage and costs

### When Refactoring
- Run full test suite before and after
- Update any affected documentation
- Consider backward compatibility for database changes
- Test critical user flows end-to-end

### When Working with Prompts

Loopforge uses sophisticated prompt engineering across its 26+ specialized AI workflows. This section documents the KERNEL framework, token optimization strategies, and practical patterns used throughout the codebase.

#### KERNEL Framework (Primary Methodology)

All Loopforge prompts follow the KERNEL framework for systematic prompt design:

**K - Keep it simple**
- Single clear goal per prompt section
- Example: Ralph loop separates Context (input), Function (task), Parameters (constraints), Output (format), Verify (success criteria)
- See `lib/ralph/prompt-generator.ts:19-69` - section headers at lines 21, 27, 31, 47, 56

```typescript
// File: lib/ralph/prompt-generator.ts:19-26
return `# Ralph Loop - Iteration ${context.iteration}

## Context (Input)
Project: ${context.project}
Change: ${context.changeId}
Working directory: ${context.workingDir}
Tasks file: ${context.tasksPath}
```

**E - Easy to verify**
- JSON schemas with explicit fields
- Completion markers (`RALPH_COMPLETE`, `RALPH_STUCK: <reason>`)
- Acceptance criteria in planning prompts
- Success criteria checklists

Examples:
- `lib/ralph/prompt-generator.ts:56-60` - Verify section with checkboxes
- `lib/ai/plan.ts:69-98` - JSON schema with explicit field definitions

```typescript
// File: lib/ai/plan.ts:69-83 (condensed)
## OUTPUT FORMAT (JSON only)
{
  "sprintGoal": "Clear, measurable goal for this work",
  "overview": "High-level approach and architecture decisions",
  "steps": [
    {
      "id": "1",
      "title": "Concise task title",
      "description": "What to implement and how",
      "acceptanceCriteria": ["Testable condition 1", "Testable condition 2"],
      "estimatedEffort": "small|medium|large",
      "priority": "critical|high|medium|low"
    }
  ]
}
```

**R - Reproducible**
- Explicit output formats (JSON schemas, markdown templates)
- Numbered workflow steps
- Deterministic parsing with fallback extraction

Example: `lib/ai/plan.ts:115-137` - Markdown stripping + JSON parsing with fallback

```typescript
// File: lib/ai/plan.ts:115-125 (condensed)
// Strip markdown code blocks if present
let cleanedText = text.trim();
const jsonBlockMatch = cleanedText.match(/^```json\s*([\s\S]*?)\s*```$/);

if (jsonBlockMatch) {
  cleanedText = jsonBlockMatch[1].trim();
}

try {
  return JSON.parse(cleanedText);
} catch {
  // Fallback extraction...
}
```

**N - Narrow scope**
- Each prompt focuses on one phase (brainstorm, plan, execute)
- Sub-agents handle specialized tasks (code review, testing, refactoring)
- Clear boundaries prevent scope creep

Example: Brainstorming stays conversational, planning generates structured JSON, execution implements code - never mixed

**E - Explicit constraints**
- DO/DON'T lists in Ralph loop (`lib/ralph/prompt-generator.ts:31-45`)
- Priority ordering (Security > Quality > Style in code review)
- Clear task-specific rules

```typescript
// File: lib/ralph/prompt-generator.ts:31-45 (condensed)
## Constraints (Parameters)

DO:
- Focus on ONE task only
- Follow existing patterns in the codebase
- Keep changes minimal and focused

DON'T:
- Modify unrelated code
- Skip verification steps
- Combine multiple tasks into one
```

**L - Logical structure**
- Consistent section organization: Context → Role → Instructions → Output → Success
- All agent prompts follow the same pattern
- Enables systematic debugging and refinement

#### Token Optimization Strategies

Based on Anthropic's context engineering principles:

**1. Context as Finite Resource**

Loopforge treats context as precious. Key strategies:

- **Attention degradation awareness**: Critical instructions front-loaded in prompts
  - Ralph loop puts Context and Task sections FIRST (lines 21-29 in prompt-generator.ts)
  - Completion markers defined early, not buried at end

- **Context rot prevention**: Sub-agents return condensed summaries (1,000-2,000 tokens)
  - Brainstorm conversations accumulate incrementally, not reprocessed each turn
  - Planning generates structured JSON instead of verbose narratives

- **Dynamic context loading**: Ralph loop loads files just-in-time vs. pre-loading entire repos
  - See `lib/ai/brainstorm-chat.ts:42-112` - scanRepository limits to 20 files, detects tech stack on-demand
  - Repository scanner in `lib/github/repo-scanner.ts` limits file sizes and counts

**2. System Prompt Calibration (Finding the Goldilocks Zone)**

Loopforge evolved through multiple iterations:

- **Too rigid**: Early prompts with overly specific constraints led to brittle behavior
- **Too vague**: Generic "improve code quality" prompts produced unfocused outputs
- **Just right**: Current prompts use structured sections + flexible reasoning space

Example: `lib/ai/brainstorm-chat.ts:114-173` balances Scrum framework guidance with open-ended refinement questions

```typescript
// File: lib/ai/brainstorm-chat.ts:122-134 (condensed)
SCRUM REFINEMENT FRAMEWORK:
1. STORY CLARITY - Ensure the "what" and "why" are crystal clear
2. ACCEPTANCE CRITERIA - Define specific, testable conditions for "done"
3. TASK BREAKDOWN - Identify concrete implementation steps
4. DEPENDENCIES - Surface blockers, prerequisites, or related work
5. RISKS - Identify potential challenges or unknowns
6. ESTIMATION INPUT - Gather info needed for accurate estimation

CRITICAL RULES:
1. STAY ON TOPIC - Questions MUST relate directly to the original task
2. ACCUMULATE - BUILD UPON existing brainstorm, adding details, NOT replacing
3. BE SPECIFIC - Use Scrum refinement questions specific to THIS task
4. KNOW WHEN TO STOP - After gathering acceptance criteria, key tasks, and risks
```

**3. Just-in-Time Context Loading**

Benefits of lazy loading:
- **Reduced token usage**: Only load files the AI explicitly requests
- **Faster iteration**: No upfront cost for unused context
- **Focused context**: AI gets exactly what it needs, when it needs it

Implementation pattern:
- Ralph loop starts with minimal context (task description, working directory)
- AI can request files via tool calls during execution
- Repository context built dynamically based on task type (see `lib/ai/brainstorm-chat.ts:239-329`)

**4. Tool Design Efficiency**

Loopforge designs tools to return concise, relevant information:

- **Clear, non-overlapping functionality**: Separate tools for brainstorm, plan, execute (never combined)
- **Structured outputs**: JSON responses reduce parsing ambiguity
- **Decision reduction**: Limited options in brainstorm (3-4 choices), clear completion markers

Example: Brainstorm chat options limited to 3-4 relevant choices + "ready to proceed" option (line 156-157 in brainstorm-chat.ts)

#### Loopforge Prompt Patterns

**Structured Sections Pattern**

All prompts organize information hierarchically:
```
Context → Role/Expertise → Instructions → Output Format → Success Criteria
```

**Used in**:
- Ralph loop (`lib/ralph/prompt-generator.ts`)
- Planning (`lib/ai/plan.ts:49-108`)
- Brainstorming system prompt (`lib/ai/brainstorm-chat.ts:114-173`)

**Benefits**:
- Reduces cognitive load on AI
- Enables systematic prompt debugging (modify one section at a time)
- Consistent structure across all workflows

**JSON Output Enforcement Pattern**

All prompts expecting structured data include:
1. Explicit JSON schema in prompt
2. "Respond ONLY with valid JSON" instruction
3. Markdown code block stripping (`` ```json `` and `` ``` ``)
4. Fallback text parsing when JSON fails
5. Graceful degradation with sensible defaults

See `lib/ai/plan.ts:115-243` for comprehensive fallback implementation

**Context Accumulation Pattern**

Brainstorming builds context iteratively:
- Each turn includes previous preview: `lib/ai/brainstorm-chat.ts:193-200`
- AI instructed to "BUILD UPON, not replace" existing content
- Prevents context loss across conversation turns

**Progressive Refinement Pattern**

Task-specific prompts detect task type and adapt:
- Testing tasks get coverage/mocking questions (`lib/ai/brainstorm-chat.ts:247-263`)
- Bug fix tasks get root cause analysis prompts (`lib/ai/brainstorm-chat.ts:283-299`)
- Performance tasks get profiling/benchmarking prompts (`lib/ai/brainstorm-chat.ts:301-317`)

**Completion Marker Pattern**

Clear signals for task completion:
- `RALPH_COMPLETE` when all tasks done (`lib/ralph/prompt-generator.ts:53`)
- `RALPH_STUCK: <reason>` when blocked (`lib/ralph/prompt-generator.ts:54`)
- `suggestComplete: true` in brainstorming when ready (`lib/ai/brainstorm-chat.ts:144-148`)

#### Practical Guidelines for Claude

**1. Apply KERNEL First**

Before writing a prompt:
- Identify the single clear goal (K)
- Define verifiable success criteria (E)
- Ensure reproducible outputs via explicit format (R)
- Keep scope narrow to one task/phase (N)
- Add explicit DO/DON'T constraints (E)
- Structure logically with numbered sections (L)

**2. Use Existing Patterns**

Before creating new prompt logic:
- Check `lib/ai/brainstorm-chat.ts` for conversational patterns
- Reuse JSON schema patterns from `lib/ai/plan.ts`
- Copy completion marker pattern from `lib/ralph/prompt-generator.ts`
- Follow section structure from existing prompts

**3. Token Budget by Task Type**

Recommended max tokens by workflow:
- **Brainstorming**: 2,048 tokens (exploratory, conversational)
- **Planning**: 4,096 tokens (structured JSON output with multiple steps)
- **Code Generation**: 8,192 tokens (need space for code blocks)
- **Execution**: 8,192 tokens (includes context accumulation)

See actual usage:
- `lib/ai/brainstorm-chat.ts:211` - 2,048 tokens
- `lib/ai/plan.ts:112` - 4,096 tokens

**4. Test with Real Tasks**

No unit tests can fully simulate prompt effectiveness:
- Create test task on Kanban board
- Monitor execution logs in `executionLogs` table
- Check token usage in analytics dashboard
- Verify JSON parsing succeeds across different AI providers

**5. Error Handling is Mandatory**

Every prompt with JSON output must include:
- Markdown code block stripping (`` ```json `` and `` ``` ``)
- Fallback text parsing when JSON.parse() fails
- Graceful degradation with sensible defaults
- Never throw errors - always return usable structure

Reference implementation: `lib/ai/plan.ts:115-243`

**6. Front-Load Critical Information**

Due to attention degradation in long contexts:
- Put task description and constraints FIRST
- Define success criteria early in prompt
- Place optional details at end
- Don't bury completion markers deep in prompt

#### Prompt Template Checklist

Use this when creating new prompts:

```typescript
// 1. Role Definition
"You are an expert [specialty] [profession]..."

// 2. Context Section
const context = {
  project: "...",
  task: "...",
  iteration: "...",
  workingDirectory: "..."
};

// 3. Expertise/Capabilities (bulleted list)
"Your expertise includes:
- Capability 1
- Capability 2
- Capability 3"

// 4. Workflow (numbered steps)
"Your workflow:
1. Step 1
2. Step 2
3. Step 3"

// 5. Output Format (explicit JSON schema)
"Output format:
{
  field1: \"description\",
  field2: [\"array\", \"of\", \"values\"],
  field3: { nested: \"object\" }
}"

// 6. Success Criteria
"Success criteria:
□ Criterion 1
□ Criterion 2
□ Criterion 3"

// 7. Completion Markers
"When complete, output: TASK_COMPLETE
If blocked, output: TASK_BLOCKED: <reason>"

// 8. Fallback Handling (MANDATORY for JSON prompts)
function parseResponse(response: string) {
  // Strip markdown code blocks
  let cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "");

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    // Fallback: extract from text or return default structure
    return fallbackExtraction(response);
  }
}
```

#### Anti-Patterns to Avoid

Based on Loopforge's evolution:

❌ **Vague success criteria**: "Make the code better"
✅ **Specific acceptance criteria**: "Reduce function length to <50 lines, add JSDoc comments, extract magic numbers to constants"

❌ **Implicit expectations**: Expecting AI to know project conventions
✅ **Explicit constraints**: "Follow existing patterns in `lib/agents/definitions/code-reviewer.ts:15-45`"

❌ **Mixed concerns in one section**: Combining context, instructions, and output format
✅ **Separated sections**: Context section, Instructions section, Output Format section (see prompt-generator.ts structure)

❌ **JSON without fallback**: Assuming AI always returns valid JSON
✅ **Robust parsing**: Markdown stripping + fallback extraction (see `lib/ai/plan.ts:115-243`)

❌ **Pre-loading entire context**: Loading all repository files upfront
✅ **Just-in-time loading**: Load files on-demand based on AI requests (see Ralph loop execution)

❌ **Generic prompts**: "Analyze this task"
✅ **Task-specific prompts**: Testing tasks get coverage questions, bug fixes get root cause prompts (see `lib/ai/brainstorm-chat.ts:239-329`)

❌ **Buried instructions**: Important constraints at end of long prompt
✅ **Front-loaded critical info**: Task description and constraints in first 500 tokens

❌ **No completion signals**: AI doesn't know when to stop
✅ **Clear markers**: `RALPH_COMPLETE`, `suggestComplete: true` (see completion marker pattern)

#### Token Usage Monitoring

Track and optimize token usage:
- Monitor analytics dashboard for token consumption trends
- Repository scanner limits file sizes (`lib/github/repo-scanner.ts`)
- Brainstorm conversation capped at reasonable length
- Planning outputs structured JSON (compact vs. verbose narratives)

#### Key Prompt Files Reference

When modifying prompts, consult these files:
- **Ralph loop prompts**: `lib/ralph/prompt-generator.ts:15-89`
- **Planning prompts**: `lib/ai/plan.ts:49-108`
- **Brainstorming system prompt**: `lib/ai/brainstorm-chat.ts:114-173`
- **Task-specific detection**: `lib/ai/brainstorm-chat.ts:239-329`
- **JSON extraction fallback**: `lib/ai/plan.ts:115-243`
- **Repository context scanning**: `lib/ai/brainstorm-chat.ts:42-112`

---

**Last Updated**: 2026-01-29
**Project Version**: 0.1.0
**Maintained By**: Loopforge Team
