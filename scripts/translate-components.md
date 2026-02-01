# Component Translation Guide

This guide helps complete the i18n implementation for all remaining components.

## Translation Pattern Reference

### Pattern 1: Simple Component with useTranslations

```typescript
// Before
export function MyComponent() {
  return <h1>Hello World</h1>;
}

// After
import { useTranslations } from "next-intl";

export function MyComponent() {
  const t = useTranslations("namespace");
  return <h1>{t("title")}</h1>;
}
```

### Pattern 2: Data Arrays (use helper function)

```typescript
// Before
const items = [
  { label: "Item 1", value: "1" },
  { label: "Item 2", value: "2" },
];

// After
function getItems(t: (key: string) => string) {
  return [
    { label: t("items.item1.label"), value: "1" },
    { label: t("items.item2.label"), value: "2" },
  ];
}

export function MyComponent() {
  const t = useTranslations();
  const items = getItems(t);
  // ...
}
```

### Pattern 3: Constants (factory function)

```typescript
// Before (lib/constants/status-config.ts)
export const STATUS_CONFIG = {
  todo: { label: "To Do", description: "Waiting" },
};

// After
export function getStatusConfig(t: (key: string) => string) {
  return {
    todo: {
      label: t("tasks.statuses.todo"),
      description: t("tasks.statusDescriptions.todo"),
    },
  };
}

// In component
const t = useTranslations();
const STATUS_CONFIG = getStatusConfig(t);
```

## Files to Translate (Priority Order)

### Phase 3: Comparison Components (Task #3)

**File: components/landing/comparison.tsx**

- Add `import { useTranslations } from "next-intl";`
- Create `getCompetitors(t)` and `getPillars(t)` helper functions
- Update section title and subtitle with `t("landing.comparison.title")`
- Update badges, mobile labels, callout text

**File: components/landing/comparison-table.tsx**

- Add `useTranslations` import
- Create `getFeatures(t)` helper
- Update table headers with `t("landing.comparisonTable.features.*")`

**File: components/landing/comparison-bento.tsx**

- Similar pattern to comparison.tsx
- Update callout sections

### Phase 4: Features & Demo Kanban (Task #4)

**File: components/landing/features-expanded.tsx**

- Create `getFeatures(t)` helper
- Update section title (split for styling):
  ```typescript
  const titleParts = t("landing.featuresExpanded.sectionTitle").split(" ");
  const highlight = titleParts.slice(-2).join(" "); // "ship faster"
  const rest = titleParts.slice(0, -2).join(" ");
  ```

**File: components/landing/modern-kanban/demo-data.ts**

- **IMPORTANT**: This is a data file, needs helper function pattern
- Create `export function getDemoData(t: (key: string) => string)`
- Return columns and cards with translated labels

**File: components/landing/modern-kanban/demo-card.tsx**

- Add `useTranslations`
- Update status labels: `{status === "blocked" && t("landing.demoKanban.statuses.blocked")}`
- Update time formatting with placeholders: `t("landing.demoKanban.timeAgo.seconds", { seconds })`

**File: components/landing/modern-kanban/browser-chrome.tsx**

- Update URL display with `t("landing.demoKanban.url")`

### Phase 5: Task Modals (Task #5)

**File: components/modals/task-modal/task-actions.tsx**

- All button labels use `t("tasks.actions.*")`
- Example: `<Button>{t("tasks.actions.startBrainstorming")}</Button>`

**File: components/modals/new-task-modal.tsx**

- Form labels: `t("tasks.newTask.taskTitle")`, `t("tasks.newTask.required")`
- Placeholders: `placeholder={t("tasks.newTask.titlePlaceholder")}`
- Dialog title: `t("tasks.newTask.title")`
- Button states: `{isCreating ? t("tasks.newTask.creating") : t("tasks.newTask.createTask")}`

**File: components/modals/task-modal.tsx**

- Dialog title: `t("tasks.modal.title")`
- Loading states: `t("tasks.modal.loadingExecution")`
- Autonomous mode labels: `t("tasks.modal.autonomousModeActive")`

**File: components/modals/task-modal/tabs.tsx**

- Tab labels: `t("tasks.tabs.details")`, `t("tasks.tabs.timeline")`, etc.

### Phase 6: Status Config (Task #6)

**File: lib/constants/status-config.ts**

- **CRITICAL**: Convert from constant to factory function
- ```typescript
  export function getStatusConfig(t: (key: string) => string) {
    return {
      todo: {
        label: t("tasks.statuses.todo"),
        description: t("tasks.statusDescriptions.todo"),
        // ... keep other properties (color, icon, etc.)
      },
      // ... all other statuses
    };
  }
  ```
- Update all files that import STATUS_CONFIG to use the factory

### Phase 7: Kanban Components (Task #7)

**File: components/kanban/kanban-card.tsx**

- Delete dialog: `t("tasks.modal.deleteTask")`, `t("tasks.modal.deleteConfirm", { title })`
- Buttons: `t("common.cancel")`, `t("tasks.modal.delete")`

**File: components/kanban/processing-popover.tsx**

- Processing labels: `t("tasks.modal.progress")`, `t("tasks.modal.elapsed")`

### Phase 8: Settings Pages (Task #8)

