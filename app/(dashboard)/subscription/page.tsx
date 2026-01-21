"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  Check,
  Loader2,
  CreditCard,
  Settings,
  Zap,
  ArrowRight,
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  displayName: string;
  priceMonthly: number;
  priceYearly: number;
  taskLimit: number;
  features: string[];
}

interface Subscription {
  id: string;
  planId: string;
  plan: Plan;
  billingCycle: "monthly" | "yearly";
  status: "active" | "canceled" | "past_due" | "trialing";
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface UserData {
  billingMode: "byok" | "managed" | null;
  subscription: Subscription | null;
}

export default function SubscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, userRes] = await Promise.all([
        fetch("/api/plans"),
        fetch("/api/user/subscription"),
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData.plans);
      }

      if (userRes.ok) {
        const userData = await userRes.json();
        setUserData(userData);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load subscription data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planName: string) => {
    setCheckoutLoading(planName);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName, billingCycle }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.portalUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPortalLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // BYOK users shouldn't see subscription page
  if (userData?.billingMode === "byok") {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Bring Your Own Key</CardTitle>
            <CardDescription>
              You&apos;re using your own Anthropic API key for unlimited tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Since you&apos;re using BYOK mode, you don&apos;t need a subscription.
              Your API usage is billed directly by Anthropic.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => router.push("/settings")}>
              <Settings className="w-4 h-4 mr-2" />
              Update API Key
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Show current subscription for managed users
  if (userData?.subscription) {
    const sub = userData.subscription;
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Your Subscription</CardTitle>
            <CardDescription>
              Manage your Loopforge subscription
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <div className="font-semibold text-lg">{sub.plan.displayName} Plan</div>
                <div className="text-sm text-muted-foreground">
                  {sub.billingCycle === "monthly" ? "Monthly" : "Yearly"} billing
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {formatPrice(
                    sub.billingCycle === "monthly"
                      ? sub.plan.priceMonthly
                      : sub.plan.priceYearly
                  )}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{sub.billingCycle === "monthly" ? "mo" : "yr"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-medium ${
                  sub.status === "active" ? "text-green-600" :
                  sub.status === "past_due" ? "text-yellow-600" :
                  "text-red-600"
                }`}>
                  {sub.status === "active" ? "Active" :
                   sub.status === "past_due" ? "Past Due" :
                   sub.status === "canceled" ? "Canceled" :
                   "Trialing"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Task Limit</span>
                <span className="font-medium">{sub.plan.taskLimit} tasks/month</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {sub.cancelAtPeriodEnd ? "Ends on" : "Renews on"}
                </span>
                <span className="font-medium">{formatDate(sub.currentPeriodEnd)}</span>
              </div>
              {sub.cancelAtPeriodEnd && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-200 text-sm rounded-lg">
                  Your subscription will cancel at the end of the current period.
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleManageSubscription} disabled={portalLoading}>
              {portalLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Manage Subscription
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // No subscription - show plans
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
        <p className="text-muted-foreground">
          Select a subscription to start using Loopforge with managed AI
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-destructive/10 text-destructive rounded-md text-sm text-center">
          {error}
        </div>
      )}

      {/* Billing Toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex items-center p-1 bg-muted rounded-lg">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              billingCycle === "monthly"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              billingCycle === "yearly"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Yearly
            <span className="ml-1 text-xs text-green-600 dark:text-green-400">
              (2 months free)
            </span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${plan.name === "team" ? "border-primary" : ""}`}
          >
            {plan.name === "team" && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                Most Popular
              </div>
            )}
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className={`w-5 h-5 ${plan.name === "team" ? "text-primary" : "text-muted-foreground"}`} />
                {plan.displayName}
              </CardTitle>
              <CardDescription>
                {plan.taskLimit} tasks per month
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-4xl font-bold">
                  {formatPrice(billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly)}
                </span>
                <span className="text-muted-foreground">
                  /{billingCycle === "monthly" ? "month" : "year"}
                </span>
              </div>

              <ul className="space-y-2">
                {plan.features?.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => handleSubscribe(plan.name)}
                disabled={checkoutLoading !== null}
                className="w-full"
                variant={plan.name === "team" ? "default" : "outline"}
              >
                {checkoutLoading === plan.name ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
