# Tasks: Loopforge Studio

**Input**: Design documents from `specs/001-loopforge-studio/`
**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/ ✅, research.md ✅

**Organization**: Tasks grouped by user story for independent implementation and testing.
**Tests**: Not requested — no test tasks included.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story this task belongs to (US1–US7)

## Path Conventions

- **API**: `apps/api/src/`
- **Web**: `apps/web/src/`
- **Shared**: `packages/shared/src/`
- **Prisma schema**: `apps/api/prisma/schema.prisma`
- **Docker**: `docker-compose.yml`, `.env.example`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo initialization, tooling, and shared configuration.

- [x] T001 Initialize pnpm workspaces monorepo with `apps/api`, `apps/web`, `packages/shared` in `package.json`
- [x] T002 [P] Initialize `apps/api` — Fastify + TypeScript project with `package.json`, `tsconfig.json`, `src/index.ts`
- [x] T003 [P] Initialize `apps/web` — Vite + React 18 + TypeScript project with `package.json`, `tsconfig.json`, `vite.config.ts`
- [x] T004 [P] Initialize `packages/shared` — TypeScript library with `package.json`, `tsconfig.json`, `src/types.ts`, `src/contracts.ts`
- [x] T005 [P] Configure ESLint + Prettier across all packages with shared config in `.eslintrc.json` and `.prettierrc`
- [x] T006 Create `docker-compose.yml` with services: `api` (port 3001), `web` (port 3000), `db` (PostgreSQL 16), `redis` (Redis 7)
- [x] T007 Create `.env.example` with all required variables: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`, `REDIS_URL`, `API_PORT`, `WEB_PORT`
- [x] T008 [P] Add `Dockerfile` for `apps/api` (Node 20 LTS base image, multi-stage build)
- [x] T009 [P] Add `Dockerfile` for `apps/web` (Node 20 LTS build stage + nginx serve stage)

**Checkpoint**: `docker compose build` succeeds with all four services.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, encryption, and core infrastructure that ALL user stories depend on.

⚠️ **CRITICAL**: No user story work begins until this phase is complete.

- [x] T010 Define Prisma schema in `apps/api/prisma/schema.prisma` with all 8 entities: `User`, `Repository`, `Task`, `ExecutionPlan`, `ChatMessage`, `ProviderConfig`, `ExecutionLog`, `Commit`, `AnalyticsEvent` — including all fields, relations, and indexes from `specs/001-loopforge-studio/data-model.md`
- [x] T011 Run initial Prisma migration to generate `apps/api/prisma/migrations/` and validate schema
- [x] T012 [P] Implement `EncryptionService` in `apps/api/src/services/encryption.service.ts` — AES-256-GCM encrypt/decrypt for API keys and OAuth tokens
- [x] T013 [P] Define shared TypeScript types in `packages/shared/src/types.ts` — `Task`, `Stage` enum (`TODO | BRAINSTORMING | PLANNING | READY | EXECUTING | DONE | STUCK`), `Provider` enum (`ANTHROPIC | OPENAI | GOOGLE`), `Repository`, `ChatMessage`, `ExecutionPlan`, `AnalyticsEvent`
- [x] T014 [P] Define API request/response DTOs in `packages/shared/src/contracts.ts` matching `specs/001-loopforge-studio/contracts/api.openapi.yaml`
- [x] T015 [P] Create Prisma client singleton in `apps/api/src/prisma/client.ts` with connection pooling
- [x] T016 [P] Create Fastify app factory in `apps/api/src/app.ts` — register plugins: `@fastify/cors`, `@fastify/cookie`, `@fastify/sensible`, error handler, request logger
- [x] T017 [P] Configure Socket.io server in `apps/api/src/realtime/board.gateway.ts` — attach to Fastify HTTP server, JWT auth middleware on handshake, `/board` namespace
- [x] T018 [P] Create BullMQ queue setup in `apps/api/src/workers/queue.ts` — Redis connection, `execution-queue` queue, per-repo named queue helper
- [x] T019 [P] Configure Vite dev proxy in `apps/web/vite.config.ts` — proxy `/api` → `http://localhost:3001`, `/socket.io` → `http://localhost:3001`
- [x] T020 [P] Set up TailwindCSS + shadcn/ui in `apps/web` — `tailwind.config.ts`, `src/index.css`, initialize shadcn with `components.json`
- [x] T021 [P] Create React Router setup in `apps/web/src/main.tsx` with routes: `/` (BoardPage), `/task/:id` (TaskPage), `/settings` (SettingsPage), `/analytics` (AnalyticsPage), `/login` (LoginPage)
- [x] T022 Create API client in `apps/web/src/services/api.client.ts` — fetch wrapper with JWT cookie auth, typed request/response using `packages/shared` contracts
- [x] T023 [P] Create Socket.io client in `apps/web/src/services/socket.client.ts` — connect to `/board` namespace, reconnection logic, typed event emitters/listeners
- [x] T024 [P] Create SSE client utility in `apps/web/src/services/sse.client.ts` — `EventSource` wrapper with auth header injection, typed message parser, cleanup on unmount

