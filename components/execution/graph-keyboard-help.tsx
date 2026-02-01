"use client";

import React, { useState, useEffect } from "react";
import { Keyboard, X } from "lucide-react";
import { KEYBOARD_SHORTCUTS } from "./graph-accessibility";

/**
 * Keyboard shortcuts help overlay
 */
export function GraphKeyboardHelp() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle with "?" key
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }

      // Close with Escape
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute bottom-4 left-4 z-10 p-2 rounded-lg bg-slate-800/90 backdrop-blur-sm border border-slate-700 hover:bg-slate-700 transition-colors text-slate-300"
        aria-label="Show keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard className="w-4 h-4" />
      </button>

      {/* Help overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />

          {/* Help panel */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-slate-900 rounded-xl border border-slate-700 shadow-2xl animate-in zoom-in-95 fade-in duration-200">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-emerald-400" />
                  <h2 className="font-semibold text-lg text-slate-200">
                    Keyboard Shortcuts
                  </h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Shortcuts list */}
              <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {KEYBOARD_SHORTCUTS.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-4"
                  >
                    <div className="flex flex-wrap gap-2">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          <kbd className="px-2 py-1 text-xs font-mono bg-slate-800 border border-slate-600 rounded text-slate-300">
                            {key}
                          </kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-xs text-slate-500 self-center">
                              or
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <span className="text-sm text-slate-400 text-right flex-shrink-0">
                      {shortcut.description}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-700 text-center">
                <p className="text-xs text-slate-500">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 text-xs font-mono bg-slate-800 border border-slate-600 rounded">
                    ?
                  </kbd>{" "}
                  or{" "}
                  <kbd className="px-1.5 py-0.5 text-xs font-mono bg-slate-800 border border-slate-600 rounded">
                    Esc
                  </kbd>{" "}
                  to close
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
