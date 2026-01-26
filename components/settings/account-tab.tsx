"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key } from "lucide-react";

interface AccountTabProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  apiKeyMasked?: string | null;
}

export function AccountTab({ user, apiKeyMasked }: AccountTabProps) {
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

    </div>
  );
}
