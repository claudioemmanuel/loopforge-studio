# Navigation Menu Restructure - Design Document

**Date:** 2026-02-01
**Status:** Approved
**Author:** Claude Sonnet 4.5 + UI Designer Agent

## Executive Summary

Loopforge Studio's current navigation has significant coherence issues: duplicate pages for the same functionality, orphaned analytics, unclear terminology ("Execution"), and overloaded Settings sections. This redesign consolidates duplicates, clarifies terminology, and creates a logical information architecture that matches user mental models.

## Problems Identified

### Critical Issues

1. **Duplicate Analytics/Performance Pages**
   - `/analytics` exists but is orphaned (not in navigation)
   - `/execution/performance` is in navigation
   - Both pages show identical content (charts, metrics, token usage)
   - **User Impact:** Analytics hidden from users, confusing duplication

2. **Duplicate Workers/Execution Pages**
   - `/execution/*` routes for task monitoring (Active, History, Failed)
   - `/workers/*` routes for identical functionality
   - **User Impact:** Users confused which section to use

3. **"Execution" is Unclear Terminology**
   - "Execution" suggests code execution, not AI task monitoring
   - Doesn't communicate purpose clearly
   - Mixes real-time monitoring with historical analytics

4. **Settings > Integrations Overload**
   - Contains 3 distinct concepts: AI providers, GitHub, repository list
   - Too much functionality in one page
   - **User Impact:** Hard to find specific settings

5. **"Workflow" Mislabeled**
   - Contains test defaults and clone directory settings
   - "Workflow" suggests task automation, not configuration defaults
   - **User Impact:** Users don't look here for test/clone settings

## Solution Overview

### New Navigation Structure

```
Dashboard
├─ (single page - overview)

Repositories
├─ Overview
└─ [Individual repos: dynamic list]

Activity (renamed from "Execution")
├─ Active
├─ History
└─ Failed

Analytics (NEW - top-level)
├─ (consolidates /analytics + /execution/performance)

Settings
├─ Account & Billing
├─ Connections (replaces "Integrations", uses tabs)
├─ Preferences
└─ Automation (renamed from "Workflow")

Experiments (conditional)
└─ (single page)
```

### Key Changes

