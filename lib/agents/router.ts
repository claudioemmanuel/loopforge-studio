/**
 * Task Router - Routes tasks to the most appropriate specialized agent
 */

import type { AgentDefinition, PlanStep } from "./types";
import { getAllAgents, getAgent } from "./registry";
import { Agents } from "./registry";

interface RoutingResult {
  agent: AgentDefinition;
  confidence: number;
  matchedKeywords: string[];
  reason: string;
}

interface RoutingOptions {
  /** Prefer certain agent categories */
  preferCategories?: string[];
  /** Exclude certain agents */
  excludeAgents?: string[];
  /** Override routing for specific task IDs */
  overrides?: Record<string, string>;
}

/**
 * Calculate how well a task matches an agent based on keywords
 */
function calculateKeywordScore(
  content: string,
  agent: AgentDefinition
): { score: number; matchedKeywords: string[] } {
  const lowerContent = content.toLowerCase();
  const matchedKeywords: string[] = [];
  let score = 0;

  for (const keyword of agent.keywords) {
    const lowerKeyword = keyword.toLowerCase();

    // Check for exact word match (with word boundaries)
    const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(lowerKeyword)}\\b`, "i");
    if (wordBoundaryRegex.test(lowerContent)) {
      score += 10;
      matchedKeywords.push(keyword);
      continue;
    }

    // Check for partial match
    if (lowerContent.includes(lowerKeyword)) {
      score += 5;
      matchedKeywords.push(keyword);
    }
  }

  return { score, matchedKeywords };
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Route a single task to the most appropriate agent
 */
export function routeTaskToAgent(
  task: PlanStep,
  options: RoutingOptions = {}
): RoutingResult {
  const { preferCategories, excludeAgents = [], overrides = {} } = options;

  // Check for manual override first
  if (overrides[task.id]) {
    const overrideAgent = getAgent(overrides[task.id]);
    if (overrideAgent) {
      return {
        agent: overrideAgent,
        confidence: 1.0,
        matchedKeywords: [],
        reason: "Manual override specified",
      };
    }
  }

  // Combine task content for analysis
  const content = `${task.title} ${task.description} ${(task.tags || []).join(" ")}`;

  // Score all agents
  const agents = getAllAgents();
  const scoredAgents: Array<{
    agent: AgentDefinition;
    score: number;
    matchedKeywords: string[];
  }> = [];

  for (const agent of agents) {
    // Skip excluded agents
    if (excludeAgents.includes(agent.id)) {
      continue;
    }

    const { score, matchedKeywords } = calculateKeywordScore(content, agent);

    // Apply category preference bonus
    let adjustedScore = score;
    if (preferCategories?.includes(agent.category)) {
      adjustedScore *= 1.5;
    }

    // Apply priority bonus (higher priority agents get slight boost)
    adjustedScore += agent.priority * 0.1;

    scoredAgents.push({
      agent,
      score: adjustedScore,
      matchedKeywords,
    });
  }

  // Sort by score descending
  scoredAgents.sort((a, b) => b.score - a.score);

  // If we have a clear winner with good confidence
  if (scoredAgents.length > 0 && scoredAgents[0].score > 0) {
    const winner = scoredAgents[0];
    const confidence = Math.min(winner.score / 100, 1.0);

    return {
      agent: winner.agent,
      confidence,
      matchedKeywords: winner.matchedKeywords,
      reason: `Matched keywords: ${winner.matchedKeywords.join(", ")}`,
    };
  }

  // Fall back to fullstack developer for generic tasks
  return {
    agent: Agents.fullstackDeveloper,
    confidence: 0.5,
    matchedKeywords: [],
    reason: "No specific match, using fullstack developer as default",
  };
}

/**
 * Route multiple tasks and return a mapping
 */
export function routeTasks(
  tasks: PlanStep[],
  options: RoutingOptions = {}
): Map<string, RoutingResult> {
  const results = new Map<string, RoutingResult>();

  for (const task of tasks) {
    results.set(task.id, routeTaskToAgent(task, options));
  }

  return results;
}

/**
 * Analyze a task description and suggest the best agent
 * Useful for UI showing which agent will handle a task
 */
export function analyzeTask(description: string): RoutingResult {
  const pseudoTask: PlanStep = {
    id: "analysis",
    title: description,
    description: "",
    dependencies: [],
  };

  return routeTaskToAgent(pseudoTask);
}

/**
 * Get routing explanation for debugging
 */
export function explainRouting(task: PlanStep): string {
  const agents = getAllAgents();
  const content = `${task.title} ${task.description} ${(task.tags || []).join(" ")}`;

  const explanations: string[] = [`Task: "${task.title}"`, "", "Agent Scores:"];

  const scores: Array<{ name: string; score: number; keywords: string[] }> = [];

  for (const agent of agents) {
    const { score, matchedKeywords } = calculateKeywordScore(content, agent);
    scores.push({
      name: agent.name,
      score: score + agent.priority * 0.1,
      keywords: matchedKeywords,
    });
  }

  scores.sort((a, b) => b.score - a.score);

  for (const { name, score, keywords } of scores.slice(0, 5)) {
    explanations.push(`  ${name}: ${score.toFixed(1)} (${keywords.join(", ") || "no matches"})`);
  }

  const result = routeTaskToAgent(task);
  explanations.push("", `Selected: ${result.agent.name} (confidence: ${(result.confidence * 100).toFixed(0)}%)`);

  return explanations.join("\n");
}

/**
 * Detect if a task is a review task (for mandatory code review)
 */
export function isReviewTask(task: PlanStep): boolean {
  const content = `${task.title} ${task.description}`.toLowerCase();
  const reviewKeywords = ["review", "check", "verify", "validate", "audit", "inspect"];

  return reviewKeywords.some((kw) => content.includes(kw));
}

/**
 * Detect if a task is a test task
 */
export function isTestTask(task: PlanStep): boolean {
  const content = `${task.title} ${task.description}`.toLowerCase();
  const testKeywords = ["test", "spec", "coverage", "unit test", "integration test", "e2e"];

  return testKeywords.some((kw) => content.includes(kw));
}
