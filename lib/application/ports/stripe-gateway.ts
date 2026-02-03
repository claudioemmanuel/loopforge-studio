export interface StripeGateway {
  getPlanConfig(tier: string): {
    name: string;
    priceId: string;
    maxRepos: number;
    maxTasksPerRepo: number;
    features: string[];
  };
  isUnlimited(tier: string, resource: "repos" | "tasks"): boolean;
  getLimit(tier: string, resource: "repos" | "tasks"): number;
}
