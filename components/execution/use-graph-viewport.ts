"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ZOOM_CONFIG } from "@/lib/shared/graph-types";

/**
 * Viewport state for pan/zoom
 */
export interface ViewportState {
  x: number; // horizontal offset
  y: number; // vertical offset
  zoom: number; // scale factor (0.25 - 2.0)
}

/**
 * Graph dimensions for viewport calculations
 */
export interface GraphDimensions {
  width: number;
  height: number;
  containerWidth: number;
  containerHeight: number;
}

/**
 * Hook return type
 */
export interface UseGraphViewportReturn {
  viewport: ViewportState;
  pan: (dx: number, dy: number) => void;
  zoom: (delta: number, centerX?: number, centerY?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: (dimensions: GraphDimensions) => void;
  reset: () => void;
  setViewport: (state: Partial<ViewportState>) => void;
}

const STORAGE_KEY = "loopforge-graph-viewport";
const DEBOUNCE_MS = 16; // 60fps

/**
 * Custom hook for managing graph viewport state (pan/zoom)
 */
export function useGraphViewport(
  containerRef: React.RefObject<HTMLElement>,
): UseGraphViewportReturn {
  // Initialize viewport from sessionStorage or defaults
  const [viewport, setViewportState] = useState<ViewportState>(() => {
    if (typeof window === "undefined") {
      return { x: 0, y: 0, zoom: ZOOM_CONFIG.default };
    }

    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error("Failed to parse stored viewport:", error);
    }

    return { x: 0, y: 0, zoom: ZOOM_CONFIG.default };
  });

  // Debounce timer ref
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const pendingViewport = useRef<ViewportState>(viewport);

  // Update viewport with debouncing
  const updateViewport = useCallback((newViewport: ViewportState) => {
    pendingViewport.current = newViewport;

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set immediate state for smooth rendering
    setViewportState(newViewport);

    // Debounce sessionStorage update
    debounceTimer.current = setTimeout(() => {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(pendingViewport.current),
        );
      } catch (error) {
        console.error("Failed to save viewport:", error);
      }
    }, DEBOUNCE_MS);
  }, []);

  // Pan the viewport by delta
  const pan = useCallback(
    (dx: number, dy: number) => {
      updateViewport({
        ...viewport,
        x: viewport.x + dx,
        y: viewport.y + dy,
      });
    },
    [viewport, updateViewport],
  );

  // Zoom the viewport
  const zoom = useCallback(
    (delta: number, centerX?: number, centerY?: number) => {
      const newZoom = Math.min(
        ZOOM_CONFIG.max,
        Math.max(ZOOM_CONFIG.min, viewport.zoom + delta),
      );

      // If zoom didn't change (hit limits), don't update
      if (newZoom === viewport.zoom) return;

      // Calculate new pan to zoom toward center point
      let newX = viewport.x;
      let newY = viewport.y;

      if (centerX !== undefined && centerY !== undefined) {
        const zoomRatio = newZoom / viewport.zoom;
        newX = centerX - (centerX - viewport.x) * zoomRatio;
        newY = centerY - (centerY - viewport.y) * zoomRatio;
      }

      updateViewport({
        x: newX,
        y: newY,
        zoom: newZoom,
      });
    },
    [viewport, updateViewport],
  );

  // Zoom in by step
  const zoomIn = useCallback(() => {
    zoom(ZOOM_CONFIG.step);
  }, [zoom]);

  // Zoom out by step
  const zoomOut = useCallback(() => {
    zoom(-ZOOM_CONFIG.step);
  }, [zoom]);

  // Fit graph to view
  const fitToView = useCallback(
    (dimensions: GraphDimensions) => {
      const { width, height, containerWidth, containerHeight } = dimensions;

      // Calculate zoom to fit
      const zoomX = containerWidth / width;
      const zoomY = containerHeight / height;
      const newZoom = Math.min(
        Math.max(Math.min(zoomX, zoomY) * 0.9, ZOOM_CONFIG.min),
        ZOOM_CONFIG.max,
      );

      // Center the graph
      const newX = (containerWidth - width * newZoom) / 2;
      const newY = (containerHeight - height * newZoom) / 2;

      updateViewport({
        x: newX,
        y: newY,
        zoom: newZoom,
      });
    },
    [updateViewport],
  );

  // Reset to default zoom, centered
  const reset = useCallback(() => {
    updateViewport({ x: 0, y: 0, zoom: ZOOM_CONFIG.default });
  }, [updateViewport]);

  // Set viewport directly
  const setViewport = useCallback(
    (state: Partial<ViewportState>) => {
      updateViewport({ ...viewport, ...state });
    },
    [viewport, updateViewport],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          break;
        case "-":
        case "_":
          e.preventDefault();
          zoomOut();
          break;
        case "f":
        case "F":
          if (containerRef.current) {
            e.preventDefault();
            // Will be called from parent with dimensions
          }
          break;
        case "r":
        case "R":
          e.preventDefault();
          reset();
          break;
        case "ArrowUp":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            pan(0, 50);
          }
          break;
        case "ArrowDown":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            pan(0, -50);
          }
          break;
        case "ArrowLeft":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            pan(50, 0);
          }
          break;
        case "ArrowRight":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            pan(-50, 0);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, reset, pan, containerRef]);

  // Mouse wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Check if wheel event is for zooming (ctrl/meta key or pinch gesture)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const rect = container.getBoundingClientRect();
        const centerX = e.clientX - rect.left;
        const centerY = e.clientY - rect.top;

        const delta = -e.deltaY * 0.001;
        zoom(delta, centerX, centerY);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [containerRef, zoom]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    viewport,
    pan,
    zoom,
    zoomIn,
    zoomOut,
    fitToView,
    reset,
    setViewport,
  };
}
