"use client";

import { useState, useEffect, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import {
  X,
  Check,
  XCircle,
  Loader2,
  FileText,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
} from "lucide-react";
import { DiffFile } from "./diff-file";
import { TestOutput } from "@/components/test-results/test-output";

interface PendingChange {
  id: string;
  filePath: string;
  action: "create" | "modify" | "delete";
  oldContent: string | null;
  newContent: string;
  diffPatch: string | null;
  isApproved: boolean;
}

interface TestRunData {
  id: string;
  status: "running" | "passed" | "failed" | "timeout" | "skipped";
  statusText: string;
  durationText: string;
  stdout: string | null;
  stderr: string | null;
  hasOutput: boolean;
}

interface DiffModalProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onRequestChanges?: () => Promise<void>;
}

export function DiffModal({
  taskId,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onRequestChanges,
}: DiffModalProps) {
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<PendingChange[]>([]);
  const [testRun, setTestRun] = useState<TestRunData | null>(null);
  const [summary, setSummary] = useState({ total: 0, approved: 0, pending: 0 });
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [showTestOutput, setShowTestOutput] = useState(false);

  const fetchChanges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/diff`);
      if (!res.ok) {
        throw new Error("Failed to fetch changes");
      }
      const data = await res.json();
      setChanges(data.changes || []);
      setSummary(data.summary || { total: 0, approved: 0, pending: 0 });
      setTestRun(data.testRun);
      // Expand all files by default if there are few
      if (data.changes.length <= 5) {
        setExpandedFiles(new Set(data.changes.map((c: PendingChange) => c.id)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load changes");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (isOpen) {
      fetchChanges();
    }
  }, [isOpen, fetchChanges]);

  const handleApprove = async () => {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/diff/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createPr: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to approve changes");
      }
      await onApprove();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to approve changes",
      );
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/diff/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "stuck" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reject changes");
      }
      await onReject();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject changes");
    } finally {
      setRejecting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!feedback.trim()) return;
    setRequesting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/diff/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus: "planning",
          reason: feedback.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to request changes");
      }
      if (onRequestChanges) {
        await onRequestChanges();
      }
      setFeedback("");
      setShowFeedbackForm(false);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to request changes",
      );
    } finally {
      setRequesting(false);
    }
  };

  const toggleFile = (id: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedFiles(new Set(changes.map((c) => c.id)));
  };

  const collapseAll = () => {
    setExpandedFiles(new Set());
  };

  // Count additions and deletions
  const stats = changes.reduce(
    (acc, change) => {
      if (change.action === "create") acc.created++;
      else if (change.action === "delete") acc.deleted++;
      else acc.modified++;
      return acc;
    },
    { created: 0, modified: 0, deleted: 0 },
  );

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex items-center justify-center outline-none">
          {/* Modal */}
          <div className="relative z-10 w-full max-w-5xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl flex flex-col overflow-hidden mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold">Review Changes</h2>
                <p className="text-sm text-muted-foreground">
                  {summary.total} file{summary.total !== 1 ? "s" : ""} changed
                  {stats.created > 0 && (
                    <span className="ml-2 text-emerald-600">
                      <Plus className="inline w-3 h-3" /> {stats.created}{" "}
                      created
                    </span>
                  )}
                  {stats.modified > 0 && (
                    <span className="ml-2 text-amber-600">
                      <FileText className="inline w-3 h-3" /> {stats.modified}{" "}
                      modified
                    </span>
                  )}
                  {stats.deleted > 0 && (
                    <span className="ml-2 text-red-600">
                      <Minus className="inline w-3 h-3" /> {stats.deleted}{" "}
                      deleted
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Test Results Banner */}
            {testRun && (
              <div
                className={`px-6 py-3 border-b flex items-center justify-between cursor-pointer ${
                  testRun.status === "passed"
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                    : testRun.status === "failed"
                      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                      : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                }`}
                onClick={() => setShowTestOutput(!showTestOutput)}
              >
                <div className="flex items-center gap-2">
                  {testRun.status === "passed" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : testRun.status === "failed" ? (
                    <XCircle className="w-5 h-5 text-red-600" />
                  ) : testRun.status === "running" ? (
                    <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-600" />
                  )}
                  <span className="font-medium">{testRun.statusText}</span>
                  {testRun.durationText && (
                    <span className="text-sm text-muted-foreground">
                      ({testRun.durationText})
                    </span>
                  )}
                </div>
                {testRun.hasOutput && (
                  <span className="text-sm text-muted-foreground">
                    {showTestOutput ? "Hide output" : "Show output"}
                  </span>
                )}
              </div>
            )}

            {/* Test Output Panel */}
            {showTestOutput && testRun && (
              <div className="border-b border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto">
                <TestOutput
                  stdout={testRun.stdout || ""}
                  stderr={testRun.stderr || ""}
                  status={testRun.status}
                />
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                  <Button
                    onClick={fetchChanges}
                    variant="outline"
                    className="mt-4"
                  >
                    Try Again
                  </Button>
                </div>
              ) : changes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No pending changes to review
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* File controls */}
                  <div className="flex items-center justify-end gap-2 text-sm">
                    <button
                      onClick={expandAll}
                      className="text-blue-600 hover:underline"
                    >
                      Expand all
                    </button>
                    <span className="text-muted-foreground">|</span>
                    <button
                      onClick={collapseAll}
                      className="text-blue-600 hover:underline"
                    >
                      Collapse all
                    </button>
                  </div>

                  {/* File list */}
                  {changes.map((change) => (
                    <DiffFile
                      key={change.id}
                      filePath={change.filePath}
                      action={change.action}
                      oldContent={change.oldContent}
                      newContent={change.newContent}
                      diffPatch={change.diffPatch}
                      expanded={expandedFiles.has(change.id)}
                      onToggle={() => toggleFile(change.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Feedback Form */}
            {showFeedbackForm && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/10 space-y-3">
                <label className="block text-sm font-medium">
                  What changes would you like?
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Describe the changes you'd like the AI to make..."
                  className="w-full h-24 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <div className="flex items-center gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowFeedbackForm(false);
                      setFeedback("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleRequestChanges}
                    disabled={requesting || !feedback.trim()}
                    className="gap-2"
                  >
                    {requesting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageSquare className="w-4 h-4" />
                    )}
                    Submit Feedback
                  </Button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="text-sm text-muted-foreground">
                {testRun?.status === "failed" && (
                  <span className="text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Tests failed - review carefully before approving
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={rejecting || approving || requesting || loading}
                  className="gap-2"
                >
                  {rejecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Reject
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowFeedbackForm(!showFeedbackForm)}
                  disabled={rejecting || approving || requesting || loading}
                  className="gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Request Changes
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={
                    approving ||
                    rejecting ||
                    requesting ||
                    loading ||
                    changes.length === 0
                  }
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {approving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Approve & Create PR
                </Button>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
