"use client";

import React, { useState, useEffect } from "react";
import type { ExecutionGraph, GraphNode } from "@/lib/execution/graph-types";
import { ExecutionGraph as ExecutionGraphComponent } from "./execution-graph";
import { Menu, X } from "lucide-react";

/**
 * Props for responsive graph wrapper
 */
export interface GraphResponsiveProps {
  taskId: string;
  executionGraph: ExecutionGraph | null | undefined;
  onNodeClick?: (node: GraphNode) => void;
  onGraphUpdate?: (graph: ExecutionGraph) => void;
  enableRealtime?: boolean;
}

/**
 * Breakpoints for responsive design
 */
const BREAKPOINTS = {
  mobile: 640,
  tablet: 1024,
  desktop: 1280,
} as const;

/**
 * Responsive wrapper for ExecutionGraph with mobile optimizations
 */
export function GraphResponsive({
  taskId,
  executionGraph,
  onNodeClick,
  onGraphUpdate,
  enableRealtime = false,
}: GraphResponsiveProps) {
  const [screenSize, setScreenSize] = useState<"mobile" | "tablet" | "desktop">(
    "desktop",
  );
  const [showActivityFeed, setShowActivityFeed] = useState(false);

  // Detect screen size
  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < BREAKPOINTS.mobile) {
        setScreenSize("mobile");
      } else if (width < BREAKPOINTS.tablet) {
        setScreenSize("tablet");
      } else {
        setScreenSize("desktop");
      }
    };

    updateScreenSize();
    window.addEventListener("resize", updateScreenSize);
    return () => window.removeEventListener("resize", updateScreenSize);
  }, []);

  // Mobile: show activity feed as bottom sheet
  const isMobile = screenSize === "mobile";

  return (
    <div className="relative w-full h-full">
      {/* Main graph */}
      <ExecutionGraphComponent
        taskId={taskId}
        executionGraph={executionGraph}
        onNodeClick={onNodeClick}
        onGraphUpdate={onGraphUpdate}
        enableRealtime={enableRealtime}
        compact={isMobile}
        showMinimap={!isMobile} // Hide minimap on mobile
        showLegend={!isMobile} // Show legend on desktop/tablet only
        showControls={true} // Always show controls (will be FAB on mobile)
      />

      {/* Mobile: Activity feed toggle button */}
      {isMobile && (
        <button
          onClick={() => setShowActivityFeed(!showActivityFeed)}
          className="fixed bottom-20 right-4 z-20 p-3 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-colors"
          aria-label={
            showActivityFeed ? "Hide activity feed" : "Show activity feed"
          }
        >
          {showActivityFeed ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      )}

      {/* Mobile: Activity feed bottom sheet */}
      {isMobile && showActivityFeed && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 bg-slate-900 border-t border-slate-700 rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300"
          style={{ maxHeight: "50vh" }}
        >
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-200">Activity</h3>
            <button
              onClick={() => setShowActivityFeed(false)}
              className="p-1 rounded hover:bg-slate-800 text-slate-400"
              aria-label="Close activity feed"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 overflow-y-auto max-h-[calc(50vh-60px)]">
            <p className="text-xs text-slate-400 text-center">
              Activity feed coming soon
            </p>
          </div>
        </div>
      )}

      {/* Touch gesture instructions (mobile only, shown once) */}
      {isMobile && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-2 shadow-lg">
            <p className="text-xs text-slate-300 text-center">
              Pinch to zoom • Two fingers to pan
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
