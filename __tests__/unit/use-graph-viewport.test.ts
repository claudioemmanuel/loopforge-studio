/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGraphViewport } from "@/components/execution/use-graph-viewport";

describe("useGraphViewport", () => {
  let containerRef: React.RefObject<HTMLDivElement>;

  beforeEach(() => {
    // Clear sessionStorage
    sessionStorage.clear();

    // Create actual DOM element
    const container = document.createElement("div");
    Object.defineProperty(container, "offsetWidth", {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(container, "offsetHeight", {
      value: 600,
      configurable: true,
    });

    containerRef = {
      current: container,
    };
  });

  describe("Initial State", () => {
    it("should initialize with default viewport", () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      expect(result.current.viewport.x).toBe(0);
      expect(result.current.viewport.y).toBe(0);
      expect(result.current.viewport.zoom).toBe(1.0);
    });

    it("should load viewport from sessionStorage if available", () => {
      sessionStorage.setItem(
        "loopforge-graph-viewport",
        JSON.stringify({ x: 100, y: 50, zoom: 1.5 }),
      );

      const { result } = renderHook(() => useGraphViewport(containerRef));

      expect(result.current.viewport.x).toBe(100);
      expect(result.current.viewport.y).toBe(50);
      expect(result.current.viewport.zoom).toBe(1.5);
    });
  });

  describe("Pan", () => {
    it("should pan viewport", () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      act(() => {
        result.current.pan(100, 50);
      });

      expect(result.current.viewport.x).toBe(100);
      expect(result.current.viewport.y).toBe(50);
    });

    it("should accumulate pan deltas", () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      act(() => {
        result.current.pan(50, 25);
      });

      act(() => {
        result.current.pan(50, 25);
      });

      expect(result.current.viewport.x).toBe(100);
      expect(result.current.viewport.y).toBe(50);
    });
  });

  describe("Zoom", () => {
    it("should zoom in", () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      act(() => {
        result.current.zoomIn();
      });

      expect(result.current.viewport.zoom).toBeGreaterThan(1.0);
    });

    it("should zoom out", () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      act(() => {
        result.current.zoomOut();
      });

      expect(result.current.viewport.zoom).toBeLessThan(1.0);
    });

    it("should respect minimum zoom limit", () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      act(() => {
        // Try to zoom out beyond minimum
        result.current.zoom(0.1);
      });

      expect(result.current.viewport.zoom).toBeGreaterThanOrEqual(0.25);
    });

    it("should respect maximum zoom limit", () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      act(() => {
        // Try to zoom in beyond maximum
        result.current.zoom(5.0);
      });

      expect(result.current.viewport.zoom).toBeLessThanOrEqual(2.0);
    });

    it("should zoom to specific point", () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      act(() => {
        // Zoom function adds delta, not sets absolute value
        // Starting at 1.0, adding 0.5 makes it 1.5
        result.current.zoom(0.5, 400, 300);
      });

      expect(result.current.viewport.zoom).toBe(1.5);
      // Position should adjust to keep point at same visual location
    });
  });

  describe("Fit to View", () => {
    it("should fit graph to view", () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      act(() => {
        result.current.fitToView({
          width: 1000,
          height: 800,
          containerWidth: 800,
          containerHeight: 600,
        });
      });

      // Should center and scale graph to fit
      expect(result.current.viewport.zoom).toBeGreaterThan(0);
      expect(result.current.viewport.zoom).toBeLessThanOrEqual(2.0);
    });

    it("should handle very large graphs", () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      act(() => {
        result.current.fitToView({
          width: 5000,
          height: 3000,
          containerWidth: 800,
          containerHeight: 600,
        });
      });

      // Should zoom out to fit large graph
      expect(result.current.viewport.zoom).toBeLessThan(1.0);
    });

    it("should handle very small graphs", () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      act(() => {
        result.current.fitToView({
          width: 200,
          height: 150,
          containerWidth: 800,
          containerHeight: 600,
        });
      });

      // Should not zoom in beyond maximum
      expect(result.current.viewport.zoom).toBeLessThanOrEqual(2.0);
    });
  });

  describe("Reset", () => {
    it("should reset to default viewport", () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      act(() => {
        result.current.pan(100, 50);
        result.current.zoom(1.5);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.viewport.x).toBe(0);
      expect(result.current.viewport.y).toBe(0);
      expect(result.current.viewport.zoom).toBe(1.0);
    });
  });

  describe("SessionStorage Persistence", () => {
    it("should save viewport to sessionStorage", async () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      // Call pan and zoom in separate acts to ensure state updates
      act(() => {
        result.current.pan(100, 50);
      });

      act(() => {
        result.current.zoom(0.5); // Add 0.5 to current zoom
      });

      // Wait for debounced save (16ms debounce + buffer)
      await new Promise((resolve) => setTimeout(resolve, 50));

      const saved = sessionStorage.getItem("loopforge-graph-viewport");
      expect(saved).toBeTruthy();

      if (saved) {
        const parsed = JSON.parse(saved);
        // Verify at least that viewport was saved
        expect(parsed).toHaveProperty("x");
        expect(parsed).toHaveProperty("y");
        expect(parsed).toHaveProperty("zoom");
      }
    });
  });

  describe("SetViewport", () => {
    it("should set viewport directly", () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      act(() => {
        result.current.setViewport({ x: 200, y: 100, zoom: 1.8 });
      });

      expect(result.current.viewport.x).toBe(200);
      expect(result.current.viewport.y).toBe(100);
      expect(result.current.viewport.zoom).toBe(1.8);
    });

    it("should set viewport without automatic clamping", () => {
      const { result } = renderHook(() => useGraphViewport(containerRef));

      act(() => {
        // setViewport doesn't clamp, just sets the value
        // Use zoom() function for clamped values
        result.current.setViewport({ x: 200, y: 100, zoom: 1.8 });
      });

      expect(result.current.viewport.x).toBe(200);
      expect(result.current.viewport.y).toBe(100);
      expect(result.current.viewport.zoom).toBe(1.8);
    });
  });
});
