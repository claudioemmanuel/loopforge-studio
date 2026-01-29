"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { clientLogger } from "@/lib/logger";
import { X, Loader2, Sparkles, Code, FileText } from "lucide-react";
import type { Task } from "@/lib/db/schema";
import { useAPIError } from "@/components/hooks/use-api-error";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import type { ChatMessageData, BrainstormPreview } from "./chat-message";

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
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [currentPreview, setCurrentPreview] =
    useState<BrainstormPreview | null>(null);
  const [repoContext, setRepoContext] = useState<{
    techStack: string[];
    fileStructure: string[];
  } | null>(null);
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
        if (
          data.isRestored &&
          data.existingMessages &&
          data.existingMessages.length > 0
        ) {
          // Restore full conversation history
          const restoredMessages: ChatMessageData[] = data.existingMessages.map(
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
            },
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
              content: "Failed to start refinement session. Please try again.",
            },
          ]);
        }
      }
    } catch (error) {
      clientLogger.error("Brainstorm init error", { error });
      setMessages([
        {
          role: "assistant",
          content:
            "Connection error. Please check your internet and try again.",
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
        body: JSON.stringify(
          isChoice ? { choice: content } : { message: content },
        ),
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
      clientLogger.error("Brainstorm chat error", { error });
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
      clientLogger.error("Brainstorm finalize error", { error });
    } finally {
      setLoading(false);
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
        clientLogger.error("Brainstorm save error", { error });
        // Still close even if save fails
      } finally {
        setSaving(false);
      }
    }
    onClose();
  };

  const handleSend = (content: string) => {
    sendMessage(content);
  };

  const handleOptionClick = (label: string) => {
    sendMessage(label, true);
  };

  const handleKeepRefining = () => {
    sendMessage("I'd like to continue refining");
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
          "animate-in slide-in-from-right fade-in duration-500 ease-out",
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
            <h2 className="font-semibold truncate">Refine: {taskTitle}</h2>
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
              <ChatMessage
                key={i}
                message={msg}
                isLast={i === messages.length - 1}
                loading={loading}
                onOptionClick={handleOptionClick}
                onFinalize={handleFinalize}
                onKeepRefining={handleKeepRefining}
              />
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
                <p>
                  <strong>Summary:</strong> {currentPreview.summary}
                </p>
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
        <ChatInput
          ref={inputRef}
          value={input}
          onChange={setInput}
          onSend={handleSend}
          loading={loading}
          disabled={loading || initializing}
        />
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
