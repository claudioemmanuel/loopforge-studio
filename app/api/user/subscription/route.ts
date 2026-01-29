import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db, users, subscriptionPlans } from "@/lib/db";
import { eq } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";

export const GET = withAuth(async (_request, { user }) => {
  try {
    // Re-fetch user with subscription and plan relations
    const userWithSubscription = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      with: {
        subscription: {
          with: {
            plan: true,
          },
        },
      },
    });

    if (!userWithSubscription) {
      return handleError(Errors.notFound("User"));
    }

    const subscription = userWithSubscription.subscription;
    const plan = subscription?.plan;

    // Determine effective plan (free tier if no subscription)
    const freePlan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.tier, "free"),
    });

    const effectivePlan = plan || freePlan;

    return NextResponse.json({
      billingMode: userWithSubscription.billingMode || "byok",
      hasActiveSubscription: !!subscription && subscription.status === "active",
      subscription: subscription
        ? {
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      plan: effectivePlan
        ? {
            id: effectivePlan.id,
            name: effectivePlan.name,
            tier: effectivePlan.tier,
            billingMode: effectivePlan.billingMode,
            limits: effectivePlan.limits,
          }
        : null,
    });
  } catch (error) {
    return handleError(error);
  }
});
