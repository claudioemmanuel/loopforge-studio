"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { clientLogger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AlertTriangle, Download, Unplug, Trash2, Loader2 } from "lucide-react";

export default function DangerZonePage() {
  const t = useTranslations();
  const router = useRouter();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDisconnectAll = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/repos", { method: "DELETE" });
      if (res.ok) {
        setShowDisconnectDialog(false);
        router.refresh();
      } else {
        clientLogger.error("Failed to disconnect all repositories");
      }
    } catch (error) {
      clientLogger.error("Failed to disconnect all repositories", { error });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleDeleteAccount = async () => {
    // Verify confirmation text
    if (deleteConfirm !== "DELETE MY ACCOUNT") {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete", { method: "DELETE" });
      if (res.ok) {
        // Redirect to goodbye page or login
        router.push("/login");
      } else {
        clientLogger.error("Failed to delete account");
      }
    } catch (error) {
      clientLogger.error("Failed to delete account", { error });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl border-2 border-destructive/50 bg-destructive/5">
        <div className="flex items-center gap-2 mb-4 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-serif font-semibold tracking-tight">
            {t("settings.dangerZone.title")}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {t("settings.dangerZone.subtitle")}
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
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => setShowDisconnectDialog(true)}
              >
                Disconnect All
              </Button>
            </div>

            <ConfirmDialog
              open={showDisconnectDialog}
              onOpenChange={setShowDisconnectDialog}
              title="Disconnect All Repositories?"
              description="This action will disconnect all repositories from Loopforge. Please review what will happen:"
              confirmText={
                disconnecting ? "Disconnecting..." : "Disconnect All"
              }
              onConfirm={handleDisconnectAll}
              variant="destructive"
              disabled={disconnecting}
            >
              <div className="space-y-3 text-sm">
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30">
                  <p className="font-medium text-amber-800 dark:text-amber-300 mb-2">
                    ⚠️ Active Tasks Warning
                  </p>
                  <p className="text-amber-700 dark:text-amber-400 text-xs">
                    Any tasks currently in brainstorming, planning, or executing
                    status will be stopped. Incomplete work may be lost.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="font-medium">What will be removed:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Repository connections (GitHub access revoked)</li>
                    <li>Local repository clones (if configured)</li>
                    <li>Task execution history and logs</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="font-medium">What will be preserved:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Task definitions and descriptions</li>
                    <li>Your account and settings</li>
                    <li>Subscription and billing information</li>
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground">
                    You can reconnect repositories at any time, but execution
                    history will not be restored.
                  </p>
                </div>
              </div>
            </ConfirmDialog>
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

            <ConfirmDialog
              open={showDeleteDialog}
              onOpenChange={(open) => {
                setShowDeleteDialog(open);
                if (!open) setDeleteConfirm("");
              }}
              title="Delete Account Permanently?"
              description="This action is irreversible and will permanently delete all your data. Please review what will happen:"
              confirmText={deleting ? "Deleting..." : "Delete My Account"}
              onConfirm={handleDeleteAccount}
              variant="destructive"
              disabled={deleting || deleteConfirm !== "DELETE MY ACCOUNT"}
            >
              <div className="space-y-4 text-sm">
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/30">
                  <p className="font-medium text-red-800 dark:text-red-300 mb-2">
                    🚨 Permanent Deletion Warning
                  </p>
                  <p className="text-red-700 dark:text-red-400 text-xs">
                    This action CANNOT be undone. All data will be permanently
                    erased from our systems.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="font-medium">What will be deleted:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>All repository connections</li>
                    <li>All tasks, executions, and history</li>
                    <li>Local repository clones</li>
                    <li>Your account profile and settings</li>
                    <li>Subscription and billing information</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-destructive">
                    Type DELETE MY ACCOUNT to confirm:
                  </p>
                  <Input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE MY ACCOUNT"
                    className="font-mono"
                    autoComplete="off"
                  />
                  {deleteConfirm && deleteConfirm !== "DELETE MY ACCOUNT" && (
                    <p className="text-xs text-muted-foreground">
                      Text must match exactly (case sensitive)
                    </p>
                  )}
                </div>
              </div>
            </ConfirmDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
