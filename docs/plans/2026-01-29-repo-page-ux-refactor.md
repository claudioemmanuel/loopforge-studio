# Repository Page UX Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify repository page UX by removing redundant status indicators, standardizing to Alert component patterns, moving auto-approve to task level, and adding clear disabled states.

**Architecture:** Remove RepoSetupBanner and RepoStatusBadge components, refactor RepoSetupOverlay to use shadcn Alert component, move auto-approve toggle from repo header to per-task checkbox in NewTaskModal, add database migration for tasks.autoApprove column, disable New Task button and fade board when repo not cloned.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.7, Drizzle ORM, shadcn/ui, Tailwind CSS

---

## Task 1: Database Migration - Add tasks.autoApprove Column

**Files:**

- Create: `drizzle/0028_task_auto_approve.sql`
- Reference: `lib/db/schema/tables.ts:129-149` (tasks table definition)

**Step 1: Create migration file**

Create `drizzle/0028_task_auto_approve.sql`:

```sql
-- Migration: Add auto_approve column to tasks table
-- Date: 2026-01-29
-- Purpose: Move auto-approve from repo-level to task-level for granular control

-- Add auto_approve column to tasks table
ALTER TABLE "tasks" ADD COLUMN "auto_approve" boolean NOT NULL DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS "idx_tasks_auto_approve" ON "tasks" ("auto_approve");

-- Migrate existing tasks to inherit repo's autoApprove setting
UPDATE "tasks" t
SET "auto_approve" = r."auto_approve"
FROM "repos" r
WHERE t."repo_id" = r."id"
AND r."auto_approve" = true;

-- Add comment for documentation
COMMENT ON COLUMN "tasks"."auto_approve" IS 'When true, automatically commit and push changes when tests pass. Overrides manual review requirement.';
```

**Step 2: Apply migration to Docker postgres**

Run:

```bash
docker compose exec postgres psql -U postgres -d loopforge < drizzle/0028_task_auto_approve.sql
```

Expected output:

```
ALTER TABLE
CREATE INDEX
UPDATE <N>
COMMENT
```

**Step 3: Verify column added**

Run:

```bash
docker compose exec postgres psql -U postgres -d loopforge -c "\d tasks" | grep auto_approve
```

Expected: `auto_approve | boolean | not null | false`

**Step 4: Update TypeScript schema**

Modify `lib/db/schema/tables.ts:129-149` (tasks table):

```typescript
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  repoId: uuid("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("todo"),
  priority: integer("priority").notNull().default(0),
  brainstormResult: text("brainstorm_result"),
  brainstormConversation: text("brainstorm_conversation"),
  brainstormSummary: text("brainstorm_summary"),
  brainstormMessageCount: integer("brainstorm_message_count").default(0),
  brainstormCompactedAt: timestamp("brainstorm_compacted_at"),
  planContent: text("plan_content"),
  branch: text("branch"),
  autonomousMode: boolean("autonomous_mode").notNull().default(false),
  autoApprove: boolean("auto_approve").notNull().default(false), // NEW
  processingPhase: processingPhaseEnum("processing_phase"),
  processingJobId: text("processing_job_id"),
  // ... rest of fields
});
```

**Step 5: Commit**

```bash
git add drizzle/0028_task_auto_approve.sql lib/db/schema/tables.ts
git commit -m "feat(db): add auto_approve column to tasks table

- Add tasks.auto_approve for per-task approval control
- Migrate existing tasks to inherit repo autoApprove setting
- Add index for efficient filtering

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Update API Route - Accept autoApprove in Task Creation

**Files:**

- Modify: `app/api/repos/[repoId]/tasks/route.ts`
- Reference: `lib/db/schema/tables.ts:129` (tasks schema)

**Step 1: Update POST request validation**

Modify `app/api/repos/[repoId]/tasks/route.ts` (around line 20-40):

```typescript
export const POST = withAuth(async (request, { user }) => {
  const repoId = params.repoId;
  const body = await request.json();

  // Validate request body
  const { title, description, autonomousMode, autoApprove } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return errorResponse(Errors.invalidInput("Title is required"));
  }

  // Validate autoApprove is boolean if provided
  if (autoApprove !== undefined && typeof autoApprove !== "boolean") {
    return errorResponse(Errors.invalidInput("autoApprove must be boolean"));
  }

  // ... rest of validation
});
```

**Step 2: Include autoApprove in database insert**

Modify the insert statement (around line 60-80):

```typescript
const [task] = await db
  .insert(tasks)
  .values({
    repoId,
    title: title.trim(),
    description: description?.trim() || null,
    autonomousMode: autonomousMode || false,
    autoApprove: autoApprove || false, // NEW
    status: "todo",
    priority: 0,
  })
  .returning();
