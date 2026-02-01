// =============================================================================
// Execution Graph Builder
// Transforms task execution data into DAG visualization structure
// =============================================================================

import dagre from "dagre";
import type {
  ExecutionGraph,
  ExecutionData,
  GraphNode,
  GraphEdge,
  GraphNodeType,
  GraphNodeStatus,
  GraphNodeMetadata,
  GraphLayoutConfig,
  AgentType,
} from "./graph-types";
import { DEFAULT_LAYOUT_CONFIG, NODE_SIZES } from "./graph-types";

/**
 * Builds an execution graph from task execution data
 */
export async function buildExecutionGraph(
  executionData: ExecutionData,
  layoutConfig: GraphLayoutConfig = DEFAULT_LAYOUT_CONFIG,
): Promise<ExecutionGraph> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Parse execution events to extract phases, sub-tasks, and agents
  const { phaseNodes, subTaskNodes, agentNodes, dependencies } =
    parseExecutionEvents(executionData);

  // Combine all nodes
  nodes.push(...phaseNodes, ...subTaskNodes, ...agentNodes);

  // Create edges from dependencies
  edges.push(...createEdges(dependencies));

  // Calculate node positions using Dagre layout
  const positionedNodes = calculateLayout(nodes, edges, layoutConfig);

  // Build metadata
  const metadata = {
    totalDuration: calculateTotalDuration(executionData),
    phaseCount: phaseNodes.length,
    agentCount: agentNodes.length,
    taskId: executionData.taskId,
    executionId: executionData.executionId,
    lastUpdated: new Date().toISOString(),
  };

  return {
    nodes: positionedNodes,
    edges,
    metadata,
  };
}

/**
 * Parses execution events to extract graph structure
 */
function parseExecutionEvents(executionData: ExecutionData): {
  phaseNodes: GraphNode[];
  subTaskNodes: GraphNode[];
  agentNodes: GraphNode[];
  dependencies: Array<{ source: string; target: string; type: string }>;
} {
  const phaseNodes: GraphNode[] = [];
  const subTaskNodes: GraphNode[] = [];
  const agentNodes: GraphNode[] = [];
  const dependencies: Array<{ source: string; target: string; type: string }> =
    [];

  // Create phase nodes from execution status
  if (executionData.phase) {
    const phaseNode = createPhaseNode(
      executionData.phase,
      executionData.status,
      executionData,
    );
    phaseNodes.push(phaseNode);
  }

  // Group events by agent type (if available in metadata)
  const agentGroups = new Map<string, ExecutionData["events"]>();

  for (const event of executionData.events) {
    const agentType =
      (event.metadata?.agentType as AgentType) ||
      inferAgentType(event.eventType);

    if (!agentGroups.has(agentType)) {
      agentGroups.set(agentType, []);
    }
    agentGroups.get(agentType)!.push(event);
  }

  // Create agent nodes if multiple agents detected
  if (agentGroups.size > 1) {
    agentGroups.forEach((events, agentType) => {
      const agentNode = createAgentNode(agentType as AgentType, events);
      agentNodes.push(agentNode);

      // Create dependency: phase -> agent
      if (phaseNodes.length > 0) {
        dependencies.push({
          source: phaseNodes[0].id,
          target: agentNode.id,
          type: "sequential",
        });
      }
    });
  }

  // Extract sub-tasks from events (e.g., file operations)
  const subTasks = extractSubTasks(executionData.events);
  subTaskNodes.push(...subTasks);

  // Create dependencies between sub-tasks (sequential by default)
  for (let i = 0; i < subTaskNodes.length - 1; i++) {
    dependencies.push({
      source: subTaskNodes[i].id,
      target: subTaskNodes[i + 1].id,
      type: "sequential",
    });
  }

  return {
    phaseNodes,
    subTaskNodes,
    agentNodes,
    dependencies,
  };
}

/**
 * Creates a phase node
 */
function createPhaseNode(
  phase: string,
  status: string,
  executionData: ExecutionData,
): GraphNode {
  const metadata: GraphNodeMetadata = {
    startedAt: executionData.startedAt
      ? new Date(executionData.startedAt).toISOString()
      : undefined,
    completedAt: executionData.completedAt
      ? new Date(executionData.completedAt).toISOString()
      : undefined,
    duration: calculateDuration(
      executionData.startedAt,
      executionData.completedAt,
    ),
  };

  if (executionData.commits && executionData.commits.length > 0) {
    metadata.commits = executionData.commits.map((sha) => ({
      sha,
      message: "",
    }));
  }

  if (executionData.errorMessage) {
    metadata.errorMessage = executionData.errorMessage;
  }

  return {
    id: `phase-${phase}`,
    type: "phase",
    label: formatPhaseLabel(phase),
    status: mapStatusToGraphStatus(status),
    x: 0,
    y: 0,
    width: NODE_SIZES.phase.width,
    height: NODE_SIZES.phase.height,
    metadata,
  };
}

/**
 * Creates an agent node
 */
