import Stripe from "stripe";
import { db } from "@/lib/db";
import { users, userSubscriptions, subscriptionPlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// Stripe Client
// =============================================================================

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey && process.env.NODE_ENV === "production") {
  console.warn(
    "STRIPE_SECRET_KEY is not set - Stripe features will be disabled",
  );
}

export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// =============================================================================
// Checkout Session
// =============================================================================

export interface CreateCheckoutParams {
  userId: string;
  userEmail: string;
  planId: string;
  billingCycle: "monthly" | "yearly";
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a Stripe Checkout session for subscription
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams,
): Promise<{ url: string } | { error: string }> {
  if (!stripe) {
    return { error: "Stripe is not configured" };
  }

  const { userId, userEmail, planId, billingCycle, successUrl, cancelUrl } =
    params;

  // Get the plan and its Stripe price ID
  const plan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.id, planId),
  });

  if (!plan) {
    return { error: "Plan not found" };
  }

  const priceId =
    billingCycle === "yearly"
      ? plan.stripePriceIdYearly
      : plan.stripePriceIdMonthly;

  if (!priceId) {
    return { error: "Plan does not have a Stripe price configured" };
  }

  // Get or create Stripe customer
  let stripeCustomerId: string;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (user?.stripeCustomerId) {
    stripeCustomerId = user.stripeCustomerId;
  } else {
    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: {
        userId,
      },
    });

    stripeCustomerId = customer.id;

    // Save customer ID to user
    await db
      .update(users)
      .set({ stripeCustomerId })
      .where(eq(users.id, userId));
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      planId,
      billingCycle,
    },
    subscription_data: {
      metadata: {
        userId,
        planId,
      },
    },
  });

  if (!session.url) {
    return { error: "Failed to create checkout session" };
  }

  return { url: session.url };
}

// =============================================================================
// Customer Portal
// =============================================================================

/**
 * Create a Stripe Customer Portal session
 */
export async function createPortalSession(
  userId: string,
  returnUrl: string,
): Promise<{ url: string } | { error: string }> {
  if (!stripe) {
    return { error: "Stripe is not configured" };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user?.stripeCustomerId) {
    return { error: "No billing account found" };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

// =============================================================================
// Webhook Handlers
// =============================================================================

export type WebhookEvent =
  | "checkout.session.completed"
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.paid"
  | "invoice.payment_failed";

/**
 * Verify and parse a Stripe webhook event
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
): Promise<Stripe.Event | { error: string }> {
  if (!stripe) {
    return { error: "Stripe is not configured" };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return { error: "Webhook secret is not configured" };
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: `Webhook signature verification failed: ${message}` };
  }
}

/**
 * Handle checkout.session.completed event
 */
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;
  const billingCycle = session.metadata?.billingCycle as "monthly" | "yearly";
  const subscriptionId = session.subscription as string;

  if (!userId || !planId || !subscriptionId) {
    console.error("Missing metadata in checkout session", session.id);
    return;
  }

  // Get subscription details from Stripe
  if (!stripe) return;

  const subscriptionResponse =
    await stripe.subscriptions.retrieve(subscriptionId);

  // Extract the subscription data from items (Stripe v20 moved period to items)
  const firstItem = subscriptionResponse.items?.data?.[0];
  const currentPeriodStart =
    firstItem?.current_period_start ?? Math.floor(Date.now() / 1000);
  const currentPeriodEnd =
    firstItem?.current_period_end ??
    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const cancelAtPeriodEnd = subscriptionResponse.cancel_at_period_end;

  // Create or update user subscription
  const existingSubscription = await db.query.userSubscriptions.findFirst({
    where: eq(userSubscriptions.userId, userId),
  });

  const subscriptionData = {
    planId,
    status: "active" as const,
    billingCycle,
    stripeSubscriptionId: subscriptionId,
    currentPeriodStart: new Date(currentPeriodStart * 1000),
    currentPeriodEnd: new Date(currentPeriodEnd * 1000),
    cancelAtPeriodEnd,
    updatedAt: new Date(),
  };

  if (existingSubscription) {
    await db
      .update(userSubscriptions)
      .set(subscriptionData)
      .where(eq(userSubscriptions.userId, userId));
  } else {
    await db.insert(userSubscriptions).values({
      userId,
      ...subscriptionData,
    });
  }

  // Update user's billing mode to managed (since they're subscribing)
  const plan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.id, planId),
  });

  if (plan) {
    await db
      .update(users)
      .set({ billingMode: plan.billingMode })
      .where(eq(users.id, userId));
  }
}

/**
 * Handle customer.subscription.updated event
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error("Missing userId in subscription metadata", subscription.id);
    return;
  }

  // Map Stripe status to our status
  const statusMap: Record<
    string,
    "active" | "canceled" | "past_due" | "trialing"
  > = {
    active: "active",
    canceled: "canceled",
    past_due: "past_due",
    trialing: "trialing",
    incomplete: "past_due",
    incomplete_expired: "canceled",
    unpaid: "past_due",
    paused: "past_due",
  };

  const status = statusMap[subscription.status] || "active";

  // Extract period from items (Stripe v20 moved period to items)
  const firstItem = subscription.items?.data?.[0];
  const currentPeriodStart =
    firstItem?.current_period_start ?? Math.floor(Date.now() / 1000);
  const currentPeriodEnd =
    firstItem?.current_period_end ??
    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  await db
    .update(userSubscriptions)
    .set({
      status,
      currentPeriodStart: new Date(currentPeriodStart * 1000),
      currentPeriodEnd: new Date(currentPeriodEnd * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.userId, userId));
}

/**
 * Handle customer.subscription.deleted event
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error("Missing userId in subscription metadata", subscription.id);
    return;
  }

  // Mark subscription as canceled
  await db
    .update(userSubscriptions)
    .set({
      status: "canceled",
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.userId, userId));

  // Revert user to BYOK mode
  await db
    .update(users)
    .set({ billingMode: "byok" })
    .where(eq(users.id, userId));
}

/**
 * Handle invoice.payment_failed event
 */
export async function handlePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  // In Stripe v20, subscription is in parent.subscription_details.subscription
  const parent = invoice.parent;
  if (!parent || parent.type !== "subscription_details" || !stripe) return;

  const subscriptionDetails = parent.subscription_details;
  if (!subscriptionDetails) return;

  const subscriptionId =
    typeof subscriptionDetails.subscription === "string"
      ? subscriptionDetails.subscription
      : subscriptionDetails.subscription.id;

  const subscriptionResponse =
    await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscriptionResponse.metadata?.userId;

  if (!userId) return;

  // Update subscription status to past_due
  await db
    .update(userSubscriptions)
    .set({
      status: "past_due",
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.userId, userId));
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if Stripe is configured and available
 */
export function isStripeConfigured(): boolean {
  return !!stripe;
}

/**
 * Get Stripe publishable key for client-side
 */
export function getPublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY || null;
}
