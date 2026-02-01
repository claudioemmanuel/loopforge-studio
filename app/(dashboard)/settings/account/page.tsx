"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  User,
  AlertTriangle,
  CreditCard,
  Check,
  Sparkles,
  Settings as SettingsIcon,
  Loader2,
  Download,
  Unplug,
} from "lucide-react";
import { useSettings } from "../settings-context";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UsageDashboard } from "@/components/billing/usage-dashboard";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { clientLogger } from "@/lib/logger";

interface Plan {
  id: string;
  name: string;
  tier: string;
  billingMode: "byok" | "managed";
  priceMonthly: number;
  priceYearly: number;
  limits: {
    maxRepos: number;
    maxTasksPerMonth: number;
    maxTokensPerMonth: number;
  };
  hasStripePrice: boolean;
}

interface PlansData {
  plans: Record<string, Plan>;
  stripeEnabled: boolean;
  stripePublishableKey: string | null;
}

interface SubscriptionData {
  billingMode: "byok" | "managed";
  hasActiveSubscription: boolean;
  subscription: {
    status: string;
    billingCycle: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  plan: {
    id: string;
    name: string;
    tier: string;
  } | null;
}

const tierOrder = ["free", "pro", "team"];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export default function AccountPage() {
  const t = useTranslations("settings.accountPage");
  const tBilling = useTranslations("settings.billingPage");
  const { user } = useSettings();
  const router = useRouter();

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Disconnect repos state
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Billing state
  const [plans, setPlans] = useState<PlansData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null,
  );
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [billingMode, setBillingMode] = useState<"byok" | "managed">("byok");
  const [billingLoading, setBillingLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Get tier features from translations
  const getTierFeatures = (tier: string): string[] => {
    switch (tier) {
      case "free":
        return [
          tBilling("features.free.repos"),
          tBilling("features.free.tasks"),
          tBilling("features.free.tokens"),
          tBilling("features.free.support"),
        ];
      case "pro":
        return [
          tBilling("features.pro.repos"),
          tBilling("features.pro.tasks"),
          tBilling("features.pro.tokens"),
          tBilling("features.pro.support"),
          tBilling("features.pro.analytics"),
        ];
      case "team":
        return [
          tBilling("features.team.repos"),
          tBilling("features.team.tasks"),
          tBilling("features.team.tokens"),
          tBilling("features.team.support"),
          tBilling("features.team.collaboration"),
          tBilling("features.team.integrations"),
        ];
      default:
        return [];
    }
  };

  // Fetch billing data
  useEffect(() => {
    async function fetchBillingData() {
      try {
        const [plansRes, subRes] = await Promise.all([
          fetch("/api/plans"),
          fetch("/api/user/subscription"),
        ]);

        if (plansRes.ok) {
          const plansData = await plansRes.json();
          setPlans(plansData);
        }

        if (subRes.ok) {
          const subData = await subRes.json();
          setSubscription(subData);
          setBillingMode(subData.billingMode || "byok");
        }
      } catch (error) {
        clientLogger.error("Failed to fetch billing data", { error });
      } finally {
        setBillingLoading(false);
      }
    }

    fetchBillingData();
  }, []);

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

  const handleCheckout = async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: tBilling("errors.checkoutTitle"),
          description: data.error || tBilling("errors.checkoutMessage"),
          variant: "destructive",
        });
      }
    } catch (error) {
      clientLogger.error("Checkout error", { error });
      toast({
        title: tBilling("errors.checkoutTitle"),
        description: tBilling("errors.checkoutMessage"),
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: tBilling("errors.billingTitle"),
          description: data.error || tBilling("errors.billingMessage"),
          variant: "destructive",
        });
      }
    } catch (error) {
      clientLogger.error("Portal error", { error });
      toast({
        title: tBilling("errors.billingTitle"),
        description: tBilling("errors.billingMessage"),
        variant: "destructive",
      });
    }
  };

  const filteredPlans = plans
    ? Object.values(plans.plans)
        .filter((plan) => plan.billingMode === billingMode)
        .sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier))
    : [];

  const currentTier = subscription?.plan?.tier || "free";

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

      {/* Billing & Subscription */}
      <div className="p-6 rounded-xl border bg-card" id="billing">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4" />
          <h3 className="font-serif font-semibold tracking-tight">
            {t("billing.title")}
          </h3>
        </div>

        {/* Current Usage */}
        <div className="mb-6">
          <UsageDashboard />
        </div>

        {billingLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Billing Mode Toggle */}
            <div className="flex items-center justify-center gap-2 p-1 rounded-lg bg-muted w-fit mx-auto mb-6">
              <button
                onClick={() => setBillingMode("byok")}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  billingMode === "byok"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tBilling("billingMode.byok")}
              </button>
              <button
                onClick={() => setBillingMode("managed")}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  billingMode === "managed"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tBilling("billingMode.managed")}
              </button>
            </div>

            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <span
                className={cn(
                  "text-sm",
                  billingCycle === "monthly"
                    ? "font-medium"
                    : "text-muted-foreground",
                )}
              >
                {tBilling("billingCycle.monthly")}
              </span>
              <button
                onClick={() =>
                  setBillingCycle((c) =>
                    c === "monthly" ? "yearly" : "monthly",
                  )
                }
                className={cn(
                  "relative inline-flex h-6 w-12 items-center rounded-full transition-colors",
                  billingCycle === "yearly" ? "bg-primary" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    billingCycle === "yearly"
                      ? "translate-x-7"
                      : "translate-x-1",
                  )}
                />
              </button>
              <span
                className={cn(
                  "text-sm",
                  billingCycle === "yearly"
                    ? "font-medium"
                    : "text-muted-foreground",
                )}
              >
                {tBilling("billingCycle.yearly")}
                <span className="ml-1 text-xs text-green-500">
                  {tBilling("billingCycle.save")}
                </span>
              </span>
            </div>

            {/* Plans Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              {filteredPlans.map((plan) => {
                const price =
                  billingCycle === "yearly"
                    ? plan.priceYearly / 12
                    : plan.priceMonthly;
                const isCurrentPlan = plan.tier === currentTier;
                const isUpgrade =
                  tierOrder.indexOf(plan.tier) > tierOrder.indexOf(currentTier);
                const features = getTierFeatures(plan.tier);

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative p-6 rounded-xl border bg-card",
                      plan.tier === "pro" && "border-primary shadow-lg",
                      isCurrentPlan && "ring-2 ring-primary",
                    )}
                  >
                    {plan.tier === "pro" && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                        {tBilling("plans.popular")}
                      </div>
                    )}

                    <div className="text-center mb-6">
                      <h3 className="text-lg font-semibold">{plan.name}</h3>
                      <div className="mt-2">
                        <span className="text-3xl font-bold">
                          {formatPrice(price)}
                        </span>
                        <span className="text-muted-foreground">
                          {tBilling("plans.perMonth")}
                        </span>
                      </div>
                      {billingCycle === "yearly" && plan.priceYearly > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {tBilling("plans.billedYearly", {
                            price: formatPrice(plan.priceYearly),
                          })}
                        </p>
                      )}
                    </div>

                    <ul className="space-y-3 mb-6">
                      {features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrentPlan ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleManageSubscription}
                        disabled={!subscription?.hasActiveSubscription}
                      >
                        <SettingsIcon className="w-4 h-4 mr-2" />
                        {subscription?.hasActiveSubscription
                          ? tBilling("plans.managePlan")
                          : tBilling("plans.currentPlan")}
                      </Button>
                    ) : plan.tier === "free" ? (
                      <Button variant="outline" className="w-full" disabled>
                        {tBilling("plans.freeForever")}
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleCheckout(plan.id)}
                        disabled={
                          !plans?.stripeEnabled ||
                          !plan.hasStripePrice ||
                          checkoutLoading !== null
                        }
                      >
                        {checkoutLoading === plan.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            {isUpgrade
                              ? tBilling("plans.upgrade")
                              : tBilling("plans.switch")}{" "}
                            {tBilling("plans.to")} {plan.name}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Manage Subscription */}
            {subscription?.hasActiveSubscription && (
              <div className="p-6 rounded-xl border bg-card mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-4 h-4" />
                  <h3 className="font-serif font-semibold tracking-tight">
                    {tBilling("billingDetails.title")}
                  </h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {tBilling("billingDetails.status")}
                    </span>
                    <span className="capitalize">
                      {subscription.subscription?.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {tBilling("billingDetails.cycle")}
                    </span>
                    <span className="capitalize">
                      {subscription.subscription?.billingCycle}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {tBilling("billingDetails.nextDate")}
                    </span>
                    <span>
                      {subscription.subscription?.currentPeriodEnd
                        ? new Date(
                            subscription.subscription.currentPeriodEnd,
                          ).toLocaleDateString()
                        : "-"}
                    </span>
                  </div>
                  {subscription.subscription?.cancelAtPeriodEnd && (
                    <p className="text-yellow-500 text-xs mt-2">
                      {tBilling("billingDetails.cancelNotice")}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={handleManageSubscription}
                >
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  {tBilling("billingDetails.manageBilling")}
                </Button>
              </div>
            )}

            {/* Stripe not configured notice */}
            {!plans?.stripeEnabled && (
              <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 text-sm text-center">
                <p className="text-yellow-600 dark:text-yellow-400">
                  {tBilling("notices.stripeNotConfigured")}
                </p>
              </div>
            )}
          </>
        )}
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
