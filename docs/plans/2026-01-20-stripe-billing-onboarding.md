# Stripe Billing & Revised Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Stripe subscription billing with a revised onboarding flow that offers users two paths: BYOK (free) or Managed API (paid subscription).

**Architecture:** Users choose their billing mode during onboarding. BYOK users provide their own Anthropic API key and use Loopforge free. Managed users subscribe via Stripe Checkout when they first try to execute a task, then use the app's shared API key. Stripe webhooks handle subscription lifecycle. Stripe Customer Portal handles billing management.

**Tech Stack:** Next.js 15, Stripe Checkout, Stripe Webhooks, Stripe Customer Portal, PostgreSQL, Drizzle ORM

---

## Task 1: Add Stripe Dependencies and Environment Variables

**Files:**
- Modify: `loopforge/package.json`
- Modify: `loopforge/.env.example`

**Step 1: Install Stripe SDK**

Run:
```bash
cd /Users/claudioemmanuel/Documents/GitHub/vamo-app/loopforge && npm install stripe
```

Expected: Package added to dependencies

**Step 2: Update .env.example with Stripe variables**

Add to `loopforge/.env.example` after the Redis section:

```env
# ===========================================
# Stripe (Required for Managed API billing)
# ===========================================
# Get these from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Webhook signing secret from Stripe Dashboard > Webhooks
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs from Stripe Dashboard > Products
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
STRIPE_TEAM_MONTHLY_PRICE_ID=price_...
STRIPE_TEAM_YEARLY_PRICE_ID=price_...

# App's Anthropic API key (used for Managed API subscribers)
APP_ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Step 3: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat: add Stripe SDK and environment variables"
```

---

## Task 2: Update Database Schema with Billing Mode

**Files:**
- Modify: `loopforge/lib/db/schema.ts`

**Step 1: Add billing_mode enum and column to users table**

In `loopforge/lib/db/schema.ts`, add after the existing enums (around line 44):

```typescript
export const billingModeEnum = pgEnum("billing_mode", ["byok", "managed"]);
```

**Step 2: Add billingMode column to users table**

Modify the users table definition to add after `onboardingCompleted`:

```typescript
  billingMode: billingModeEnum("billing_mode"), // null until onboarding completes
```

**Step 3: Add stripePriceId to subscription_plans table**

Add after the `features` column in `subscriptionPlans`:

```typescript
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
```

**Step 4: Export the new enum**

Add to the type exports section:

```typescript
export type BillingMode = "byok" | "managed";
```

**Step 5: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat(db): add billing_mode enum and stripe price IDs"
```

---

## Task 3: Generate and Run Database Migration

**Files:**
- Create: `loopforge/drizzle/0001_*.sql` (auto-generated)

**Step 1: Generate migration**

Run:
```bash
cd /Users/claudioemmanuel/Documents/GitHub/vamo-app/loopforge && npm run db:generate
```

Expected: New migration file created in drizzle/

**Step 2: Run migration**

Run:
```bash
npm run db:migrate
```

Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add drizzle/
git commit -m "feat(db): migration for billing_mode and stripe price IDs"
```

---

## Task 4: Update Seed Script - Remove Free Tier, Add Stripe Price IDs

**Files:**
- Modify: `loopforge/lib/db/seed.ts`

**Step 1: Rewrite seed script**

Replace entire contents of `loopforge/lib/db/seed.ts`:

