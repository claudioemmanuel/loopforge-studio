import type { DomainEvent } from "../../entities/events";
import type { Result } from "@/lib/shared/Result";
import type { PublisherError } from "@/lib/shared/errors";

/**
 * Event publisher port interface
 *
 * Publishes domain events to the event bus (Redis Pub/Sub).
 * Use cases emit events through this port for cross-context communication.
 */
export interface IEventPublisher {
  publish(event: DomainEvent): Promise<Result<void, PublisherError>>;
  publishAll(events: DomainEvent[]): Promise<Result<void, PublisherError>>;
}
