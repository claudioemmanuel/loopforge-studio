import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";
import { getStripeClient } from "@/lib/contexts/billing/infrastructure/stripe";
import {
  SUBSCRIPTION_PLANS,
  type SubscriptionTier,
} from "@/lib/contexts/billing/api";

/**
 * POST /api/billing/create-checkout-session
 * Creates a Stripe checkout session for subscription upgrade
 * Phase 3.1: Stripe Integration
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id || !session?.user?.email) {
    return handleError(Errors.unauthorized());
  }

  try {
    const body = await request.json();
    const { tier } = body as { tier: SubscriptionTier };

    if (!tier || !(tier in SUBSCRIPTION_PLANS)) {
      return handleError(Errors.invalidRequest("Invalid subscription tier"));
    }

    const plan = SUBSCRIPTION_PLANS[tier];

    if (!plan.priceId) {
      return handleError(Errors.serverError("Price ID not configured"));
    }

    // Get or create Stripe customer
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    let customerId = user?.stripeCustomerId;

    const stripe = getStripeClient();
    if (!stripe) {
      return handleError(Errors.invalidRequest("Stripe is not configured"));
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        metadata: {
          userId: session.user.id,
        },
      });

      customerId = customer.id;

      // Save customer ID
      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, session.user.id));
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/settings/account?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/settings/account?canceled=true`,
      metadata: {
        userId: session.user.id,
        tier,
      },
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return handleError(error);
  }
}