```typescript
import { db, subscriptionPlans } from "./index";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding subscription plans...");

  // First, delete the free plan if it exists
  await db.delete(subscriptionPlans).where(eq(subscriptionPlans.name, "free"));
  console.log("  ✓ Removed free plan (no longer offered)");

  const plans = [
    {
      name: "pro",
      displayName: "Pro",
      priceMonthly: 3900, // $39.00
      priceYearly: 39000, // $390.00 (2 months free)
      taskLimit: 30,
      gracePercent: 10,
      features: [
        "30 tasks per month",
        "Priority AI assistance",
        "Email support",
        "Advanced analytics",
      ],
      stripePriceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || null,
      stripePriceIdYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || null,
      isActive: true,
    },
    {
      name: "team",
      displayName: "Team",
      priceMonthly: 12900, // $129.00
      priceYearly: 129000, // $1,290.00 (2 months free)
      taskLimit: 100,
      gracePercent: 10,
      features: [
        "100 tasks per month",
        "Premium AI assistance",
        "Priority support",
        "Advanced analytics",
        "Team collaboration",
        "API access",
      ],
      stripePriceIdMonthly: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID || null,
      stripePriceIdYearly: process.env.STRIPE_TEAM_YEARLY_PRICE_ID || null,
      isActive: true,
    },
  ];

  for (const plan of plans) {
    await db
      .insert(subscriptionPlans)
      .values(plan)
      .onConflictDoUpdate({
        target: subscriptionPlans.name,
        set: {
          displayName: plan.displayName,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          taskLimit: plan.taskLimit,
          gracePercent: plan.gracePercent,
          features: plan.features,
          stripePriceIdMonthly: plan.stripePriceIdMonthly,
          stripePriceIdYearly: plan.stripePriceIdYearly,
          isActive: plan.isActive,
          updatedAt: new Date(),
        },
      });
    console.log(`  ✓ ${plan.displayName} plan`);
  }

  console.log("\n✅ Subscription plans seeded successfully!");
  console.log("   Note: Free tier removed. Users choose BYOK or Managed billing.");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
```

**Step 2: Run seed to update plans**

Run:
```bash
npm run db:seed
```

Expected: Free plan removed, Pro and Team updated

**Step 3: Commit**

```bash
git add lib/db/seed.ts
git commit -m "feat(db): remove free tier, add Stripe price IDs to seed"
```

---

## Task 5: Create Stripe Client Library

**Files:**
- Create: `loopforge/lib/stripe.ts`

**Step 1: Create Stripe client**

Create `loopforge/lib/stripe.ts`:

```typescript
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});

export const STRIPE_CONFIG = {
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
  prices: {
    pro: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "",
    },
    team: {
      monthly: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID || "",
      yearly: process.env.STRIPE_TEAM_YEARLY_PRICE_ID || "",
    },
  },
} as const;
```

**Step 2: Commit**

```bash
git add lib/stripe.ts
git commit -m "feat: add Stripe client library"
```

---

## Task 6: Create Stripe Checkout API Endpoint

**Files:**
- Create: `loopforge/app/api/stripe/checkout/route.ts`

**Step 1: Create checkout endpoint**

