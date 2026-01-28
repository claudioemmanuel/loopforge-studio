"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FilePlus,
  FileMinus,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { detectLanguage } from "@/lib/utils/language-detection";
import { SyntaxLine } from "./syntax-line";

interface DiffFileProps {
  filePath: string;
  action: "create" | "modify" | "delete";
  oldContent: string | null;
  newContent: string;
  diffPatch: string | null;
  expanded: boolean;
  onToggle: () => void;
}

interface DiffLine {
  type: "context" | "addition" | "deletion" | "header";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export function DiffFile({
  filePath,
  action,
  oldContent,
  newContent,
  diffPatch,
  expanded,
  onToggle,
}: DiffFileProps) {
  const [copied, setCopied] = useState(false);
  const language = useMemo(() => detectLanguage(filePath), [filePath]);

  const ActionIcon =
    action === "create" ? FilePlus : action === "delete" ? FileMinus : FileText;

  const actionColor =
    action === "create"
      ? "text-emerald-600"
      : action === "delete"
        ? "text-red-600"
        : "text-amber-600";

  const actionBg =
    action === "create"
      ? "bg-emerald-100 dark:bg-emerald-900/30"
      : action === "delete"
        ? "bg-red-100 dark:bg-red-900/30"
        : "bg-amber-100 dark:bg-amber-900/30";

  // Parse the diff patch into lines
  const diffLines = useMemo((): DiffLine[] => {
    if (!diffPatch && action === "create") {
      // For new files, show all lines as additions
      return newContent.split("\n").map(
        (line, i): DiffLine => ({
          type: "addition",
          content: line,
          newLineNumber: i + 1,
        }),
      );
    }

    if (!diffPatch && action === "delete") {
      // For deleted files, show all lines as deletions
      return (oldContent || "").split("\n").map(
        (line, i): DiffLine => ({
          type: "deletion",
          content: line,
          oldLineNumber: i + 1,
        }),
      );
    }

    if (!diffPatch) {
      // Generate a simple diff if no patch provided
      return generateSimpleDiff(oldContent || "", newContent);
    }

    // Parse unified diff format
    return parseDiffPatch(diffPatch);
  }, [diffPatch, action, oldContent, newContent]);

  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const line of diffLines) {
      if (line.type === "addition") additions++;
      if (line.type === "deletion") deletions++;
    }
    return { additions, deletions };
  }, [diffLines]);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(newContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* File Header */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
          "hover:bg-gray-50 dark:hover:bg-gray-800/50",
          actionBg,
        )}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <ActionIcon className={cn("w-4 h-4 shrink-0", actionColor)} />
        <span className="font-mono text-sm truncate flex-1">{filePath}</span>
        <div className="flex items-center gap-2 text-xs shrink-0">
          {stats.additions > 0 && (
            <span className="text-emerald-600">+{stats.additions}</span>
          )}
          {stats.deletions > 0 && (
            <span className="text-red-600">-{stats.deletions}</span>
          )}
        </div>
      </button>

      {/* Diff Content */}
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* Toolbar */}
          <div className="flex items-center justify-end px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy new content
                </>
              )}
            </button>
          </div>

          {/* Diff lines */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <tbody>
                {diffLines.map((line, i) => (
                  <tr
                    key={i}
                    className={cn(
                      line.type === "addition" &&
                        "bg-emerald-50 dark:bg-emerald-900/20",
                      line.type === "deletion" &&
                        "bg-red-50 dark:bg-red-900/20",
                      line.type === "header" &&
                        "bg-blue-50 dark:bg-blue-900/20",
                    )}
                  >
                    {/* Line numbers */}
                    <td className="w-12 px-2 py-0.5 text-right text-muted-foreground select-none border-r border-gray-200 dark:border-gray-700">
                      {line.oldLineNumber || ""}
                    </td>
                    <td className="w-12 px-2 py-0.5 text-right text-muted-foreground select-none border-r border-gray-200 dark:border-gray-700">
                      {line.newLineNumber || ""}
                    </td>
                    {/* Line prefix */}
                    <td className="w-6 px-1 py-0.5 text-center select-none">
                      {line.type === "addition" && (
                        <span className="text-emerald-600">+</span>
                      )}
                      {line.type === "deletion" && (
                        <span className="text-red-600">-</span>
                      )}
                      {line.type === "header" && (
                        <span className="text-blue-600">@</span>
                      )}
                    </td>
                    {/* Line content */}
                    <td className="px-2 py-0.5 whitespace-pre">
                      {line.content ? (
                        <SyntaxLine
                          content={line.content}
                          language={language}
                        />
                      ) : (
                        " "
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Parse a unified diff patch into lines
 */
function parseDiffPatch(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  const patchLines = patch.split("\n");

  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of patchLines) {
    // Skip diff headers
    if (
      line.startsWith("diff --git") ||
      line.startsWith("index ") ||
      line.startsWith("---") ||
      line.startsWith("+++")
    ) {
      continue;
    }

    // Parse hunk header
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLineNum = parseInt(match[1], 10);
        newLineNum = parseInt(match[2], 10);
      }
      lines.push({
        type: "header",
        content: line,
      });
      continue;
    }

    // Parse content lines
    if (line.startsWith("+")) {
      lines.push({
        type: "addition",
        content: line.slice(1),
        newLineNumber: newLineNum++,
      });
    } else if (line.startsWith("-")) {
      lines.push({
        type: "deletion",
        content: line.slice(1),
        oldLineNumber: oldLineNum++,
      });
    } else if (line.startsWith(" ") || line === "") {
      lines.push({
        type: "context",
        content: line.startsWith(" ") ? line.slice(1) : line,
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
      });
    }
  }

  return lines;
}

/**
 * Generate a simple diff when no patch is provided
 */
function generateSimpleDiff(
  oldContent: string,
  newContent: string,
): DiffLine[] {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const lines: DiffLine[] = [];

  // Simple line-by-line comparison
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      lines.push({
        type: "context",
        content: oldLine || "",
        oldLineNumber: i < oldLines.length ? i + 1 : undefined,
        newLineNumber: i < newLines.length ? i + 1 : undefined,
      });
    } else {
      if (i < oldLines.length) {
        lines.push({
          type: "deletion",
          content: oldLine,
          oldLineNumber: i + 1,
        });
      }
      if (i < newLines.length) {
        lines.push({
          type: "addition",
          content: newLine,
          newLineNumber: i + 1,
        });
      }
    }
  }

  return lines;
}