**Checkpoint**: API starts (`pnpm --filter api dev`), Prisma migrations run, frontend builds (`pnpm --filter web dev`).

---

## Phase 3: User Story 1 — Task Creation & Kanban Board (Priority: P1) 🎯 MVP

**Goal**: Users can create tasks and see a 7-column Kanban board with tasks in correct columns.

**Independent Test**: Start the app, log in, create a task — it appears in the Todo column. All 7 columns are visible. Deleting a task removes it from the board.

### Implementation

- [x] T025 [P] [US1] Implement `TaskService` in `apps/api/src/services/task.service.ts` — `createTask`, `listTasks`, `getTask`, `updateTask`, `deleteTask`, `transitionStage` with valid-transition enforcement
- [x] T026 [P] [US1] Implement task REST routes in `apps/api/src/routes/tasks.ts` — `GET /tasks`, `POST /tasks`, `GET /tasks/:id`, `PATCH /tasks/:id`, `DELETE /tasks/:id`, `POST /tasks/:id/stage`
- [x] T027 [US1] Wire Socket.io board events in `apps/api/src/realtime/board.gateway.ts` — emit `task:created`, `task:updated`, `task:deleted`, `task:stage_changed` to authenticated user room on every `TaskService` mutation (depends on T025)
- [x] T028 [P] [US1] Create Zustand store in `apps/web/src/store/board.store.ts` — tasks state, `fetchTasks`, `createTask`, `deleteTask`, `updateTaskStage`, socket event handlers
- [x] T029 [P] [US1] Build `KanbanBoard` component in `apps/web/src/components/board/KanbanBoard.tsx` — renders 7 `KanbanColumn` components side by side, subscribes to Socket.io events via board store
- [x] T030 [P] [US1] Build `KanbanColumn` component in `apps/web/src/components/board/KanbanColumn.tsx` — displays column title, task count badge, scrollable list of `TaskCard` components
- [x] T031 [P] [US1] Build `TaskCard` component in `apps/web/src/components/board/TaskCard.tsx` — shows title, repo name, creation timestamp, stage badge, click navigates to `/task/:id`
- [x] T032 [P] [US1] Build `CreateTaskDialog` component in `apps/web/src/components/board/CreateTaskDialog.tsx` — modal with title + description fields + repo selector, calls `POST /tasks`
- [x] T033 [US1] Build `BoardPage` in `apps/web/src/pages/BoardPage.tsx` — renders `KanbanBoard`, `+ New Task` button triggering `CreateTaskDialog`, loads tasks on mount (depends on T029, T032)

**Checkpoint**: Board shows 7 columns with tasks. Creating a task appears in Todo. Deleting removes it. Board updates in real time across browser tabs.

---

## Phase 4: User Story 2 — GitHub OAuth Login & Repository Connection (Priority: P1)

**Goal**: Users authenticate via GitHub OAuth and connect repositories that persist across sessions.

**Independent Test**: Click "Sign in with GitHub", complete OAuth, land on board. Connect a repo, log out, log back in — repo connection persists.

### Implementation

