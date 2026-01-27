import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users, userSubscriptions, subscriptionPlans } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get user with subscription and plan
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      with: {
        subscription: {
          with: {
            plan: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const subscription = user.subscription;
    const plan = subscription?.plan;

    // Determine effective plan (free tier if no subscription)
    const freePlan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.tier, "free"),
    });

    const effectivePlan = plan || freePlan;

    return NextResponse.json({
      billingMode: user.billingMode || "byok",
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
    console.error("Get subscription error:", error);
    return NextResponse.json(
      { error: "Failed to get subscription" },
      { status: 500 },
    );
  }
}
