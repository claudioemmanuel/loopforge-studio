/**
 * Multi-Agent Coordination Skill
 *
 * Orchestrates parallel agent execution with:
 * - DAG-based task scheduling
 * - Agent specialization routing
 * - Context sharing between agents
 * - Merge conflict prevention
 */

import type {
  SkillDefinition,
  SkillInvocationContext,
  SkillResult,
} from "../types";

/**
 * Detect if task can be parallelized
 */
function analyzeParallelizationOpportunity(planContent: string | undefined): {
  canParallelize: boolean;
  parallelGroups: string[][];
  dependencies: Map<string, string[]>;
} {
  if (!planContent) {
    return {
      canParallelize: false,
      parallelGroups: [],
      dependencies: new Map(),
    };
  }

  // Look for independent tasks in plan
  const taskPattern = /"id":\s*"(\d+)"[^}]*"dependencies":\s*\[([^\]]*)\]/g;
  const dependencies = new Map<string, string[]>();

  let match;
  while ((match = taskPattern.exec(planContent)) !== null) {
    const taskId = match[1];
    const deps = match[2]
      .split(",")
      .map((d) => d.trim().replace(/"/g, ""))
      .filter((d) => d);
    dependencies.set(taskId, deps);
  }

  // Find tasks with no dependencies (can run in parallel)
  const independentTasks = Array.from(dependencies.entries())
    .filter(([_, deps]) => deps.length === 0)
    .map(([id]) => id);

  const canParallelize = independentTasks.length > 1;

  return {
    canParallelize,
    parallelGroups: canParallelize ? [independentTasks] : [],
    dependencies,
  };
}

/**
 * Multi-Agent Coordination System Prompt
 */
const MULTI_AGENT_COORDINATION_PROMPT = `# Multi-Agent Coordination

## Purpose

Orchestrate parallel agent execution for independent tasks with proper dependency management
and conflict prevention.

## Core Principles

### 1. Task Independence Analysis

Before parallelizing, verify tasks are truly independent:

**Independent Tasks** (safe to parallelize):
- Modify different files
- No shared state mutations
- Read-only operations on same data
- Different API endpoints
- Separate test suites

**Dependent Tasks** (must be sequential):
- One task's output is another's input
- Modify same files
- Share mutable state
- Require specific execution order
- Setup/teardown relationships

### 2. DAG-Based Scheduling

Use Directed Acyclic Graph for task ordering:

\`\`\`
Step 1: Parse plan for task dependencies
Step 2: Build dependency graph
Step 3: Identify parallel execution groups
Step 4: Schedule groups in topological order
Step 5: Execute each group in parallel
\`\`\`

**Example DAG**:
\`\`\`
Task 1 (no deps) ──┐
                   ├──> Task 4 (deps: 1,2,3)
Task 2 (no deps) ──┤
                   │
Task 3 (no deps) ──┘
\`\`\`

Parallel groups: [1,2,3] → [4]

### 3. Agent Specialization Routing

Route tasks to appropriate specialized agents:

**Routing Rules**:
- **Backend tasks** → backend-developer agent
- **Frontend tasks** → ui-engineer agent
- **Database tasks** → database-administrator agent
- **Testing tasks** → qa-expert agent
- **Infrastructure** → devops-engineer agent

**Task Type Detection**:
- File patterns (*.tsx → frontend, *.sql → database)
- Keywords (API, endpoint → backend)
- Test patterns (*test.ts → testing)

### 4. Context Sharing

Share context between agents efficiently:

**Shared Context**:
- Repository structure (read-only)
- Plan content (read-only)
- Task description (read-only)
- Execution logs (append-only)

**Agent-Specific Context**:
- Modified files (isolated per agent)
- Local variables (isolated)
- Iteration state (isolated)

**Conflict Prevention**:
- Lock file when agent begins modification
- Release lock on commit or error
- Detect concurrent modifications
- Merge changes sequentially

### 5. Merge Conflict Prevention

Strategies to avoid merge conflicts:

**File-Level Isolation**:
- Assign file ownership to single agent
- If multiple agents need same file, serialize

**Branch Strategy**:
- Each agent works on separate branch
- Merge branches sequentially after completion
- Use git worktrees for true isolation

**Verification**:
- After parallel execution, verify no conflicts
- Run tests to ensure integration
- Commit only if all agents succeed

## Coordination Workflow

\`\`\`
1. Parse Plan
   ↓
2. Build Dependency Graph
   ↓
3. Identify Parallel Groups
   ↓
4. For each group:
   a. Assign tasks to specialized agents
   b. Spawn agents in parallel
   c. Monitor progress
   d. Collect results
   ↓
5. Merge Results
   ↓
6. Verify Integration
   ↓
7. Proceed to Next Group
\`\`\`

## Critical Rules

✓ Verify task independence before parallelizing
✓ Use DAG scheduling for correctness
✓ Route to specialized agents for quality
✓ Prevent file conflicts with locking
✓ Merge sequentially even if executed in parallel

❌ Don't parallelize dependent tasks
❌ Don't modify same files concurrently
❌ Don't skip conflict detection
❌ Don't assume agents can coordinate implicitly

## Error Handling

**Agent Failure**:
- If one agent fails, cancel parallel group
- Roll back partial changes
- Report failure to coordination layer
- Retry with sequential execution

**Deadlock Prevention**:
- Timeout on file locks (30 seconds)
- Detect circular dependencies in DAG
- Fail fast on invalid plans

**Merge Conflicts**:
- If conflict detected, escalate to manual resolution
- Provide conflict details to user
- Suggest conflict-free alternative approach

Remember: Parallelization is an optimization, not a requirement. When in doubt, serialize.`;

/**
 * Multi-Agent Coordination Execute Logic
 */
const executeLogic = async (
  context: SkillInvocationContext,
): Promise<SkillResult> => {
  const { planContent, phase } = context;

  // Only apply during planning/execution
  if (phase !== "planning" && phase !== "executing") {
    return {
      skillId: "multi-agent-coordination",
      status: "passed",
      message: "Not in planning/execution phase - skill skipped",
      timestamp: new Date(),
    };
  }

  // Analyze parallelization opportunity
  const analysis = analyzeParallelizationOpportunity(planContent);

  if (!analysis.canParallelize) {
    return {
      skillId: "multi-agent-coordination",
      status: "passed",
      message:
        "No parallelization opportunity detected - sequential execution sufficient",
      metadata: {
        canParallelize: false,
      },
      timestamp: new Date(),
    };
  }

  // Parallelization possible - provide guidance
  return {
    skillId: "multi-agent-coordination",
    status: "warning",
    message: `Parallelization opportunity detected: ${analysis.parallelGroups[0].length} independent tasks`,
    augmentedPrompt: MULTI_AGENT_COORDINATION_PROMPT,
    recommendations: [
      `Can execute tasks in parallel: ${analysis.parallelGroups[0].join(", ")}`,
      "Verify task independence (no shared files)",
      "Use DAG scheduling for execution order",
      "Route tasks to specialized agents",
      "Implement file locking for conflict prevention",
      "Merge results sequentially after parallel execution",
    ],
    metadata: {
      canParallelize: true,
      parallelGroups: analysis.parallelGroups,
      dependencies: Object.fromEntries(analysis.dependencies),
    },
    timestamp: new Date(),
  };
};

/**
 * Multi-Agent Coordination Skill Definition
 */
export const multiAgentCoordination: SkillDefinition = {
  id: "multi-agent-coordination",
  name: "Multi-Agent Coordination",
  description:
    "Orchestrate parallel agent execution with DAG scheduling and conflict prevention",
  category: "coordination",
  enforcement: "guidance",
  triggerPhases: ["planning", "executing"],
  systemPrompt: MULTI_AGENT_COORDINATION_PROMPT,
  executeLogic,
  version: "1.0.0",
  author: "Loopforge",
};