Create `loopforge/app/api/stripe/checkout/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { db, users, subscriptionPlans, userSubscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";

interface CheckoutRequest {
  planName: "pro" | "team";
  billingCycle: "monthly" | "yearly";
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: CheckoutRequest = await request.json();
    const { planName, billingCycle } = body;

    // Get the plan from database
    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.name, planName),
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const priceId = billingCycle === "yearly"
      ? plan.stripePriceIdYearly
      : plan.stripePriceIdMonthly;

    if (!priceId) {
      return NextResponse.json(
        { error: "Price not configured for this plan" },
        { status: 400 }
      );
    }

    // Check if user already has a Stripe customer ID
    const existingSubscription = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.userId, session.user.id),
    });

    // Get user email for Stripe
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    // Create Stripe Checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer: existingSubscription?.stripeCustomerId || undefined,
      customer_email: existingSubscription?.stripeCustomerId ? undefined : user?.email || undefined,
      client_reference_id: session.user.id,
      metadata: {
        userId: session.user.id,
        planId: plan.id,
        planName: plan.name,
        billingCycle,
      },
      success_url: `${process.env.NEXTAUTH_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/subscription/cancel`,
      subscription_data: {
        metadata: {
          userId: session.user.id,
          planId: plan.id,
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/stripe/checkout/route.ts
git commit -m "feat: add Stripe Checkout API endpoint"
```

---

## Task 7: Create Stripe Webhook Handler

**Files:**
- Create: `loopforge/app/api/webhooks/stripe/route.ts`

**Step 1: Create webhook handler**

Create `loopforge/app/api/webhooks/stripe/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { db, users, userSubscriptions, subscriptionPlans } from "@/lib/db";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;
  const billingCycle = session.metadata?.billingCycle as "monthly" | "yearly";

  if (!userId || !planId || !session.subscription || !session.customer) {
    console.error("Missing data in checkout session", { userId, planId });
    return;
  }

  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription.id;

  const customerId = typeof session.customer === "string"
    ? session.customer
    : session.customer.id;

  // Fetch subscription details from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Create or update user subscription
  const existingSubscription = await db.query.userSubscriptions.findFirst({
    where: eq(userSubscriptions.userId, userId),
  });

  const subscriptionData = {
    userId,
    planId,
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    billingCycle,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    status: "active" as const,
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    updatedAt: new Date(),
  };

  if (existingSubscription) {
    await db
      .update(userSubscriptions)
      .set(subscriptionData)
      .where(eq(userSubscriptions.userId, userId));
  } else {
    await db.insert(userSubscriptions).values(subscriptionData);
  }

  // Update user billing mode to managed
  await db
    .update(users)
    .set({ billingMode: "managed", updatedAt: new Date() })
    .where(eq(users.id, userId));

  console.log(`Subscription created for user ${userId}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error("Missing userId in subscription metadata");
    return;
  }

  const status = subscription.status === "active" ? "active"
    : subscription.status === "past_due" ? "past_due"
    : subscription.status === "canceled" ? "canceled"
    : "active";

  await db
    .update(userSubscriptions)
    .set({
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id));

  console.log(`Subscription updated for user ${userId}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error("Missing userId in subscription metadata");
    return;
  }

  await db
    .update(userSubscriptions)
    .set({
      status: "canceled",
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id));

  console.log(`Subscription canceled for user ${userId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription;

  if (!subscriptionId || typeof subscriptionId !== "string") {
    return;
  }

  await db
    .update(userSubscriptions)
    .set({
      status: "past_due",
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.stripeSubscriptionId, subscriptionId));

  console.log(`Payment failed for subscription ${subscriptionId}`);
}
```

**Step 2: Commit**

```bash
git add app/api/webhooks/stripe/route.ts
git commit -m "feat: add Stripe webhook handler"
```

---

## Task 8: Create Customer Portal API Endpoint

**Files:**
- Create: `loopforge/app/api/stripe/portal/route.ts`

**Step 1: Create portal endpoint**

Create `loopforge/app/api/stripe/portal/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { db, userSubscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get user's Stripe customer ID
    const subscription = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.userId, session.user.id),
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    // Create Stripe Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/settings`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Portal error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/stripe/portal/route.ts
git commit -m "feat: add Stripe Customer Portal API endpoint"
```

---

## Task 9: Revise Onboarding Page - Step 1 (Billing Mode Selection)

**Files:**
- Modify: `loopforge/app/(auth)/onboarding/page.tsx`

**Step 1: Rewrite onboarding page**

Replace entire contents of `loopforge/app/(auth)/onboarding/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Search,
  Star,
  Lock,
  Globe,
  Building2,
  Check,
  Loader2,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Key,
  Shield,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { LoopforgeLogo } from "@/components/loopforge-logo";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
    type: string;
  };
}

