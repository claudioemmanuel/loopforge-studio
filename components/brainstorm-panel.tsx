"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  X,
  Send,
  Loader2,
  Sparkles,
  CheckCircle2,
  Code,
  FileText,
} from "lucide-react";
import type { Task } from "@/lib/db/schema";
import { useAPIError } from "@/components/hooks/use-api-error";
import { ErrorDialog } from "@/components/ui/error-dialog";

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

interface BrainstormOption {
  label: string;
  value: string;
}

interface BrainstormPreview {
  summary: string;
  requirements: string[];
  considerations: string[];
  suggestedApproach: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  options?: BrainstormOption[];
  preview?: BrainstormPreview;
  suggestComplete?: boolean;
}

interface BrainstormPanelProps {
  taskId: string;
  taskTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onFinalize: () => void;
  onSave?: (task: Task) => void;
}

export function BrainstormPanel({
  taskId,
  taskTitle,
  isOpen,
  onClose,
  onFinalize,
  onSave,
}: BrainstormPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [currentPreview, setCurrentPreview] = useState<BrainstormPreview | null>(null);
  const [repoContext, setRepoContext] = useState<{ techStack: string[]; fileStructure: string[] } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Error handling
  const {
    error: apiError,
    retryCountdown,
    isApiKeyError,
    clearError,
    handleAPIResponse,
  } = useAPIError();

  const initializeConversation = useCallback(async () => {
    setInitializing(true);
    clearError();
    try {
      const res = await fetch(`/api/tasks/${taskId}/brainstorm/init`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();

        // Check if we have existing messages to restore
        if (data.isRestored && data.existingMessages && data.existingMessages.length > 0) {
          // Restore full conversation history
          const restoredMessages: ChatMessage[] = data.existingMessages.map(
            (msg: { role: "user" | "assistant"; content: string }) => {
              if (msg.role === "assistant") {
                // Try to parse assistant messages as JSON to extract options/preview
                try {
                  const parsed = JSON.parse(msg.content);
                  return {
                    role: "assistant" as const,
                    content: parsed.message || msg.content,
                    options: parsed.options,
                    preview: parsed.brainstormPreview,
                    suggestComplete: parsed.suggestComplete,
                  };
                } catch {
                  return { role: "assistant" as const, content: msg.content };
                }
              }
              return { role: "user" as const, content: msg.content };
            }
          );

          // Add a welcome back message at the start if we're restoring
          setMessages([
            {
              role: "assistant",
              content: data.message,
              options: data.options,
            },
            ...restoredMessages,
          ]);
          setIsRestored(true);
        } else {
          // New conversation
          setMessages([
            {
              role: "assistant",
              content: data.message,
              options: data.options,
              preview: data.brainstormPreview,
            },
          ]);
          setIsRestored(false);
        }

        if (data.brainstormPreview) {
          setCurrentPreview(data.brainstormPreview);
        }
        if (data.repoContext) {
          setRepoContext(data.repoContext);
        }
      } else {
        // Use standardized error handling
        const hasError = await handleAPIResponse(res);
        if (!hasError) {
          // Fallback for non-standard errors
          setMessages([
            {
              role: "assistant",
              content: "Failed to start brainstorming. Please try again.",
            },
          ]);
        }
      }
    } catch (error) {
      console.error("Init error:", error);
      setMessages([
        {
          role: "assistant",
          content: "Connection error. Please check your internet and try again.",
        },
      ]);
    } finally {
      setInitializing(false);
    }
  }, [taskId, clearError, handleAPIResponse]);

  // Initialize conversation when panel opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      initializeConversation();
    }
  }, [isOpen, messages.length, initializeConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when not loading
  useEffect(() => {
    if (!loading && !initializing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading, initializing]);

  const sendMessage = async (content: string, isChoice = false) => {
    if (!content.trim() && !isChoice) return;

    setLoading(true);
    clearError();

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content }]);
    setInput("");

    try {
      const res = await fetch(`/api/tasks/${taskId}/brainstorm/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isChoice ? { choice: content } : { message: content }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message,
            options: data.options,
            preview: data.brainstormPreview,
            suggestComplete: data.suggestComplete,
          },
        ]);
        if (data.brainstormPreview) {
          setCurrentPreview(data.brainstormPreview);
        }
      } else {
        // Use standardized error handling
        const hasError = await handleAPIResponse(res);
        if (!hasError) {
          // Fallback for non-standard errors
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Something went wrong. Please try again.",
            },
          ]);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Connection error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/brainstorm/finalize`, {
        method: "POST",
      });

      if (res.ok) {
        onFinalize();
        onClose();
      } else {
        const error = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: error.error || "Failed to finalize. Please try again.",
          },
        ]);
      }
    } catch (error) {
      console.error("Finalize error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Auto-save on close
  const handleClose = async () => {
    // Only save if we have messages (conversation has started)
    if (messages.length > 0) {
      setSaving(true);
      try {
        const res = await fetch(`/api/tasks/${taskId}/brainstorm/save`, {
          method: "POST",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.task && onSave) {
            onSave(data.task);
          }
        }
      } catch (error) {
        console.error("Save error:", error);
        // Still close even if save fails
      } finally {
        setSaving(false);
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[400px] bg-card border-l shadow-xl z-50",
          "flex flex-col",
          "animate-in slide-in-from-right fade-in duration-500 ease-out"
        )}
      >
        {/* Saving Overlay */}
        {saving && (
          <div className="absolute inset-0 bg-card/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Saving your progress...</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-5 h-5 text-violet-500 flex-shrink-0" />
            <h2 className="font-semibold truncate">Brainstorm: {taskTitle}</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="p-2 -m-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Repo Context Badge */}
        {repoContext && (
          <div className="px-4 py-2 bg-muted/50 border-b text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Code className="w-3 h-3" />
                <span>{repoContext.techStack.slice(0, 3).join(", ")}</span>
                {repoContext.techStack.length > 3 && (
                  <span>+{repoContext.techStack.length - 3} more</span>
                )}
              </div>
              {isRestored && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Restored
                </span>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {initializing ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex flex-col gap-2",
                  msg.role === "user" ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{renderFormattedText(msg.content)}</p>
                </div>

                {/* Options */}
                {msg.role === "assistant" && msg.options && msg.options.length > 0 && (
                  <div className="flex flex-col gap-1.5 w-full max-w-[85%]">
                    {msg.options.map((opt, j) => (
                      <button
                        key={j}
                        onClick={() => sendMessage(opt.label, true)}
                        disabled={loading || i !== messages.length - 1}
                        className={cn(
                          "text-left px-3 py-2 rounded-lg text-sm border transition-colors",
                          i === messages.length - 1
                            ? "hover:bg-muted/80 hover:border-primary/50 cursor-pointer"
                            : "opacity-50 cursor-not-allowed",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Suggest Complete */}
                {msg.role === "assistant" && msg.suggestComplete && i === messages.length - 1 && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={handleFinalize}
                      disabled={loading}
                      className="gap-1.5"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Yes, Generate Plan
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendMessage("I'd like to continue refining")}
                      disabled={loading}
                    >
                      Keep Refining
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Preview (collapsible) */}
        {currentPreview && (
          <div className="border-t">
            <details className="group">
              <summary className="flex items-center gap-2 px-4 py-2 text-sm font-medium cursor-pointer hover:bg-muted/50">
                <FileText className="w-4 h-4 text-violet-500" />
                Current Understanding
                <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
                  Click to expand
                </span>
              </summary>
              <div className="px-4 pb-3 text-xs space-y-2 max-h-40 overflow-y-auto">
                <p><strong>Summary:</strong> {currentPreview.summary}</p>
                {currentPreview.requirements.length > 0 && (
                  <div>
                    <strong>Requirements:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {currentPreview.requirements.slice(0, 3).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                      {currentPreview.requirements.length > 3 && (
                        <li className="text-muted-foreground">
                          +{currentPreview.requirements.length - 3} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Or type your own answer..."
              disabled={loading || initializing}
              className={cn(
                "flex-1 px-3 py-2 rounded-lg border bg-background text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={loading || initializing || !input.trim()}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Error Dialog */}
      {apiError && (
        <ErrorDialog
          open={!!apiError}
          onClose={clearError}
          title={apiError.code === "RATE_LIMIT" ? "Rate Limited" : "Error"}
          description={apiError.message}
          isApiKeyError={isApiKeyError}
          retryCountdown={retryCountdown}
          errorAction={apiError.action}
        />
      )}
    </>
  );
}
