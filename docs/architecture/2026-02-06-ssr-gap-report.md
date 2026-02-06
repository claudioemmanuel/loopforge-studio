# SSR Gap Report (Next.js App Router)

Date: 2026-02-06  
Status: Partially aligned, not fully aligned with current official guidance

## Official Baseline Used

This report aligns with current Next.js App Router docs:

- Server Components: https://nextjs.org/docs/app/building-your-application/rendering/server-components
- Client Components: https://nextjs.org/docs/app/building-your-application/rendering/client-components
- Data Fetching: https://nextjs.org/docs/app/building-your-application/data-fetching
- Loading UI and Streaming: https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
- Caching: https://nextjs.org/docs/app/building-your-application/caching

## Executive Verdict

The project uses App Router correctly and has a working SSR foundation, but dashboard-heavy surfaces remain client-first and hydration-dependent. Current implementation is not fully aligned with server-first and selective-client-boundary best practices.

## Inventory

- Total pages: 33 (`find app -name 'page.tsx' | wc -l`)
- Client pages (`"use client"` at page entry): 13
  - Scan source: `rg -n "^['\\\"]use client['\\\"]" app --glob '**/page.tsx'`

### Client page routes (current)

- `app/(dashboard)/analytics/page.tsx`
- `app/(dashboard)/repos/[repoId]/page.tsx`
- `app/(dashboard)/activity/active/page.tsx`
- `app/(dashboard)/activity/history/page.tsx`
- `app/(dashboard)/activity/failed/page.tsx`
- `app/(dashboard)/settings/account/page.tsx`
- `app/(dashboard)/settings/automation/page.tsx`
- `app/(dashboard)/settings/connections/page.tsx`
- `app/(dashboard)/settings/preferences/page.tsx`
- `app/(auth)/login/page.tsx`
- `app/(auth)/onboarding/page.tsx`
- `app/(auth)/setup/page.tsx`
- `app/(auth)/welcome/page.tsx`

## Evidence Snapshot

### Analytics route is fully client-first and disables SSR for major components

- Client page marker: `app/(dashboard)/analytics/page.tsx:1`
- Dynamic imports with SSR disabled:
  - `app/(dashboard)/analytics/page.tsx:12`
  - `app/(dashboard)/analytics/page.tsx:18`
  - `app/(dashboard)/analytics/page.tsx:23`
  - `app/(dashboard)/analytics/page.tsx:28`
  - `app/(dashboard)/analytics/page.tsx:33`
- Client-side fetch after hydration:
  - `app/(dashboard)/analytics/page.tsx:89`

### Activity and settings pages are client pages with browser fetch orchestration

- `app/(dashboard)/activity/active/page.tsx:1`
- `app/(dashboard)/activity/active/page.tsx:87`
- `app/(dashboard)/activity/active/page.tsx:96`
- `app/(dashboard)/settings/connections/page.tsx:1`
- `app/(dashboard)/settings/connections/page.tsx:165`
- `app/(dashboard)/settings/connections/page.tsx:547`

### Server-rendered pages exist, but some query DB directly

- `app/(dashboard)/layout.tsx:4`
- `app/(dashboard)/dashboard/page.tsx:2`
- `app/(dashboard)/repositories/page.tsx:2`
- `app/(dashboard)/settings/layout.tsx:3`
- `app/(dashboard)/activity/[id]/page.tsx:3`

### Route-level loading/error boundary coverage is thin

- Loading boundaries found: 3
  - `app/(dashboard)/analytics/loading.tsx`
  - `app/(dashboard)/repos/[repoId]/loading.tsx`
  - `app/(dashboard)/settings/account/loading.tsx`
- Error boundaries found: 0 (`find app -name 'error.tsx'`)
- Not-found boundaries found: 1
  - `app/(dashboard)/activity/[id]/not-found.tsx`

## Gap Matrix

