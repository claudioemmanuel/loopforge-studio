import { NextResponse } from "next/server";
import { db, subscriptionPlans } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    // Get all active plans
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true));

    return NextResponse.json({
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        taskLimit: plan.taskLimit,
        gracePercent: plan.gracePercent,
        features: plan.features,
      })),
    });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
