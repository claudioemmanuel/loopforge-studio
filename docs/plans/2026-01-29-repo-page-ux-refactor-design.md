# Repository Page UX Refactor - Design Document

**Date**: 2026-01-29
**Status**: Approved
**Objective**: Simplify repository page UX by removing redundant status indicators, standardizing warning patterns, and moving auto-approve to task level.

---

## Problem Statement

The current repository page has several UX issues:

1. **Redundant status indicators**: Yellow warning banner + "Not Cloned" badge + overlay (3 places showing same status)
2. **Inconsistent warning patterns**: Yellow banner doesn't follow shadcn/ui Alert patterns used elsewhere
3. **Wrong abstraction level**: Auto-approve is repo-level but should be task-level (users want different behavior per task)
4. **Unclear disabled state**: New Task button enabled even when repo not cloned, page not sufficiently faded
5. **Visual clutter**: Status badge competes with repo name in header

---

## Design Solution

### Architecture

**Files Modified:**

1. `components/repo-setup/repo-setup-overlay.tsx` - Replace centered card with Alert component
2. `app/(dashboard)/repos/[repoId]/repo-header.tsx` - Remove badge & auto-approve toggle, disable New Task button
3. `components/modals/new-task-modal.tsx` - Add auto-approve checkbox
4. `app/(dashboard)/repos/[repoId]/page.tsx` - Remove banner, add board fade

**Component Hierarchy:**

```
RepoPage
├─ RepoHeader (no badge, conditional New Task button)
├─ Main (Kanban Board with conditional fade)
│  └─ RepoSetupOverlay (Alert-based, top-positioned)
└─ NewTaskModal (with auto-approve checkbox)
```

---

## Component Designs

### 1. RepoSetupOverlay - Alert-Based Design

**Current**: Centered card with icon, title, description, button
**New**: Top-aligned Alert component with stronger backdrop blur

**Implementation:**

```tsx
<div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-md">
  <div className="flex items-start justify-center pt-12 px-4">
    <Alert
      variant={cloneStatus === "error" ? "destructive" : "default"}
      className="max-w-2xl"
    >
      <GitBranch className="h-5 w-5" />
      <AlertTitle>Repository Setup Required</AlertTitle>
      <AlertDescription>
        {cloneStatus === "cloning"
          ? `Cloning ${repoName}...`
          : cloneStatus === "error"
            ? errorMessage || "Failed to clone repository. Please try again."
            : "Clone this repository to start executing AI tasks. You can still organize tasks while it's not cloned."}
      </AlertDescription>
      {/* Button states: Clone Repository / Cloning... / Try Again */}
    </Alert>
  </div>
</div>
```

**Key Changes:**

- Backdrop: `bg-background/60 backdrop-blur-[2px]` → `bg-background/80 backdrop-blur-md` (stronger fade)
- Position: Centered → Top-aligned (`pt-12`)
- Component: Custom card → shadcn Alert
- Variants: Default (blue) for idle, Destructive (red) for error
- Auto-hide on success after 1.5s

---

### 2. RepoHeader - Simplified

**Removed:**

- RepoStatusBadge component (lines 122-127)
- Auto-approve toggle button (lines 68-95)

**Added:**

- Disabled state for New Task button when `!repo?.isCloned`
- Tooltip explaining why disabled
- Subtle opacity fade when not cloned

**Implementation:**

```tsx
// Add opacity to entire header
<header className={cn(
  "flex-shrink-0 border-b bg-card/50 backdrop-blur-sm transition-opacity duration-300",
  !repo?.isCloned && "opacity-60"
)}>

// Disable New Task button
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

**Result**: Clean header without redundant status indicators or misplaced controls.

---

### 3. NewTaskModal - Task-Level Auto-Approve

**Added:**

- `autoApprove` state (boolean)
- Checkbox with Zap icon and explanation
- Include `autoApprove` in API request body

**Implementation:**

```tsx
// State
const [autoApprove, setAutoApprove] = useState(false);

// API call
body: (JSON.stringify({
  title,
  description,
  autonomousMode,
  autoApprove,
}),
  (
    // UI (after Autonomous Mode section)
    <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
      <input
        type="checkbox"
        id="autoApprove"
        checked={autoApprove}
        onChange={(e) => setAutoApprove(e.target.checked)}
        className="mt-1"
      />
      <div className="flex-1">
        <label
          htmlFor="autoApprove"
          className="flex items-center gap-2 cursor-pointer"
        >
          <Zap className={cn("w-4 h-4", autoApprove && "text-amber-500")} />
          <span className="font-medium text-sm">Auto-approve changes</span>
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          Automatically commit and push changes when tests pass. Useful for
          low-risk tasks like documentation or refactoring.
        </p>
      </div>
    </div>
  ));
