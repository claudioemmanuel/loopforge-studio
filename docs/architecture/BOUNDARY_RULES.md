# Clean Architecture Boundary Rules

Date: 2026-02-06
Status: Active

## Purpose

Prevent clean-architecture regressions by enforcing where persistence imports are allowed and documenting the port/adapter pattern.

## Layer Structure

```
┌─────────────────────────────────────────────────┐
│  Presentation Layer (UI/API Routes)            │
│  - app/(dashboard)/**                           │
│  - app/(auth)/**                                │
│  - app/api/**                                   │
└─────────────────┬───────────────────────────────┘
                  │ Uses facades/services
                  ▼
┌─────────────────────────────────────────────────┐
│  Application Layer (Use Cases & Services)      │
│  - lib/contexts/*/application/*-service.ts      │
└─────────────────┬───────────────────────────────┘
                  │ Uses repository ports
                  ▼
┌─────────────────────────────────────────────────┐
│  Domain Layer (Business Logic)                 │
│  - lib/contexts/*/domain/                       │
└─────────────────────────────────────────────────┘
                  ▲
                  │ Implemented by adapters
┌─────────────────────────────────────────────────┐
│  Infrastructure Layer (Adapters)               │
│  - lib/contexts/*/infrastructure/               │
│  - Database access (@/lib/db) ONLY HERE         │
└─────────────────────────────────────────────────┘
```

## Import Rules

### ❌ FORBIDDEN

1. **Presentation Layer** (`app/(dashboard)/**`, `app/api/**`) CANNOT import `@/lib/db`
   - Use context API facades: `@/lib/contexts/*/api/`
   - Use service factories: `getTaskService()`, `getUserService()`

2. **Application Layer** (`lib/contexts/*/application/**`) CANNOT import `@/lib/db`
   - Use repository interfaces injected via constructor
   - Dependencies injected, not imported

3. **Domain Layer** (`lib/contexts/*/domain/**`) CANNOT import infrastructure or presentation
   - Domain is the core - zero external dependencies
   - Only imports: other domain entities, domain events, standard library

### ✅ ALLOWED

1. **Infrastructure Layer** (`lib/contexts/*/infrastructure/**`) CAN import `@/lib/db`
   - ONLY layer allowed to know about database implementation
   - Implements repository ports defined in domain

### Documented Exceptions

Some files legitimately need direct DB access:

- `app/api/system/health/route.ts` - Health checks
- `app/api/workers/monitoring/route.ts` - Worker monitoring

## Port/Adapter Pattern

### Port (Interface)

\`\`\`typescript
// lib/contexts/task/domain/ports.ts
export interface TaskRepository {
findById(id: string): Promise<Task | null>;
save(task: Task): Promise<void>;
}
\`\`\`

### Adapter (Implementation)

\`\`\`typescript
// lib/contexts/task/infrastructure/task-repository.ts
import { db } from "@/lib/db"; // ✅ ALLOWED in infrastructure

export class PrismaTaskRepository implements TaskRepository {
async findById(id: string) {
return db.task.findUnique({ where: { id } });
}
}
\`\`\`

### Dependency Injection

\`\`\`typescript
// lib/contexts/task/api/index.ts (Factory)
import { TaskService } from "../application/task-service";
import { PrismaTaskRepository } from "../infrastructure/task-repository";

export function getTaskService() {
const taskRepo = new PrismaTaskRepository();
return new TaskService(taskRepo); // Inject adapter
}
\`\`\`

## Enforcement

### Static Analysis

\`\`\`bash

# Find violations

rg -n "from ['\"]@/lib/db" app/(dashboard) app/api/tasks lib/contexts/\*/application
\`\`\`

### ESLint Rules

See \`eslint.config.mjs\` for automated enforcement blocking \`@/lib/db\` imports in presentation and application layers.

### Code Review Checklist

- [ ] No \`@/lib/db\` imports in presentation layer
- [ ] No \`@/lib/db\` imports in application layer
- [ ] Domain layer has no infrastructure dependencies
- [ ] New database access goes in infrastructure/repositories
- [ ] Services use dependency injection

## Current Facades

- \`lib/contexts/task/api/index.ts\`
- \`lib/contexts/execution/api/index.ts\`
- \`lib/contexts/iam/api/index.ts\`
- \`lib/contexts/repository/api/index.ts\`
- \`lib/contexts/billing/api/index.ts\`
- \`lib/contexts/analytics/api/index.ts\`
- \`lib/contexts/dashboard/api/index.ts\` (planned)
- \`lib/contexts/settings/api/index.ts\` (planned)
- \`lib/contexts/activity/api/index.ts\` (planned)

## Benefits

1. **Testability:** Mock repositories in tests (no database needed)
2. **Maintainability:** Clear separation of concerns
3. **Flexibility:** Swap implementations without touching application layer
4. **Team Collaboration:** Clear boundaries prevent merge conflicts

## Related Documentation

- [DDD Migration Status](./DDD-MIGRATION-STATUS.md)
- [Clean Architecture Gap Report](./2026-02-06-clean-architecture-gap-report.md)
- [Architecture Master Plan](./2026-02-06-architecture-migration-master-plan.md)
