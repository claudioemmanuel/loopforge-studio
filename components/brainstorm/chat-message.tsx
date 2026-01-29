"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2 } from "lucide-react";

// Simple markdown-like text renderer for **bold** syntax
function renderFormattedText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export interface BrainstormOption {
  label: string;
  value: string;
}

export interface BrainstormPreview {
  summary: string;
  requirements: string[];
  considerations: string[];
  suggestedApproach: string;
}

export interface ChatMessageData {
  role: "user" | "assistant";
  content: string;
  options?: BrainstormOption[];
  preview?: BrainstormPreview;
  suggestComplete?: boolean;
}

interface ChatMessageProps {
  message: ChatMessageData;
  /** Whether this is the last message in the list */
  isLast: boolean;
  /** Whether a request is in progress */
  loading: boolean;
  /** Callback when a quick-reply option is clicked */
  onOptionClick: (label: string) => void;
  /** Callback when the "Save & Continue" button is clicked */
  onFinalize: () => void;
  /** Callback when "Keep Refining" is clicked */
  onKeepRefining: () => void;
}

export function ChatMessage({
  message,
  isLast,
  loading,
  onOptionClick,
  onFinalize,
  onKeepRefining,
}: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        message.role === "user" ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5",
          message.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted",
        )}
      >
        <p className="text-sm whitespace-pre-wrap">
          {renderFormattedText(message.content)}
        </p>
      </div>

      {/* Options */}
      {message.role === "assistant" &&
        message.options &&
        message.options.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full max-w-[85%]">
            {message.options.map((opt, j) => (
              <button
                key={j}
                onClick={() => onOptionClick(opt.label)}
                disabled={loading || !isLast}
                className={cn(
                  "text-left px-3 py-2 rounded-lg text-sm border transition-colors",
                  isLast
                    ? "hover:bg-muted/80 hover:border-primary/50 cursor-pointer"
                    : "opacity-50 cursor-not-allowed",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

      {/* Suggest Complete */}
      {message.role === "assistant" && message.suggestComplete && isLast && (
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            onClick={onFinalize}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Save & Continue
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onKeepRefining}
            disabled={loading}
          >
            Keep Refining
          </Button>
        </div>
      )}
    </div>
  );
}