```

**Step 3: Test API endpoint manually**

Run (ensure dev server running):

```bash
# Get a repo ID from database
REPO_ID=$(docker compose exec postgres psql -U postgres -d loopforge -t -c "SELECT id FROM repos LIMIT 1;" | xargs)

# Test creating task with autoApprove
curl -X POST http://localhost:3000/api/repos/$REPO_ID/tasks \
  -H "Content-Type: application/json" \
  -H "Cookie: $(curl -s http://localhost:3000/api/auth/session | grep -o 'session=[^;]*')" \
  -d '{"title":"Test auto-approve task","autoApprove":true}'
```

Expected: 200 response with task object containing `"autoApprove": true`

**Step 4: Commit**

```bash
git add app/api/repos/[repoId]/tasks/route.ts
git commit -m "feat(api): accept autoApprove in task creation

- Add autoApprove validation in POST /api/repos/:id/tasks
- Store autoApprove value in tasks table
- Default to false if not provided

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Refactor RepoSetupOverlay - Use Alert Component

**Files:**

- Modify: `components/repo-setup/repo-setup-overlay.tsx`
- Reference: `components/ui/alert.tsx` (shadcn Alert component)

**Step 1: Update imports**

Replace imports in `components/repo-setup/repo-setup-overlay.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // NEW
import { GitBranch, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils"; // NEW
```

**Step 2: Replace component structure**

Replace the return statement (lines 53-109):

```typescript
// Don't show overlay if cloned
if (isCloned) {
  return null;
}

return (
  <div className="absolute inset-0 z-20 flex items-start justify-center bg-background/80 backdrop-blur-md pt-12 px-4">
    <Alert
      variant={cloneStatus === "error" ? "destructive" : "default"}
      className="max-w-2xl border-2 shadow-lg"
    >
      <GitBranch className="h-5 w-5" />
      <AlertTitle className="text-lg font-semibold">
        {cloneStatus === "error" ? "Clone Failed" : "Repository Setup Required"}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-4">
        <p className="text-sm">
          {cloneStatus === "cloning"
            ? `Cloning ${repoName}... This may take a few moments.`
            : cloneStatus === "error"
              ? errorMessage || "Failed to clone repository. Please try again."
              : "Clone this repository to start executing AI tasks. You can still organize tasks while it's not cloned."}
        </p>

        <div className="flex gap-2">
          {cloneStatus === "idle" && (
            <Button size="lg" onClick={handleClone} className="gap-2">
              <GitBranch className="w-4 h-4" />
              Clone Repository
            </Button>
          )}

          {cloneStatus === "cloning" && (
            <Button size="lg" disabled className="gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cloning...
            </Button>
          )}

          {cloneStatus === "error" && (
            <Button
              size="lg"
              onClick={handleClone}
              variant="destructive"
              className="gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              Try Again
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Tasks can be created and organized without cloning.
          Execution requires the repository to be cloned.
        </p>
      </AlertDescription>
    </Alert>
  </div>
);
```

**Step 3: Test overlay appearance**

Run dev server and navigate to repo page with uncloned repo:

```bash
npm run dev
# Open http://localhost:3000/repos/<uncloned-repo-id>
```

Expected:

- Top-aligned Alert (not centered)
- Stronger backdrop blur (more opaque)
- Blue border for default, red for error
- Clean button progression (Clone → Cloning → Try Again)

**Step 4: Commit**

```bash
git add components/repo-setup/repo-setup-overlay.tsx
git commit -m "refactor(ui): use Alert component in RepoSetupOverlay

- Replace centered card with top-aligned Alert
- Use shadcn Alert variants (default/destructive)
- Increase backdrop blur from backdrop-blur-[2px] to backdrop-blur-md
- Improve visual hierarchy with stronger fade

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Remove RepoSetupBanner from Repo Page

**Files:**

- Modify: `app/(dashboard)/repos/[repoId]/page.tsx`

**Step 1: Remove banner import**

Remove from imports (line 27):

```typescript
// DELETE THIS LINE:
import { RepoSetupBanner, RepoSetupOverlay } from "@/components/repo-setup";

