"use client";

import { Button } from "@/components/ui/button";
import { Check, Lock, Globe, Bell } from "lucide-react";

interface IntegrationsTabProps {
  github: {
    username: string;
    connectedAt: string;
  };
  repos: Array<{
    id: string;
    fullName: string;
    isPrivate: boolean;
  }>;
}

export function IntegrationsTab({ github, repos }: IntegrationsTabProps) {
  return (
    <div className="space-y-6">
      {/* GitHub Connection */}
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="font-serif font-semibold tracking-tight mb-4">GitHub Connection</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Check className="w-4 h-4" />
            <span>Connected as @{github.username}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Permissions: read:user, user:email, repo
          </p>
          <p className="text-sm text-muted-foreground">
            Connected: {github.connectedAt}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">Reconnect</Button>
            <Button size="sm" variant="outline" className="text-destructive">
              Revoke Access
            </Button>
          </div>
        </div>
      </div>

      {/* Connected Repositories */}
      <div className="p-6 rounded-xl border bg-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif font-semibold tracking-tight">Connected Repositories</h3>
          <Button size="sm" variant="outline">+ Add Repos</Button>
        </div>
        <div className="space-y-2">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{repo.fullName}</span>
                {repo.isPrivate ? (
                  <Lock className="w-3 h-3 text-muted-foreground" />
                ) : (
                  <Globe className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
              <Button size="sm" variant="ghost" className="text-destructive text-xs">
                Disconnect
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Webhooks */}
      <div className="p-6 rounded-xl border bg-card opacity-60">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4" />
          <h3 className="font-serif font-semibold tracking-tight">Webhooks</h3>
          <span className="text-xs bg-muted px-2 py-0.5 rounded">Coming Soon</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Configure webhooks to notify external services when tasks complete or encounter errors.
        </p>
        <Button size="sm" variant="outline" disabled>
          Notify me when available
        </Button>
      </div>
    </div>
  );
}