| Change | Before | After | Reason |
|--------|--------|-------|--------|
| **Rename** | Execution | Activity | Clearer purpose |
| **Consolidate** | Analytics orphaned + Execution > Performance | Analytics (top-level) | Remove duplication |
| **Remove** | Execution > Performance | (deleted) | Merged into Analytics |
| **Redirect** | /workers/* | /activity/* | Eliminate duplicate |
| **Rename** | Settings > Integrations | Settings > Connections | Split into tabs |
| **Rename** | Settings > Workflow | Settings > Automation | Clearer purpose |
| **Promote** | /analytics (hidden) | Analytics (top-level) | Make discoverable |

## Detailed Design

### 1. Activity Section (Renamed from Execution)

**Purpose:** Real-time and historical monitoring of AI task execution

#### Activity > Active
- **Route:** `/activity/active`
- **Content:** Live task cards with streaming updates
- **Features:**
  - Real-time progress (SSE streaming)
  - Current phase indicator
  - Time elapsed, iteration count
  - Pause/Cancel actions
  - Click to expand full logs

#### Activity > History
- **Route:** `/activity/history`
- **Content:** Completed task execution logs
- **Features:**
  - Filter by repo, date, status
  - Search by task title
  - Summary: commits, files changed, tests run
  - Pagination (20 per page)

#### Activity > Failed
- **Route:** `/activity/failed`
- **Content:** Tasks that got stuck or errored
- **Features:**
  - Failure reason display
  - Retry/Resume/Delete actions
  - View full error logs
  - Amber warning styling

**Icon:** Activity icon (replacing Zap)

---

### 2. Analytics Page (Top-Level)

**Purpose:** Comprehensive metrics and insights across all tasks

**Route:** `/analytics` (promoted from orphaned page)

**Content Sections:**

1. **Top Stats Row**
   - Total Tasks, Completed This Month, Success Rate, Avg Time
   - Trend indicators (↑↓)

2. **Date Range Selector**
   - Quick filters: Today, Week, Month, Year
   - Custom range picker

3. **Charts (2-column layout):**
   - Tasks by Status (pie chart)
   - Completion Trend (line chart)
   - Token Usage (stacked bar chart)
   - Execution Duration Distribution (histogram)

4. **Repository Activity Table**
   - Sort by: name, tasks, success rate, duration
   - Click repo → filter all charts to that repo

5. **Export Analytics**
   - JSON or CSV download
   - Date range selection

**Icon:** BarChart3

---

### 3. Settings > Connections (Replaces Integrations)

**Purpose:** Manage external service integrations

**Route:** `/settings/connections` (renamed from `/settings/integrations`)

**Tabbed Interface:**

#### Tab 1: AI Providers
- Configure API keys:
  - Anthropic (Claude Sonnet 4, Opus 4, Haiku 3)
  - OpenAI (GPT-4o, GPT-4 Turbo, GPT-4o Mini)
  - Google (Gemini 2.5 Pro, 2.5 Flash, 2.0 Flash)
- Select default provider
- Choose preferred models per provider
- Test connection button
- Invalid key warnings

#### Tab 2: GitHub
- Connection status (connected as @username)
- Permissions: read:user, user:email, repo
- Connected repositories list:
  - Name, privacy (public/private)
  - Status indicator (cloned, indexing, ready)
  - Task count badge
  - Disconnect button per repo
- "Add Repositories" button
- Reconnect/Revoke access buttons

**Icon:** Plug

**Why "Connections" instead of "Integrations"?**
- More intuitive for users ("I need to connect my GitHub")
- Scalable for future integrations (Jira, Linear, Slack)
- Shorter, clearer label

---

### 4. Settings > Automation (Renamed from Workflow)

**Purpose:** Configure default behaviors for new repositories

**Route:** `/settings/automation` (renamed from `/settings/workflow`)

**Tabbed Interface (existing structure):**

#### Tab 1: Clone Directory
- Local path where repos are cloned
- Path validation and expansion
- Common paths quick-select

#### Tab 2: Test Defaults
- Default test command
- Test timeout (30s - 3600s)
- Test gate policy (strict/warn/skip/autoApprove)

**Future Tabs:**
- PR Defaults (title template, draft setting, auto-create)
- Execution Behavior (auto-approve patterns, model overrides)

**Icon:** GitBranch

**Why "Automation" instead of "Workflow"?**
- "Workflow" is ambiguous (could mean task workflow, Kanban stages)
- "Automation" clearly communicates: "defaults that apply automatically"
- Aligns with common terminology (GitHub Actions, automation rules)

---

### 5. Settings > Account & Billing

**Route:** `/settings/account` (no change)

**Page Structure (improved visual sections):**

1. **Profile Section** (top)
   - Avatar, name, email
   - GitHub username
   - Connected since date

2. **Subscription & Billing Section** (middle)
   - Current plan badge (Free/Pro/Team)
   - Usage metrics:
     - Tasks this month / limit
     - Tokens used / limit
   - Billing cycle
   - Next billing date
   - "Manage Subscription" button → Stripe portal

3. **Danger Zone Section** (bottom, red border)
   - Export all data (JSON download)
   - Disconnect all repositories
   - Delete account permanently

**No route change, just improved visual organization**

---

### 6. Settings > Preferences

**Route:** `/settings/preferences` (no change)

**Content (keep as-is):**
- Language selection (EN/PT-BR)
- Theme (light/dark/system)
- Future: notification preferences, timezone

**No changes to this page**

---

## Route Redirects

To maintain backward compatibility and avoid breaking bookmarks:

| Old Route | New Route | Method |
|-----------|-----------|--------|
| `/execution/performance` | `/analytics` | Redirect |
| `/execution/*` | `/activity/*` | Redirect |
| `/workers` | `/activity/active` | Redirect |
| `/workers/history` | `/activity/history` | Redirect |
| `/workers/failed` | `/activity/failed` | Redirect |
| `/workers/[taskId]` | `/activity/[taskId]` | Redirect |
| `/settings/integrations` | `/settings/connections` | Redirect |
| `/settings/workflow` | `/settings/automation` | Redirect |

**Implementation:** Add redirects in `middleware.ts` or Next.js `next.config.js` redirects array

---

## Translation Keys

### New Keys (English)

```json
{
  "navigation": {
    "activity": "Activity",
    "analytics": "Analytics"
  },
  "settings": {
    "connections": "Connections",
    "automation": "Automation"
  },
  "settingsPage": {
    "connectionsPage": {
      "title": "Connections",
      "subtitle": "Manage external integrations and connected services",
      "tabs": {
        "aiProviders": "AI Providers",
        "github": "GitHub"
      },
      "aiProviders": {
        "title": "AI Provider API Keys",
        "description": "Configure API keys for Claude, GPT, and Gemini. Keys are encrypted and stored securely."
      },
      "github": {
        "title": "GitHub Connection",
        "description": "Manage your GitHub connection and connected repositories."
      }
    },
    "automationPage": {
      "title": "Automation Settings",
      "subtitle": "Configure default behaviors for task execution and repository management"
    }
  }
}
```

### New Keys (Portuguese)

```json
{
  "navigation": {
    "activity": "Atividade",
    "analytics": "Análise"
  },
  "settings": {
    "connections": "Conexões",
    "automation": "Automação"
  },
  "settingsPage": {
    "connectionsPage": {
      "title": "Conexões",
      "subtitle": "Gerencie integrações externas e serviços conectados",
      "tabs": {
        "aiProviders": "Provedores de IA",
        "github": "GitHub"
      },
      "aiProviders": {
        "title": "Chaves de API de Provedores de IA",
        "description": "Configure chaves de API para Claude, GPT e Gemini. As chaves são criptografadas e armazenadas com segurança."
      },
      "github": {
        "title": "Conexão GitHub",
        "description": "Gerencie sua conexão GitHub e repositórios conectados."
      }
    },
    "automationPage": {
      "title": "Configurações de Automação",
      "subtitle": "Configure comportamentos padrão para execução de tarefas e gerenciamento de repositórios"
    }
  }
}
```

---

## Implementation Plan

### Phase 1: Route Consolidation (Day 1)

**Priority:** Critical - Eliminate duplicates first

1. **Rename Execution → Activity**
   - Rename folder: `app/(dashboard)/execution` → `app/(dashboard)/activity`
   - Update all internal imports
   - Add redirects for old `/execution/*` URLs

2. **Consolidate Analytics**
   - Keep `/analytics` page
   - Add redirect: `/execution/performance` → `/analytics`
   - Remove "Performance" from Activity submenu

3. **Remove Workers Duplication**
   - Add redirects: `/workers/*` → `/activity/*`
   - Option: Delete `/workers/*` files or keep as aliases

**Testing:** Verify all old URLs redirect correctly

---

### Phase 2: Settings Reorganization (Day 1-2)

1. **Rename Integrations → Connections**
   - Rename folder: `app/(dashboard)/settings/integrations` → `app/(dashboard)/settings/connections`
   - Refactor page into tabbed interface:
     - Tab 1: AI Providers (existing content)
     - Tab 2: GitHub (connection + repos list)
   - Add redirect: `/settings/integrations` → `/settings/connections`

2. **Rename Workflow → Automation**
   - Rename folder: `app/(dashboard)/settings/workflow` → `app/(dashboard)/settings/automation`
   - Update page title/subtitle
   - Add redirect: `/settings/workflow` → `/settings/automation`

3. **Update Account Page**
   - Add visual section separators
   - Improve Billing section heading
   - Enhance Danger Zone styling (red border)

**Testing:** Verify tabs work, redirects work, settings save correctly

---

### Phase 3: Navigation Updates (Day 2)

1. **Update Desktop Sidebar**
   - File: `components/sidebar/desktop-sidebar.tsx`
   - Changes:
     - Rename `executionSubItems` → `activitySubItems`
     - Remove Performance item
     - Update `settingsSubItems` with new labels
     - Add Analytics as top-level item
     - Change Execution icon to Activity icon

2. **Update Mobile Sidebar**
   - File: `components/sidebar/mobile-sidebar.tsx`
   - Apply same changes as desktop
   - Test cascade menus on mobile

3. **Add Analytics to Navigation**
   - Insert between Repositories and Settings
   - Single-item (no submenu)
   - BarChart3 icon

**Testing:** Click all menu items, verify correct pages load

---

### Phase 4: Translation Updates (Day 2)

1. **Update English translations**
   - File: `messages/en.json`
   - Add new keys for Activity, Analytics, Connections, Automation
   - Update Settings page subtitles

2. **Update Portuguese translations**
   - File: `messages/pt-BR.json`
   - Mirror English changes

**Testing:** Switch language, verify all labels display correctly

---

### Phase 5: Testing & Validation (Day 3)

**Manual Testing Checklist:**
- [ ] All menu items navigate to correct pages
- [ ] Collapsed sidebar tooltips show correct labels
- [ ] Mobile sidebar cascade menus work
- [ ] Old bookmarked URLs redirect correctly
- [ ] No broken internal links
- [ ] Language switcher works on all pages
- [ ] Settings > Connections tabs work
- [ ] Settings > Automation tabs work
- [ ] Analytics page shows all data

**Automated Testing:**
- Update E2E tests for new routes
- Update sidebar component unit tests

---

### Phase 6: Cleanup (Day 3)

1. **Remove Deprecated Code**
   - Delete `/workers/*` page files (if using redirects only)
   - Remove old translation keys
   - Clean up any unused imports

2. **Update Documentation**
   - Update README if it references navigation
   - Update any developer docs
   - Update user-facing help docs

---

## Files to Modify

| File | Action | Priority |
|------|--------|----------|
| `app/(dashboard)/execution/*` | Rename → `activity/*` | P0 |
| `app/(dashboard)/workers/*` | Delete or redirect | P0 |
| `app/(dashboard)/settings/integrations/page.tsx` | Rename → `connections/page.tsx` + add tabs | P1 |
| `app/(dashboard)/settings/workflow/*` | Rename → `automation/*` | P1 |
| `components/sidebar/desktop-sidebar.tsx` | Update nav arrays | P0 |
| `components/sidebar/mobile-sidebar.tsx` | Update nav arrays | P0 |
| `messages/en.json` | Add new keys | P1 |
| `messages/pt-BR.json` | Add new keys | P1 |
| `middleware.ts` or `next.config.js` | Add redirects | P0 |
| `components/settings/connections-page.tsx` | Create new tabbed page | P1 |

---

## Success Metrics

**User Experience:**
- ✅ No duplicate pages for same functionality
- ✅ All functional pages accessible via navigation
- ✅ Clear, intuitive menu labels
- ✅ Logical grouping of related features
- ✅ Old bookmarks still work (via redirects)

**Technical:**
- ✅ No broken links
- ✅ All tests pass
- ✅ Translations complete for both languages
- ✅ Backward compatibility maintained

**Analytics to Monitor:**
- Analytics page usage (should increase from 0% to measurable)
- Settings > Connections usage (vs old Integrations)
- User navigation patterns (fewer dead ends)

---

## Future Enhancements

**Not in Scope for This Phase:**

1. **Add System Health Section**
   - Worker status, queue health, background jobs
   - Could be Settings > System or standalone

2. **Visual Hierarchy Improvements**
   - Add separator lines between navigation sections
   - Group: Operational (Dashboard, Repos, Activity, Analytics) vs Configuration (Settings, Experiments)

3. **Mobile Navigation Optimization**
   - Long repository lists may need better mobile UX
   - Consider swipe gestures or different layout

4. **Breadcrumbs**
   - Add breadcrumb navigation for deep pages
   - Help users understand current location

5. **Settings Organization**
   - If Settings grows beyond 5 items, consider sub-grouping
   - Example: Settings > General, Settings > Integrations (as parent)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Broken bookmarks | Medium | Medium | Implement redirects |
| User confusion during transition | Low | Low | Redirects are transparent |
| Translation gaps | Low | Medium | Test both languages thoroughly |
| Mobile navigation issues | Low | Medium | Test on real devices |
| Analytics page performance | Low | Low | Already exists, just promoting |

---

## Rollback Plan

If critical issues discovered after deployment:

1. **Immediate:** Revert navigation sidebar changes (restore old labels)
2. **Keep redirects:** Don't break old URLs
3. **Fix forward:** Address issues and re-deploy within 24h
4. **Database:** No schema changes, rollback is safe

---

## Approval & Sign-off

**Design Approved By:** User
**Date:** 2026-02-01
**Implementation Start:** 2026-02-01
**Target Completion:** 2026-02-04 (3 days)

---

## Appendix: Visual Mockups

### Before (Current Navigation)
```
Dashboard
Repositories
  ├─ All Repositories
  └─ [repos...]
Execution ⚠️
  ├─ Active
  ├─ History
  ├─ Failed
  └─ Performance ⚠️ (duplicate)
Settings
  ├─ Account
  ├─ Preferences
  ├─ Integrations ⚠️ (overloaded)
  └─ Workflow ⚠️ (unclear)
Experiments

⚠️ Problems:
- /analytics orphaned
- /workers/* duplicate
- "Execution" unclear
- "Integrations" too broad
- "Workflow" mislabeled
```

### After (New Navigation)
```
Dashboard
Repositories
  ├─ Overview (renamed)
  └─ [repos...]
Activity ✅ (renamed)
  ├─ Active
  ├─ History
  └─ Failed
Analytics ✅ (promoted to top-level)
Settings
  ├─ Account & Billing
  ├─ Connections ✅ (renamed + tabs)
  ├─ Preferences
  └─ Automation ✅ (renamed)
Experiments

✅ Improvements:
- No duplicates
- Clear labels
- Logical grouping
- All pages accessible
```

---

**End of Design Document**
