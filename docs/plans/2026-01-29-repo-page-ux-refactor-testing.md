# Manual Testing Checklist - Repository Page UX Refactor

**Date**: 2026-01-29
**Branch**: `feat/repo-page-ux-refactor`
**Commits**: 7 commits (3475b71 through d0b408a)

## Overview

This document provides a comprehensive manual testing checklist for the repository page UX refactor (9 tasks total, 7 implementation tasks complete).

---

## Pre-Testing Setup

### 1. Database Verification

- ✅ `auto_approve` column exists in `tasks` table
- ✅ Column type: `boolean NOT NULL DEFAULT false`
- ✅ Index `idx_tasks_auto_approve` exists

```bash
docker exec loopforge-studio-postgres psql -U postgres -d loopforge -c "\d tasks"
```

Expected: `auto_approve | boolean | not null | false`

### 2. Build Verification

- ✅ TypeScript compilation successful (no errors)
- ✅ All routes built successfully
- ✅ No missing imports or broken references

```bash
npm run build
```

Expected: Build completes with "Compiled successfully"

### 3. Branch Status

- ✅ 7 commits on `feat/repo-page-ux-refactor`
- ✅ All commits have descriptive messages
- ✅ No merge conflicts with main

```bash
git log --oneline feat/repo-page-ux-refactor ^main
```

---

## Manual Testing Scenarios

### Scenario 1: Repository Not Cloned (Initial State)

**Setup:**

