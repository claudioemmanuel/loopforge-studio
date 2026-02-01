import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";
import { stripe } from "@/lib/stripe/client";

/**
 * POST /api/billing/create-portal-session
 * Creates a Stripe customer portal session for subscription management
 * Phase 3.1: Stripe Integration
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  try {
    // Get user's Stripe customer ID
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user?.stripeCustomerId) {
      return handleError(Errors.invalidRequest("No active subscription found"));
    }

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/settings/account`,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error("Stripe portal error:", error);
    return handleError(error);
  }
}
