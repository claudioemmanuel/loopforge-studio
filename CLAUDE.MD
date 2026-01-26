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

---

**Last Updated**: 2026-01-23
**Project Version**: 0.1.0
**Maintained By**: Loopforge Team
