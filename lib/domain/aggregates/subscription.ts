import type { UserSubscription } from "@/lib/db/schema";
import { SubscriptionId } from "../value-objects/identifiers";

export type SubscriptionAggregateSnapshot = UserSubscription;

export class SubscriptionAggregate {
  private constructor(private state: SubscriptionAggregateSnapshot) {}

  static fromPersistence(
    record: SubscriptionAggregateSnapshot,
  ): SubscriptionAggregate {
    return new SubscriptionAggregate({ ...record });
  }

  get id(): SubscriptionId {
    return new SubscriptionId(this.state.id);
  }

  get snapshot(): SubscriptionAggregateSnapshot {
    return { ...this.state };
  }

  isActive(): boolean {
    return this.state.status === "active" || this.state.status === "trialing";
  }
}
