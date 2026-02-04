"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onValueChange: (value: string) => void;
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function SegmentedControl({
  options,
  value,
  onValueChange,
  size = "default",
  className,
}: SegmentedControlProps) {
  const [focusedIndex, setFocusedIndex] = React.useState<number>(
    options.findIndex((opt) => opt.value === value),
  );

  const sizeClasses = {
    sm: "h-8 text-xs",
    default: "h-9 text-sm",
    lg: "h-10 text-base",
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = options.findIndex((opt) => opt.value === value);
    let newIndex = currentIndex;

    switch (e.key) {
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        break;
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        newIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        break;
      case "Home":
        e.preventDefault();
        newIndex = 0;
        break;
      case "End":
        e.preventDefault();
        newIndex = options.length - 1;
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        onValueChange(options[focusedIndex].value);
        return;
      default:
        return;
    }

    setFocusedIndex(newIndex);
    onValueChange(options[newIndex].value);
  };

  return (
    <div
      role="radiogroup"
      aria-label="View switcher"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5 border border-border/50",
        sizeClasses[size],
        className,
      )}
      onKeyDown={handleKeyDown}
    >
      {options.map((option, index) => {
        const isActive = value === option.value;
        const isFocused = focusedIndex === index;

        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={isActive}
            aria-label={option.ariaLabel || option.label}
            tabIndex={isActive ? 0 : -1}
            onClick={() => {
              setFocusedIndex(index);
              onValueChange(option.value);
            }}
            onFocus={() => setFocusedIndex(index)}
            className={cn(
              "inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-sm font-medium transition-all duration-150 ease-out",
              "min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0", // Mobile touch targets
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              isFocused && !isActive && "ring-2 ring-ring ring-offset-2",
            )}
          >
            {option.icon && (
              <span className="shrink-0" aria-hidden="true">
                {option.icon}
              </span>
            )}
            <span className="hidden sm:inline">{option.label}</span>
            {/* Screen reader only text for mobile icon-only view */}
            <span className="sr-only sm:hidden">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
