import { eq } from "drizzle-orm";
import { db, subscriptionPlans } from "./index";

async function seed() {
  console.log("🌱 Seeding subscription plans...");

  // Note: Stripe price IDs are configured via environment variables
  // Set them in Stripe Dashboard, then update .env with the IDs
  const plans = [
    {
      name: "pro",
      displayName: "Pro",
      priceMonthly: 3900, // $39.00
      priceYearly: 39000, // $390.00 (2 months free)
      stripePriceMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || null,
      stripePriceYearly: process.env.STRIPE_PRICE_PRO_YEARLY || null,
      taskLimit: 30,
      gracePercent: 10,
      features: [
        "30 tasks per month",
        "Priority AI assistance",
        "Email support",
        "Advanced analytics",
      ],
      isActive: true,
    },
    {
      name: "team",
      displayName: "Team",
      priceMonthly: 12900, // $129.00
      priceYearly: 129000, // $1,290.00 (2 months free)
      stripePriceMonthly: process.env.STRIPE_PRICE_TEAM_MONTHLY || null,
      stripePriceYearly: process.env.STRIPE_PRICE_TEAM_YEARLY || null,
      taskLimit: 100,
      gracePercent: 10,
      features: [
        "100 tasks per month",
        "Premium AI assistance",
        "Priority support",
        "Advanced analytics",
        "Team collaboration",
        "API access",
      ],
      isActive: true,
    },
  ];

  for (const plan of plans) {
    await db
      .insert(subscriptionPlans)
      .values(plan)
      .onConflictDoUpdate({
        target: subscriptionPlans.name,
        set: {
          displayName: plan.displayName,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          stripePriceMonthly: plan.stripePriceMonthly,
          stripePriceYearly: plan.stripePriceYearly,
          taskLimit: plan.taskLimit,
          gracePercent: plan.gracePercent,
          features: plan.features,
          isActive: plan.isActive,
          updatedAt: new Date(),
        },
      });
    console.log(`  ✓ ${plan.displayName} plan`);
  }

  // Deactivate the free plan if it exists
  await db
    .update(subscriptionPlans)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(subscriptionPlans.name, "free"));

  console.log("\n✅ Subscription plans seeded successfully!");
  console.log("⚠️  Remember to set STRIPE_PRICE_* environment variables");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
