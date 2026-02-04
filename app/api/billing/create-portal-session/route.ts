import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { getBillingService } from "@/lib/contexts/billing/api";

/**
 * POST /api/billing/create-portal-session
 * Creates a Stripe customer portal session for subscription management.
 */
export const POST = withAuth(async (_request, { user }) => {
  const billingService = getBillingService();
  const result = await billingService.createPortalSession({ userId: user.id });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ url: result.url });
});
