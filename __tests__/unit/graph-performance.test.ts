import { describe, it, expect } from "vitest";
import {
  shouldUseCanvasRendering,
  getViewportBounds,
  isNodeInViewport,
  getVisibleNodes,
  getVisibleEdges,
  createMemoCache,
  debounce,
  throttle,
  PerformanceMonitor,
  PERFORMANCE_THRESHOLDS,
} from "@/components/execution/graph-performance";
import type { GraphNode, GraphEdge } from "@/lib/shared/graph-types";
import type { ViewportState } from "@/components/execution/use-graph-viewport";

describe("Graph Performance", () => {
  describe("shouldUseCanvasRendering", () => {
    it("should use canvas for large graphs", () => {
      expect(shouldUseCanvasRendering(60)).toBe(true);
      expect(shouldUseCanvasRendering(100)).toBe(true);
    });

    it("should use SVG for small graphs", () => {
      expect(shouldUseCanvasRendering(30)).toBe(false);
      expect(shouldUseCanvasRendering(50)).toBe(false);
    });

    it("should have correct threshold", () => {
      expect(PERFORMANCE_THRESHOLDS.largeGraph).toBe(50);
    });
  });

  describe("Viewport Culling", () => {
    const viewport: ViewportState = {
      x: 0,
      y: 0,
      zoom: 1.0,
    };

    it("should calculate viewport bounds correctly", () => {
      const bounds = getViewportBounds(viewport, 800, 600);

      expect(bounds.minX).toBeLessThan(bounds.maxX);
      expect(bounds.minY).toBeLessThan(bounds.maxY);
    });

    it("should include margin in bounds", () => {
      const margin = 100;
      const bounds = getViewportBounds(viewport, 800, 600, margin);

      // Bounds should extend beyond viewport by margin
      expect(bounds.minX).toBe(-margin);
      expect(bounds.minY).toBe(-margin);
    });

    it("should detect nodes in viewport", () => {
      const node: GraphNode = {
        id: "node-1",
        type: "phase",
        label: "Test",
        status: "complete",
        x: 400,
        y: 300,
        width: 240,
        height: 120,
        metadata: {},
      };

      const bounds = getViewportBounds(viewport, 800, 600);
      expect(isNodeInViewport(node, bounds)).toBe(true);
    });

    it("should detect nodes outside viewport", () => {
      const node: GraphNode = {
        id: "node-1",
        type: "phase",
        label: "Test",
        status: "complete",
        x: 2000,
        y: 2000,
        width: 240,
        height: 120,
        metadata: {},
      };

      const bounds = getViewportBounds(viewport, 800, 600, 0);
      expect(isNodeInViewport(node, bounds)).toBe(false);
    });

    it("should filter visible nodes", () => {
      const nodes: GraphNode[] = [
        {
          id: "node-1",
          type: "phase",
          label: "Visible",
          status: "complete",
          x: 400,
          y: 300,
          width: 240,
          height: 120,
          metadata: {},
        },
        {
          id: "node-2",
          type: "phase",
          label: "Hidden",
          status: "complete",
          x: 2000,
          y: 2000,
          width: 240,
          height: 120,
          metadata: {},
        },
      ];

      const bounds = getViewportBounds(viewport, 800, 600, 0);
      const visible = getVisibleNodes(nodes, bounds);

      expect(visible).toHaveLength(1);
      expect(visible[0].id).toBe("node-1");
    });

    it("should filter visible edges", () => {
      const nodes: GraphNode[] = [
        {
          id: "node-1",
          type: "phase",
          label: "Node 1",
          status: "complete",
          x: 400,
          y: 300,
          width: 240,
          height: 120,
          metadata: {},
        },
        {
          id: "node-2",
          type: "phase",
          label: "Node 2",
          status: "complete",
          x: 600,
          y: 300,
          width: 240,
          height: 120,
          metadata: {},
        },
      ];

      const edges: GraphEdge[] = [
        {
          id: "edge-1",
          source: "node-1",
          target: "node-2",
          type: "sequential",
        },
      ];

      const visibleNodeIds = new Set(["node-1", "node-2"]);
      const visible = getVisibleEdges(edges, nodes, visibleNodeIds);

      expect(visible).toHaveLength(1);
    });
  });

  describe("Memoization Cache", () => {
    it("should cache values", () => {
      const cache = createMemoCache<string, number>();

      cache.set("key1", 100);
      expect(cache.get("key1")).toBe(100);
    });

    it("should return undefined for missing keys", () => {
      const cache = createMemoCache<string, number>();

      expect(cache.get("missing")).toBeUndefined();
    });

    it("should expire old values", async () => {
      const cache = createMemoCache<string, number>(100); // 100ms TTL

      cache.set("key1", 100);
      expect(cache.get("key1")).toBe(100);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.get("key1")).toBeUndefined();
    });

    it("should clear cache", () => {
      const cache = createMemoCache<string, number>();

      cache.set("key1", 100);
      cache.set("key2", 200);
      expect(cache.size()).toBe(2);

      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe("Debounce", () => {
    it("should debounce function calls", async () => {
      let callCount = 0;
      const fn = debounce(() => callCount++, 50);

      fn();
      fn();
      fn();

      expect(callCount).toBe(0);

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(callCount).toBe(1);
    });
  });

  describe("Throttle", () => {
    it("should throttle function calls", async () => {
      let callCount = 0;
      const fn = throttle(() => callCount++, 50);

      fn();
      fn();
      fn();

      expect(callCount).toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 100));
      fn();

      expect(callCount).toBe(2);
    });
  });

  describe("PerformanceMonitor", () => {
    it("should record frame durations", () => {
      const monitor = new PerformanceMonitor();

      monitor.recordFrame(16); // ~60fps
      monitor.recordFrame(16);
      monitor.recordFrame(16);

      const stats = monitor.getStats();
      expect(stats.avgFPS).toBeGreaterThan(50);
    });

    it("should calculate average FPS", () => {
      const monitor = new PerformanceMonitor();

      // Record 60fps frames
      for (let i = 0; i < 10; i++) {
        monitor.recordFrame(16.67);
      }

      expect(monitor.getAverageFPS()).toBeCloseTo(60, 0);
    });

    it("should reset measurements", () => {
      const monitor = new PerformanceMonitor();

      monitor.recordFrame(16);
      monitor.recordFrame(16);

      monitor.reset();

      const stats = monitor.getStats();
      expect(stats.avgFPS).toBe(60); // Default when no measurements
    });
  });
});
