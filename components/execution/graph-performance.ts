/**
 * Performance optimization utilities for execution graph
 */

import type { GraphNode, GraphEdge } from "@/lib/shared/graph-types";
import type { ViewportState } from "./use-graph-viewport";

/**
 * Performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  largeGraph: 50, // Switch to canvas rendering
  viewportCullingMargin: 100, // Extra pixels around viewport
  debounceDelay: 16, // 60fps
  memoizationTTL: 5000, // 5 seconds
} as const;

/**
 * Check if graph should use canvas rendering
 */
export function shouldUseCanvasRendering(nodeCount: number): boolean {
  return nodeCount > PERFORMANCE_THRESHOLDS.largeGraph;
}

/**
 * Viewport culling - filter nodes/edges visible in viewport
 */
export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Calculate viewport bounds from viewport state and container size
 */
export function getViewportBounds(
  viewport: ViewportState,
  containerWidth: number,
  containerHeight: number,
  margin = PERFORMANCE_THRESHOLDS.viewportCullingMargin,
): ViewportBounds {
  const viewportWidth = containerWidth / viewport.zoom;
  const viewportHeight = containerHeight / viewport.zoom;
  const offsetX = -viewport.x / viewport.zoom;
  const offsetY = -viewport.y / viewport.zoom;

  return {
    minX: offsetX - margin,
    maxX: offsetX + viewportWidth + margin,
    minY: offsetY - margin,
    maxY: offsetY + viewportHeight + margin,
  };
}

/**
 * Check if node is within viewport bounds
 */
export function isNodeInViewport(
  node: GraphNode,
  bounds: ViewportBounds,
): boolean {
  const nodeLeft = node.x - node.width / 2;
  const nodeRight = node.x + node.width / 2;
  const nodeTop = node.y - node.height / 2;
  const nodeBottom = node.y + node.height / 2;

  return (
    nodeRight >= bounds.minX &&
    nodeLeft <= bounds.maxX &&
    nodeBottom >= bounds.minY &&
    nodeTop <= bounds.maxY
  );
}

/**
 * Filter visible nodes based on viewport
 */
export function getVisibleNodes(
  nodes: GraphNode[],
  bounds: ViewportBounds,
): GraphNode[] {
  return nodes.filter((node) => isNodeInViewport(node, bounds));
}

/**
 * Filter visible edges (both nodes must be visible or edge crosses viewport)
 */
export function getVisibleEdges(
  edges: GraphEdge[],
  nodes: GraphNode[],
  visibleNodeIds: Set<string>,
): GraphEdge[] {
  return edges.filter((edge) => {
    // Include if either node is visible
    return visibleNodeIds.has(edge.source) || visibleNodeIds.has(edge.target);
  });
}

/**
 * Memoization cache for expensive computations
 */
class MemoCache<K, V> {
  private cache = new Map<string, { value: V; timestamp: number }>();
  private ttl: number;

  constructor(ttl = PERFORMANCE_THRESHOLDS.memoizationTTL) {
    this.ttl = ttl;
  }

  private keyToString(key: K): string {
    return JSON.stringify(key);
  }

  get(key: K): V | undefined {
    const keyStr = this.keyToString(key);
    const cached = this.cache.get(keyStr);

    if (!cached) return undefined;

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(keyStr);
      return undefined;
    }

    return cached.value;
  }

  set(key: K, value: V): void {
    const keyStr = this.keyToString(key);
    this.cache.set(keyStr, {
      value,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Create a memoization cache
 */
export function createMemoCache<K, V>(ttl?: number): MemoCache<K, V> {
  return new MemoCache<K, V>(ttl);
}

/**
 * Debounce function for performance
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait = PERFORMANCE_THRESHOLDS.debounceDelay,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttle function for performance
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait = PERFORMANCE_THRESHOLDS.debounceDelay,
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCall >= wait) {
      lastCall = now;
      func(...args);
    }
  };
}

/**
 * Request animation frame wrapper for smooth updates
 */
export function requestUpdate(callback: () => void): { cancel: () => void } {
  let rafId: number | null = null;

  rafId = requestAnimationFrame(() => {
    callback();
    rafId = null;
  });

  return {
    cancel: () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}

/**
 * Measure render performance
 */
export class PerformanceMonitor {
  private measurements: number[] = [];
  private maxSamples = 60; // Keep last 60 frames

  recordFrame(duration: number): void {
    this.measurements.push(duration);

    if (this.measurements.length > this.maxSamples) {
      this.measurements.shift();
    }
  }

  getAverageFPS(): number {
    if (this.measurements.length === 0) return 60;

    const avgDuration =
      this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length;

    return Math.round(1000 / avgDuration);
  }

  getStats(): {
    avgFPS: number;
    minFPS: number;
    maxFPS: number;
  } {
    if (this.measurements.length === 0) {
      return { avgFPS: 60, minFPS: 60, maxFPS: 60 };
    }

    const fps = this.measurements.map((d) => 1000 / d);
    const avgFPS = Math.round(fps.reduce((a, b) => a + b, 0) / fps.length);
    const minFPS = Math.round(Math.min(...fps));
    const maxFPS = Math.round(Math.max(...fps));

    return { avgFPS, minFPS, maxFPS };
  }

  reset(): void {
    this.measurements = [];
  }
}
