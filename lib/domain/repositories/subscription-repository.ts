import { db, userSubscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { UserSubscription } from "@/lib/db/schema";
import { SubscriptionAggregate } from "../aggregates/subscription";

export class SubscriptionRepository {
  async findByUserId(userId: string): Promise<SubscriptionAggregate | null> {
    const record = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.userId, userId),
    });

    if (!record) {
      return null;
    }

    return SubscriptionAggregate.fromPersistence(record as UserSubscription);
  }
}
