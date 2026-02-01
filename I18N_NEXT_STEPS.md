# i18n Implementation - Next Steps

## Current Status

✅ **Translation files expanded** (387 keys in EN and PT-BR)
✅ **Integrations component translated** (pattern established)
🔄 **20% complete** - Foundation is solid, ready to scale

---

## How to Continue

You have 3 options to complete the remaining 80%:

### Option 1: Continue with Claude (Recommended)

Resume this conversation and continue translating components one phase at a time.

**Commands to use:**

```bash
# Check progress
cat I18N_IMPLEMENTATION_PROGRESS.md

# See detailed instructions for next component
cat scripts/translate-components.md

# Validate translation files anytime
node -e "JSON.parse(require('fs').readFileSync('messages/en.json')); console.log('✓ EN valid')"
node -e "JSON.parse(require('fs').readFileSync('messages/pt-BR.json')); console.log('✓ PT-BR valid')"
```

**Continue with:**
"Continue implementing the i18n plan. Let's complete Task #3 (comparison components)."

---

### Option 2: Manual Implementation

Use the translation guide and implement yourself.

**Follow this order:**

1. Read `scripts/translate-components.md` for patterns
2. Start with Phase 3 (comparison components)
3. Follow the exact patterns from `integrations.tsx`
4. Test after each component
5. Move to next phase

**Quick Reference:**

- Translation files: `messages/en.json`, `messages/pt-BR.json`
- Pattern examples: `components/landing/integrations.tsx`
- All keys already defined - just hook them up!

---

### Option 3: Batch Process (Fastest)

If comfortable with find-and-replace, use this approach:

**For simple components:**

1. Add import: `import { useTranslations } from "next-intl";`
2. Add hook: `const t = useTranslations();`
3. Replace hardcoded strings with `t("namespace.key")`

**Example transformation:**

```typescript
// Before
<h1>Settings</h1>
<p>Manage your account</p>

// After
import { useTranslations } from "next-intl";

export function Settings() {
  const t = useTranslations("settings");
  return (
    <>
      <h1>{t("accountPage.title")}</h1>
      <p>{t("accountPage.profile")}</p>
    </>
  );
}
```

---

## Critical Files Reference

### Must Use Factory Pattern

These files export constants, need conversion:

**`lib/constants/status-config.ts`**

```typescript
// Convert from:
export const STATUS_CONFIG = { ... }

// To:
export function getStatusConfig(t: (key: string) => string) {
  return { ... }
}
```

**`components/landing/modern-kanban/demo-data.ts`**

```typescript
// Convert from:
export const demoData = { ... }

// To:
export function getDemoData(t: (key: string) => string) {
  return { ... }
}
```

---

## Translation Key Quick Lookup

Need to find the right key? Use this table:

| Component File              | Translation Namespace                            |
| --------------------------- | ------------------------------------------------ |
| `comparison.tsx`            | `landing.comparison.*`                           |
| `comparison-table.tsx`      | `landing.comparisonTable.*`                      |
| `features-expanded.tsx`     | `landing.featuresExpanded.*`                     |
| `demo-kanban/*`             | `landing.demoKanban.*`                           |
| `task-actions.tsx`          | `tasks.actions.*`                                |
| `new-task-modal.tsx`        | `tasks.newTask.*`                                |
| `task-modal.tsx`            | `tasks.modal.*`                                  |
| `tabs.tsx`                  | `tasks.tabs.*`                                   |
| `status-config.ts`          | `tasks.statuses.*`, `tasks.statusDescriptions.*` |
| `kanban-card.tsx`           | `tasks.modal.deleteTask`, `common.cancel`        |
| `danger-zone/page.tsx`      | `settings.dangerZone.*`                          |
| `integrations/page.tsx`     | `settings.integrationsPage.*`                    |
| `workflow/page.tsx`         | `settings.workflowPage.*`                        |
| `billing/page.tsx`          | `settings.billingPage.*`                         |
| `failed/page.tsx`           | `execution.failed.*`                             |
| `performance/page.tsx`      | `execution.performance.*`                        |
| `repositories/page.tsx`     | `repositories.*`                                 |
| `repo-status-indicator.tsx` | `repositories.status.*`                          |

