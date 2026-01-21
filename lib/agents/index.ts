/**
 * Agent System - Multi-agent execution for specialized tasks
 */

// Types
export type {
  AgentCategory,
  AgentDefinition,
  AgentExecutionContext,
  AgentOutput,
  AgentResult,
  PlanStep,
  ParsedPlan,
  ReviewResult,
  ReviewIssue,
  TaskNode,
  DependencyGraph,
  ParallelExecutionOptions,
  ExecutionProgress,
  ParallelExecutionResult,
  Tool,
} from "./types";

// Registry
export {
  getAgent,
  getAllAgents,
  getAgentsByCategory,
  getAgentIds,
  hasAgent,
  getAgentsByKeywords,
  Agents,
  type AgentId,
} from "./registry";

// Router
export {
  routeTaskToAgent,
  routeTasks,
  analyzeTask,
  explainRouting,
  isReviewTask,
  isTestTask,
} from "./router";

// Executor
export {
  executeWithAgent,
  executeTask,
  executeTaskWithAgentId,
  executeTasksSequentially,
} from "./executor";
