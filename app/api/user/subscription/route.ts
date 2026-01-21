import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users, userSubscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user with billing mode
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's subscription with plan details
    const subscription = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.userId, session.user.id),
      with: { plan: true },
    });

    return NextResponse.json({
      billingMode: user.billingMode,
      subscription: subscription
        ? {
            id: subscription.id,
            planId: subscription.planId,
            plan: {
              id: subscription.plan.id,
              name: subscription.plan.name,
              displayName: subscription.plan.displayName,
              priceMonthly: subscription.plan.priceMonthly,
              priceYearly: subscription.plan.priceYearly,
              taskLimit: subscription.plan.taskLimit,
              features: subscription.plan.features,
            },
            billingCycle: subscription.billingCycle,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart.toISOString(),
            currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