---

## Verification Commands

After completing each phase, run these checks:

```bash
# 1. Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('messages/en.json')); console.log('✓ EN valid')"
node -e "JSON.parse(require('fs').readFileSync('messages/pt-BR.json')); console.log('✓ PT-BR valid')"

# 2. Start dev server
npm run dev

# 3. Test in browser
# - EN: Check for hardcoded English strings
# - PT-BR: Switch locale, verify Portuguese displays
# - Console: Look for "[next-intl] Missing message:" warnings

# 4. Test dynamic content
# - Create task → Check delete dialog shows task title
# - Settings → Check count placeholders work
# - Demo kanban → Check time formatting (seconds/minutes)
```

---

## Common Gotchas

### ❌ Mistake 1: Wrong Namespace

```typescript
// Wrong
t("task.title"); // Missing 's' in 'tasks'

// Correct
t("tasks.newTask.title");
```

### ❌ Mistake 2: Forgetting Import

```typescript
// Won't work - no import
const t = useTranslations();

// Correct
import { useTranslations } from "next-intl";
const t = useTranslations();
```

### ❌ Mistake 3: Hardcoding in Data Files

```typescript
// Wrong (in demo-data.ts)
export const cards = [
  { title: "Add authentication" }, // Hardcoded!
];

// Correct
export function getCards(t: (key: string) => string) {
  return [{ title: t("landing.demoKanban.cards.addAuth.title") }];
}
```

### ❌ Mistake 4: Missing Placeholders

```typescript
// Translation: "Delete task \"{title}\"?"

// Wrong
t("tasks.modal.deleteConfirm"); // Placeholder not filled

// Correct
t("tasks.modal.deleteConfirm", { title: task.title });
```

### ❌ Mistake 5: Breaking Styled Text

```typescript
// Translation: "Powered by the best AI models"
// Want "best AI models" highlighted

// Wrong - splits incorrectly
const highlighted = t("title").split(" ").slice(-1)[0]; // Only "models"

// Correct
const words = t("title").split(" ");
const highlighted = words.slice(-3).join(" "); // "best AI models"
const rest = words.slice(0, -3).join(" "); // "Powered by the"
```

---

## Testing Checklist

Before marking a phase complete:

- [ ] No hardcoded English strings in modified files
- [ ] `useTranslations` imported where needed
- [ ] Translation keys match exactly (check spelling)
- [ ] Dynamic placeholders tested ({count}, {title}, {seconds})
- [ ] No console warnings about missing translations
- [ ] Portuguese text displays without layout breaks
- [ ] Buttons, modals, and cards render correctly in PT-BR
- [ ] Time formatting works (seconds → minutes conversion)
- [ ] Styled text (highlighted words) displays correctly

---

## Success Criteria

When 100% complete, you should have:

✅ All 387 translation keys utilized across 29 files
✅ Zero hardcoded English strings in components
✅ Both EN and PT-BR locales work perfectly
✅ No console warnings about missing translations
✅ Dynamic content (placeholders, counts, time) works
✅ Layout integrity maintained with longer Portuguese text
✅ Status config working as factory function
✅ Data arrays using helper functions

---

## Get Help

**Stuck on a component?**

1. Check `scripts/translate-components.md` for patterns
2. Reference completed `integrations.tsx` for examples
3. Search translation files for existing keys: `grep -r "deleteTask" messages/`

**Translation key not found?**

1. Check spelling in `messages/en.json`
2. Verify namespace matches (e.g., `landing.` not `landings.`)
3. All 387 keys are already defined - if you think one is missing, double-check the file

**Layout breaking with Portuguese?**

1. Portuguese text is ~20% longer - this is expected
2. Use responsive classes: `text-sm md:text-base`
3. Allow buttons to wrap: `whitespace-normal` instead of `whitespace-nowrap`
4. Test on mobile - responsive design should handle longer text

---

**Ready to continue?**

Tell Claude: "Continue implementing i18n. Let's complete Task #3."

Or start manually with: `components/landing/comparison.tsx`

All translation keys are ready. Just hook them up! 🚀