- [x] T034 [P] [US2] Implement GitHub OAuth routes in `apps/api/src/auth/github.ts` — `GET /auth/github` (redirect), `GET /auth/github/callback` (exchange code, encrypt token, issue JWT cookie), `POST /auth/logout`, `GET /auth/me`
- [x] T035 [P] [US2] Implement `GithubService` in `apps/api/src/services/github.service.ts` — `getUserRepos`, `validateRepoAccess`, `getRepoDetails` using stored encrypted token
- [x] T036 [P] [US2] Implement repository REST routes in `apps/api/src/routes/repositories.ts` — `GET /repositories`, `GET /repositories/github`, `POST /repositories`, `DELETE /repositories/:id`
- [x] T037 [US2] Add JWT auth middleware in `apps/api/src/auth/middleware.ts` — verify JWT from cookie, attach `userId` to request context; protect all routes except `/auth/*` (depends on T034)
- [x] T038 [P] [US2] Build `LoginPage` in `apps/web/src/pages/LoginPage.tsx` — centered card with "Sign in with GitHub" button, redirects to `GET /auth/github`
- [x] T039 [P] [US2] Build auth store in `apps/web/src/store/auth.store.ts` — `user` state, `fetchMe`, `logout`, redirect-to-login guard
- [x] T040 [P] [US2] Build `ConnectRepoDialog` component in `apps/web/src/components/settings/ConnectRepoDialog.tsx` — lists `GET /repositories/github` results, connect button calls `POST /repositories`
- [x] T041 [US2] Build `SettingsPage` repository tab in `apps/web/src/pages/SettingsPage.tsx` — lists connected repos, disconnect button, `+ Connect Repo` opens `ConnectRepoDialog` (depends on T040)
- [x] T042 [US2] Add route guard in `apps/web/src/main.tsx` — unauthenticated users redirect to `/login`; authenticated users on `/login` redirect to `/` (depends on T039)

**Checkpoint**: GitHub OAuth flow completes end-to-end. Connected repos persist on re-login. All non-auth API routes reject unauthenticated requests with 401.

---

## Phase 5: User Story 3 — AI Brainstorming Chat (Priority: P2)

**Goal**: Users chat with AI about their task in real time with streaming responses.

**Independent Test**: Move a task to Brainstorming, send a message, AI streams a response within 5 seconds. Conversation history persists on page refresh.

### Implementation

- [x] T043 [P] [US3] Implement `AIProviderInterface` in `apps/api/src/providers/provider.interface.ts` — `stream(messages: ChatMessage[], options: ProviderOptions): AsyncIterable<string>`, provider factory function
- [x] T044 [P] [US3] Implement `AnthropicProvider` in `apps/api/src/providers/anthropic.provider.ts` — implements `AIProviderInterface`, uses `@anthropic-ai/sdk`, streams via `AsyncIterable`
- [x] T045 [P] [US3] Implement `OpenAIProvider` in `apps/api/src/providers/openai.provider.ts` — implements `AIProviderInterface`, uses `openai` SDK
- [x] T046 [P] [US3] Implement `GoogleProvider` in `apps/api/src/providers/google.provider.ts` — implements `AIProviderInterface`, uses `@google/generative-ai` SDK
- [x] T047 [US3] Implement chat REST + SSE routes in `apps/api/src/routes/chat.ts` — `GET /tasks/:id/chat` (history), `POST /tasks/:id/chat/stream` (SSE stream; uses provider factory to select provider from user ProviderConfig; persists messages; emits `data: {type:"chunk",...}` and `data: {type:"done",...}`) (depends on T043–T046)
- [x] T048 [P] [US3] Build `ChatMessage` component in `apps/web/src/components/chat/ChatMessage.tsx` — renders user or assistant message with markdown support, provider/model badge on assistant messages
- [x] T049 [P] [US3] Build `ChatInput` component in `apps/web/src/components/chat/ChatInput.tsx` — textarea + send button, disabled while streaming, Enter to send (Shift+Enter for newline)
- [x] T050 [P] [US3] Build `ProviderSelector` component in `apps/web/src/components/chat/ProviderSelector.tsx` — dropdown to select provider + model from configured `ProviderConfig`
- [x] T051 [US3] Build `BrainstormingPanel` component in `apps/web/src/components/chat/BrainstormingPanel.tsx` — full chat UI: message history list, `ChatInput`, `ProviderSelector`, SSE streaming via `sse.client.ts`, "Finalize plan" button triggers `POST /tasks/:id/stage` with `{stage: "PLANNING"}` (depends on T048–T050)
- [x] T052 [US3] Integrate `BrainstormingPanel` into `TaskPage` in `apps/web/src/pages/TaskPage.tsx` — rendered when `task.stage === "BRAINSTORMING"` (depends on T051)