1. Navigate to a repository page where `isCloned: false`
2. If no such repo exists, create a new repository connection (don't clone it yet)

**Expected Behavior:**

✅ **Visual Indicators:**

- [ ] Yellow warning banner is **gone** (removed in Task 4)
- [ ] "Not Cloned" badge next to repo name is **gone** (removed in Task 5)
- [ ] Kanban board is **faded** (opacity-40)
- [ ] Board fades smoothly with 300ms transition
- [ ] Header has subtle fade (opacity-60)
- [ ] RepoSetupOverlay (Alert component) is visible at top
- [ ] Alert has blue styling (default variant)
- [ ] Alert shows "Repository Setup Required" title
- [ ] Alert shows appropriate message based on status

✅ **Interactive Elements:**

- [ ] "New Task" button is **disabled** (grayed out)
- [ ] Clicking "New Task" button does **nothing**
- [ ] Auto-approve toggle button is **gone** from header (removed in Task 5)
- [ ] "Clone Repository" button in overlay is clickable

✅ **Clone Process:**

1. Click "Clone Repository" in overlay
   - [ ] Button shows loading spinner "Cloning..."
   - [ ] Button is disabled during clone
   - [ ] Alert message changes to "Cloning {repoName}..."

2. After clone completes:
   - [ ] Board smoothly transitions to full opacity (300ms)
   - [ ] Header returns to full opacity
   - [ ] Overlay auto-hides after 1.5 seconds
   - [ ] "New Task" button becomes **enabled**
   - [ ] Page refreshes to reflect new state

### Scenario 2: Repository Already Cloned

**Setup:**

1. Navigate to a repository page where `isCloned: true`

**Expected Behavior:**

✅ **Visual State:**

- [ ] No warning banner (removed)
- [ ] No "Not Cloned" badge (removed)
- [ ] Board at full opacity (100%)
- [ ] Header at full opacity (100%)
- [ ] No overlay visible
- [ ] Clean, uncluttered interface

✅ **Interactive Elements:**

- [ ] "New Task" button is **enabled**
- [ ] No auto-approve toggle in header (removed)
- [ ] All normal repository functionality works

### Scenario 3: Creating Task Without Auto-Approve

**Setup:**

1. Navigate to a cloned repository
2. Click "New Task" button

**Expected Behavior:**

✅ **Modal Appearance:**

- [ ] Modal opens successfully
- [ ] Modal contains title input (required)
- [ ] Modal contains description textarea (optional)
- [ ] Modal contains "Autonomous Mode" toggle section (amber background)
- [ ] Modal contains "Auto-approve changes" checkbox section (neutral background)
- [ ] Auto-approve checkbox is **unchecked by default**
- [ ] Zap icon next to "Auto-approve changes" label
- [ ] Help text explains: "Automatically commit and push changes when tests pass..."

✅ **Creating Task:**

1. Enter title: "Test task without auto-approve"
2. Leave auto-approve checkbox **unchecked**
3. Click "Create Task"
   - [ ] Task created successfully
   - [ ] Task appears on Kanban board in "Todo" column
   - [ ] Modal closes

✅ **Database Verification:**

```sql
SELECT id, title, auto_approve FROM tasks
WHERE title = 'Test task without auto-approve';
```

Expected: `auto_approve = false`

### Scenario 4: Creating Task With Auto-Approve

**Setup:**

1. Navigate to a cloned repository
2. Click "New Task" button

**Expected Behavior:**

✅ **Enabling Auto-Approve:**

1. Enter title: "Test task with auto-approve"
2. Check the "Auto-approve changes" checkbox
   - [ ] Checkbox becomes checked
   - [ ] Zap icon changes to **amber color** (text-amber-500)
   - [ ] Visual feedback is clear
3. Click "Create Task"
   - [ ] Task created successfully
   - [ ] Modal closes

✅ **Database Verification:**

```sql
SELECT id, title, auto_approve FROM tasks
WHERE title = 'Test task with auto-approve';
```

Expected: `auto_approve = true`

### Scenario 5: Modal State Reset

**Setup:**

1. Open New Task modal
2. Check auto-approve checkbox
3. Close modal **without creating task**

**Expected Behavior:**

✅ **State Reset:**

1. Close modal via:
   - [ ] X button in top-right
   - [ ] Clicking backdrop
   - [ ] Cancel button
2. Reopen modal
   - [ ] Auto-approve checkbox is **unchecked** (state reset)
   - [ ] Title field is empty (state reset)
   - [ ] Description field is empty (state reset)
   - [ ] Autonomous Mode is off (state reset)

### Scenario 6: API Error Handling

**Setup:**

1. Open New Task modal
2. Create task with invalid data or trigger error

**Expected Behavior:**

✅ **Error States:**

- [ ] Error message displays in modal
- [ ] Modal remains open (doesn't auto-close on error)
- [ ] Form fields retain user input
- [ ] Auto-approve checkbox state preserved
- [ ] User can fix error and retry

### Scenario 7: Clone Error State

**Setup:**

1. Navigate to repository not cloned
2. Trigger clone error (disconnect network, invalid repo, etc.)

**Expected Behavior:**

✅ **Error Handling:**

- [ ] Alert changes to **destructive variant** (red styling)
- [ ] Error message displays in Alert
- [ ] "Try Again" button appears
- [ ] "Try Again" button has destructive variant (red)
- [ ] Clicking "Try Again" retries clone operation
- [ ] Board remains faded until successful clone

### Scenario 8: Responsive Design

**Setup:**

1. Test on different screen sizes

**Expected Behavior:**

✅ **Desktop (1920px+):**

- [ ] All elements visible and properly spaced
- [ ] Alert positioned at top with pt-12
- [ ] Board columns side-by-side
- [ ] Modal centered and readable

✅ **Tablet (768px-1024px):**

- [ ] Alert responsive (max-w-2xl constrains width)
- [ ] Board columns wrap appropriately
- [ ] Modal adapts to screen width

✅ **Mobile (375px-768px):**

- [ ] Alert scrollable if needed
- [ ] Modal fills screen appropriately
- [ ] Checkbox and labels wrap correctly
- [ ] Touch targets large enough

### Scenario 9: Keyboard Navigation & Accessibility

**Setup:**

1. Use keyboard only (Tab, Enter, Space)

**Expected Behavior:**

✅ **Keyboard Navigation:**

- [ ] Tab moves focus through interactive elements
- [ ] "New Task" button receives focus
- [ ] Modal can be navigated with Tab
- [ ] Checkbox can be toggled with Space
- [ ] Enter submits form
- [ ] Escape closes modal

✅ **Screen Reader (if available):**

- [ ] Alert has `role="alert"` attribute
- [ ] Checkbox has proper label association
- [ ] Help text is associated with checkbox
- [ ] Button states announced (enabled/disabled)

---

## Edge Cases & Regression Testing

### Edge Case 1: Rapid Modal Open/Close

1. Quickly open and close modal multiple times
   - [ ] No memory leaks
   - [ ] State resets correctly each time
   - [ ] No UI glitches or race conditions

### Edge Case 2: Repository State Change While Page Open

1. Clone repository via API/CLI while page is open
2. Refresh page
   - [ ] UI updates correctly
   - [ ] "New Task" button becomes enabled
   - [ ] Overlay disappears

### Edge Case 3: Multiple Simultaneous Tasks

1. Create multiple tasks with different auto-approve settings
   - [ ] Each task stores correct auto_approve value
   - [ ] No cross-contamination between tasks

### Edge Case 4: Long Repo Names

1. Test with repository that has very long name
   - [ ] Alert message doesn't overflow
   - [ ] "Cloning {repoName}..." displays correctly

---

## Performance Testing

### Load Time

- [ ] Page loads in < 2 seconds
- [ ] Modal opens instantly (< 100ms)
- [ ] Transitions are smooth (no jank)
- [ ] No console errors

### Animation Performance

- [ ] Opacity transitions smooth (300ms)
- [ ] No layout shifts during fade
- [ ] Backdrop blur renders correctly
- [ ] No flickering

---

## Browser Compatibility

Test on:

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, macOS)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Database Integrity

### Migration Verification

```sql
-- Verify column exists
\d tasks

-- Check default value
SELECT column_default FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name = 'auto_approve';

-- Verify index
\di idx_tasks_auto_approve

-- Check data migration (if any existing tasks)
SELECT COUNT(*) FROM tasks WHERE auto_approve = true;
```

### Data Consistency

- [ ] All existing tasks have `auto_approve = false` (default)
- [ ] Newly created tasks respect checkbox state
- [ ] No NULL values in auto_approve column

---

## Rollback Testing

If issues are found:

1. **Database Rollback:**

   ```sql
   -- Can be safely rolled back by dropping column
   ALTER TABLE tasks DROP COLUMN auto_approve;
   DROP INDEX IF EXISTS idx_tasks_auto_approve;
   ```

2. **Code Rollback:**

   ```bash
   git checkout main
   ```

3. **Verify Rollback:**
   - [ ] Old UI restored
   - [ ] No broken references
   - [ ] Application functions normally

---

## Final Verification Checklist

### Implementation Complete

- ✅ Task 1: Database migration applied
- ✅ Task 2: API accepts autoApprove parameter
- ✅ Task 3: RepoSetupOverlay refactored to Alert
- ✅ Task 4: RepoSetupBanner removed, board fade added
- ✅ Task 5: RepoHeader simplified (badge and toggle removed)
- ✅ Task 6: Auto-approve checkbox added to modal
- ✅ Task 7: Modal prevented from opening when not cloned

### Code Quality

- ✅ No TypeScript errors
- ✅ Build successful
- ✅ All imports resolved
- ✅ No unused code
- ✅ Consistent code style

### Documentation

- [ ] Implementation notes reviewed
- [ ] Commit messages descriptive
- [ ] Testing checklist created (this document)

---

## Sign-Off

**Tested by**: ********\_********
**Date**: ********\_********
**Status**: [ ] PASS [ ] FAIL [ ] NEEDS REVISION

**Notes**:

```
(Add any observations, issues found, or recommendations)
```

---

**Next Steps After Testing:**

- If all tests pass → Proceed to Task 9: Cleanup & Documentation
- If issues found → Fix issues, retest, then proceed
- Final step → Create pull request to merge into main
