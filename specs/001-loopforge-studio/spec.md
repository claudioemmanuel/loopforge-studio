# Feature Specification: Loopforge Studio

**Feature Branch**: `001-loopforge-studio`
**Created**: 2026-02-12
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Task Creation & Kanban Board (Priority: P1)

A developer opens Loopforge Studio, connects their GitHub repository, and creates a new task
describing a feature they want built. The task appears in the **Todo** column on a visual
Kanban board showing all seven workflow stages. The developer can see all their tasks, their
current stage, and navigate the board.

**Why this priority**: This is the foundational interaction — without task creation and the
board view, no other workflow is reachable. It is the entry point to the entire product.

**Independent Test**: Create a task, verify it appears in the Todo column. Board renders all
seven columns. Task card shows title and creation timestamp.

**Acceptance Scenarios**:

1. **Given** the user is logged in, **When** they create a task with a title and description,
   **Then** the task appears in the Todo column with correct metadata.
2. **Given** tasks exist across multiple columns, **When** the user views the board,
   **Then** all seven columns (Todo, Brainstorming, Planning, Ready, Executing, Done, Stuck)
   are visible with tasks in their correct columns.
3. **Given** a task exists, **When** the user deletes it, **Then** it is removed from the board.

---

### User Story 2 — GitHub OAuth Login & Repository Connection (Priority: P1)

A new user lands on Loopforge Studio and signs in via GitHub OAuth. After authentication, they
can browse and select which of their repositories to connect. Connected repos are stored
securely so the user does not need to re-authenticate on subsequent sessions.

**Why this priority**: GitHub connectivity is required for the core loop (AI commits to repos).
Without auth and repo selection, no AI execution can occur.

**Independent Test**: Complete GitHub OAuth flow, select a repo, verify it persists on
re-login without re-authenticating.

**Acceptance Scenarios**:

1. **Given** a new user, **When** they click "Sign in with GitHub" and complete OAuth,
   **Then** they are logged in and redirected to the board.
2. **Given** a logged-in user, **When** they connect a repository, **Then** the repo appears
   in their connected repos list and is available for task assignment.
3. **Given** a connected repo, **When** the session expires and the user logs back in,
   **Then** the repo connection persists without re-authorization.

---

### User Story 3 — AI Brainstorming Chat (Priority: P2)

A developer moves a task to the **Brainstorming** column and opens a live chat interface with
the AI. The AI analyzes the connected codebase and discusses implementation approaches. The
developer can ask questions, clarify requirements, and iterate until they have a solid approach.
The user selects their AI provider and model before or during the chat.

**Why this priority**: Brainstorming is the first AI-powered stage. It must work before
Planning is viable.

**Independent Test**: Move a task to Brainstorming, send a message, receive a streaming AI
response referencing the codebase. Switch provider mid-session.

**Acceptance Scenarios**:

1. **Given** a task in Brainstorming, **When** the user sends a message, **Then** the AI
   responds with streaming output visible in real time within 5 seconds.
2. **Given** the user selects "Anthropic / Claude Sonnet 4", **When** they send a message,
   **Then** responses come from that specific model.
3. **Given** a multi-turn chat, **When** the user signals readiness to finalize, **Then**
   the task advances to the Planning stage and the conversation is preserved.

---

### User Story 4 — Plan Review & Approval (Priority: P2)

After brainstorming, the AI generates a detailed step-by-step execution plan. The plan is
displayed in the **Planning** column for the user to review. The user can request changes,
accept the plan (advancing to **Ready**), or reject it (returning to Brainstorming).

**Why this priority**: The approval gate is a core product differentiator — AI must not
execute any code without explicit user sign-off.

**Independent Test**: Task in Planning shows AI-generated plan. Approving moves it to Ready.
Rejecting returns it to Brainstorming with feedback intact.

**Acceptance Scenarios**:

1. **Given** a task in Planning, **When** the user views it, **Then** the AI-generated plan
   is displayed with clear, numbered steps.
2. **Given** a plan displayed, **When** the user clicks "Approve", **Then** the task moves
   to the Ready column.
3. **Given** a plan displayed, **When** the user clicks "Reject / Request Changes",
   **Then** the task returns to Brainstorming with their feedback visible to the AI.

---

### User Story 5 — AI Code Execution & Commits (Priority: P2)

Tasks in the **Ready** column are queued for execution. A background worker picks them up,
runs the AI coding loop, and pushes commits to a feature branch on the connected GitHub
repository. The user watches live streaming output of the AI's actions. Completed tasks
move to **Done**; tasks the AI cannot complete move to **Stuck** with actionable feedback.

**Why this priority**: This is the core value delivery — actual code written and committed.

**Independent Test**: Approve a plan, observe task move to Executing, see live logs, verify
commit appears on a feature branch in GitHub, task moves to Done.

**Acceptance Scenarios**:

1. **Given** a task in Ready, **When** execution starts, **Then** the task moves to Executing
   and live AI action logs stream to the UI within 2 seconds of each step.
2. **Given** execution completes successfully, **When** the AI commits code, **Then** a commit
   appears on a dedicated feature branch (never main/master) and the task moves to Done.
3. **Given** the AI encounters an unresolvable blocker, **When** it detects it is stuck,
   **Then** the task moves to Stuck with a human-readable explanation and suggested next steps.

---

### User Story 6 — AI Provider Configuration (Priority: P3)

A user opens Settings and configures their preferred AI provider (Anthropic, OpenAI, or
Google) by entering their API key and selecting a default model. Keys are stored encrypted.
The user can switch providers globally or override per task.

