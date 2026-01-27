/**
 * Stripe Products & Prices Setup Script
 *
 * This script creates the required Stripe products and prices for Loopforge Studio
 * subscription plans, then updates the .env file with the generated price IDs.
 *
 * Usage: npm run stripe:setup
 *
 * Prerequisites:
 * - STRIPE_SECRET_KEY must be set in .env
 */

import Stripe from "stripe";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env file manually
function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith("#")) {
        const [key, ...valueParts] = trimmedLine.split("=");
        const value = valueParts.join("=");
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnvFile();

// =============================================================================
// Configuration
// =============================================================================

interface ProductConfig {
  name: string;
  description: string;
  tier: string;
  billingMode: "byok" | "managed";
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  envKeyMonthly: string;
  envKeyYearly: string;
}

const PRODUCTS: ProductConfig[] = [
  {
    name: "Loopforge Pro (BYOK)",
    description: "Pro tier for users bringing their own API keys",
    tier: "pro",
    billingMode: "byok",
    monthlyPriceCents: 1500, // $15/mo
    yearlyPriceCents: 14400, // $144/yr ($12/mo)
    envKeyMonthly: "STRIPE_PRICE_PRO_BYOK_MONTHLY",
    envKeyYearly: "STRIPE_PRICE_PRO_BYOK_YEARLY",
  },
  {
    name: "Loopforge Pro (Managed)",
    description: "Pro tier with full managed AI experience",
    tier: "pro",
    billingMode: "managed",
    monthlyPriceCents: 2900, // $29/mo
    yearlyPriceCents: 27800, // $278/yr (~$23/mo)
    envKeyMonthly: "STRIPE_PRICE_PRO_MANAGED_MONTHLY",
    envKeyYearly: "STRIPE_PRICE_PRO_MANAGED_YEARLY",
  },
  {
    name: "Loopforge Team (BYOK)",
    description: "Team tier for users bringing their own API keys",
    tier: "team",
    billingMode: "byok",
    monthlyPriceCents: 3900, // $39/mo
    yearlyPriceCents: 37400, // $374/yr (~$31/mo)
    envKeyMonthly: "STRIPE_PRICE_TEAM_BYOK_MONTHLY",
    envKeyYearly: "STRIPE_PRICE_TEAM_BYOK_YEARLY",
  },
  {
    name: "Loopforge Team (Managed)",
    description: "Team tier with full managed AI experience",
    tier: "team",
    billingMode: "managed",
    monthlyPriceCents: 7900, // $79/mo
    yearlyPriceCents: 75800, // $758/yr (~$63/mo)
    envKeyMonthly: "STRIPE_PRICE_TEAM_MANAGED_MONTHLY",
    envKeyYearly: "STRIPE_PRICE_TEAM_MANAGED_YEARLY",
  },
];

// =============================================================================
// Main Setup Function
// =============================================================================

async function setupStripeProducts() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    console.error("Error: STRIPE_SECRET_KEY is not set in .env");
    console.error("\nPlease add your Stripe secret key to .env:");
    console.error(
      "STRIPE_SECRET_KEY=sk_test_51Stw7ZHmXThH7zkLTwJ9mJ94nUkAkDgzRKu5dp9EMZubtrpGJB091QGxgSMAhbzbr0MlAJ7lEw5Pn0Jvrq0gyh2p00CfNhVHWj",
    );
    process.exit(1);
  }

  const stripe = new Stripe(secretKey);

  console.log("Setting up Stripe products and prices...\n");

  const priceIds: Record<string, string> = {};

  for (const productConfig of PRODUCTS) {
    console.log(`\n--- ${productConfig.name} ---`);

    // Check for existing product
    const existingProducts = await stripe.products.search({
      query: `metadata['tier']:'${productConfig.tier}' AND metadata['billingMode']:'${productConfig.billingMode}'`,
    });

    let product: Stripe.Product;

    if (existingProducts.data.length > 0) {
      product = existingProducts.data[0];
      console.log(`Found existing product: ${product.id}`);
    } else {
      // Create new product
      product = await stripe.products.create({
        name: productConfig.name,
        description: productConfig.description,
        metadata: {
          tier: productConfig.tier,
          billingMode: productConfig.billingMode,
        },
      });
      console.log(`Created product: ${product.id}`);
    }

    // Check for existing prices
    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
    });

    const existingMonthly = existingPrices.data.find(
      (p) => p.recurring?.interval === "month",
    );
    const existingYearly = existingPrices.data.find(
      (p) => p.recurring?.interval === "year",
    );

    // Create or use existing monthly price
    let monthlyPrice: Stripe.Price;
    if (existingMonthly) {
      monthlyPrice = existingMonthly;
      console.log(`Found existing monthly price: ${monthlyPrice.id}`);
    } else {
      monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: productConfig.monthlyPriceCents,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: {
          tier: productConfig.tier,
          billingMode: productConfig.billingMode,
          interval: "monthly",
        },
      });
      console.log(`Created monthly price: ${monthlyPrice.id}`);
    }

    // Create or use existing yearly price
    let yearlyPrice: Stripe.Price;
    if (existingYearly) {
      yearlyPrice = existingYearly;
      console.log(`Found existing yearly price: ${yearlyPrice.id}`);
    } else {
      yearlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: productConfig.yearlyPriceCents,
        currency: "usd",
        recurring: { interval: "year" },
        metadata: {
          tier: productConfig.tier,
          billingMode: productConfig.billingMode,
          interval: "yearly",
        },
      });
      console.log(`Created yearly price: ${yearlyPrice.id}`);
    }

    priceIds[productConfig.envKeyMonthly] = monthlyPrice.id;
    priceIds[productConfig.envKeyYearly] = yearlyPrice.id;
  }

  // Update .env file
  console.log("\n--- Updating .env file ---");
  await updateEnvFile(priceIds);

  // Print summary
  console.log("\n========================================");
  console.log("Setup Complete!");
  console.log("========================================\n");
  console.log("The following price IDs have been added to .env:\n");

  for (const [key, value] of Object.entries(priceIds)) {
    console.log(`${key}=${value}`);
  }

  console.log("\n--- Next Steps ---");
  console.log("1. Run 'npm run db:seed' to update plans with price IDs");
  console.log("2. Test checkout flow from /subscription page");
  console.log("\nView products in Stripe Dashboard:");
  console.log("https://dashboard.stripe.com/test/products");
}

