"use client";

import { motion } from "framer-motion";

// ============================================================================
// ProgressDots Component
// ============================================================================

export function ProgressDots({
  currentPhase,
  totalPhases,
}: {
  currentPhase: number;
  totalPhases: number;
}) {
  return (
    <div className="flex justify-center gap-1.5 mt-3">
      {Array.from({ length: totalPhases }).map((_, index) => (
        <motion.div
          key={index}
          className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
          style={{
            backgroundColor: index <= currentPhase ? "#10b981" : "#e2e8f0",
          }}
          animate={index === currentPhase ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// BrowserChrome Component
// ============================================================================

export function BrowserChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-2xl shadow-slate-900/10 dark:shadow-slate-900/50 border border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 rounded-t-xl">
        {/* Traffic lights */}
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>

        {/* URL bar */}
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            loopforge.studio/dashboard
          </div>
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}

// ============================================================================
// BackgroundDecoration Component
// ============================================================================

export function BackgroundDecoration() {
  return (
    <div className="absolute inset-0 overflow-hidden -z-10 rounded-xl">
      {/* Gradient blobs */}
      <div className="absolute -top-20 left-1/4 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 right-1/4 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #64748b 1px, transparent 1px), linear-gradient(to bottom, #64748b 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
    </div>
  );
}
