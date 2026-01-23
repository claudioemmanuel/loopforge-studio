"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Timeline Root Component
 * Container for timeline items with vertical line
 */
const Timeline = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative space-y-0", className)}
    {...props}
  />
));
Timeline.displayName = "Timeline";

/**
 * Timeline Item
 * Individual item in the timeline with connector line
 */
interface TimelineItemProps extends React.HTMLAttributes<HTMLDivElement> {
  isLast?: boolean;
  lineColor?: string;
}

const TimelineItem = React.forwardRef<HTMLDivElement, TimelineItemProps>(
  ({ className, isLast, lineColor, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative flex gap-4 pb-6 last:pb-0", className)}
      {...props}
    >
      {/* Vertical connector line */}
      {!isLast && (
        <div
          className={cn(
            "absolute left-[11px] top-8 bottom-0 w-0.5",
            lineColor || "bg-border"
          )}
        />
      )}
      {children}
    </div>
  )
);
TimelineItem.displayName = "TimelineItem";

/**
 * Timeline Dot/Indicator
 * The dot or icon indicator on the timeline
 */
interface TimelineDotProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline" | "primary" | "destructive" | "muted";
  size?: "sm" | "md" | "lg";
}

const TimelineDot = React.forwardRef<HTMLDivElement, TimelineDotProps>(
  ({ className, variant = "default", size = "md", children, ...props }, ref) => {
    const sizeClasses = {
      sm: "w-4 h-4",
      md: "w-6 h-6",
      lg: "w-8 h-8",
    };

    const variantClasses = {
      default: "bg-border",
      outline: "border-2 border-border bg-background",
      primary: "bg-primary",
      destructive: "bg-destructive",
      muted: "bg-muted",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative z-10 flex items-center justify-center rounded-full shrink-0",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TimelineDot.displayName = "TimelineDot";

/**
 * Timeline Content
 * The content area next to the timeline dot
 */
const TimelineContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 min-w-0 pt-0.5", className)}
    {...props}
  />
));
TimelineContent.displayName = "TimelineContent";

/**
 * Timeline Header
 * Header row within timeline content (title + timestamp)
 */
const TimelineHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-start justify-between gap-2", className)}
    {...props}
  />
));
TimelineHeader.displayName = "TimelineHeader";

/**
 * Timeline Title
 * Main title/description in timeline item
 */
const TimelineTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-foreground", className)}
    {...props}
  />
));
TimelineTitle.displayName = "TimelineTitle";

/**
 * Timeline Time
 * Timestamp display
 */
const TimelineTime = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn("text-xs text-muted-foreground shrink-0", className)}
    {...props}
  />
));
TimelineTime.displayName = "TimelineTime";

/**
 * Timeline Description
 * Secondary text below the title
 */
const TimelineDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-muted-foreground mt-1", className)}
    {...props}
  />
));
TimelineDescription.displayName = "TimelineDescription";

export {
  Timeline,
  TimelineItem,
  TimelineDot,
  TimelineContent,
  TimelineHeader,
  TimelineTitle,
  TimelineTime,
  TimelineDescription,
};
