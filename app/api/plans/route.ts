import { NextResponse } from "next/server";
import { db, subscriptionPlans } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isStripeConfigured, getPublishableKey } from "@/lib/billing/infra";
import { handleError } from "@/lib/errors";

export async function GET() {
  try {
    // Get all active plans
    const plans = await db.query.subscriptionPlans.findMany({
      where: eq(subscriptionPlans.isActive, true),
    });

    // Group plans by tier and mode for easier frontend consumption
    const groupedPlans = plans.reduce(
      (acc, plan) => {
        const key = `${plan.tier}-${plan.billingMode}`;
        acc[key] = {
          id: plan.id,
          name: plan.name,
          tier: plan.tier,
          billingMode: plan.billingMode,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          limits: plan.limits,
          hasStripePrice: !!(
            plan.stripePriceIdMonthly || plan.stripePriceIdYearly
          ),
        };
        return acc;
      },
      {} as Record<string, unknown>,
    );

    return NextResponse.json({
      plans: groupedPlans,
      stripeEnabled: isStripeConfigured(),
      stripePublishableKey: getPublishableKey(),
    });
  } catch (error) {
    return handleError(error);
  }
}
