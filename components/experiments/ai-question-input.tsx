"use client";

import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface AIQuestionInputProps {
  question: string;
  questionId: string;
  type: "text" | "radio";
  options?: string[];
  value: string;
  onChange: (value: string) => void;
  animated?: boolean;
}

export function AIQuestionInput({
  question,
  questionId,
  type,
  options,
  value,
  onChange,
  animated = false,
}: AIQuestionInputProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 mt-1">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <Label htmlFor={questionId} className="text-base font-medium">
            {question}
          </Label>
        </div>
      </div>

      <div
        className={
          animated
            ? "animate-in fade-in slide-in-from-bottom-2 duration-300"
            : ""
        }
      >
        {type === "text" && (
          <Input
            id={questionId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your answer..."
            className="mt-2"
          />
        )}

        {type === "radio" && options && (
          <div className="mt-3 space-y-2">
            {options.map((option) => (
              <label
                key={option}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                  "hover:bg-accent",
                  value === option
                    ? "border-primary bg-primary/5"
                    : "border-border",
                )}
              >
                <input
                  type="radio"
                  name={questionId}
                  value={option}
                  checked={value === option}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium">{option}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