// REPLACE WITH:
import { RepoSetupOverlay } from "@/components/repo-setup";
```

**Step 2: Remove banner rendering**

Delete lines 283-293:

```typescript
// DELETE THIS ENTIRE BLOCK:
{repo && !repo.isCloned && (
  <div className="px-6 lg:px-8 pt-4">
    <RepoSetupBanner
      repoId={repoId}
      repoName={repo.name}
      isCloned={repo.isCloned}
      onCloneComplete={fetchData}
    />
  </div>
)}
```

**Step 3: Add board fade when not cloned**

Modify main element (line 296):

```typescript
<main className={cn(
  "flex-1 overflow-hidden px-6 lg:px-8 py-6 relative transition-opacity duration-300",
  !repo?.isCloned && "opacity-40"
)}>
```

**Step 4: Test visual changes**

Run dev server and check:

```bash
npm run dev
# Navigate to uncloned repo
```

Expected:

- No yellow warning banner at top
- Kanban board faded (40% opacity)
- Only overlay Alert visible

**Step 5: Commit**

```bash
git add app/(dashboard)/repos/[repoId]/page.tsx
git commit -m "refactor(ui): remove redundant RepoSetupBanner

- Remove yellow warning banner (redundant with overlay)
- Add 40% opacity fade to board when not cloned
- Keep only RepoSetupOverlay for clone status

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Simplify RepoHeader - Remove Badge and Auto-Approve Toggle

**Files:**

- Modify: `app/(dashboard)/repos/[repoId]/repo-header.tsx`
- Reference: `components/repo-status-indicator.tsx` (RepoStatusBadge to remove)

**Step 1: Remove auto-approve toggle state and handler**

Delete lines 34-54 (handleToggleAutoApprove function and state):

```typescript
// DELETE THIS ENTIRE BLOCK:
const [togglingAutoApprove, setTogglingAutoApprove] = useState(false);

const handleToggleAutoApprove = async () => {
  if (!repo) return;
  setTogglingAutoApprove(true);
  try {
    const res = await fetch(`/api/repos/${repo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoApprove: !repo.autoApprove }),
    });
    if (res.ok) {
      const updated = await res.json();
      onRepoUpdate?.(updated);
    }
  } catch (err) {
    console.error("Failed to toggle auto-approve", err);
  } finally {
    setTogglingAutoApprove(false);
  }
};
```

**Step 2: Remove auto-approve button from actions**

Delete lines 68-95:

```typescript
// DELETE THIS ENTIRE BLOCK:
{repo && (
  <button
    onClick={handleToggleAutoApprove}
    disabled={togglingAutoApprove}
    className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
      repo.autoApprove
        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted",
      togglingAutoApprove && "opacity-50 cursor-not-allowed",
    )}
    title={
      repo.autoApprove
        ? "Auto-approve enabled: changes are committed automatically when tests pass"
        : "Auto-approve disabled: changes require manual review"
    }
  >
    <Zap
      className={cn(
        "w-3.5 h-3.5",
        repo.autoApprove && "text-amber-500",
      )}
    />
    <span className="hidden sm:inline">
      Auto-approve {repo.autoApprove ? "on" : "off"}
    </span>
  </button>
)}
```

**Step 3: Add disabled state to New Task button**

Modify New Task button (line 108):

```typescript
<Button
  onClick={onNewTask}
  size="sm"
  className="gap-2"
  disabled={!repo?.isCloned}
  title={!repo?.isCloned ? "Clone repository to create tasks" : undefined}
>
  <Plus className="w-4 h-4" />
  <span>New Task</span>
