# Type Safety Audit Cleanup Pass 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce TypeScript compile errors by addressing the highest-frequency type mismatch patterns first.

**Architecture:** Apply low-risk, high-leverage typing fixes in test scaffolding and shared type contracts before touching domain behavior. Start with repeated mock-shape failures (`AIClient`), then align route/test handler signatures and graph/domain metadata types.

**Tech Stack:** TypeScript 5.7, Vitest, Next.js route handlers, Drizzle ORM, Loopforge skills framework

### Task 1: Fix `AIClient` Mock Contract Violations (TS2345 Cluster)

**Files:**

- Modify: `__tests__/unit/lib/skills/core/planning-skills.test.ts`
- Modify: `__tests__/unit/lib/skills/core/systematic-debugging.test.ts`
- Modify: `__tests__/unit/lib/skills/core/test-driven-development.test.ts`
- Modify: `__tests__/unit/lib/skills/core/verification-before-completion.test.ts`
- Modify: `__tests__/unit/lib/skills/loopforge/loopforge-skills.test.ts`

**Step 1: Convert mock client declarations to `AIClient`**

- Replace `Partial<AIClient>` or ad-hoc provider/model-only objects with fully typed `AIClient` mocks.

**Step 2: Add minimal `chat` stub**

- Provide `chat: async () => ""` in each mock to satisfy interface requirements without altering test behavior.

**Step 3: Run focused typecheck for target files**

- Command: `npx tsc --noEmit --pretty false 2>&1 | rg -n "planning-skills\\.test|systematic-debugging\\.test|test-driven-development\\.test|verification-before-completion\\.test|loopforge-skills\\.test"`
- Expected: no matches for those files.

### Task 2: Fix Route Handler Test Signature Mismatches (TS2352 Cluster)

**Files:**

- Modify: `__tests__/api/brainstorm-start-route.test.ts`
- Modify: `__tests__/api/plan-start-route.test.ts`

**Step 1: Align test route handler cast types**

- Update local handler type aliases to match current Next route context shape (`{ params: Promise<...> }`).

**Step 2: Run focused typecheck**

- Command: `npx tsc --noEmit --pretty false 2>&1 | rg -n "__tests__/api/(brainstorm-start-route|plan-start-route)\\.test"`
- Expected: no matches.

### Task 3: Align Graph/Domain Metadata Test Expectations (TS2339/TS2322 Cluster)

**Files:**

- Modify: `__tests__/unit/graph-builder.test.ts`
- Modify: `lib/shared/graph-builder.ts` (if needed)
- Modify: `__tests__/domain-events/runtime-operational.test.ts`

**Step 1: Reconcile status/phase enum expectations with current types**

- Update invalid literal usages (e.g., `"brainstorming"` vs current phase type).

**Step 2: Reconcile metadata field names**

- Remove/replace stale properties (e.g., missing `agentType` on `ExecutionEventMetadata` if no longer present).

**Step 3: Run focused typecheck**

- Command: `npx tsc --noEmit --pretty false 2>&1 | rg -n "__tests__/unit/graph-builder\\.test|__tests__/domain-events/runtime-operational\\.test|lib/shared/graph-builder\\.ts"`
- Expected: no matches.

### Task 4: Re-baseline and Report Remaining Debt

**Files:**

- No code changes required

**Step 1: Re-run full typecheck**

- Command: `npx tsc --noEmit --pretty false`

**Step 2: Produce hotspot summary**

- Group remaining errors by file and error code for next pass prioritization.