**Checkpoint**: Brainstorming chat streams AI responses. History persists. "Finalize plan" moves task to Planning stage.

---

## Phase 6: User Story 4 — Plan Review & Approval (Priority: P2)

**Goal**: AI generates a step-by-step execution plan; user reviews and approves or rejects it.

**Independent Test**: Task in Planning shows numbered AI plan steps. Approving moves to Ready. Rejecting returns to Brainstorming with feedback visible in next chat.

### Implementation

- [x] T053 [P] [US4] Implement plan generation logic in `apps/api/src/services/task.service.ts` — on `BRAINSTORMING → PLANNING` transition, call AI provider to generate `ExecutionPlan` with numbered steps from conversation history; store with `status: PENDING_REVIEW`
- [x] T054 [P] [US4] Implement plan REST routes in `apps/api/src/routes/plans.ts` — `GET /tasks/:id/plan`, `POST /tasks/:id/plan/approve` (sets `APPROVED`, transitions task to `READY`, emits board event), `POST /tasks/:id/plan/reject` (sets `REJECTED` with feedback, transitions task back to `BRAINSTORMING`, emits board event)
- [x] T055 [P] [US4] Build `PlanStep` component in `apps/web/src/components/plan/PlanStep.tsx` — renders a single numbered plan step with description and estimated changes
- [x] T056 [P] [US4] Build `PlanRejectDialog` component in `apps/web/src/components/plan/PlanRejectDialog.tsx` — modal with feedback textarea, confirms rejection
- [x] T057 [US4] Build `PlanReviewPanel` component in `apps/web/src/components/plan/PlanReviewPanel.tsx` — lists all `PlanStep` components, "Approve" button calls `POST /tasks/:id/plan/approve`, "Request Changes" opens `PlanRejectDialog` (depends on T055–T056)
- [x] T058 [US4] Integrate `PlanReviewPanel` into `TaskPage` — rendered when `task.stage === "PLANNING"` (depends on T057)

**Checkpoint**: Plan review displays numbered steps. Approving moves task to Ready column. Rejecting returns it to Brainstorming with rejection feedback in next chat session.

---

## Phase 7: User Story 5 — AI Code Execution & Commits (Priority: P2)

**Goal**: Background worker executes AI coding tasks, commits to feature branches, streams live logs.

**Independent Test**: Task moves to Executing, live logs stream in UI within 2 seconds of each step. Commit appears on `loopforge/<task-id>-<slug>` branch in GitHub. Task moves to Done or Stuck with feedback.

### Implementation

- [x] T059 [P] [US5] Implement `ExecutionWorker` in `apps/api/src/workers/execution.worker.ts` — BullMQ worker processing `execution-queue`; picks up `READY` tasks; creates feature branch via GitHub API; runs AI coding loop (chat with codebase context); persists `ExecutionLog` entries; emits SSE events; transitions task to `DONE` or `STUCK`; enforces branch-is-not-main guard
- [x] T060 [P] [US5] Implement execution log REST + SSE routes in `apps/api/src/routes/logs.ts` — `GET /tasks/:id/logs` (persisted history), `GET /tasks/:id/logs/stream` (SSE: streams `ExecutionLog` entries in real time by polling BullMQ/DB for new entries while task is `EXECUTING`)
- [x] T061 [US5] Add job enqueue logic in `apps/api/src/services/task.service.ts` — on `PLANNING → READY` approval, add job to per-repo named BullMQ queue (depends on T059)
- [x] T062 [P] [US5] Build `LogEntry` component in `apps/web/src/components/logs/LogEntry.tsx` — renders a single log line with level badge (`INFO`, `ACTION`, `ERROR`, `COMMIT`), message, and timestamp
- [x] T063 [P] [US5] Build `ExecutionLogPanel` component in `apps/web/src/components/logs/ExecutionLogPanel.tsx` — auto-scrolling list of `LogEntry` components; connects to `GET /tasks/:id/logs/stream` SSE when task is `EXECUTING`; loads `GET /tasks/:id/logs` when `DONE`/`STUCK`
- [x] T064 [P] [US5] Build `StuckPanel` component in `apps/web/src/components/logs/StuckPanel.tsx` — displays stuck reason, suggested next steps, "Re-queue to Brainstorming" button
- [x] T065 [US5] Integrate `ExecutionLogPanel` and `StuckPanel` into `TaskPage` — rendered for `EXECUTING`/`DONE`/`STUCK` stages respectively (depends on T063–T064)

