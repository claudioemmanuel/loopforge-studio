# Worker History Redesign

## Problem

The current Execution History page only shows tasks that reached `done` or `stuck` status. Workers process three phases (brainstorming, planning, executing), but only the final execution phase is tracked. Users cannot see:
- Brainstorming jobs that completed
- Planning jobs that completed
- What a worker was thinking/doing during any phase

## Solution

Create a unified **Worker History** system that tracks all background processing jobs regardless of phase.

## Data Model

### New Tables

```sql
-- worker_jobs: Tracks all background processing (brainstorm, plan, execute)
CREATE TABLE worker_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  phase VARCHAR(20) NOT NULL, -- 'brainstorming' | 'planning' | 'executing'
  status VARCHAR(20) NOT NULL DEFAULT 'queued', -- 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Results
  error_message TEXT,
  result_summary TEXT, -- Brief description: "Generated 4 requirements", "Created 5-step plan"

  -- Metadata
  job_id VARCHAR(100), -- BullMQ job ID for correlation
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- worker_events: Timeline of actions during any job
CREATE TABLE worker_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_job_id UUID NOT NULL REFERENCES worker_jobs(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL, -- 'thinking' | 'action' | 'file_read' | 'file_write' | 'api_call' | 'error' | 'complete'
  content TEXT NOT NULL,
  metadata JSONB, -- { filePath, model, tokenCount, duration, etc. }
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_worker_jobs_task_id ON worker_jobs(task_id);
CREATE INDEX idx_worker_jobs_status ON worker_jobs(status);
CREATE INDEX idx_worker_jobs_phase ON worker_jobs(phase);
CREATE INDEX idx_worker_jobs_completed_at ON worker_jobs(completed_at DESC);
CREATE INDEX idx_worker_events_job_id ON worker_events(worker_job_id);
```

### Schema Types (Drizzle)

```typescript
// lib/db/schema.ts

export const workerJobPhaseEnum = pgEnum("worker_job_phase", [
  "brainstorming",
  "planning",
  "executing"
]);

export const workerJobStatusEnum = pgEnum("worker_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled"
]);

export const workerEventTypeEnum = pgEnum("worker_event_type", [
  "thinking",
  "action",
  "file_read",
  "file_write",
  "api_call",
  "error",
  "complete"
]);

export const workerJobs = pgTable("worker_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  phase: workerJobPhaseEnum("phase").notNull(),
  status: workerJobStatusEnum("status").notNull().default("queued"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  resultSummary: text("result_summary"),
  jobId: varchar("job_id", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workerEvents = pgTable("worker_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workerJobId: uuid("worker_job_id").notNull().references(() => workerJobs.id, { onDelete: "cascade" }),
  eventType: workerEventTypeEnum("event_type").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<WorkerEventMetadata>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

## Queue Worker Integration

### Brainstorm Queue

**File**: `lib/queue/brainstorm-queue.ts`

```typescript
async function processBrainstorm(job: Job<BrainstormJobData>) {
  const { taskId, userId } = job.data;

  // Create worker job record
  const [workerJob] = await db.insert(workerJobs).values({
    taskId,
    phase: "brainstorming",
    status: "running",
    startedAt: new Date(),
    jobId: job.id,
  }).returning();

  try {
    // Emit thinking event
    await db.insert(workerEvents).values({
      workerJobId: workerJob.id,
      eventType: "thinking",
      content: "Analyzing task requirements and context...",
      metadata: { model: config.model }
    });

    // Process brainstorm...
    const result = await brainstormTask(client, task.title, task.description);

    // Emit completion
    await db.insert(workerEvents).values({
      workerJobId: workerJob.id,
      eventType: "complete",
      content: "Brainstorming complete",
      metadata: { requirementsCount: result.requirements.length }
    });

    // Update job as completed
    await db.update(workerJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        resultSummary: `Generated ${result.requirements.length} requirements`
      })
      .where(eq(workerJobs.id, workerJob.id));

  } catch (error) {
    await db.update(workerJobs)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: error.message
      })
      .where(eq(workerJobs.id, workerJob.id));
  }
}
```

### Plan Queue

**File**: `lib/queue/plan-queue.ts`

Same pattern as brainstorm queue - create job, emit events, update completion.

### Execution Worker

**File**: `workers/execution-worker.ts`

Wire the existing `onEvent` callback to also insert into `worker_events`:

```typescript
// Create worker job for execution phase
const [workerJob] = await db.insert(workerJobs).values({
  taskId,
  phase: "executing",
  status: "running",
  startedAt: new Date(),
  jobId: job.id,
}).returning();

