# Workers Notification & Timeline Design

## Overview

Two UI enhancements for monitoring autonomous task execution:
1. **Sidebar Workers section** - Top-level nav item showing active workers
2. **Header notification bell** - Dropdown panel replacing toasts for worker status
3. **Workers page** - Full page with vertical timeline for autonomous tasks
4. **SSE endpoint** - Real-time event stream for worker updates

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Worker     │────▶│  SSE API    │────▶│  UI         │
│  (BullMQ)   │     │  /api/sse   │     │  Components │
└─────────────┘     └─────────────┘     └─────────────┘
     │                    │                    │
     ▼                    ▼                    ▼
  Job events         Stream events      Bell + Timeline
  stored in DB       to connected       update in
                     clients            real-time
```

## Component 1: Sidebar Workers Section

**Location:** New top-level item below "Dashboard" section, above "Settings"

**Expanded state:**
- Workers header with icon
- "Active (N)" showing count with list of active task names
- "View all →" link to /workers page

**Collapsed state:**
- Shows ⚡ icon with badge count if active workers exist
- Tooltip on hover: "Workers (2 active)"

**Badge logic:**
- Orange dot/count = tasks in autonomous flow
- Green checkmark briefly = just completed (fades after 5s)
- Red dot = stuck task needs attention

## Component 2: Header Notification Bell

**Location:** Dashboard header, right side

**Badge states:**
- Number (amber) = active workers running
- `!` (red) = stuck task needs attention
- No badge = all idle/complete

**Dropdown contents:**
- Shows last 5 worker events (active first, then recent)
- Auto-updates via SSE while open
- Click task row → opens task modal
- Click "View all workers" → navigates to /workers

**Status indicators:**
- ◉ spinning = executing
- ◐ partial = brainstorming/planning
- ✓ green = completed
- ⚠ amber = stuck

## Component 3: Workers Page

**Route:** `/workers`

**Layout:**
- Page header with filter dropdown (All/Active/Completed/Stuck)
- List of worker cards with vertical timeline

**Worker card states:**
- **Active:** Expanded by default, shows live timeline
- **Completed:** Collapsed, shows summary
- **Stuck:** Highlighted with error, action buttons

**Timeline visualization:**
```
● Brainstorming      ✓ Completed           2:34 PM
│  └ 4 requirements, 3 considerations       12s
●─Planning           ✓ Completed           2:35 PM
│  └ 6 steps across 8 files                 18s
●─Ready              ✓ Completed           2:35 PM
│  └ Complexity: 12 points (Medium)         1s
◉─Executing          ⟳ In progress...      2:36 PM
│  └ Step 3/6: Creating auth middleware
○ Done               ○ Pending
```

**Timeline node states:**
- ● filled = completed stage
- ◉ pulsing = current stage
- ○ empty = pending stage

## Component 4: SSE Implementation

**Endpoint:** `GET /api/workers/sse`

**Event types:**
```typescript
type WorkerEvent = {
  type: 'worker_update' | 'worker_complete' | 'worker_stuck';
  taskId: string;
  data: {
    status: TaskStatus;
    progress: number;
    currentStep?: string;
    currentAction?: string;
    error?: string;
    completedAt?: string;
  };
  timestamp: string;
};
```

**Progress calculation:**
- brainstorming = 20%
- planning = 40%
- ready = 60%
- executing = 60% + (step/totalSteps * 40%)
- done = 100%

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/workers` | List autonomous tasks with execution status |
| `GET /api/workers/sse` | SSE stream for real-time updates |
| `POST /api/workers/:taskId/retry` | Retry a stuck autonomous task |
| `POST /api/workers/:taskId/cancel` | Cancel an in-progress autonomous task |

## Files to Create

| File | Purpose |
|------|---------|
| `app/(dashboard)/workers/page.tsx` | Workers page |
| `app/api/workers/route.ts` | Workers list API |
| `app/api/workers/sse/route.ts` | SSE endpoint |
| `app/api/workers/[taskId]/retry/route.ts` | Retry endpoint |
| `app/api/workers/[taskId]/cancel/route.ts` | Cancel endpoint |
| `components/workers/worker-timeline.tsx` | Timeline component |
| `components/workers/notification-bell.tsx` | Header bell dropdown |
| `components/workers/worker-card.tsx` | Individual worker card |
| `components/hooks/use-worker-events.ts` | SSE client hook |
| `lib/workers/events.ts` | Event publishing utilities |

## Files to Modify

| File | Changes |
|------|---------|
| `components/sidebar.tsx` | Add Workers nav item |
| `app/(dashboard)/layout.tsx` | Add notification bell to header |
| `lib/queue/autonomous-flow.ts` | Publish events to Redis |
| `workers/execution-worker.ts` | Publish execution events |
