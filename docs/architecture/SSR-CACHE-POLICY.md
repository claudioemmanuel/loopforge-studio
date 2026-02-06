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

## Default Rules

- Prefer server-rendered initial payload for authenticated dashboard routes.
- Keep client fetching for live updates, pagination, or user-triggered mutations.
- Add `loading.tsx` and `error.tsx` at route-group boundaries for deterministic streaming and failure behavior.
