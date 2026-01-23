import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent, getStripe } from "@/lib/stripe";
import { db, users, userSubscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId || !customerId || !subscriptionId) {
    console.error("Missing data in checkout session:", { userId, customerId, subscriptionId });
    return;
  }

  // Update user with Stripe customer ID
  await db
    .update(users)
    .set({
      stripeCustomerId: customerId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Fetch full subscription details
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  await createOrUpdateSubscription(userId, subscription);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.log("No userId in subscription metadata, skipping");
    return;
  }

  await createOrUpdateSubscription(userId, subscription);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.log("No userId in subscription metadata, skipping");
    return;
  }

  // Update subscription status to canceled
  await db
    .update(userSubscriptions)
    .set({
      status: "canceled",
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id));
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Get subscription ID from parent.subscription_details in newer Stripe API
  const subscriptionDetails = invoice.parent?.subscription_details;
  const subscriptionId = subscriptionDetails?.subscription
    ? (typeof subscriptionDetails.subscription === "string"
        ? subscriptionDetails.subscription
        : subscriptionDetails.subscription.id)
    : null;

  if (!subscriptionId) return;

  // Use invoice period dates (period_start/end are on the invoice)
  await db
    .update(userSubscriptions)
    .set({
      currentPeriodStart: new Date(invoice.period_start * 1000),
      currentPeriodEnd: new Date(invoice.period_end * 1000),
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.stripeSubscriptionId, subscriptionId));
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionDetails = invoice.parent?.subscription_details;
  const subscriptionId = subscriptionDetails?.subscription
    ? (typeof subscriptionDetails.subscription === "string"
        ? subscriptionDetails.subscription
        : subscriptionDetails.subscription.id)
    : null;

  if (!subscriptionId) return;

  // Mark subscription as past due
  await db
    .update(userSubscriptions)
    .set({
      status: "past_due",
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.stripeSubscriptionId, subscriptionId));
}

async function createOrUpdateSubscription(userId: string, subscription: Stripe.Subscription) {
  // Get price ID from subscription
  const priceId = subscription.items.data[0]?.price.id;

  if (!priceId) {
    console.error("No price ID found in subscription");
    return;
  }

  // Find plan by Stripe price ID
  const plan = await db.query.subscriptionPlans.findFirst({
    where: (plans, { or, eq }) =>
      or(
        eq(plans.stripePriceMonthly, priceId),
        eq(plans.stripePriceYearly, priceId)
      ),
  });

  if (!plan) {
    console.error("No plan found for price ID:", priceId);
    return;
  }

  // Determine billing cycle
  const billingCycle = plan.stripePriceMonthly === priceId ? "monthly" : "yearly";

  // Map Stripe status to our status
  const statusMap: Record<string, "active" | "canceled" | "past_due" | "trialing"> = {
    active: "active",
    canceled: "canceled",
    past_due: "past_due",
    trialing: "trialing",
    incomplete: "past_due",
    incomplete_expired: "canceled",
    unpaid: "past_due",
    paused: "canceled",
  };

  const status = statusMap[subscription.status] || "active";

  // Get period dates from subscription items (Stripe v20+)
  const firstItem = subscription.items?.data?.[0];
  const periodStart = firstItem?.current_period_start ?? Math.floor(Date.now() / 1000);
  const periodEnd = firstItem?.current_period_end ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  // Use atomic upsert to prevent TOCTOU race condition from webhook retries
  // The unique index on stripeSubscriptionId ensures atomicity
  await db
    .insert(userSubscriptions)
    .values({
      userId,
      planId: plan.id,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      billingCycle,
      currentPeriodStart: new Date(periodStart * 1000),
      currentPeriodEnd: new Date(periodEnd * 1000),
      status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: userSubscriptions.stripeSubscriptionId,
      set: {
        planId: plan.id,
        billingCycle,
        currentPeriodStart: new Date(periodStart * 1000),
        currentPeriodEnd: new Date(periodEnd * 1000),
        status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      },
    });
}
