import { randomUUID } from "crypto";
import type { IEventPublisher as ITaskEventPublisher } from "../../use-cases/ports/IEventPublisher";
import type { DomainEvent as TaskDomainEvent } from "@/lib/contexts/domain-events/types";
import { Result } from "@/lib/shared/Result";
import { PublisherError } from "@/lib/shared/errors";
import { EventPublisher } from "@/lib/contexts/domain-events/event-publisher";

export class EventPublisherAdapter implements ITaskEventPublisher {
  constructor(private readonly eventPublisher: EventPublisher) {}

  async publish(event: TaskDomainEvent) {
    try {
      await this.eventPublisher.publish({
        id: event.id || randomUUID(),
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType || "Task",
        occurredAt: event.occurredAt,
        data: event.data,
        metadata: event.metadata,
      });
      return Result.ok<void, PublisherError>(undefined);
    } catch (error) {
      return Result.fail<void, PublisherError>(
        new PublisherError("Failed to publish domain event", error),
      );
    }
  }

  async publishAll(events: TaskDomainEvent[]) {
    try {
      for (const event of events) {
        const publishResult = await this.publish(event);
        if (publishResult.isFailure) {
          return publishResult;
        }
      }
      return Result.ok<void, PublisherError>(undefined);
    } catch (error) {
      return Result.fail<void, PublisherError>(
        new PublisherError("Failed to publish domain events", error),
      );
    }
  }
}
