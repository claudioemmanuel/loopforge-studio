import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users, subscriptionPlans } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { planName, billingCycle } = body;

    if (!planName || !billingCycle) {
      return NextResponse.json(
        { error: "Plan name and billing cycle are required" },
        { status: 400 }
      );
    }

    if (!["monthly", "yearly"].includes(billingCycle)) {
      return NextResponse.json(
        { error: "Invalid billing cycle" },
        { status: 400 }
      );
    }

    // Get plan from database
    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.name, planName),
    });

    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { error: "Plan not found or inactive" },
        { status: 404 }
      );
    }

    // Get Stripe price ID
    const priceId = billingCycle === "monthly"
      ? plan.stripePriceMonthly
      : plan.stripePriceYearly;

    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price not configured for this plan" },
        { status: 500 }
      );
    }

    // Get user details
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Create Stripe checkout session
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const checkoutSession = await createCheckoutSession({
      priceId,
      customerId: user.stripeCustomerId || undefined,
      customerEmail: user.email || undefined,
      userId: session.user.id,
      successUrl: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/subscription/cancel`,
    });

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