**Checkpoint**: Task executes end-to-end. Live logs stream. Commit appears on feature branch. Task reaches Done or Stuck with actionable message.

---

## Phase 8: User Story 6 — AI Provider Configuration (Priority: P3)

**Goal**: Users configure AI provider API keys and select default models in Settings.

**Independent Test**: Enter Anthropic key in Settings, select Claude Sonnet 4 as default. Open a new Brainstorming session — provider selector shows Anthropic as default. Enter invalid key — AI call shows clear error.

### Implementation

- [x] T066 [P] [US6] Implement provider config REST routes in `apps/api/src/routes/settings.ts` — `GET /settings/providers` (keys masked: `hasKey: true/false`), `PUT /settings/providers/:provider` (encrypts key via `EncryptionService`, stores), `DELETE /settings/providers/:provider`
- [x] T067 [P] [US6] Build `ProviderConfigCard` component in `apps/web/src/components/settings/ProviderConfigCard.tsx` — shows provider name, configured models dropdown, API key input (masked), save/delete buttons
- [x] T068 [US6] Build `SettingsPage` providers tab in `apps/web/src/pages/SettingsPage.tsx` — renders a `ProviderConfigCard` for each of Anthropic, OpenAI, Google; loads from `GET /settings/providers` (depends on T067)
- [x] T069 [US6] Add provider validation in `apps/api/src/routes/chat.ts` — before streaming, verify user has a `ProviderConfig` for requested provider; if missing or invalid key, return structured error `{type:"error", message:"..."}` in SSE stream (depends on T047)

**Checkpoint**: API keys save encrypted, display masked. Selecting provider in Brainstorming uses configured key. Missing/invalid key shows friendly error instead of crash.

---

## Phase 9: User Story 7 — Analytics Dashboard (Priority: P3)

**Goal**: Dashboard shows task completion metrics, token usage, and per-repo activity.

**Independent Test**: Complete two tasks. Open Analytics page — task count, success rate, and token breakdown by provider/model are visible. Per-repo totals match completed tasks.

### Implementation

- [x] T070 [P] [US7] Add `AnalyticsEvent` emission throughout `apps/api/src/services/task.service.ts` — emit events for `TASK_CREATED`, `STAGE_CHANGED`, `PLAN_APPROVED`, `PLAN_REJECTED`, `EXECUTION_STARTED`, `EXECUTION_COMPLETED`, `STUCK_DETECTED`, `COMMIT_PUSHED` with token counts where applicable
- [x] T071 [P] [US7] Implement analytics REST route in `apps/api/src/routes/analytics.ts` — `GET /analytics` aggregates `AnalyticsEvent` table: total/completed/stuck task counts, success rate, token totals by provider+model, per-repo breakdown
- [x] T072 [P] [US7] Build `MetricCard` component in `apps/web/src/components/analytics/MetricCard.tsx` — displays a single metric with label, value, and optional trend indicator
- [x] T073 [P] [US7] Build `TokenUsageChart` component in `apps/web/src/components/analytics/TokenUsageChart.tsx` — bar or table breakdown of token usage by provider and model
- [x] T074 [P] [US7] Build `RepoActivityTable` component in `apps/web/src/components/analytics/RepoActivityTable.tsx` — table of connected repos with task count and token spend columns
- [x] T075 [US7] Build `AnalyticsPage` in `apps/web/src/pages/AnalyticsPage.tsx` — renders summary `MetricCard` grid (total tasks, success rate, tokens used), `TokenUsageChart`, `RepoActivityTable`; loads from `GET /analytics` (depends on T072–T074)

**Checkpoint**: Analytics page loads data within 60 seconds of task completion. All metrics accurately reflect completed tasks and token usage.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: UX polish, error handling, and integration hardening across all stories.

