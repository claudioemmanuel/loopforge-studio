// =============================================================================
// Execution Graph Types for DAG Visualization
// =============================================================================

/**
 * Node types in the execution graph
 */
export type GraphNodeType = "phase" | "sub-task" | "agent";

/**
 * Status of a node in the execution graph
 */
export type GraphNodeStatus =
  | "pending"
  | "in-progress"
  | "complete"
  | "failed"
  | "stuck";

/**
 * Agent type for specialized agent nodes
 */
export type AgentType = "test" | "backend" | "frontend" | "general";

/**
 * Edge types representing different relationships
 */
export type GraphEdgeType = "sequential" | "parallel" | "dependency";

/**
 * Metadata for a graph node
 */
export interface GraphNodeMetadata {
  duration?: number; // milliseconds
  progress?: number; // 0-100 percentage
  agentType?: AgentType;
  commits?: Array<{
    sha: string;
    message: string;
  }>;
  startedAt?: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
  errorMessage?: string;
  filesChanged?: string[];
  iteration?: number;
}

/**
 * A node in the execution graph
 */
export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  status: GraphNodeStatus;
  x: number;
  y: number;
  width: number;
  height: number;
  metadata: GraphNodeMetadata;
}

/**
 * An edge connecting two nodes
 */
export interface GraphEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  type: GraphEdgeType;
  animated?: boolean; // for in-progress edges
  label?: string; // optional label for edge
}

/**
 * Metadata for the entire execution graph
 */
export interface ExecutionGraphMetadata {
  totalDuration?: number; // milliseconds
  phaseCount: number;
  agentCount: number;
  taskId: string;
  executionId?: string;
  lastUpdated: string; // ISO timestamp
}

/**
 * Complete execution graph structure
 */
export interface ExecutionGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: ExecutionGraphMetadata;
}

/**
 * Raw execution data from database (used to build graph)
 */
import type { ExecutionEventMetadata } from "@/lib/ralph/types";

export interface ExecutionData {
  taskId: string;
  executionId?: string;
  status: string;
  phase?: string;
  events: Array<{
    id: string;
    eventType: string;
    title?: string;
    content: string;
    metadata?: ExecutionEventMetadata;
    createdAt: Date | string;
  }>;
  commits?: string[];
  startedAt?: Date | string;
  completedAt?: Date | string;
  errorMessage?: string;
}

/**
 * Dagre layout configuration
 */
export interface GraphLayoutConfig {
  rankdir: "TB" | "BT" | "LR" | "RL"; // top-to-bottom, bottom-to-top, left-to-right, right-to-left
  ranksep: number; // separation between ranks (vertical spacing)
  nodesep: number; // separation between nodes in same rank (horizontal spacing)
  edgesep: number; // separation between edges
  marginx: number; // horizontal margin
  marginy: number; // vertical margin
}

/**
 * Default layout configuration for execution graphs
 */
export const DEFAULT_LAYOUT_CONFIG: GraphLayoutConfig = {
  rankdir: "LR", // left-to-right flow
  ranksep: 100, // 100px between ranks
  nodesep: 50, // 50px between nodes
  edgesep: 20, // 20px between edges
  marginx: 40, // 40px horizontal margin
  marginy: 40, // 40px vertical margin
};

/**
 * Node size configurations
 */
export const NODE_SIZES = {
  phase: {
    width: 240,
    height: 120,
    mobileWidth: 180,
    mobileHeight: 100,
  },
  "sub-task": {
    width: 180,
    height: 80,
    mobileWidth: 140,
    mobileHeight: 70,
  },
  agent: {
    width: 160,
    height: 60,
    mobileWidth: 120,
    mobileHeight: 50,
  },
} as const;

/**
 * Zoom constraints
 */
export const ZOOM_CONFIG = {
  min: 0.25,
  max: 2.0,
  step: 0.1,
  default: 1.0,
} as const;

/**
 * Animation durations (milliseconds)
 */
export const ANIMATION_DURATIONS = {
  statusTransition: 300,
  flowAnimation: 2000,
  pulseEffect: 500,
  panZoom: 200,
  staggerDelay: 50,
} as const;
