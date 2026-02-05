import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createPortalSession,
  isStripeConfigured,
} from "@/lib/contexts/billing/infrastructure/stripe";
import { handleError, Errors } from "@/lib/errors";

export async function POST() {
  if (!isStripeConfigured()) {
    return handleError(Errors.invalidRequest("Stripe is not configured"));
  }

  const session = await auth();

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const result = await createPortalSession(
      session.user.id,
      `${baseUrl}/billing`,
    );

    if ("error" in result) {
      return handleError(Errors.invalidRequest(result.error));
    }

    return NextResponse.json({ url: result.url });
  } catch (error) {
    return handleError(error);
  }
}