**File: app/(dashboard)/settings/danger-zone/page.tsx**

- Page title: `t("settings.dangerZone.title")`
- All section headings and descriptions
- Confirmation dialogs with count placeholder: `t("settings.dangerZone.activeTasksMessage", { count })`

**File: app/(dashboard)/settings/integrations/page.tsx**

- Use `t("settings.integrationsPage.*")`

**File: app/(dashboard)/settings/workflow/page.tsx**

- Use `t("settings.workflowPage.*")`

**File: app/(dashboard)/billing/page.tsx**

- Use `t("settings.billingPage.*")`

### Phase 9: Execution & Repos (Task #9)

**File: app/(dashboard)/execution/failed/page.tsx**

- Empty state: `t("execution.failed.noFailed")`, `t("execution.failed.noFailedMessage")`

**File: app/(dashboard)/execution/performance/page.tsx**

- Stats labels: `t("execution.performance.stats.totalTasks")`
- Date range buttons: `t("execution.performance.dateRanges.today")`

**File: app/(dashboard)/repositories/page.tsx**

- Page header, empty states
- Badge labels: `t("repositories.private")`, `t("repositories.tasks")`

**File: components/repo-status-indicator.tsx**

- **IMPORTANT**: Status messages need factory pattern
- ```typescript
  function getStatusInfo(status: string, t: (key: string) => string) {
    switch (status) {
      case "not_cloned":
        return {
          label: t("repositories.status.notCloned"),
          description: t("repositories.status.notClonedMessage"),
          // ... rest
        };
      // ... all statuses
    }
  }
  ```

## Verification Checklist

After completing all translations:

1. **JSON Validation**

   ```bash
   node -e "JSON.parse(require('fs').readFileSync('messages/en.json')); console.log('✓ Valid')"
   node -e "JSON.parse(require('fs').readFileSync('messages/pt-BR.json')); console.log('✓ Valid')"
   ```

2. **Key Count Match**

   ```bash
   # Should both return 387
   node scripts/count-translation-keys.js
   ```

3. **Test EN Locale**
   - Start dev server: `npm run dev`
   - Navigate all pages
   - Check browser console for missing key warnings

4. **Test PT-BR Locale**
   - Switch locale to pt-BR
   - Navigate same pages
   - Verify all text displays in Portuguese

5. **Dynamic Content**
   - Test placeholders: Create task with specific title, check delete dialog shows `{title}`
   - Test counts: Disconnect repos with active tasks, verify `{count}` displays correctly
   - Test time formatting: Check demo kanban time labels

6. **Layout Integrity**
   - Portuguese text is ~20% longer than English
   - Check for text overflow in buttons, cards, modals
   - Test responsive layouts on mobile

## Quick Reference: Translation Keys by Component

| Component         | Translation Namespace                            |
| ----------------- | ------------------------------------------------ |
| Integrations      | `landing.integrations.*`                         |
| Comparison        | `landing.comparison.*`                           |
| Comparison Table  | `landing.comparisonTable.*`                      |
| Features Expanded | `landing.featuresExpanded.*`                     |
| Demo Kanban       | `landing.demoKanban.*`                           |
| Task Actions      | `tasks.actions.*`                                |
| New Task Modal    | `tasks.newTask.*`                                |
| Task Modal        | `tasks.modal.*`                                  |
| Task Tabs         | `tasks.tabs.*`                                   |
| Status Config     | `tasks.statuses.*`, `tasks.statusDescriptions.*` |
| Danger Zone       | `settings.dangerZone.*`                          |
| Integrations Page | `settings.integrationsPage.*`                    |
| Workflow Page     | `settings.workflowPage.*`                        |
| Billing Page      | `settings.billingPage.*`                         |
| Failed Tasks      | `execution.failed.*`                             |
| Performance       | `execution.performance.*`                        |
| Repositories      | `repositories.*`                                 |
| Errors            | `errors.*`                                       |
| Dashboard         | `dashboard.*`                                    |

## Common Mistakes to Avoid

1. **❌ Using wrong namespace**: `t("task.title")` instead of `t("tasks.newTask.title")`
2. **❌ Forgetting import**: Not adding `import { useTranslations } from "next-intl";`
3. **❌ Hardcoding in data files**: Creating arrays with hardcoded strings instead of helper functions
4. **❌ Missing placeholders**: Not including `{count}`, `{title}` in PT-BR translation
5. **❌ Breaking styled text**: Splitting title incorrectly when applying different colors/styles

## Testing Commands

```bash
# Validate translation files
npm run validate-translations  # (if script exists)

# Start dev server
npm run dev

# Test in different locale (set in language switcher)
# EN: http://localhost:3000
# PT-BR: http://localhost:3000 (switch via dropdown)

# Check for missing translations (browser console)
# Look for: "[next-intl] Missing message: ..."
```

## Success Criteria

✅ All 387 keys used across components
✅ No hardcoded English strings in JSX
✅ No console warnings about missing translations
✅ Portuguese text displays correctly without layout breaks
✅ Dynamic placeholders work ({count}, {title}, {seconds}, {minutes})
✅ Status config works as factory function
✅ Data arrays use helper functions
✅ All pages tested in both locales
