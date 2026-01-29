import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createCheckoutSession, isStripeConfigured } from "@/lib/billing";
import { handleError, Errors } from "@/lib/errors";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return handleError(Errors.invalidRequest("Stripe is not configured"));
  }

  const session = await auth();

  if (!session?.user?.id || !session?.user?.email) {
    return handleError(Errors.unauthorized());
  }

  try {
    const body = await request.json();
    const { planId, billingCycle } = body;

    if (!planId || !billingCycle) {
      return handleError(
        Errors.invalidRequest("planId and billingCycle are required"),
      );
    }

    if (billingCycle !== "monthly" && billingCycle !== "yearly") {
      return handleError(
        Errors.invalidRequest("billingCycle must be 'monthly' or 'yearly'"),
      );
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const result = await createCheckoutSession({
      userId: session.user.id,
      userEmail: session.user.email,
      planId,
      billingCycle,
      successUrl: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/billing/cancel`,
    });

    if ("error" in result) {
      return handleError(Errors.invalidRequest(result.error));
    }

    return NextResponse.json({ url: result.url });
  } catch (error) {
    return handleError(error);
  }
}