</Button>
```

**Step 4: Remove RepoStatusBadge from title area**

Delete lines 122-127:

```typescript
// DELETE THIS BLOCK:
{repo && (
  <RepoStatusBadge
    isCloned={repo.isCloned}
    indexingStatus={repo.indexingStatus}
  />
)}
```

**Step 5: Add header fade when not cloned**

Modify header element (line 56):

```typescript
<header className={cn(
  "flex-shrink-0 border-b bg-card/50 backdrop-blur-sm transition-opacity duration-300",
  !repo?.isCloned && "opacity-60"
)}>
```

**Step 6: Remove unused imports**

Remove from imports (lines 8, 10):

```typescript
// DELETE:
import { Zap } from "lucide-react";
import { RepoStatusBadge } from "@/components/repo-status-indicator";
```

**Step 7: Test header changes**

Run dev server and verify:

```bash
npm run dev
```

Expected:

- No "Auto-approve on/off" button
- No "Not Cloned" badge next to repo name
- New Task button grayed out when not cloned
- Hover on disabled button shows tooltip
- Header slightly faded (60% opacity) when not cloned

**Step 8: Commit**

```bash
git add app/(dashboard)/repos/[repoId]/repo-header.tsx
git commit -m "refactor(ui): simplify header - remove badge and auto-approve

- Remove RepoStatusBadge (redundant with overlay)
- Remove auto-approve toggle (moving to task level)
- Disable New Task button when repo not cloned
- Add tooltip explaining disabled state
- Add 60% opacity fade to header when not cloned

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Add Auto-Approve Checkbox to New Task Modal

**Files:**

- Modify: `components/modals/new-task-modal.tsx`
- Reference: `lib/db/schema/tables.ts:145` (tasks.autoApprove)

**Step 1: Add autoApprove state**

Add after line 37:

```typescript
const [title, setTitle] = useState("");
const [description, setDescription] = useState("");
const [autonomousMode, setAutonomousMode] = useState(false);
const [autoApprove, setAutoApprove] = useState(false); // NEW
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Step 2: Update API call to include autoApprove**

Modify handleSubmit function (around line 52):

```typescript
const res = await fetch(`/api/repos/${repoId}/tasks`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title,
    description,
    autonomousMode,
    autoApprove, // NEW
  }),
});
```

**Step 3: Read modal content to find insertion point**

```bash
grep -n "Autonomous Mode" components/modals/new-task-modal.tsx
```

Expected: Find the autonomous mode section (around line 160-200)

**Step 4: Add auto-approve checkbox after autonomous mode**

Insert after the autonomous mode section (after line ~195, before form actions):

```typescript
{/* Auto-approve checkbox */}
<div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30 hover:bg-muted/40 transition-colors">
  <input
    type="checkbox"
    id="autoApprove"
    checked={autoApprove}
    onChange={(e) => setAutoApprove(e.target.checked)}
    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
  />
  <div className="flex-1 cursor-pointer" onClick={() => setAutoApprove(!autoApprove)}>
    <label htmlFor="autoApprove" className="flex items-center gap-2 cursor-pointer font-medium text-sm">
      <Zap className={cn("w-4 h-4 transition-colors", autoApprove && "text-amber-500")} />
      <span>Auto-approve changes</span>
    </label>
    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
      Automatically commit and push changes when tests pass.
      Useful for low-risk tasks like documentation or refactoring.
    </p>
  </div>
</div>
```

**Step 5: Test modal functionality**

Run dev server and test:

```bash
npm run dev
# Navigate to cloned repo
# Click New Task button
```

Expected:

- Checkbox appears below autonomous mode
- Checkbox unchecked by default
- Icon turns yellow/amber when checked
- Clicking label or surrounding div toggles checkbox
- Task created with autoApprove value

**Step 6: Commit**

```bash
git add components/modals/new-task-modal.tsx
git commit -m "feat(ui): add auto-approve checkbox to New Task modal

- Add autoApprove state (default false)
- Include autoApprove in API request
- Add checkbox with Zap icon below autonomous mode
- Explain auto-approve behavior in help text
- Yellow accent when checked

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Prevent Modal Opening When Repo Not Cloned

**Files:**

- Modify: `app/(dashboard)/repos/[repoId]/page.tsx`

**Step 1: Add conditional check in onNewTask callback**

Modify RepoHeader component usage (line 274):

```typescript
<RepoHeader
  repo={repo}
  taskStats={taskStats}
  refreshing={refreshing}
  onRefresh={handleRefresh}
  onNewTask={() => {
    if (repo?.isCloned) {
      setShowNewTask(true);
    }
    // If not cloned, button is disabled so this won't be called
    // But add check for defensive programming
  }}
  onRepoUpdate={setRepo}
/>
```

