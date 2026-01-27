"use client";

import { useState, useEffect } from "react";
import { Zap, FileText, FolderGit2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface UsageData {
  currentPeriod: {
    start: string;
    end: string;
  };
  tokens: {
    used: number;
    limit: number;
    percentUsed: number;
  };
  tasks: {
    created: number;
    limit: number;
    percentUsed: number;
  };
  repos: {
    count: number;
    limit: number;
    percentUsed: number;
  };
  estimatedCost: {
    cents: number;
    formatted: string;
  };
  billingMode: "byok" | "managed";
  plan: {
    name: string;
    tier: string;
  } | null;
}

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number;
  percentUsed: number;
  icon: React.ReactNode;
  formatValue?: (value: number) => string;
}

function UsageMeter({
  label,
  used,
  limit,
  percentUsed,
  icon,
  formatValue = (v) => v.toLocaleString(),
}: UsageMeterProps) {
  const isNearLimit = percentUsed >= 80;
  const isAtLimit = percentUsed >= 100;

  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span
          className={cn(
            "text-sm font-mono",
            isAtLimit && "text-destructive",
            isNearLimit && !isAtLimit && "text-yellow-500",
          )}
        >
          {formatValue(used)} / {formatValue(limit)}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out rounded-full",
            isAtLimit
              ? "bg-destructive"
              : isNearLimit
                ? "bg-yellow-500"
                : "bg-primary",
          )}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>
      {isNearLimit && (
        <p
          className={cn(
            "text-xs mt-1",
            isAtLimit ? "text-destructive" : "text-yellow-500",
          )}
        >
          {isAtLimit ? "Limit reached" : "Approaching limit"}
        </p>
      )}
    </div>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

export function UsageDashboard() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const response = await fetch("/api/user/usage");
        if (!response.ok) {
          throw new Error("Failed to fetch usage");
        }
        const data = await response.json();
        setUsage(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load usage");
      } finally {
        setLoading(false);
      }
    }

    fetchUsage();
  }, []);

  if (loading) {
    return (
      <div className="p-6 rounded-xl border bg-card animate-pulse">
        <div className="h-6 w-32 bg-muted rounded mb-4" />
        <div className="space-y-4">
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className="p-6 rounded-xl border bg-card">
        <p className="text-sm text-muted-foreground">
          {error || "Unable to load usage data"}
        </p>
      </div>
    );
  }

  const periodStart = new Date(usage.currentPeriod.start);
  const periodEnd = new Date(usage.currentPeriod.end);

  return (
    <div className="p-6 rounded-xl border bg-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          <h3 className="font-serif font-semibold tracking-tight">Usage</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          {periodStart.toLocaleDateString()} - {periodEnd.toLocaleDateString()}
        </div>
      </div>

      {usage.plan && (
        <div className="mb-4 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="text-sm">
              <span className="font-medium">{usage.plan.name}</span>
              <span className="text-muted-foreground ml-2">
                ({usage.billingMode === "managed" ? "Managed" : "BYOK"})
              </span>
            </span>
            {usage.billingMode === "managed" && (
              <span className="text-sm font-mono">
                {usage.estimatedCost.formatted}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <UsageMeter
          label="Tokens"
          used={usage.tokens.used}
          limit={usage.tokens.limit}
          percentUsed={usage.tokens.percentUsed}
          icon={<Zap className="w-4 h-4" />}
          formatValue={formatTokens}
        />
        <UsageMeter
          label="Tasks"
          used={usage.tasks.created}
          limit={usage.tasks.limit}
          percentUsed={usage.tasks.percentUsed}
          icon={<FileText className="w-4 h-4" />}
        />
        <UsageMeter
          label="Repositories"
          used={usage.repos.count}
          limit={usage.repos.limit}
          percentUsed={usage.repos.percentUsed}
          icon={<FolderGit2 className="w-4 h-4" />}
        />
      </div>
    </div>
  );
}
