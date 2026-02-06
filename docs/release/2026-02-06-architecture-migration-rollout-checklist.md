# Architecture Migration Rollout Checklist

Date: 2026-02-06
Owner: Platform

## Stage 1 — EDA Runtime + Taxonomy

- [ ] Deploy runtime role config (`DOMAIN_EVENT_RUNTIME_ROLE`, `DOMAIN_EVENT_CONSUMER_ROLE`).
- [ ] Confirm only consumer role starts subscriber loop.
- [ ] Monitor dead-letter channel volume (`domain-events:dead-letter`).
- [ ] Verify billing/analytics side effects are not duplicated.

## Stage 2 — Clean Architecture Boundaries

- [ ] Enforce boundary lint in CI.
- [ ] Confirm dashboard/settings/activity server pages use context facades.
- [ ] Confirm application services no longer import `@/lib/db*` directly for targeted contexts.

## Stage 3 — SSR Alignment

- [ ] Validate analytics initial render includes server-provided data.
- [ ] Validate activity/settings route-group `loading.tsx` and `error.tsx`.
- [ ] Confirm route-level cache/freshness behavior matches `docs/architecture/SSR-CACHE-POLICY.md`.

## Rollback Triggers

- Event lag or dead-letter spikes.
- Duplicate billing usage records.
- Dashboard latency regressions.
- Elevated route error rate.

## Rollback Actions

- Disable consumer role startup on non-owner runtimes.
- Revert canonical taxonomy rollout if integration regressions occur.
- Revert server-entry page wrappers per route group.