function createAgentNode(
  agentType: AgentType,
  events: ExecutionData["events"],
): GraphNode {
  const status = inferAgentStatus(events);
  const metadata: GraphNodeMetadata = {
    agentType,
    startedAt: events[0]
      ? new Date(events[0].createdAt).toISOString()
      : undefined,
    completedAt:
      events.length > 0
        ? new Date(events[events.length - 1].createdAt).toISOString()
        : undefined,
  };

  // Count file operations for this agent
  const fileOperations = events.filter((e) =>
    ["file_read", "file_write"].includes(e.eventType),
  );
  if (fileOperations.length > 0) {
    metadata.filesChanged = fileOperations.map(
      (e) => e.metadata?.filePath as string,
    );
  }

  return {
    id: `agent-${agentType}`,
    type: "agent",
    label: formatAgentLabel(agentType),
    status,
    x: 0,
    y: 0,
    width: NODE_SIZES.agent.width,
    height: NODE_SIZES.agent.height,
    metadata,
  };
}

/**
 * Extracts sub-tasks from execution events
 */
function extractSubTasks(events: ExecutionData["events"]): GraphNode[] {
  const subTasks: GraphNode[] = [];

  // Group events by iteration if available
  const iterations = new Map<number, ExecutionData["events"]>();

  for (const event of events) {
    const iteration = (event.metadata?.iteration as number) || 0;
    if (!iterations.has(iteration)) {
      iterations.set(iteration, []);
    }
    iterations.get(iteration)!.push(event);
  }

  // Create sub-task node for each iteration (if > 1 iteration)
  if (iterations.size > 1) {
    iterations.forEach((iterEvents, iteration) => {
      const status = inferIterationStatus(iterEvents);
      const metadata: GraphNodeMetadata = {
        iteration,
        startedAt: iterEvents[0]
          ? new Date(iterEvents[0].createdAt).toISOString()
          : undefined,
        completedAt:
          iterEvents.length > 0
            ? new Date(
                iterEvents[iterEvents.length - 1].createdAt,
              ).toISOString()
            : undefined,
      };

      subTasks.push({
        id: `subtask-iter-${iteration}`,
        type: "sub-task",
        label: `Iteration ${iteration + 1}`,
        status,
        x: 0,
        y: 0,
        width: NODE_SIZES["sub-task"].width,
        height: NODE_SIZES["sub-task"].height,
        metadata,
      });
    });
  }

  return subTasks;
}

/**
 * Creates edges from dependencies
 */
function createEdges(
  dependencies: Array<{ source: string; target: string; type: string }>,
): GraphEdge[] {
  return dependencies.map((dep, index) => ({
    id: `edge-${dep.source}-${dep.target}-${index}`,
    source: dep.source,
    target: dep.target,
    type: dep.type as "sequential" | "parallel" | "dependency",
    animated: false, // Will be updated based on node status
  }));
}

/**
 * Calculates node positions using Dagre layout algorithm
 */
function calculateLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  layoutConfig: GraphLayoutConfig,
): GraphNode[] {
  // Create a new directed graph
  const g = new dagre.graphlib.Graph();

  // Set graph configuration
  g.setGraph(layoutConfig);

  // Default edge configuration
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to graph
  for (const node of nodes) {
    g.setNode(node.id, { width: node.width, height: node.height });
  }

  // Add edges to graph
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  // Calculate layout
  dagre.layout(g);

  // Update node positions from layout
  return nodes.map((node) => {
    const layoutNode = g.node(node.id);
    return {
      ...node,
      x: layoutNode.x,
      y: layoutNode.y,
    };
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Infers agent type from event type
 */
function inferAgentType(eventType: string): AgentType {
  if (eventType.includes("test")) return "test";
  if (eventType.includes("api") || eventType.includes("command"))
    return "backend";
  if (
    eventType.includes("file_write") &&
    (eventType.includes("component") || eventType.includes("tsx"))
  )
    return "frontend";
  return "general";
}

/**
 * Infers agent status from events
 */
function inferAgentStatus(events: ExecutionData["events"]): GraphNodeStatus {
  const lastEvent = events[events.length - 1];
  if (!lastEvent) return "pending";

  if (lastEvent.eventType === "error") return "failed";
  if (lastEvent.eventType === "complete") return "complete";
  if (lastEvent.eventType === "stuck") return "stuck";
  return "in-progress";
}

/**
 * Infers iteration status from events
 */
function inferIterationStatus(
  events: ExecutionData["events"],
): GraphNodeStatus {
  return inferAgentStatus(events);
}

/**
 * Maps task status to graph node status
 */
function mapStatusToGraphStatus(status: string): GraphNodeStatus {
  const statusMap: Record<string, GraphNodeStatus> = {
    queued: "pending",
    running: "in-progress",
    executing: "in-progress",
    completed: "complete",
    done: "complete",
    failed: "failed",
    stuck: "stuck",
  };
  return statusMap[status] || "pending";
}

/**
 * Formats phase label for display
 */
function formatPhaseLabel(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

/**
 * Formats agent label for display
 */
function formatAgentLabel(agentType: AgentType): string {
  const labels: Record<AgentType, string> = {
    test: "Test Agent",
    backend: "Backend Agent",
    frontend: "Frontend Agent",
    general: "General Agent",
  };
  return labels[agentType];
}

/**
 * Calculates duration between two timestamps
 */
function calculateDuration(
  startedAt?: Date | string,
  completedAt?: Date | string,
): number | undefined {
  if (!startedAt || !completedAt) return undefined;

  const start = typeof startedAt === "string" ? new Date(startedAt) : startedAt;
  const end =
    typeof completedAt === "string" ? new Date(completedAt) : completedAt;

  return end.getTime() - start.getTime();
}

/**
 * Calculates total execution duration
 */
function calculateTotalDuration(
  executionData: ExecutionData,
): number | undefined {
  return calculateDuration(executionData.startedAt, executionData.completedAt);
}
