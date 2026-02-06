# Cleanup Manifest (Aggressive)

Date: 2026-02-06
Scope: remove files not required for runtime/build/tests/CI/open-source onboarding.

## Removed Files

### Internal/assistant-only

- `CLAUDE.MD`

### Archived migration utility scripts (unused)

- `scripts/archive/bootstrap-migrations.js`
- `scripts/archive/fix-schema.js`
- `scripts/archive/reset-migrations.js`
- `scripts/archive/sync-migrations.js`
- `scripts/archive/verify-migration-fix.sh`
- Removed empty dir: `scripts/archive/`

### Stale planning artifacts superseded by final DDD docs

- `docs/plans/2025-01-25-local-first-cleanup-design.md`
- `docs/plans/2026-01-29-repo-page-ux-refactor-design.md`
- `docs/plans/2026-01-29-repo-page-ux-refactor.md`
- `docs/plans/2026-01-30-internationalization-i18n.md`
- `docs/plans/2026-02-01-navigation-restructure-design.md`

## Kept Intentionally

- `docs/plans/2026-02-05-clean-architecture-task-context-design.md`
- `docs/plans/2026-02-06-full-backend-ddd-migration.md`
- `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- `.github/workflows/ci.yml`
- production and dev compose files

Rationale: retained the two architecture-critical migration plans for traceability and contributor context.