// In onEvent callback
onEvent: async (event) => {
  // Existing execution_events insert...

  // Also insert to worker_events for unified history
  await db.insert(workerEvents).values({
    workerJobId: workerJob.id,
    eventType: mapEventType(event.type),
    content: event.content,
    metadata: event.metadata,
  });
}
```

## API Changes

### Updated History Endpoint

**File**: `app/api/workers/history/route.ts`

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // New filter: phase
  const phase = searchParams.get("phase") as WorkerJobPhase | "all" | null;
  const status = searchParams.get("status") as "completed" | "failed" | "all" | null;
  const search = searchParams.get("search");
  const repoId = searchParams.get("repoId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;

  // Build conditions
  const conditions = [];

  if (phase && phase !== "all") {
    conditions.push(eq(workerJobs.phase, phase));
  }

  if (status === "completed") {
    conditions.push(eq(workerJobs.status, "completed"));
  } else if (status === "failed") {
    conditions.push(eq(workerJobs.status, "failed"));
  } else {
    conditions.push(inArray(workerJobs.status, ["completed", "failed"]));
  }

  // Query with task join
  const jobs = await db.query.workerJobs.findMany({
    where: and(...conditions),
    with: {
      task: { with: { repo: true } },
      events: { limit: 10, orderBy: desc(workerEvents.createdAt) }
    },
    orderBy: desc(workerJobs.completedAt),
    limit,
    offset: (page - 1) * limit
  });

  // Calculate stats
  const stats = await db.select({
    total: count(),
    completed: count(sql`CASE WHEN status = 'completed' THEN 1 END`),
    failed: count(sql`CASE WHEN status = 'failed' THEN 1 END`),
    brainstorming: count(sql`CASE WHEN phase = 'brainstorming' THEN 1 END`),
    planning: count(sql`CASE WHEN phase = 'planning' THEN 1 END`),
    executing: count(sql`CASE WHEN phase = 'executing' THEN 1 END`),
  }).from(workerJobs);

  return NextResponse.json({
    items: jobs.map(formatHistoryItem),
    stats: stats[0],
    page,
    hasMore: jobs.length === limit
  });
}
```

### Response Shape

```typescript
interface WorkerHistoryItem {
  id: string;
  taskId: string;
  taskTitle: string;
  repoName: string;
  phase: "brainstorming" | "planning" | "executing";
  status: "completed" | "failed";
  startedAt: string;
  completedAt: string;
  duration: number; // seconds
  resultSummary: string | null;
  errorMessage: string | null;
  events: WorkerEvent[];
}

interface WorkerHistoryStats {
  total: number;
  completed: number;
  failed: number;
  brainstorming: number;
  planning: number;
  executing: number;
}
```

## UI Changes

### History Page Updates

**File**: `app/(dashboard)/workers/history/page.tsx`

1. **Phase Filter Tabs**: Add tabs to filter by phase
   - All | Brainstorming | Planning | Execution

2. **Stats Cards**: Show breakdown by phase
   - Total jobs (not tasks)
   - Completed / Failed counts
   - Jobs by phase pie/bar

3. **History Cards**: Update to show phase badge
   - Phase badge with color (violet=brainstorm, blue=plan, green=execute)
   - Duration
   - Result summary
   - Expandable event timeline

### History Card Component

**File**: `components/workers/history-card.tsx`

```tsx
// Phase badge colors
const phaseBadgeColors = {
  brainstorming: "bg-violet-100 text-violet-700",
  planning: "bg-blue-100 text-blue-700",
  executing: "bg-emerald-100 text-emerald-700",
};

// Updated card showing phase
<div className="flex items-center gap-2">
  <Badge className={phaseBadgeColors[item.phase]}>
    {item.phase}
  </Badge>
  <span className="font-medium">{item.taskTitle}</span>
</div>
```

## Migration Strategy

1. **Create new tables** via Drizzle migration
2. **Update queue workers** to create `worker_jobs` records
3. **Keep existing `executions` table** for backward compatibility
4. **Backfill historical data** (optional): Create worker_jobs from existing tasks that have brainstorm/plan results

## Files to Modify

| File | Changes |
|------|---------|
| `lib/db/schema.ts` | Add `workerJobs`, `workerEvents` tables |
| `drizzle/XXXX_worker_jobs.sql` | Migration file |
| `lib/queue/brainstorm-queue.ts` | Create worker job records |
| `lib/queue/plan-queue.ts` | Create worker job records |
| `workers/execution-worker.ts` | Create worker job records, dual-write events |
| `app/api/workers/history/route.ts` | Query `worker_jobs` instead of tasks |
| `app/(dashboard)/workers/history/page.tsx` | Add phase filters, update stats |
| `components/workers/history-card.tsx` | Show phase badge, update layout |
| `components/workers/history-filters.tsx` | Add phase filter option |

## Verification

1. **Create a task** and let it brainstorm
2. **Check Worker History** - brainstorm job should appear with events
3. **Advance to planning** - plan job should appear
4. **Execute the task** - execution job should appear
5. **Filter by phase** - each filter should show correct jobs
6. **Expand a card** - event timeline should show worker thoughts/actions

---

**Created**: 2025-01-23
**Status**: Ready for implementation