type FilterType = "all" | "public" | "private" | "org";
type BillingMode = "byok" | "managed";
type Step = "billing" | "repos" | "apikey";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("billing");
  const [billingMode, setBillingMode] = useState<BillingMode | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingRepos, setFetchingRepos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const fetchRepos = async () => {
    setFetchingRepos(true);
    setError(null);
    try {
      const res = await fetch("/api/github/repos");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch repositories");
      }
      const data = await res.json();
      setRepos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setFetchingRepos(false);
    }
  };

  // Group repos by owner
  const groupedRepos = useMemo(() => {
    const filtered = repos.filter((repo) => {
      const matchesSearch =
        searchQuery === "" ||
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (repo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      const matchesFilter =
        filter === "all" ||
        (filter === "public" && !repo.private) ||
        (filter === "private" && repo.private) ||
        (filter === "org" && repo.owner.type === "Organization");

      return matchesSearch && matchesFilter;
    });

    const groups: Record<string, { owner: GitHubRepo["owner"]; repos: GitHubRepo[] }> = {};
    filtered.forEach((repo) => {
      if (!groups[repo.owner.login]) {
        groups[repo.owner.login] = { owner: repo.owner, repos: [] };
      }
      groups[repo.owner.login].repos.push(repo);
    });

    return Object.values(groups);
  }, [repos, searchQuery, filter]);

  const toggleRepo = (repoId: number) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  const handleBillingSelect = (mode: BillingMode) => {
    setBillingMode(mode);
    setStep("repos");
    fetchRepos();
  };

  const handleReposContinue = () => {
    if (selectedRepos.size === 0) {
      setError("Please select at least one repository");
      return;
    }
    if (billingMode === "byok") {
      setStep("apikey");
    } else {
      // Managed mode - complete onboarding, will prompt for subscription on first execute
      handleComplete(null);
    }
  };

  const handleComplete = async (providedApiKey: string | null) => {
    setLoading(true);
    setError(null);

    try {
      const selectedReposList = repos.filter((r) => selectedRepos.has(r.id));

      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repos: selectedReposList,
          apiKey: providedApiKey,
          billingMode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to complete onboarding");
      }

      const { repoId } = await res.json();
      router.push(`/repos/${repoId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const getStepNumber = () => {
    if (step === "billing") return 1;
    if (step === "repos") return 2;
    return 3;
  };

  const getTotalSteps = () => {
    return billingMode === "byok" ? 3 : 2;
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background to-secondary/30">
      <div className="mb-6 flex flex-col items-center">
        <LoopforgeLogo size="lg" animate={true} showSparks={true} showText={false} />
        <h1 className="text-3xl font-serif font-bold tracking-tight !-mt-2">
          <span className="text-primary">Loop</span>forge
        </h1>
      </div>

      <Card className="w-full max-w-3xl">
        <CardHeader>
          {/* Progress indicator */}
          <div className="flex items-center gap-4 mb-2">
            {[1, 2, 3].slice(0, getTotalSteps()).map((num, idx) => (
              <div key={num} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    getStepNumber() === num
                      ? "bg-primary text-primary-foreground"
                      : getStepNumber() > num
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {getStepNumber() > num ? <Check className="w-4 h-4" /> : num}
                </div>
                <span className="text-sm hidden sm:inline">
                  {num === 1 && "Choose Mode"}
                  {num === 2 && "Select Repos"}
                  {num === 3 && billingMode === "byok" && "API Key"}
                </span>
                {idx < getTotalSteps() - 1 && <div className="h-px flex-1 bg-border" />}
              </div>
            ))}
          </div>

          <CardTitle>
            {step === "billing" && "How would you like to use Loopforge?"}
            {step === "repos" && "Select Repositories"}
            {step === "apikey" && "Configure API Key"}
          </CardTitle>
          <CardDescription>
            {step === "billing" && "Choose how you want to power your AI coding assistant"}
            {step === "repos" && "Choose which repositories to connect with Loopforge"}
            {step === "apikey" && "Enter your Anthropic API key for AI-powered coding"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Billing Mode Selection */}
          {step === "billing" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* BYOK Option */}
                <button
                  onClick={() => handleBillingSelect("byok")}
                  className="p-6 text-left rounded-xl border-2 hover:border-primary/50 hover:bg-muted/50 transition-all group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Key className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Bring Your Own Key</h3>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Free forever</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Use your own Anthropic API key. You pay Anthropic directly for usage (~$0.01-0.10 per task).
                  </p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      Unlimited tasks
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      Full control over costs
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      Your key, your data
                    </li>
                  </ul>
                  <div className="mt-4 flex items-center text-sm font-medium text-primary group-hover:underline">
                    Get started <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </button>

                {/* Managed Option */}
                <button
                  onClick={() => handleBillingSelect("managed")}
                  className="p-6 text-left rounded-xl border-2 hover:border-primary/50 hover:bg-muted/50 transition-all group relative"
                >
                  <div className="absolute -top-3 right-4 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                    Recommended
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Managed API</h3>
                      <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">From $39/month</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    We handle the API. Simple monthly subscription with predictable costs.
                  </p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-violet-500" />
                      No API key needed
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-violet-500" />
                      Pro: 30 tasks/mo • Team: 100 tasks/mo
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-violet-500" />
                      Priority support
                    </li>
                  </ul>
                  <div className="mt-4 flex items-center text-sm font-medium text-primary group-hover:underline">
                    Get started <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </button>
              </div>

              <div className="pt-4 border-t">
                <Button variant="ghost" onClick={() => router.push("/welcome")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Repository Selection */}
          {step === "repos" && (
            <div className="space-y-4">
              {/* Search and filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search repositories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-1">
                  {(["all", "public", "private", "org"] as FilterType[]).map((f) => (
                    <Button
                      key={f}
                      variant={filter === f ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setFilter(f)}
                      className="capitalize"
                    >
                      {f === "org" ? (
                        <Building2 className="w-4 h-4 mr-1" />
                      ) : f === "private" ? (
                        <Lock className="w-4 h-4 mr-1" />
                      ) : f === "public" ? (
                        <Globe className="w-4 h-4 mr-1" />
                      ) : null}
                      {f}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Repository list */}
              {fetchingRepos ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : groupedRepos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {repos.length === 0
                    ? "No repositories found"
                    : "No repositories match your search"}
                </div>
              ) : (
                <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
                  {groupedRepos.map(({ owner, repos: ownerRepos }) => (
                    <div key={owner.login} className="space-y-2">
                      <div className="flex items-center gap-2 sticky top-0 bg-background py-1">
                        <img
                          src={owner.avatar_url}
                          alt={owner.login}
                          className="w-5 h-5 rounded-full"
                        />
                        <span className="text-sm font-medium">{owner.login}</span>
                        {owner.type === "Organization" && (
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-1 ml-7">
                        {ownerRepos.map((repo) => (
                          <button
                            key={repo.id}
                            onClick={() => toggleRepo(repo.id)}
                            className={`w-full p-3 text-left rounded-lg border transition-all ${
                              selectedRepos.has(repo.id)
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "hover:border-primary/50 hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium truncate">{repo.name}</span>
                                  {repo.private ? (
                                    <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                  ) : (
                                    <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                  )}
                                </div>
                                {repo.description && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {repo.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  {repo.language && (
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-primary" />
                                      {repo.language}
                                    </span>
                                  )}
                                  {repo.stargazers_count > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Star className="w-3 h-3" />
                                      {repo.stargazers_count}
                                    </span>
                                  )}
                                  <span>Updated {formatDate(repo.updated_at)}</span>
                                </div>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                  selectedRepos.has(repo.id)
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-muted-foreground/30"
                                }`}
                              >
                                {selectedRepos.has(repo.id) && <Check className="w-3 h-3" />}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selection summary and continue */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {selectedRepos.size === 0
                    ? "No repositories selected"
                    : `${selectedRepos.size} ${selectedRepos.size === 1 ? "repository" : "repositories"} selected`}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStep("billing")}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={handleReposContinue} disabled={selectedRepos.size === 0 || loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        {billingMode === "managed" ? "Complete Setup" : "Continue"}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: API Key (BYOK only) */}
          {step === "apikey" && (
            <div className="space-y-6">
              {/* Step 1: Open Anthropic Console */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    1
                  </div>
                  <h3 className="font-medium">Open Anthropic Console</h3>
                </div>
                <div className="ml-8 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Go to the Anthropic Console and sign in or create an account.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href="https://console.anthropic.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2"
                    >
                      Open Anthropic Console
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </div>

              {/* Step 2: Create API Key */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                  <h3 className="font-medium">Create an API Key</h3>
                </div>
                <div className="ml-8 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Navigate to <strong>Settings</strong> → <strong>API Keys</strong> → <strong>Create Key</strong>
                  </p>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Key className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Suggested name:</span>
                      <code className="px-1.5 py-0.5 bg-background rounded text-sm font-mono">Loopforge</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Paste API Key */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    3
                  </div>
                  <h3 className="font-medium">Paste your API Key</h3>
                </div>
                <div className="ml-8 space-y-3">
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sk-ant-api03-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="w-4 h-4 text-green-600 dark:text-green-500" />
                    <span>Your API key is encrypted with AES-256-GCM before storage</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t">
                <Button variant="ghost" onClick={() => setStep("repos")} disabled={loading}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => handleComplete(apiKey)}
                  disabled={!apiKey || loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add app/\(auth\)/onboarding/page.tsx
git commit -m "feat: revise onboarding with BYOK vs Managed billing choice"
```

---

## Task 10: Update Onboarding Complete API Endpoint

**Files:**
- Modify: `loopforge/app/api/onboarding/complete/route.ts`

**Step 1: Update to handle billingMode**

Replace contents of `loopforge/app/api/onboarding/complete/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users, repos } from "@/lib/db";
import { encryptApiKey } from "@/lib/crypto";
import { eq } from "drizzle-orm";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
}

interface CompleteOnboardingRequest {
  repos: GitHubRepo[];
  apiKey: string | null;
  billingMode: "byok" | "managed";
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: CompleteOnboardingRequest = await request.json();
    const { repos: reposList, apiKey, billingMode } = body;

    if (!reposList || reposList.length === 0) {
      return NextResponse.json(
        { error: "At least one repository is required" },
        { status: 400 }
      );
    }

    if (!billingMode || !["byok", "managed"].includes(billingMode)) {
      return NextResponse.json(
        { error: "Invalid billing mode" },
        { status: 400 }
      );
    }

    // BYOK mode requires API key
    if (billingMode === "byok" && !apiKey) {
      return NextResponse.json(
        { error: "API key is required for BYOK mode" },
        { status: 400 }
      );
    }

    // Update user with billing mode and API key (if BYOK)
    const updateData: Record<string, unknown> = {
      billingMode,
      onboardingCompleted: true,
      updatedAt: new Date(),
    };

    if (billingMode === "byok" && apiKey) {
      const encrypted = encryptApiKey(apiKey);
      updateData.encryptedApiKey = encrypted.encrypted;
      updateData.apiKeyIv = encrypted.iv;
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, session.user.id));

    // Create repo records
    const repoIds: string[] = [];
    for (const repoData of reposList) {
      const repoId = crypto.randomUUID();
      repoIds.push(repoId);

      await db.insert(repos).values({
        id: repoId,
        userId: session.user.id,
        githubRepoId: String(repoData.id),
        name: repoData.name,
        fullName: repoData.full_name,
        defaultBranch: repoData.default_branch,
        cloneUrl: repoData.clone_url,
        isPrivate: repoData.private,
      });
    }

    return NextResponse.json({
      repoId: repoIds[0],
      repoIds,
      billingMode,
      success: true,
    });
  } catch (error) {
    console.error("Error completing onboarding:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/onboarding/complete/route.ts
git commit -m "feat: update onboarding API to handle billingMode"
```

---

## Task 11: Update Execute Endpoint with Subscription Gate

**Files:**
- Modify: `loopforge/app/api/tasks/[taskId]/execute/route.ts`

**Step 1: Add subscription check**

Replace contents of `loopforge/app/api/tasks/[taskId]/execute/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users, executions, userSubscriptions, usageRecords } from "@/lib/db";
import { eq, and, gte, count } from "drizzle-orm";
import { queueExecution } from "@/lib/queue";
import { decryptApiKey } from "@/lib/crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user with subscription info
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    with: {
      subscription: {
        with: {
          plan: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get task with repo to verify ownership
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (task.status !== "ready") {
    return NextResponse.json(
      { error: "Task must be in ready status to execute" },
      { status: 400 }
    );
  }

  if (!task.planContent) {
    return NextResponse.json(
      { error: "Task must have a plan to execute" },
      { status: 400 }
    );
  }

  // Determine API key based on billing mode
  let apiKey: string;

  if (user.billingMode === "byok") {
    // BYOK: Use user's own API key
    if (!user.encryptedApiKey || !user.apiKeyIv) {
      return NextResponse.json(
        { error: "API key not configured. Please add your Anthropic API key in settings." },
        { status: 400 }
      );
    }
    apiKey = decryptApiKey({
      encrypted: user.encryptedApiKey,
      iv: user.apiKeyIv,
    });
  } else if (user.billingMode === "managed") {
    // Managed: Check subscription status
    const subscription = user.subscription;

    if (!subscription || subscription.status !== "active") {
      return NextResponse.json(
        {
          error: "subscription_required",
          message: "An active subscription is required to execute tasks.",
          redirectTo: "/subscription"
        },
        { status: 402 }
      );
    }

    // Check usage limits
    const periodStart = subscription.currentPeriodStart;
    const taskLimit = subscription.plan.taskLimit;
    const gracePercent = subscription.plan.gracePercent;
    const effectiveLimit = Math.floor(taskLimit * (1 + gracePercent / 100));

    // Count tasks executed this period
    const [usageCount] = await db
      .select({ count: count() })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.userId, session.user.id),
          gte(usageRecords.periodStart, periodStart)
        )
      );

    if (usageCount.count >= effectiveLimit) {
      return NextResponse.json(
        {
          error: "limit_exceeded",
          message: `You've reached your plan limit of ${taskLimit} tasks (with ${gracePercent}% grace period). Please upgrade your plan.`,
          usage: usageCount.count,
          limit: taskLimit,
          effectiveLimit,
        },
        { status: 429 }
      );
    }

    // Use app's API key
    if (!process.env.APP_ANTHROPIC_API_KEY) {
      console.error("APP_ANTHROPIC_API_KEY is not configured");
      return NextResponse.json(
        { error: "Service configuration error" },
        { status: 500 }
      );
    }
    apiKey = process.env.APP_ANTHROPIC_API_KEY;
  } else {
    // Billing mode not set - shouldn't happen after onboarding
    return NextResponse.json(
      { error: "Please complete onboarding first" },
      { status: 400 }
    );
  }

  try {
    // Create execution record
    const executionId = crypto.randomUUID();
    await db.insert(executions).values({
      id: executionId,
      taskId: task.id,
      status: "queued",
      iteration: 0,
      createdAt: new Date(),
    });

    // Record usage for managed users
    if (user.billingMode === "managed" && user.subscription) {
      await db.insert(usageRecords).values({
        userId: session.user.id,
        taskId: task.id,
        periodStart: user.subscription.currentPeriodStart,
        inputTokens: 0, // Will be updated by worker
        outputTokens: 0,
        costCents: 0,
      });
    }

    // Update task status
    await db
      .update(tasks)
      .set({
        status: "executing",
        branch: `loopforge/${task.id.slice(0, 8)}`,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Queue the execution job
    const job = await queueExecution({
      executionId,
      taskId: task.id,
      repoId: task.repoId,
      userId: session.user.id,
      apiKey,
      planContent: task.planContent,
      branch: `loopforge/${task.id.slice(0, 8)}`,
      cloneUrl: task.repo.cloneUrl,
    });

    const updatedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    return NextResponse.json({
      ...updatedTask,
      executionId,
      jobId: job.id,
    });
  } catch (error) {
    console.error("Execution error:", error);

    // Revert status on error
    await db
      .update(tasks)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    return NextResponse.json(
      { error: "Failed to start execution" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/tasks/\[taskId\]/execute/route.ts
git commit -m "feat: add subscription gate to execute endpoint"
```

---

## Task 12: Create Subscription Page for Managed Users

**Files:**
- Create: `loopforge/app/(dashboard)/subscription/page.tsx`

**Step 1: Create subscription page**

Create `loopforge/app/(dashboard)/subscription/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, Sparkles, Zap } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  displayName: string;
  priceMonthly: number;
  priceYearly: number;
  taskLimit: number;
  features: string[];
}

export default function SubscriptionPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/subscription/plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planName: string) => {
    setCheckoutLoading(planName);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName, billingCycle }),
      });

      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      } else {
        console.error("Checkout failed");
      }
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
        <p className="text-muted-foreground">
          Subscribe to start executing tasks with Loopforge
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <button
          onClick={() => setBillingCycle("monthly")}
          className={`px-4 py-2 rounded-lg transition-colors ${
            billingCycle === "monthly"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingCycle("yearly")}
          className={`px-4 py-2 rounded-lg transition-colors ${
            billingCycle === "yearly"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Yearly
          <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
            Save 17%
          </span>
        </button>
      </div>

      {/* Plans */}
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
              <div className="flex items-center gap-2">
                {plan.name === "pro" ? (
                  <Zap className="w-5 h-5 text-violet-500" />
                ) : (
                  <Sparkles className="w-5 h-5 text-amber-500" />
                )}
                <CardTitle>{plan.displayName}</CardTitle>
              </div>
              <CardDescription>
                {plan.taskLimit} tasks per month
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <span className="text-4xl font-bold">
                  {formatPrice(billingCycle === "yearly" ? plan.priceYearly / 12 : plan.priceMonthly)}
                </span>
                <span className="text-muted-foreground">/month</span>
                {billingCycle === "yearly" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Billed {formatPrice(plan.priceYearly)} annually
                  </p>
                )}
              </div>

              <ul className="space-y-2">
                {plan.features?.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.name === "team" ? "default" : "outline"}
                onClick={() => handleSubscribe(plan.name)}
                disabled={checkoutLoading !== null}
              >
                {checkoutLoading === plan.name ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  `Subscribe to ${plan.displayName}`
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground mt-8">
        All plans include a 10% grace period on task limits. Cancel anytime.
      </p>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/\(dashboard\)/subscription/page.tsx
git commit -m "feat: add subscription page for plan selection"
```

---

## Task 13: Create Plans API Endpoint

**Files:**
- Create: `loopforge/app/api/subscription/plans/route.ts`

**Step 1: Create plans endpoint**

Create `loopforge/app/api/subscription/plans/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db, subscriptionPlans } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const plans = await db.query.subscriptionPlans.findMany({
      where: eq(subscriptionPlans.isActive, true),
      orderBy: (plans, { asc }) => [asc(plans.priceMonthly)],
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/subscription/plans/route.ts
git commit -m "feat: add subscription plans API endpoint"
```

---

## Task 14: Create Subscription Success/Cancel Pages

**Files:**
- Create: `loopforge/app/(dashboard)/subscription/success/page.tsx`
- Create: `loopforge/app/(dashboard)/subscription/cancel/page.tsx`

**Step 1: Create success page**

Create `loopforge/app/(dashboard)/subscription/success/page.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function SubscriptionSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Refresh the page data after a short delay to ensure webhook has processed
    const timer = setTimeout(() => {
      router.refresh();
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="container max-w-md py-16">
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Subscription Active!</CardTitle>
          <CardDescription>
            Thank you for subscribing to Loopforge. You can now execute tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push("/")} className="w-full">
            Go to Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Create cancel page**

Create `loopforge/app/(dashboard)/subscription/cancel/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, ArrowLeft, ArrowRight } from "lucide-react";

export default function SubscriptionCancelPage() {
  const router = useRouter();

  return (
    <div className="container max-w-md py-16">
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Checkout Cancelled</CardTitle>
          <CardDescription>
            No worries! You can subscribe anytime when you're ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => router.push("/subscription")} variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Plans
          </Button>
          <Button onClick={() => router.push("/")} className="w-full">
            Go to Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/\(dashboard\)/subscription/success/page.tsx app/\(dashboard\)/subscription/cancel/page.tsx
git commit -m "feat: add subscription success and cancel pages"
```

---

## Task 15: Final Integration Test

**Step 1: Start development environment**

Run:
```bash
cd /Users/claudioemmanuel/Documents/GitHub/vamo-app/loopforge
docker compose -f docker-compose.dev.yml up -d
npm run dev
```

**Step 2: Test BYOK flow**

1. Go to `/onboarding`
2. Select "Bring Your Own Key"
3. Select a repository
4. Enter API key
5. Complete setup
6. Verify user has `billing_mode = 'byok'`

**Step 3: Test Managed flow (without Stripe keys)**

1. Create new user or reset onboarding
2. Select "Managed API"
3. Select a repository
4. Complete setup
5. Try to execute a task
6. Verify 402 response with `subscription_required`

**Step 4: Commit final state**

```bash
git add -A
git commit -m "feat: complete Stripe billing and revised onboarding implementation"
```

---

## Summary

This plan implements:

1. **Revised onboarding** with two paths: BYOK (free) and Managed (subscription)
2. **Stripe Checkout** integration for subscription purchases
3. **Stripe Webhook** handler for subscription lifecycle events
4. **Stripe Customer Portal** for subscription management
5. **Subscription gate** on task execution for Managed users
6. **Usage tracking** against plan limits with 10% grace period

**Files created/modified:**
- `package.json` - Added Stripe dependency
- `.env.example` - Added Stripe environment variables
- `lib/db/schema.ts` - Added billing_mode enum and stripe price IDs
- `lib/db/seed.ts` - Removed free tier, added Stripe price IDs
- `lib/stripe.ts` - Stripe client library
- `app/api/stripe/checkout/route.ts` - Checkout session creation
- `app/api/stripe/portal/route.ts` - Customer portal session
- `app/api/webhooks/stripe/route.ts` - Webhook handler
- `app/api/subscription/plans/route.ts` - Plans listing
- `app/(auth)/onboarding/page.tsx` - Revised with billing mode selection
- `app/api/onboarding/complete/route.ts` - Updated for billing mode
- `app/api/tasks/[taskId]/execute/route.ts` - Added subscription gate
- `app/(dashboard)/subscription/page.tsx` - Plan selection UI
- `app/(dashboard)/subscription/success/page.tsx` - Success confirmation
- `app/(dashboard)/subscription/cancel/page.tsx` - Cancel handling
