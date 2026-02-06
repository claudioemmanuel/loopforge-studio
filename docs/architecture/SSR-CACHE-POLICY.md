# SSR Cache Policy

Date: 2026-02-06
Status: Active

## Goal

Define explicit freshness and invalidation behavior for server-rendered dashboard surfaces.

## Route Policies

1. `app/(dashboard)/analytics/page.tsx`

- Source: analytics context service (`task_metrics`, `usage_records`, `activity_events`)
- Freshness: request-time for user-specific metrics
- Policy: dynamic data fetch on server render, client refresh for range changes
- Invalidation: automatic on next request after task/execution/activity writes

2. `app/(dashboard)/activity/active/page.tsx`

- Source: worker events + task runtime status
- Freshness: near-real-time
- Policy: server entry + client SSE/live updates
- Invalidation: SSE events and manual refresh

3. `app/(dashboard)/activity/history/page.tsx`

- Source: worker history API + execution records
- Freshness: short-lived (interactive browsing)
- Policy: server entry with client-driven pagination/filtering
- Invalidation: on retry/cancel and new worker events

4. `app/(dashboard)/activity/failed/page.tsx`

- Source: worker history filtered by failures
- Freshness: short-lived
- Policy: server entry with client refresh
- Invalidation: retry action removes failed item from list

5. `app/(dashboard)/settings/connections/page.tsx`

- Source: settings provider payload from settings layout
- Freshness: request-time on layout render
- Policy: server layout preloads masked keys/preferences; client handles mutations
- Invalidation: router refresh after configuration mutations

## Revalidate Configuration

Next.js route segments can export `revalidate` to control cache TTL:

```typescript
// app/(dashboard)/analytics/page.tsx
export const revalidate = 300; // 5 minutes - analytics data changes slowly

// app/(dashboard)/dashboard/page.tsx
export const revalidate = 60; // 1 minute - task status updates frequently

// app/(dashboard)/activity/active/page.tsx
export const revalidate = 30; // 30 seconds - near real-time worker status

// app/(dashboard)/settings/layout.tsx
export const revalidate = false; // Always fresh - user preferences must be current
```

### Recommended Values by Route Type

| Route Type       | Revalidate | Rationale                          |
| ---------------- | ---------- | ---------------------------------- |
| Dashboard        | 60s        | Balance freshness with performance |
| Analytics        | 300s (5m)  | Historical data changes slowly     |
| Activity/Workers | 30s        | Near real-time monitoring          |
| Settings         | false      | Always fresh - security sensitive  |
| Repository pages | 60s        | Task lists update frequently       |

## Tag-Based Invalidation

Use Next.js cache tags to invalidate specific data on mutations:

### Tag Patterns

```typescript
// Tag format: {entity}:{id}
"task:abc123"; // Specific task
"repo:xyz789"; // Specific repository
"user:user123"; // User-specific data
"execution:exec456"; // Specific execution
```

### Implementation Example

```typescript
// Server component - tag the fetch
import { unstable_cache } from "next/cache";

export async function getTaskData(taskId: string) {
  return unstable_cache(
    async () => {
      const service = getTaskService();
      return service.getTask(taskId);
    },
    [`task:${taskId}`], // Cache key
    {
      tags: [`task:${taskId}`, "tasks"], // Tags for invalidation
      revalidate: 60,
    },
  )();
}

// API route - invalidate on mutation
import { revalidateTag } from "next/cache";

export async function PATCH(
  request: Request,
  { params }: { params: { taskId: string } },
) {
  const { taskId } = params;

  // Update task...
  await taskService.updateTask(taskId, updates);

  // Invalidate caches
  revalidateTag(`task:${taskId}`);
  revalidateTag("tasks"); // Invalidate all task lists

  return Response.json({ success: true });
}
```

### When to Revalidate Tags

**Task mutations:**

- Create/Update/Delete: `revalidateTag('tasks')`, `revalidateTag(`task:${id}`)`
- Status change: `revalidateTag(`task:${id}`)`, `revalidateTag(`repo:${repoId}`)`

**Execution mutations:**

- Start/Complete: `revalidateTag(`execution:${id}`)`, `revalidateTag(`task:${taskId}`)`
- Events: `revalidateTag(`execution:${id}`)`

**Repository mutations:**

- Clone/Index: `revalidateTag(`repo:${id}`)`, `revalidateTag('repos')`
- Config update: `revalidateTag(`repo:${id}`)`

**User mutations:**

- Settings change: `revalidateTag(`user:${userId}`)`
- Provider config: `revalidateTag(`user:${userId}`)`

## Default Rules

- Prefer server-rendered initial payload for authenticated dashboard routes.
- Keep client fetching for live updates, pagination, or user-triggered mutations.
- Add `loading.tsx` and `error.tsx` at route-group boundaries for deterministic streaming and failure behavior.
- Use `revalidate` config for time-based caching (dashboard, analytics).
- Use `revalidateTag()` for precise invalidation on mutations (API routes).
- Combine both: time-based for background freshness, tag-based for immediate updates.
