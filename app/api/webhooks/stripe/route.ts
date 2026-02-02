/**
 * Stripe Webhook Handler
 * Handles subscription lifecycle events from Stripe
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripeClient } from "@/lib/stripe/client";
import { db, users, repos } from "@/lib/db";
import { eq, count } from "drizzle-orm";
import { apiLogger } from "@/lib/logger";
import { getMaxReposForTier } from "@/lib/api/subscription-limits";
import type Stripe from "stripe";
import type { SubscriptionTier } from "@/lib/stripe/client";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRICE_PRO || "";
const STRIPE_ENTERPRISE_PRICE_ID = process.env.STRIPE_PRICE_ENTERPRISE || "";

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      apiLogger.error("Stripe not configured");
      return NextResponse.json(
        { error: "Billing not configured" },
        { status: 503 },
      );
    }

    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      apiLogger.error("Missing stripe-signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    if (!webhookSecret) {
      apiLogger.error("STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 },
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
      const error = err as { message?: string };
      apiLogger.error({ error: err }, "Webhook signature verification failed");
      return NextResponse.json(
        { error: `Webhook Error: ${error.message || "Unknown error"}` },
        { status: 400 },
      );
    }

    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(
          event.data.object as Stripe.Subscription,
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      default:
        apiLogger.info({ type: event.type }, "Unhandled webhook event type");
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    apiLogger.error({ error }, "Error processing webhook");
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}

/**
 * Handle subscription creation or update
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;

  // Map price ID to tier
  let tier: SubscriptionTier = "free";
  if (priceId === STRIPE_PRO_PRICE_ID) {
    tier = "pro";
  } else if (priceId === STRIPE_ENTERPRISE_PRICE_ID) {
    tier = "enterprise";
  }

  const status = subscription.status;
  const isActive = status === "active" || status === "trialing";

  // Get current user to check for downgrade
  const user = await db.query.users.findFirst({
    where: eq(users.stripeCustomerId, customerId),
  });

  if (!user) {
    apiLogger.error({ customerId }, "User not found for customer ID");
    return;
  }

  const currentTier = (user.subscriptionTier || "free") as SubscriptionTier;

  // Check if this is a downgrade
  if (isActive && tier !== currentTier) {
    const newMaxRepos = getMaxReposForTier(tier);
    const currentMaxRepos = getMaxReposForTier(currentTier);

    // Only check if downgrading (lower max repos)
    if (newMaxRepos !== -1 && newMaxRepos < currentMaxRepos) {
      // Count current repos
      const repoCountResult = await db
        .select({ count: count() })
        .from(repos)
        .where(eq(repos.userId, user.id));

      const currentRepoCount = repoCountResult[0]?.count || 0;

      if (currentRepoCount > newMaxRepos) {
        // Block downgrade - user has too many repos
        apiLogger.warn(
          {
            customerId,
            userId: user.id,
            currentTier,
            newTier: tier,
            currentRepoCount,
            newMaxRepos,
          },
          "Downgrade blocked: user exceeds new tier repo limit",
        );

        // Cancel the subscription immediately
        await stripe.subscriptions.cancel(subscription.id, {
          prorate: true,
        });

        // Send notification email (if email service is configured)
        // TODO: Send email to user.email explaining the issue

        return;
      }
    }
  }

  // Only update tier if subscription is active
  const updateData: {
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    subscriptionTier?: SubscriptionTier;
  } = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
  };

  if (isActive) {
    updateData.subscriptionTier = tier;
  }

  await db
    .update(users)
    .set(updateData)
    .where(eq(users.stripeCustomerId, customerId));

  apiLogger.info(
    {
      customerId,
      tier,
      subscriptionId: subscription.id,
      status,
    },
    "Subscription updated",
  );
}

/**
 * Handle subscription deletion (downgrade to free)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  await db
    .update(users)
    .set({
      subscriptionTier: "free",
      stripeSubscriptionId: null,
    })
    .where(eq(users.stripeCustomerId, customerId));

  apiLogger.info(
    {
      customerId,
      subscriptionId: subscription.id,
    },
    "Subscription deleted, downgraded to free",
  );
}

/**
 * Handle successful checkout completion
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!subscriptionId) {
    // One-time payment, not a subscription
    return;
  }

  // Fetch the subscription to get the price ID
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await handleSubscriptionUpdate(subscription);

  apiLogger.info(
    {
      customerId,
      subscriptionId,
      sessionId: session.id,
    },
    "Checkout completed",
  );
}
