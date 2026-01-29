"use client";

import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
  loading: boolean;
  disabled: boolean;
}

export const ChatInput = forwardRef<HTMLInputElement, ChatInputProps>(
  function ChatInput({ value, onChange, onSend, loading, disabled }, ref) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend(value);
      }
    };

    return (
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            ref={ref}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type to refine your brainstorm..."
            disabled={disabled}
            className={cn(
              "flex-1 px-3 py-2 rounded-lg border bg-background text-sm",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          />
          <Button
            size="icon"
            onClick={() => onSend(value)}
            disabled={disabled || !value.trim()}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    );
  },
);
