import type { DomainEventPayloads, DomainEventType } from "./catalog";

export interface DomainEvent<T extends DomainEventType = DomainEventType> {
  type: T;
  data: DomainEventPayloads[T];
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}

export type DomainEventHandler<T extends DomainEventType = DomainEventType> = (
  event: DomainEvent<T>,
) => Promise<unknown> | unknown;

export class DomainEventBus {
  private handlers = new Map<DomainEventType, DomainEventHandler[]>();

  subscribe<T extends DomainEventType>(
    type: T,
    handler: DomainEventHandler<T>,
  ): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler as DomainEventHandler);
    this.handlers.set(type, existing);
  }

  async publish<T extends DomainEventType>(
    event: DomainEvent<T>,
  ): Promise<unknown[]> {
    const handlers = this.handlers.get(event.type) ?? [];
    if (handlers.length === 0) {
      return [];
    }

    return Promise.all(handlers.map((handler) => handler(event)));
  }
}

const globalBus = new DomainEventBus();

export function getDomainEventBus(): DomainEventBus {
  return globalBus;
}

export function createDomainEvent<T extends DomainEventType>(
  type: T,
  data: DomainEventPayloads[T],
  metadata?: Record<string, unknown>,
): DomainEvent<T> {
  return {
    type,
    data,
    occurredAt: new Date(),
    metadata,
  };
}
