"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { User, AlertTriangle, Download, Unplug } from "lucide-react";
import { useSettings } from "../settings-context";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/use-toast";
import { clientLogger } from "@/lib/logger";

export default function AccountPage() {
  const t = useTranslations("settings.accountPage");
  const { user } = useSettings();
  const router = useRouter();

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Disconnect repos state
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      // Sign out and redirect to landing page
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      clientLogger.error("Account deletion failed", { error });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectAll = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/repos", { method: "DELETE" });
      if (res.ok) {
        setShowDisconnectDialog(false);
        router.refresh();
        toast({
          title: "Success",
          description: "All repositories disconnected",
        });
      } else {
        throw new Error("Failed to disconnect repositories");
      }
    } catch (error) {
      clientLogger.error("Failed to disconnect all repositories", { error });
      toast({
        title: "Error",
        description: "Failed to disconnect repositories. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile */}
      <div className="p-6 rounded-xl border bg-card" id="profile">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4" />
          <h3 className="font-serif font-semibold tracking-tight">
            {t("profile")}
          </h3>
        </div>
        <div className="flex items-center gap-4">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name || ""}
              width={64}
              height={64}
              className="rounded-full"
            />
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

      {/* Danger Zone */}
      <div
        className="p-6 rounded-xl border border-destructive/50 bg-destructive/5"
        id="danger-zone"
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h3 className="font-serif font-semibold tracking-tight text-destructive">
            {t("dangerZone.title")}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t("dangerZone.subtitle")}
        </p>

        <div className="space-y-4">
          {/* Export Data */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <Download className="w-4 h-4" />
                  {t("dangerZone.exportData.title")}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("dangerZone.exportData.description")}
                </p>
              </div>
              <Button variant="outline" size="sm">
                {t("dangerZone.exportData.button")}
              </Button>
            </div>
          </div>

          {/* Disconnect All Repositories */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <Unplug className="w-4 h-4" />
                  {t("dangerZone.disconnectRepos.title")}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("dangerZone.disconnectRepos.description")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => setShowDisconnectDialog(true)}
              >
                {t("dangerZone.disconnectRepos.button")}
              </Button>
            </div>

            <ConfirmDialog
              open={showDisconnectDialog}
              onOpenChange={setShowDisconnectDialog}
              title={t("dangerZone.disconnectRepos.confirmTitle")}
              description={t("dangerZone.disconnectRepos.confirmDescription")}
              confirmText={
                disconnecting
                  ? t("dangerZone.disconnectRepos.disconnecting")
                  : t("dangerZone.disconnectRepos.button")
              }
              onConfirm={handleDisconnectAll}
              variant="destructive"
              disabled={disconnecting}
            >
              <div className="space-y-3 text-sm">
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30">
                  <p className="font-medium text-amber-800 dark:text-amber-300 mb-2">
                    {t("dangerZone.disconnectRepos.activeWarning")}
                  </p>
                  <p className="text-amber-700 dark:text-amber-400 text-xs">
                    {t("dangerZone.disconnectRepos.activeWarningMessage")}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="font-medium">
                    {t("dangerZone.disconnectRepos.willRemove")}
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>{t("dangerZone.disconnectRepos.removeConnections")}</li>
                    <li>{t("dangerZone.disconnectRepos.removeClones")}</li>
                    <li>{t("dangerZone.disconnectRepos.removeHistory")}</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="font-medium">
                    {t("dangerZone.disconnectRepos.willPreserve")}
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>{t("dangerZone.disconnectRepos.preserveTasks")}</li>
                    <li>{t("dangerZone.disconnectRepos.preserveAccount")}</li>
                    <li>{t("dangerZone.disconnectRepos.preserveBilling")}</li>
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground">
                    {t("dangerZone.disconnectRepos.canReconnect")}
                  </p>
                </div>
              </div>
            </ConfirmDialog>
          </div>

          {/* Delete Account */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-semibold mb-1">
                  {t("dangerZone.deleteAccount")}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t("dangerZone.deleteDescription")}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
              >
                {t("dangerZone.deleteButton")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t("dangerZone.confirmTitle")}
        description={t("dangerZone.confirmDescription")}
        confirmText={t("dangerZone.deleteButton")}
        variant="destructive"
        disabled={isDeleting}
        requireTextConfirmation={t("dangerZone.confirmText")}
        confirmationPlaceholder={t("dangerZone.confirmPlaceholder")}
        onConfirm={handleDeleteAccount}
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm font-semibold text-destructive mb-2">
              {t("dangerZone.whatHappens")}
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                <span>{t("dangerZone.allRepos")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                <span>{t("dangerZone.allTasks")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                <span>{t("dangerZone.allExecutions")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                <span>{t("dangerZone.allSettings")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                <span>{t("dangerZone.apiKeys")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                <span>{t("dangerZone.subscription")}</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
              {t("dangerZone.noUndo")}
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {t("dangerZone.dataLoss")}
            </p>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
