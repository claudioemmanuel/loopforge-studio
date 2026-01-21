"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, CreditCard } from "lucide-react";

interface AccountTabProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  apiKeyMasked?: string | null;
  subscription?: {
    plan: string;
    usage: number;
    limit: number;
    nextBilling?: string;
  } | null;
}

export function AccountTab({ user, apiKeyMasked, subscription }: AccountTabProps) {
  const [showUpdateKey, setShowUpdateKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");

  return (
    <div className="space-y-6">
      {/* Profile */}
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="font-serif font-semibold tracking-tight mb-4">Profile</h3>
        <div className="flex items-center gap-4">
          {user.image ? (
            <img src={user.image} alt={user.name || ""} className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-semibold">
              {user.name?.[0] || "U"}
            </div>
          )}
          <div>
            <p className="font-semibold text-lg">{user.name}</p>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      {/* API Key */}
      <div className="p-6 rounded-xl border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4" />
          <h3 className="font-serif font-semibold tracking-tight">API Key</h3>
        </div>
        {apiKeyMasked ? (
          <div className="space-y-3">
            <p className="font-mono text-sm bg-muted px-3 py-2 rounded">{apiKeyMasked}</p>
            {showUpdateKey ? (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="sk-ant-api03-..."
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm">Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowUpdateKey(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowUpdateKey(true)}>
                  Update API Key
                </Button>
                <Button size="sm" variant="outline" className="text-destructive">
                  Remove Key
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">No API key configured.</p>
            <Input
              type="password"
              placeholder="sk-ant-api03-..."
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
            />
            <Button size="sm">Save API Key</Button>
          </div>
        )}
      </div>

      {/* Subscription */}
      <div className="p-6 rounded-xl border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4" />
          <h3 className="font-serif font-semibold tracking-tight">Billing and Subscription</h3>
        </div>
        {subscription ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Current plan: {subscription.plan}</p>
                {subscription.nextBilling && (
                  <p className="text-sm text-muted-foreground">
                    Next billing: {subscription.nextBilling}
                  </p>
                )}
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Usage: {subscription.usage}/{subscription.limit} tasks</span>
                <span>{Math.round((subscription.usage / subscription.limit) * 100)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${(subscription.usage / subscription.limit) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">Manage Subscription</Button>
              <Button size="sm" variant="outline">View Invoices</Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              You&apos;re using Bring Your Own Key mode. Upgrade for managed billing.
            </p>
            <Button size="sm">Upgrade Plan</Button>
          </div>
        )}
      </div>
    </div>
  );
}
