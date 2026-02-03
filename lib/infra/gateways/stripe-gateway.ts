import {
  getPlanConfig,
  getLimit,
  isUnlimited,
} from "@/lib/stripe/client";
import type { StripeGateway } from "@/lib/application/ports/stripe-gateway";

export class DefaultStripeGateway implements StripeGateway {
  getPlanConfig(tier: string) {
    return getPlanConfig(tier as Parameters<typeof getPlanConfig>[0]);
  }

  isUnlimited(tier: string, resource: "repos" | "tasks"): boolean {
    return isUnlimited(tier as Parameters<typeof isUnlimited>[0], resource);
  }

  getLimit(tier: string, resource: "repos" | "tasks"): number {
    return getLimit(tier as Parameters<typeof getLimit>[0], resource);
  }
}
