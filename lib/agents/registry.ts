/**
 * Agent Registry - Central repository of all available agents
 */

import type { AgentDefinition, AgentCategory } from "./types";

// Import all agent definitions
import { backendDeveloper } from "./definitions/backend-developer";
import { frontendDeveloper } from "./definitions/frontend-developer";
import { uiEngineer } from "./definitions/ui-engineer";
import { fullstackDeveloper } from "./definitions/fullstack-developer";
import { mobileDeveloper } from "./definitions/mobile-developer";
import { apiDesigner } from "./definitions/api-designer";
import { graphqlArchitect } from "./definitions/graphql-architect";
import { microservicesArchitect } from "./definitions/microservices-architect";
import { typescriptExpert } from "./definitions/typescript-expert";
import { pythonSpecialist } from "./definitions/python-specialist";
import { goSpecialist } from "./definitions/go-specialist";
import { rustSpecialist } from "./definitions/rust-specialist";
import { swiftExpert } from "./definitions/swift-expert";
import { codeReviewer } from "./definitions/code-reviewer";
import { testAutomator } from "./definitions/test-automator";
import { qaExpert } from "./definitions/qa-expert";
import { securityAuditor } from "./definitions/security-auditor";
import { performanceEngineer } from "./definitions/performance-engineer";
import { debuggerAgent } from "./definitions/debugger";
import { devopsEngineer } from "./definitions/devops-engineer";
import { databaseOptimizer } from "./definitions/database-optimizer";
import { databaseAdministrator } from "./definitions/database-administrator";
import { kubernetesExpert } from "./definitions/kubernetes-expert";
import { multiAgentCoordinator } from "./definitions/multi-agent-coordinator";
import { refactoringSpecialist } from "./definitions/refactoring-specialist";
import { documentationEngineer } from "./definitions/documentation-engineer";

// All registered agents
const agents: AgentDefinition[] = [
  // Core Development
  backendDeveloper,
  frontendDeveloper,
  uiEngineer,
  fullstackDeveloper,
  mobileDeveloper,
  apiDesigner,
  graphqlArchitect,
  microservicesArchitect,
  // Language Specialists
  typescriptExpert,
  pythonSpecialist,
  goSpecialist,
  rustSpecialist,
  swiftExpert,
  // Quality & Security
  codeReviewer,
  testAutomator,
  qaExpert,
  securityAuditor,
  performanceEngineer,
  debuggerAgent,
  // Infrastructure
  devopsEngineer,
  databaseOptimizer,
  databaseAdministrator,
  kubernetesExpert,
  // Meta
  multiAgentCoordinator,
  refactoringSpecialist,
  documentationEngineer,
];

// Build lookup maps for efficient access
const agentById = new Map<string, AgentDefinition>();
const agentsByCategory = new Map<AgentCategory, AgentDefinition[]>();

for (const agent of agents) {
  agentById.set(agent.id, agent);

  const categoryAgents = agentsByCategory.get(agent.category) || [];
  categoryAgents.push(agent);
  agentsByCategory.set(agent.category, categoryAgents);
}

/**
 * Get an agent by its ID
 */
export function getAgent(id: string): AgentDefinition | undefined {
  return agentById.get(id);
}

/**
 * Get all agents in a category
 */
export function getAgentsByCategory(category: AgentCategory): AgentDefinition[] {
  return agentsByCategory.get(category) || [];
}

/**
 * Get all registered agents
 */
export function getAllAgents(): AgentDefinition[] {
  return [...agents];
}

/**
 * Get agent IDs only
 */
export function getAgentIds(): string[] {
  return agents.map((a) => a.id);
}

/**
 * Check if an agent exists
 */
export function hasAgent(id: string): boolean {
  return agentById.has(id);
}

/**
 * Get agents that match any of the given keywords
 */
export function getAgentsByKeywords(keywords: string[]): AgentDefinition[] {
  const lowerKeywords = keywords.map((k) => k.toLowerCase());

  return agents.filter((agent) =>
    agent.keywords.some((ak) =>
      lowerKeywords.some((lk) => ak.toLowerCase().includes(lk) || lk.includes(ak.toLowerCase()))
    )
  );
}

// Export individual agents for direct access
export const Agents = {
  // Core Development
  backendDeveloper,
  frontendDeveloper,
  uiEngineer,
  fullstackDeveloper,
  mobileDeveloper,
  apiDesigner,
  graphqlArchitect,
  microservicesArchitect,
  // Language Specialists
  typescriptExpert,
  pythonSpecialist,
  goSpecialist,
  rustSpecialist,
  swiftExpert,
  // Quality & Security
  codeReviewer,
  testAutomator,
  qaExpert,
  securityAuditor,
  performanceEngineer,
  debugger: debuggerAgent,
  // Infrastructure
  devopsEngineer,
  databaseOptimizer,
  databaseAdministrator,
  kubernetesExpert,
  // Meta
  multiAgentCoordinator,
  refactoringSpecialist,
  documentationEngineer,
} as const;

export type AgentId = keyof typeof Agents;
