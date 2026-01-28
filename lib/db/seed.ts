import { db } from "./index";
import { subscriptionPlans, type PlanLimits } from "./schema";
import { eq } from "drizzle-orm";

// =============================================================================
// Subscription Plans Seed Data
// =============================================================================

interface PlanSeedData {
  name: string;
  tier: string;
  billingMode: "byok" | "managed";
  priceMonthly: number; // cents
  priceYearly: number; // cents
  limits: PlanLimits;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
}

const plans: PlanSeedData[] = [
  // Free Tier - BYOK
  {
    name: "Free",
    tier: "free",
    billingMode: "byok",
    priceMonthly: 0,
    priceYearly: 0,
    limits: {
      maxRepos: 1,
      maxTasksPerMonth: 5,
      maxTokensPerMonth: 50_000,
    },
  },
  // Free Tier - Managed
  {
    name: "Free",
    tier: "free",
    billingMode: "managed",
    priceMonthly: 0,
    priceYearly: 0,
    limits: {
      maxRepos: 1,
      maxTasksPerMonth: 5,
      maxTokensPerMonth: 50_000,
    },
  },
  // Pro Tier - BYOK
  {
    name: "Pro",
    tier: "pro",
    billingMode: "byok",
    priceMonthly: 1500, // $15/mo
    priceYearly: 14400, // $144/yr ($12/mo)
    limits: {
      maxRepos: 5,
      maxTasksPerMonth: 100,
      maxTokensPerMonth: 2_000_000,
    },
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_BYOK_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_BYOK_YEARLY,
  },
  // Pro Tier - Managed
  {
    name: "Pro",
    tier: "pro",
    billingMode: "managed",
    priceMonthly: 2900, // $29/mo
    priceYearly: 27840, // $278.40/yr (~$23.20/mo)
    limits: {
      maxRepos: 5,
      maxTasksPerMonth: 100,
      maxTokensPerMonth: 2_000_000,
    },
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MANAGED_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_MANAGED_YEARLY,
  },
  // Team Tier - BYOK
  {
    name: "Team",
    tier: "team",
    billingMode: "byok",
    priceMonthly: 3900, // $39/mo
    priceYearly: 37440, // $374.40/yr (~$31.20/mo)
    limits: {
      maxRepos: -1, // unlimited
      maxTasksPerMonth: -1, // unlimited
      maxTokensPerMonth: 10_000_000,
    },
    stripePriceIdMonthly: process.env.STRIPE_PRICE_TEAM_BYOK_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_TEAM_BYOK_YEARLY,
  },
  // Team Tier - Managed
  {
    name: "Team",
    tier: "team",
    billingMode: "managed",
    priceMonthly: 7900, // $79/mo
    priceYearly: 75840, // $758.40/yr (~$63.20/mo)
    limits: {
      maxRepos: -1, // unlimited
      maxTasksPerMonth: -1, // unlimited
      maxTokensPerMonth: 10_000_000,
    },
    stripePriceIdMonthly: process.env.STRIPE_PRICE_TEAM_MANAGED_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_TEAM_MANAGED_YEARLY,
  },
];

async function seedPlans() {
  console.log("Seeding subscription plans...");

  for (const plan of plans) {
    // Check if plan already exists
    const existing = await db.query.subscriptionPlans.findFirst({
      where: (p, { and, eq }) =>
        and(eq(p.tier, plan.tier), eq(p.billingMode, plan.billingMode)),
    });

    if (existing) {
      // Update existing plan
      console.log(`Updating ${plan.name} (${plan.billingMode})...`);
      await db
        .update(subscriptionPlans)
        .set({
          name: plan.name,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          limits: plan.limits,
          stripePriceIdMonthly: plan.stripePriceIdMonthly || null,
          stripePriceIdYearly: plan.stripePriceIdYearly || null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionPlans.id, existing.id));
    } else {
      // Insert new plan
      console.log(`Creating ${plan.name} (${plan.billingMode})...`);
      await db.insert(subscriptionPlans).values({
        name: plan.name,
        tier: plan.tier,
        billingMode: plan.billingMode,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        limits: plan.limits,
        stripePriceIdMonthly: plan.stripePriceIdMonthly || null,
        stripePriceIdYearly: plan.stripePriceIdYearly || null,
        isActive: true,
      });
    }
  }

  console.log("Subscription plans seeded successfully!");
}

async function main() {
  try {
    await seedPlans();
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

main();