// =============================================================================
// Helper Functions
// =============================================================================

async function updateEnvFile(priceIds: Record<string, string>) {
  const envPath = path.join(process.cwd(), ".env");

  let envContent = "";

  // Read existing .env if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
  }

  // Update or add each price ID
  for (const [key, value] of Object.entries(priceIds)) {
    const regex = new RegExp(`^${key}=.*$`, "m");

    if (regex.test(envContent)) {
      // Update existing key
      envContent = envContent.replace(regex, `${key}=${value}`);
      console.log(`Updated ${key}`);
    } else {
      // Add new key
      if (!envContent.endsWith("\n") && envContent.length > 0) {
        envContent += "\n";
      }
      envContent += `${key}=${value}\n`;
      console.log(`Added ${key}`);
    }
  }

  fs.writeFileSync(envPath, envContent);
  console.log("\n.env file updated successfully!");
}

// =============================================================================
// Run Setup
// =============================================================================

setupStripeProducts().catch((error) => {
  if (error.type === "StripeAuthenticationError") {
    console.error("\n========================================");
    console.error("Authentication Error");
    console.error("========================================");
    console.error("\nThe Stripe API key is invalid.");
    console.error("\nTo fix this:");
    console.error("1. Go to https://dashboard.stripe.com/test/apikeys");
    console.error("2. Copy your Secret key (starts with sk_test_)");
    console.error("3. Update STRIPE_SECRET_KEY in your .env file");
    console.error("4. Run this script again: npm run stripe:setup\n");
  } else {
    console.error("Setup failed:", error);
  }
  process.exit(1);
});