```

**Visual Treatment:**

- Yellow accent when checked (matches Zap icon)
- Clear explanation of behavior
- Positioned after Autonomous Mode for logical grouping

**Rationale**: Different tasks need different approval levels. Hotfixes may auto-approve, architecture changes need review. Task-level provides precise control.

---

### 4. RepoPage - Orchestration

**Removed:**

- RepoSetupBanner import and usage (lines 27, 283-293)

**Modified:**

- Prevent modal opening when not cloned
- Add fade to Kanban board (40% opacity when not cloned)

**Implementation:**

```tsx
// Header callback
<RepoHeader
  onNewTask={() => {
    if (repo?.isCloned) setShowNewTask(true);
  }}
  ...
/>

// Board fade
<main className={cn(
  "flex-1 overflow-hidden px-6 lg:px-8 py-6 relative transition-opacity duration-300",
  !repo?.isCloned && "opacity-40"
)}>
```

---

## User Flow

### Not Cloned State

1. User lands on repo page
2. Header: Repo name visible, New Task button **disabled** (grayed)
3. Board: **Faded** (40% opacity) with overlay
4. Overlay: Alert showing "Repository Setup Required" with Clone button

### Cloning State

1. User clicks "Clone Repository"
2. Alert shows loading state with spinner
3. Background stays faded during clone operation

### Clone Complete

1. Alert shows success state briefly (1.5s)
2. Fade removed from board (opacity: 100%)
3. Header New Task button becomes **enabled**
4. Overlay auto-hides

### Creating Task (Cloned)

1. User clicks New Task (now enabled)
2. Modal opens with title, description, autonomous mode, **auto-approve checkbox**
3. User decides per-task whether to auto-approve
4. Task created with specified auto-approve preference

---

## Design Principles Applied

### KERNEL Framework (from PROMPT-ENGINEERING.md)

**Keep It Simple:**

- One status indicator (overlay), not three (banner + badge + overlay)
- Clear visual hierarchy: faded board = blocked state

**Easy to Verify:**

- Disabled button = can't create tasks
- Faded board = can't execute
- Alert message = clear next action

**Reproducible Results:**

- Follows existing shadcn/ui Alert patterns
- Consistent with other warning/confirmation dialogs

**Narrow Scope:**

- Auto-approve moved to correct abstraction level (task, not repo)
- Each component has single responsibility

**Explicit Constraints:**

- New Task button disabled state prevents confusion
- Tooltip explains why disabled

**Logical Structure:**

- Top-aligned Alert (less blocking than centered)
- Progressive disclosure: clone → enable → create

---

## Technical Considerations

### Database Schema

**Existing:**

- `repos.autoApprove` column (boolean, default false)

**New:**

- `tasks.autoApprove` column (boolean, default false) - **Needs migration**

### API Changes

**POST /api/repos/[repoId]/tasks:**

- Accept `autoApprove` in request body
- Store in tasks table

**PATCH /api/repos/[repoId]:**

- Remove `autoApprove` from updateable fields (deprecated at repo level)

### Backward Compatibility

**Existing tasks without autoApprove:**

- Default to `false` (requires manual review)
- Migration sets `tasks.autoApprove = repos.autoApprove` for existing tasks

**Repo-level autoApprove:**

- Keep column for backward compatibility
- Update documentation to explain task-level is preferred

---

## Success Criteria

1. **Visual Clarity**: Single source of truth for clone status (overlay only)
2. **Consistent Patterns**: Alert component matches other warnings in app
3. **Clear Disabled State**: Faded board + disabled button = obvious blocked state
4. **Task-Level Control**: Users can choose auto-approve per task
5. **Smooth Transitions**: Opacity transitions create clear state changes

---

## Future Enhancements

1. **Bulk Auto-Approve**: Select multiple tasks, toggle auto-approve
2. **Auto-Approve Defaults**: User preference for default auto-approve per repo
3. **Conditional Auto-Approve**: Auto-approve only if test coverage > X%
4. **Notification**: Toast when clone completes (if user navigated away)

---

**End of Design Document**
