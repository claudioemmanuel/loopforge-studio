"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Download, Unplug, Trash2 } from "lucide-react";

export function DangerZoneTab() {
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl border-2 border-destructive/50 bg-destructive/5">
        <div className="flex items-center gap-2 mb-4 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-serif font-semibold tracking-tight">Danger Zone</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          These actions are irreversible. Please proceed with caution.
        </p>

        <div className="space-y-4">
          {/* Export Data */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  <Download className="w-4 h-4" />
                  Export All Data
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Download all your tasks, executions, and settings
                </p>
              </div>
              <Button variant="outline" size="sm">
                Export JSON
              </Button>
            </div>
          </div>

          {/* Disconnect All */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  <Unplug className="w-4 h-4" />
                  Disconnect All Repositories
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Remove all connected repos. Tasks will be preserved.
                </p>
              </div>
              <Button variant="outline" size="sm" className="text-destructive">
                Disconnect All
              </Button>
            </div>
          </div>

          {/* Delete Account */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 font-medium text-destructive">
                  <Trash2 className="w-4 h-4" />
                  Delete Account
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                Delete Account
              </Button>
            </div>

            {showDeleteDialog && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">
                  Type &quot;DELETE MY ACCOUNT&quot; to confirm:
                </p>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE MY ACCOUNT"
                  className="mb-3"
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteConfirm !== "DELETE MY ACCOUNT"}
                  >
                    Confirm Delete
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowDeleteDialog(false);
                      setDeleteConfirm("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