**Step 2: Add safety check in modal rendering**

Modify NewTaskModal rendering (line 342):

```typescript
{/* New Task Modal */}
{showNewTask && repo?.isCloned && (
  <NewTaskModal
    repoId={repoId}
    onClose={() => setShowNewTask(false)}
    onCreate={handleTaskCreatedAndClose}
  />
)}
```

**Step 3: Test defensive checks**

Run dev server and verify:

```bash
npm run dev
```

Test cases:

1. Uncloned repo: New Task button disabled, clicking does nothing
2. Cloned repo: New Task button enabled, modal opens
3. Manual state manipulation: Even if showNewTask becomes true, modal won't render if not cloned

Expected: Modal never opens when repo not cloned

**Step 4: Commit**

```bash
git add app/(dashboard)/repos/[repoId]/page.tsx
git commit -m "fix(ui): prevent task modal opening when repo not cloned

- Add conditional check in onNewTask callback
- Add safety check in modal rendering condition
- Defensive programming for edge cases

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Manual Testing & Verification

**Files:**

- None (testing phase)

**Step 1: Test uncloned repo experience**

Start fresh:

```bash
npm run dev
# Navigate to uncloned repo: http://localhost:3000/repos/<uncloned-id>
```

Verify:

- ✅ No yellow warning banner at top
- ✅ No "Not Cloned" badge next to repo name
- ✅ No "Auto-approve on/off" button in header
- ✅ New Task button disabled and grayed out
- ✅ Hover on New Task shows "Clone repository to create tasks"
- ✅ Kanban board faded (40% opacity)
- ✅ Header faded (60% opacity)
- ✅ Top-aligned Alert visible with "Repository Setup Required"
- ✅ Alert has blue border (default variant)

**Step 2: Test clone flow**

In same repo:

1. Click "Clone Repository" button in Alert
   - ✅ Button changes to "Cloning..." with spinner
   - ✅ Background stays faded

2. Wait for clone to complete
   - ✅ Alert auto-hides after 1.5s
   - ✅ Board fade removed (100% opacity)
   - ✅ Header fade removed (100% opacity)
   - ✅ New Task button becomes enabled

**Step 3: Test cloned repo experience**

Navigate to cloned repo:

```bash
# Navigate to cloned repo: http://localhost:3000/repos/<cloned-id>
```

Verify:

- ✅ No Alert overlay
- ✅ Board fully visible (no fade)
- ✅ New Task button enabled
- ✅ Clean header without redundant indicators

**Step 4: Test task creation with auto-approve**

1. Click "New Task" button
   - ✅ Modal opens

2. Fill in task details:
   - Title: "Test auto-approve feature"
   - Description: "Verify auto-approve checkbox works"
   - Check "Auto-approve changes" checkbox
   - ✅ Zap icon turns yellow/amber when checked

3. Submit form
   - ✅ Task created successfully
   - ✅ Task appears on board

4. Verify task in database:

```bash
docker compose exec postgres psql -U postgres -d loopforge -c "SELECT title, auto_approve FROM tasks WHERE title = 'Test auto-approve feature';"
```

Expected output:

```
           title            | auto_approve
----------------------------+--------------
 Test auto-approve feature | t
```

**Step 5: Test error state in overlay**

Simulate clone error by stopping postgres temporarily:

```bash
docker compose stop postgres
# Try cloning repo in UI
# Restart: docker compose start postgres
```

Verify:

- ✅ Alert turns red (destructive variant)
- ✅ Error message displayed
- ✅ Button changes to "Try Again" with AlertCircle icon

**Step 6: Document test results**

Create test summary:

```bash
echo "# Manual Test Results - Repo Page UX Refactor

## Uncloned Repo ✅
- No banner, no badge, no auto-approve toggle
- New Task disabled with tooltip
- Board and header faded
- Alert overlay with blue border

## Clone Flow ✅
- Cloning state with spinner
- Auto-hide on success
- Fade removal on completion

## Cloned Repo ✅
- No overlay, no fade
- New Task enabled
- Clean header

## Task Creation ✅
- Auto-approve checkbox works
- Yellow icon when checked
- Saves to database correctly

## Error Handling ✅
- Red Alert on clone failure
- Retry button appears
- Error message displayed