| ID     | Gap                                                      | Evidence                                                        | Impact                                                                            | Target                                                                              |
| ------ | -------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| SSR-01 | Data-heavy dashboard pages are client-first              | `analytics/page.tsx:1`, `analytics/page.tsx:89`                 | Slower first meaningful render and SEO-unfriendly payload for dashboard analytics | Server-render initial data in page/layout, keep client only for local interactivity |
| SSR-02 | SSR disabled for key analytics widgets                   | `analytics/page.tsx:12`, `:18`, `:23`, `:28`, `:33`             | Full chart payload deferred to client, larger hydration burden                    | Render server shell + stream chart data; use client widgets only where needed       |
| SSR-03 | Mutation-oriented pages also own initial fetch on client | `activity/active/page.tsx:1`, `settings/connections/page.tsx:1` | Waterfalls and delayed paint                                                      | Split into server entry + client mutation islands                                   |
| SSR-04 | Incomplete loading/error boundary strategy               | only 3 `loading.tsx`, no `error.tsx`                            | Weak failure isolation and poor progressive rendering coverage                    | Add segment-level `loading.tsx` and `error.tsx` for major dashboard routes          |
| SSR-05 | Server pages leak persistence details                    | `dashboard/page.tsx:2`, `settings/layout.tsx:3`                 | Coupled SSR layer and domain persistence                                          | Server pages call context read facades, not DB directly                             |

## Required Rendering Policy

1. Default policy:

- Server-rendered page/layout by default.
- Client boundary only for interactive controls, drag/drop, realtime subscriptions, or browser-only APIs.

2. Data policy:

- Initial query on server for dashboard/settings/activity detail routes.
- Client fetch only for explicit live refresh or mutation responses.

3. Boundary policy:

- `loading.tsx` required for each data-heavy segment.
- `error.tsx` required for each dashboard route group.

4. Cache policy:

- Explicitly declare data freshness behavior per route (`revalidate`, dynamic reads, cache tags) instead of implicit behavior.

## Migration Plan (Decision Complete)

### Phase 1 - Rendering Architecture Refactor

1. Convert to server-entry + client-island patterns:

- `app/(dashboard)/analytics/page.tsx`
- `app/(dashboard)/activity/active/page.tsx`
- `app/(dashboard)/activity/history/page.tsx`
- `app/(dashboard)/activity/failed/page.tsx`
- `app/(dashboard)/settings/connections/page.tsx`

2. Create client island components under `components/*` for:

- interaction handlers
- local filters
- mutation actions
- realtime hooks

### Phase 2 - Data Preload On Server

1. Add server-side data loaders via context facades for initial render.
2. Pass hydrated data into client islands as props.
3. Keep client fetch for:

- polling or SSE refresh
- post-mutation revalidation

### Phase 3 - Streaming And Errors

1. Add `loading.tsx` for:

- `app/(dashboard)/activity`
- `app/(dashboard)/settings`
- `app/(dashboard)/dashboard`

2. Add `error.tsx` for key route groups:

- `app/(dashboard)/activity/error.tsx`
- `app/(dashboard)/settings/error.tsx`
- `app/(dashboard)/analytics/error.tsx`

### Phase 4 - Caching Contract

1. Document per-route cache policy in `docs/architecture/SSR-CACHE-POLICY.md`.
2. For each route, define:

- data source
- freshness requirement
- invalidation strategy

## Acceptance Criteria

1. All dashboard pages render meaningful initial content server-side before hydration.
2. Client-only pages in `app/**/page.tsx` are limited to auth onboarding and intentionally interactive-only surfaces.
3. Major dashboard route groups have both `loading.tsx` and `error.tsx`.
4. Each data-heavy route has explicit freshness policy documented and enforced.

## Validation Scenarios

1. Rendering mode audit:

- confirm route render mode and server payload for dashboard routes.

2. Performance:

- compare first contentful paint and hydration timing before/after.

3. Failure behavior:

- force API failures and verify route-level `error.tsx` handling.

4. Streaming:

- verify loading fallbacks render immediately while data resolves.