- [x] T076 [P] Add global error boundary in `apps/web/src/components/ErrorBoundary.tsx` — catches render errors, displays friendly fallback UI
- [x] T077 [P] Add API error toast notifications in `apps/web/src/services/api.client.ts` — surface 4xx/5xx errors as dismissible toasts using shadcn `toast` component
- [x] T078 [P] Add rate limiting middleware in `apps/api/src/app.ts` using `@fastify/rate-limit` — 60 req/min per user on all routes; stricter limit on AI streaming endpoints
- [x] T079 [P] Add request validation in all Fastify routes using JSON Schema matching `packages/shared/src/contracts.ts` DTOs
- [x] T080 [P] Implement session refresh in `apps/api/src/auth/middleware.ts` — auto-reissue JWT cookie 24h before expiry; redirect to `/login` if GitHub token expired
- [x] T081 Add navigation header component in `apps/web/src/components/layout/Header.tsx` — logo, board/settings/analytics nav links, user avatar + logout button
- [x] T082 [P] Add loading skeleton components for board, task detail, and analytics using shadcn `Skeleton`
- [x] T083 [P] Add `.env.example` documentation comments explaining each variable and how to generate secrets
- [x] T084 Run quickstart validation per `specs/001-loopforge-studio/quickstart.md` — verify all 8 checklist items pass end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 Board (Phase 3)**: Depends on Phase 2 — no dependency on other stories
- **US2 Auth (Phase 4)**: Depends on Phase 2 — no dependency on other stories
- **US3 Chat (Phase 5)**: Depends on Phase 2 — integrates with US1 board events
- **US4 Plan (Phase 6)**: Depends on US3 (chat history drives plan generation)
- **US5 Execution (Phase 7)**: Depends on US4 (approved plan triggers execution)
- **US6 Providers (Phase 8)**: Depends on Phase 2 — can develop in parallel with US3–US5
- **US7 Analytics (Phase 9)**: Depends on Phase 2 — can develop after US5 for meaningful data
- **Polish (Phase 10)**: Depends on all user stories

### User Story Critical Path

```
Phase 1 → Phase 2 → US1 (P1) → US2 (P1) → US3 (P2) → US4 (P2) → US5 (P2) → DONE
                               ↘ US6 (P3) [parallel, independent]
                               ↘ US7 (P3) [parallel, after US5 for data]
```

### Within Each Phase

- Tasks marked `[P]` have no inter-dependencies and can run in parallel
- Tasks without `[P]` have explicit `depends on` notes
- Models/services before routes; routes before UI; UI components before pages

---

## Parallel Execution Examples

### Phase 2: Foundational (maximize parallelism)

```bash
# Launch in parallel:
Task: "T010 Define Prisma schema"         # blocks T011
Task: "T012 EncryptionService"
Task: "T013 Shared types"
Task: "T014 API DTOs"
Task: "T016 Fastify app factory"
Task: "T017 Socket.io gateway"
Task: "T018 BullMQ queue setup"
Task: "T020 Tailwind + shadcn setup"
Task: "T022 API client"

# Then after T010:
Task: "T011 Run Prisma migration"
```

### Phase 3: US1 Board

```bash
# Launch in parallel after T025:
Task: "T026 Task REST routes"
Task: "T028 Board Zustand store"
Task: "T029 KanbanBoard component"
Task: "T030 KanbanColumn component"
Task: "T031 TaskCard component"
Task: "T032 CreateTaskDialog"
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — Task Creation & Kanban Board
4. Complete Phase 4: US2 — GitHub Auth & Repository Connection
5. **STOP and VALIDATE**: Full login-to-board flow works; tasks create and display
6. Deploy/demo: Working board with auth

### Full Feature Delivery

1. Setup + Foundational → Foundation ready
2. US1 + US2 → Board + Auth → **Demo: Working board**
3. US3 (Chat) → **Demo: AI brainstorming**
4. US4 (Plan) → **Demo: Full approval gate**
5. US5 (Execution) → **Demo: End-to-end AI commits to GitHub**
6. US6 (Providers) + US7 (Analytics) → **Full product**
7. Polish → Production ready

---

## Notes

- `[P]` = parallelizable (different files, no unmet dependencies)
- `[USn]` = maps task to user story for traceability
- Each user story phase is independently completable and testable
- Commit after each phase or logical group
- Stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file parallel conflicts, cross-story dependencies
- Total task count: **84 tasks** across 10 phases
