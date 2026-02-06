import { randomUUID } from "crypto";
import type { IEventPublisher as ITaskEventPublisher } from "../../use-cases/ports/IEventPublisher";
import type { DomainEvent as TaskDomainEvent } from "../../entities/events";
import { Result } from "@/lib/shared/Result";
import { PublisherError } from "@/lib/shared/errors";
import { EventPublisher } from "@/lib/contexts/domain-events/event-publisher";

export class EventPublisherAdapter implements ITaskEventPublisher {
  constructor(private readonly eventPublisher: EventPublisher) {}

  async publish(event: TaskDomainEvent) {
    try {
      await this.eventPublisher.publish({
        id: randomUUID(),
        eventType: event.type,
        aggregateId: event.aggregateId,
        aggregateType: "Task",
        occurredAt: event.occurredAt,
        data: event.data,
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
