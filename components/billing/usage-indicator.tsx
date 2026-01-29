"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Zap, TrendingUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface UsageData {
  tokens: {
    used: number;
    limit: number;
    percentUsed: number;
  };
  billingMode: "byok" | "managed";
  plan: {
    name: string;
    tier: string;
  } | null;
}

interface UsageIndicatorProps {
  className?: string;
  showUpgrade?: boolean;
}

type UsageLevel = "normal" | "warning" | "limit";

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}K`;
  }
  return tokens.toString();
}

function getUsageLevel(percentUsed: number): UsageLevel {
  if (percentUsed >= 100) return "limit";
  if (percentUsed >= 80) return "warning";
  return "normal";
}

export function UsageIndicator({
  className,
  showUpgrade = true,
}: UsageIndicatorProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch("/api/user/usage");
        if (res.ok) {
          const data = await res.json();
          setUsage(data);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
    // Refresh every 5 minutes
    const interval = setInterval(fetchUsage, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Don't show for BYOK users
  if (usage?.billingMode === "byok") {
    return null;
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !usage) {
    return null;
  }

  const level = getUsageLevel(usage.tokens.percentUsed);

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors cursor-default",
                level === "limit" && "bg-red-500/10 text-red-500",
                level === "warning" && "bg-amber-500/10 text-amber-500",
                level === "normal" && "bg-muted text-muted-foreground",
              )}
            >
              <Zap
                className={cn(
                  "w-3.5 h-3.5",
                  level === "limit" && "text-red-500",
                  level === "warning" && "text-amber-500",
                  level === "normal" && "text-muted-foreground",
                )}
              />
              <span className="tabular-nums">
                {formatTokens(usage.tokens.used)}/
                {formatTokens(usage.tokens.limit)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2">
              <div className="font-medium">Token Usage</div>
              <div className="text-xs text-muted-foreground">
                {formatTokens(usage.tokens.used)} of{" "}
                {formatTokens(usage.tokens.limit)} tokens used this month
              </div>
              {usage.plan && (
                <div className="text-xs text-muted-foreground">
                  Plan: {usage.plan.name}
                </div>
              )}
              {level === "warning" && (
                <div className="text-xs text-amber-500">
                  Approaching limit - consider upgrading
                </div>
              )}
              {level === "limit" && (
                <div className="text-xs text-red-500">
                  Limit reached - upgrade to continue
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {showUpgrade && (level === "warning" || level === "limit") && (
          <Button
            variant={level === "limit" ? "default" : "outline"}
            size="sm"
            asChild
            className="gap-1.5 h-7"
          >
            <Link href="/billing">
              <TrendingUp className="w-3.5 h-3.5" />
              Upgrade
            </Link>
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}

// Overlay version for blocking execution
interface UsageLimitOverlayProps {
  className?: string;
}

export function UsageLimitOverlay({ className }: UsageLimitOverlayProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch("/api/user/usage");
        if (res.ok) {
          const data = await res.json();
          setUsage(data);
        }
      } catch {
        // Ignore errors
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, []);

  // Only show overlay when at limit for managed users
  if (
    loading ||
    !usage ||
    usage.billingMode === "byok" ||
    usage.tokens.percentUsed < 100
  ) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg",
        className,
      )}
    >
      <div className="max-w-md text-center p-8">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
          <Zap className="w-8 h-8 text-red-500" />
        </div>

        <h3 className="text-xl font-semibold mb-2">Token Limit Reached</h3>

        <p className="text-muted-foreground mb-6">
          You&apos;ve used all {formatTokens(usage.tokens.limit)} tokens for
          this month. Upgrade your plan to continue executing tasks.
        </p>

        <Button size="lg" asChild className="gap-2">
          <Link href="/billing">
            <TrendingUp className="w-4 h-4" />
            Upgrade Plan
          </Link>
        </Button>

        <p className="text-xs text-muted-foreground mt-4">
          Or wait until your billing cycle resets.
        </p>
      </div>
    </div>
  );
}