All acceptance criteria met.
" > /tmp/repo-ux-refactor-test-results.txt

cat /tmp/repo-ux-refactor-test-results.txt
```

**Step 7: Final commit (if any fixes needed)**

If bugs found during testing, fix them and commit:

```bash
git add <fixed-files>
git commit -m "fix(ui): address manual testing findings

- <describe fixes>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Cleanup & Documentation

**Files:**

- Modify: `CHANGELOG.md` (if exists)
- Create: `docs/plans/2026-01-29-repo-page-ux-refactor-implementation-notes.md`

**Step 1: Document implementation notes**

Create implementation notes:

```bash
cat > docs/plans/2026-01-29-repo-page-ux-refactor-implementation-notes.md << 'EOF'
# Repository Page UX Refactor - Implementation Notes

**Date**: 2026-01-29
**Branch**: feat/repo-page-ux-refactor
**Status**: Complete

## Summary

Successfully refactored repository page UX to simplify status indicators and move auto-approve to task level.

## Changes Made

### Database
- Migration `0028_task_auto_approve.sql` added `tasks.auto_approve` column
- Migrated existing tasks to inherit repo's autoApprove setting
- Added index for efficient filtering

### Components Removed
- `RepoSetupBanner` component (yellow warning banner)
- `RepoStatusBadge` usage in repo header
- Auto-approve toggle button from repo header

### Components Modified
- `RepoSetupOverlay`: Replaced centered card with top-aligned Alert component
- `RepoHeader`: Removed badge and toggle, added disabled state to New Task button
- `NewTaskModal`: Added auto-approve checkbox with explanation
- `RepoPage`: Removed banner, added board/header fade when not cloned

### API Changes
- `POST /api/repos/:id/tasks` now accepts `autoApprove` boolean parameter

## Testing Results

All acceptance criteria met:
✅ Single status indicator (overlay only)
✅ Alert component matches app patterns
✅ Clear disabled states (button + tooltips)
✅ Board and header fade appropriately
✅ Auto-approve moved to task level
✅ Smooth opacity transitions

## Migration Path

For existing tasks:
- Tasks inherit repo's autoApprove setting during migration
- New tasks default to autoApprove=false
- Users explicitly opt-in per task

## Known Limitations

- Repo-level autoApprove column retained for backward compatibility
- Not currently used in UI but kept for potential future use

## Future Enhancements

- Bulk auto-approve toggle for multiple tasks
- User preference for default auto-approve per repo
- Conditional auto-approve (e.g., only if test coverage > 80%)

EOF

cat docs/plans/2026-01-29-repo-page-ux-refactor-implementation-notes.md
```

**Step 2: Commit documentation**

```bash
git add docs/plans/2026-01-29-repo-page-ux-refactor-implementation-notes.md
git commit -m "docs: add repo page UX refactor implementation notes

- Document changes made
- Include testing results
- Note migration path for existing tasks
- List future enhancement ideas

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Step 3: Review all commits**

```bash
git log --oneline origin/main..HEAD
```

Expected: 9 commits covering database, API, components, testing, and docs

**Step 4: Push branch**

```bash
git push -u origin feat/repo-page-ux-refactor
```

---

## Success Criteria

- ✅ Database migration applied successfully
- ✅ No yellow warning banner visible
- ✅ No "Not Cloned" badge in header
- ✅ No repo-level auto-approve toggle
- ✅ Alert component used for overlay
- ✅ New Task button disabled when not cloned
- ✅ Board fades to 40% opacity when not cloned
- ✅ Header fades to 60% opacity when not cloned
- ✅ Auto-approve checkbox in New Task modal
- ✅ Auto-approve saves to database correctly
- ✅ All manual tests pass
- ✅ Clean commit history with co-authorship

---

## Rollback Plan

If issues arise:

1. Revert branch:

```bash
git checkout main
git branch -D feat/repo-page-ux-refactor
```

2. Rollback database migration:

```bash
docker compose exec postgres psql -U postgres -d loopforge -c "ALTER TABLE tasks DROP COLUMN auto_approve;"
docker compose exec postgres psql -U postgres -d loopforge -c "DROP INDEX IF EXISTS idx_tasks_auto_approve;"
```

3. Components will revert to previous behavior automatically

---

**Plan Complete**: 9 tasks covering database, API, components, testing, and documentation.
