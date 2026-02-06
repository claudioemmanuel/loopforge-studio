import { describe, expect, it, vi } from "vitest";
import {
  PERFORMANCE_THRESHOLDS,
  shouldUseCanvasRendering,
  getViewportBounds,
  getVisibleNodes,
  getVisibleEdges,
  createMemoCache,
  debounce,
} from "@/components/execution/graph-performance";
import type { GraphNode, GraphEdge } from "@/lib/shared/graph-types";

describe("graph-performance", () => {
  it("switches to canvas rendering for large graphs", () => {
    expect(
      shouldUseCanvasRendering(PERFORMANCE_THRESHOLDS.largeGraph + 1),
    ).toBe(true);
    expect(shouldUseCanvasRendering(PERFORMANCE_THRESHOLDS.largeGraph)).toBe(
      false,
    );
  });

  it("filters visible nodes and edges by viewport bounds", () => {
    const bounds = getViewportBounds({ x: 0, y: 0, zoom: 1 }, 800, 600);
    const nodes: GraphNode[] = [
      {
        id: "a",
        type: "phase",
        label: "A",
        x: 100,
        y: 100,
        width: 80,
        height: 40,
        status: "pending",
        metadata: {},
      },
      {
        id: "b",
        type: "phase",
        label: "B",
        x: 5000,
        y: 5000,
        width: 80,
        height: 40,
        status: "pending",
        metadata: {},
      },
    ];
    const edges: GraphEdge[] = [
      { id: "e1", source: "a", target: "b", type: "dependency" },
    ];

    const visibleNodes = getVisibleNodes(nodes, bounds);
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = getVisibleEdges(edges, nodes, visibleIds);

    expect(visibleNodes.map((node) => node.id)).toEqual(["a"]);
    expect(visibleEdges).toHaveLength(1);
  });

  it("memoizes values and debounces calls", async () => {
    const cache = createMemoCache<string, number>(1000);
    cache.set("k", 1);
    expect(cache.get("k")).toBe(1);

    const spy = vi.fn();
    const fn = debounce(spy); // use default delay to satisfy literal typing
    fn("a");
    fn("b");

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
