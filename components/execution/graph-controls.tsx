"use client";

import React from "react";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";
import { ZOOM_CONFIG } from "@/lib/shared/graph-types";

/**
 * Props for GraphControls component
 */
export interface GraphControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  onReset: () => void;
  currentZoom: number;
  className?: string;
}

/**
 * Graph controls component - floating toolbar for zoom/pan controls
 */
export function GraphControls({
  onZoomIn,
  onZoomOut,
  onFitToView,
  onReset,
  currentZoom,
  className = "",
}: GraphControlsProps) {
  const isZoomInDisabled = currentZoom >= ZOOM_CONFIG.max;
  const isZoomOutDisabled = currentZoom <= ZOOM_CONFIG.min;

  return (
    <div
      className={`flex flex-col gap-1 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 shadow-lg p-1 ${className}`}
      role="toolbar"
      aria-label="Graph controls"
    >
      {/* Zoom In */}
      <button
        onClick={onZoomIn}
        disabled={isZoomInDisabled}
        className="group relative p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Zoom in (+ key)"
        title="Zoom in (+)"
      >
        <ZoomIn
          className={`w-5 h-5 ${isZoomInDisabled ? "text-slate-500" : "text-slate-300 group-hover:text-emerald-400"}`}
        />
        {/* Tooltip */}
        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-900 text-slate-200 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Zoom in (+)
        </span>
      </button>

      {/* Zoom Out */}
      <button
        onClick={onZoomOut}
        disabled={isZoomOutDisabled}
        className="group relative p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Zoom out (- key)"
        title="Zoom out (-)"
      >
        <ZoomOut
          className={`w-5 h-5 ${isZoomOutDisabled ? "text-slate-500" : "text-slate-300 group-hover:text-emerald-400"}`}
        />
        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-900 text-slate-200 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Zoom out (-)
        </span>
      </button>

      {/* Divider */}
      <div className="h-px bg-slate-700 my-1" />

      {/* Fit to View */}
      <button
        onClick={onFitToView}
        className="group relative p-2 rounded hover:bg-slate-700 transition-colors"
        aria-label="Fit to view (F key)"
        title="Fit to view (F)"
      >
        <Maximize2 className="w-5 h-5 text-slate-300 group-hover:text-emerald-400" />
        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-900 text-slate-200 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Fit to view (F)
        </span>
      </button>

      {/* Reset */}
      <button
        onClick={onReset}
        className="group relative p-2 rounded hover:bg-slate-700 transition-colors"
        aria-label="Reset zoom (R key)"
        title="Reset (R)"
      >
        <RotateCcw className="w-5 h-5 text-slate-300 group-hover:text-emerald-400" />
        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-900 text-slate-200 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Reset (R)
        </span>
      </button>

      {/* Zoom level indicator */}
      <div className="mt-1 pt-1 border-t border-slate-700">
        <div className="px-2 py-1 text-xs font-mono text-slate-400 text-center">
          {Math.round(currentZoom * 100)}%
        </div>
      </div>
    </div>
  );
}