**Why this priority**: Required for any AI interaction, but the default experience can ship
with a single provider configured. Multi-provider switching is an enhancement.

**Independent Test**: Enter Anthropic API key, select Claude Sonnet 4 as default. Open a
new task's brainstorming session and confirm it uses that model.

**Acceptance Scenarios**:

1. **Given** the Settings page, **When** a user enters a valid API key and saves,
   **Then** the key is stored and confirmed with a masked display (never shown in full).
2. **Given** multiple providers configured, **When** the user selects a provider per task,
   **Then** that task uses only the selected provider for all AI calls.
3. **Given** an invalid or expired API key, **When** an AI call is made, **Then** the user
   receives a clear error message with instructions to update the key.

---

### User Story 7 — Analytics Dashboard (Priority: P3)

A user views an analytics page showing task completion metrics, token usage over time,
and per-repository activity. Data is aggregated from all past task executions.

**Why this priority**: Analytics add value but are not required for the core workflow.

**Independent Test**: Complete two tasks, open the analytics page, verify both are reflected
in completion metrics and token counts.

**Acceptance Scenarios**:

1. **Given** completed tasks, **When** the user views the Analytics page, **Then** task
   completion count, success rate, and average time-to-completion are displayed.
2. **Given** multiple repos connected, **When** the user views per-repo activity,
   **Then** each repo shows its own task count and token spend.
3. **Given** token usage data, **When** the user views the dashboard, **Then** token counts
   are broken down by provider and model.

---

### Edge Cases

- What happens when the GitHub OAuth token expires mid-session? User is prompted to
  re-authenticate; in-progress task execution is paused and resumes after re-auth.
- What happens when an AI provider API key is rate-limited or returns an error? Task moves
  to Stuck with provider error details; user can retry or switch provider.
- What happens when the AI attempts to commit to `main`? The action is blocked; a feature
  branch is created automatically.
- What happens when a user has no repositories connected but tries to start Brainstorming?
  User is prompted to connect a repo before proceeding.
- What happens when two tasks are executing simultaneously for the same repo? Execution is
  serialized per repository to prevent conflicting commits.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to authenticate via GitHub OAuth and maintain a secure session.
- **FR-002**: System MUST allow users to connect one or more GitHub repositories to their account.
- **FR-003**: System MUST allow users to create, view, and delete tasks with a title and description.
- **FR-004**: System MUST display tasks on a Kanban board with seven columns: Todo, Brainstorming,
  Planning, Ready, Executing, Done, Stuck.
- **FR-005**: System MUST enforce valid workflow transitions; tasks MUST NOT skip stages.
- **FR-006**: System MUST provide a real-time AI chat interface during the Brainstorming stage.
- **FR-007**: System MUST generate a step-by-step execution plan during the Planning stage.
- **FR-008**: System MUST require explicit user approval before advancing a task from Planning to Ready.
- **FR-009**: System MUST execute AI coding tasks via a background worker when a task is in Ready.
- **FR-010**: System MUST commit AI-generated code exclusively to feature branches, never main/master.
- **FR-011**: System MUST stream live execution logs to the UI during the Executing stage.
- **FR-012**: System MUST detect stuck conditions and move tasks to Stuck with actionable feedback.
- **FR-013**: System MUST support Anthropic, OpenAI, and Google as AI providers via user-supplied keys.
- **FR-014**: System MUST store all API keys and OAuth tokens encrypted at rest.
- **FR-015**: System MUST provide an analytics dashboard with task metrics, token usage, and repo activity.
- **FR-016**: System MUST allow per-task or global AI provider and model selection.
- **FR-017**: System MUST serialize AI execution per repository to prevent conflicting commits.

### Key Entities

- **User**: Authenticated via GitHub OAuth; has connected repos, provider configs, and tasks.
- **Task**: Has title, description, current workflow stage, assigned repo, chat history, and plan.
- **Repository**: GitHub repo connected to a user; subject to branch isolation rules.
- **ExecutionPlan**: AI-generated step-by-step plan attached to a task; requires user approval.
- **ChatMessage**: Individual message in a brainstorming conversation; attributed to user or AI.
- **Commit**: GitHub commit created by AI execution; linked to task and feature branch.
- **ProviderConfig**: User's API key and model preference per AI provider; stored encrypted.
- **ExecutionLog**: Streaming log entry from the AI background worker for a task execution.
- **AnalyticsEvent**: Recorded task lifecycle event used to compute dashboard metrics.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the full workflow (Todo → Done) and see a commit on GitHub
  in under 15 minutes for a well-defined task.
- **SC-002**: AI brainstorming responses begin streaming within 5 seconds of sending a message.
- **SC-003**: Live execution logs appear in the UI within 2 seconds of each AI action during Executing.
- **SC-004**: 100% of AI commits land on feature branches; zero commits to main/master by the AI.
- **SC-005**: API keys and OAuth tokens are never exposed in logs, URLs, or API responses.
- **SC-006**: The system correctly detects and surfaces Stuck conditions for at least 95% of
  unresolvable AI failures (vs. silent timeouts or crashes).
- **SC-007**: Switching AI providers requires no changes outside the Settings page.
- **SC-008**: Analytics dashboard reflects completed tasks and token usage within 60 seconds
  of task completion.

## Assumptions

- Users are software developers comfortable with GitHub workflows.
- Self-hosted deployment targets a single-tenant architecture per installation.
- The AI coding execution uses an agent-loop model (e.g., Claude Code compatible).
- Real-time streaming is delivered via WebSockets or Server-Sent Events.
- Feature branches are named automatically using a convention like `loopforge/<task-id>-<slug>`.
- Token usage is tracked per AI API response and aggregated in the analytics store.
