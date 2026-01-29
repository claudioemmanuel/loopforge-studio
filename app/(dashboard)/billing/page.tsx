"use client";

import { useState, useEffect } from "react";
import { CreditCard, Check, Sparkles, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UsageDashboard } from "@/components/billing/usage-dashboard";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

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
const tierFeatures: Record<string, string[]> = {
  free: [
    "1 repository",
    "5 tasks per month",
    "50K tokens per month",
    "Community support",
  ],
  pro: [
    "5 repositories",
    "100 tasks per month",
    "2M tokens per month",
    "Priority support",
    "Advanced analytics",
  ],
  team: [
    "Unlimited repositories",
    "Unlimited tasks",
    "10M tokens per month",
    "Dedicated support",
    "Team collaboration",
    "Custom integrations",
  ],
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export default function SubscriptionPage() {
  const [plans, setPlans] = useState<PlansData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null,
  );
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [billingMode, setBillingMode] = useState<"byok" | "managed">("byok");
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
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
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

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
          title: "Checkout error",
          description: data.error || "Failed to start checkout",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Checkout error",
        description: "Failed to start checkout",
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
          title: "Billing error",
          description: data.error || "Failed to open billing portal",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Portal error:", error);
      toast({
        title: "Billing error",
        description: "Failed to open billing portal",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filteredPlans = plans
    ? Object.values(plans.plans)
        .filter((plan) => plan.billingMode === billingMode)
        .sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier))
    : [];

  const currentTier = subscription?.plan?.tier || "free";

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-bold tracking-tight">
          Subscription
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your plan and billing
        </p>
      </div>

      {/* Current Usage */}
      <UsageDashboard />

      {/* Billing Mode Toggle */}
      <div className="flex items-center justify-center gap-2 p-1 rounded-lg bg-muted w-fit mx-auto">
        <button
          onClick={() => setBillingMode("byok")}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
            billingMode === "byok"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Bring Your Own Key
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
          Managed AI
        </button>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center gap-4">
        <span
          className={cn(
            "text-sm",
            billingCycle === "monthly"
              ? "font-medium"
              : "text-muted-foreground",
          )}
        >
          Monthly
        </span>
        <button
          onClick={() =>
            setBillingCycle((c) => (c === "monthly" ? "yearly" : "monthly"))
          }
          className={cn(
            "relative w-12 h-6 rounded-full transition-colors",
            billingCycle === "yearly" ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
              billingCycle === "yearly" ? "translate-x-7" : "translate-x-1",
            )}
          />
        </button>
        <span
          className={cn(
            "text-sm",
            billingCycle === "yearly" ? "font-medium" : "text-muted-foreground",
          )}
        >
          Yearly
          <span className="ml-1 text-xs text-green-500">(Save 20%)</span>
        </span>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {filteredPlans.map((plan) => {
          const price =
            billingCycle === "yearly"
              ? plan.priceYearly / 12
              : plan.priceMonthly;
          const isCurrentPlan = plan.tier === currentTier;
          const isUpgrade =
            tierOrder.indexOf(plan.tier) > tierOrder.indexOf(currentTier);
          const features = tierFeatures[plan.tier] || [];

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
                  Popular
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">
                    {formatPrice(price)}
                  </span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                {billingCycle === "yearly" && plan.priceYearly > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Billed {formatPrice(plan.priceYearly)}/year
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
                  <Settings className="w-4 h-4 mr-2" />
                  {subscription?.hasActiveSubscription
                    ? "Manage Plan"
                    : "Current Plan"}
                </Button>
              ) : plan.tier === "free" ? (
                <Button variant="outline" className="w-full" disabled>
                  Free Forever
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
                      {isUpgrade ? "Upgrade" : "Switch"} to {plan.name}
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
        <div className="p-6 rounded-xl border bg-card">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4" />
            <h3 className="font-serif font-semibold tracking-tight">
              Billing Details
            </h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="capitalize">
                {subscription.subscription?.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Billing Cycle</span>
              <span className="capitalize">
                {subscription.subscription?.billingCycle}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Next Billing Date</span>
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
                Your subscription will cancel at the end of the billing period
              </p>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={handleManageSubscription}
          >
            <Settings className="w-4 h-4 mr-2" />
            Manage Billing
          </Button>
        </div>
      )}

      {/* Stripe not configured notice */}
      {!plans?.stripeEnabled && (
        <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 text-sm text-center">
          <p className="text-yellow-600 dark:text-yellow-400">
            Stripe is not configured. Plan upgrades are unavailable.
          </p>
        </div>
      )}
    </div>
  );
}
