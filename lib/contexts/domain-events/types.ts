/**
 * Domain Event Types
 *
 * Core types for the domain event infrastructure that enables
 * communication between bounded contexts in the DDD architecture.
 */

/**
 * Base domain event interface that all events must implement
 */
export interface DomainEvent {
  /** Unique identifier for this event instance */
  id: string;

  /** Type of event (e.g., 'UserRegistered', 'TaskCreated') */
  eventType: string;

  /** ID of the aggregate that produced this event */
  aggregateId: string;

  /** Type of aggregate (e.g., 'User', 'Task', 'Execution') */
  aggregateType: string;

  /** When the event occurred */
  occurredAt: Date;

  /** Event payload data */
  data: Record<string, unknown>;

  /** Optional metadata (correlation IDs, causation IDs, etc.) */
  metadata?: EventMetadata;
}

/**
 * Event metadata for tracing and correlation
 */
export interface EventMetadata {
  /** ID linking related events in a workflow */
  correlationId?: string;

  /** ID of the event that caused this event */
  causationId?: string;

  /** User ID who triggered the action */
  userId?: string;

  /** Additional context-specific metadata */
  [key: string]: unknown;
}

/**
 * Event handler function signature
 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T,
) => Promise<void> | void;

/**
 * Event subscriber registration
 */
export interface EventSubscription {
  /** Event type to subscribe to (supports wildcards like 'Task.*') */
  eventType: string;

  /** Handler function to invoke when event is received */
  handler: EventHandler;

  /** Subscriber name for logging/debugging */
  subscriberName: string;

  /** Priority (lower = higher priority, default = 100) */
  priority?: number;
}

/**
 * Event publisher interface
 */
export interface IEventPublisher {
  /**
   * Publish a domain event to all registered subscribers
   */
  publish(event: DomainEvent): Promise<void>;

  /**
   * Publish multiple events in order
   */
  publishAll(events: DomainEvent[]): Promise<void>;
}

/**
 * Event subscriber interface
 */
export interface IEventSubscriber {
  /**
   * Subscribe to events matching a pattern
   */
  subscribe(subscription: EventSubscription): void;

  /**
   * Unsubscribe from an event type
   */
  unsubscribe(eventType: string, subscriberName: string): void;

  /**
   * Start listening for events
   */
  start(): Promise<void>;

  /**
   * Stop listening for events
   */
  stop(): Promise<void>;
}

/**
 * Persisted event record (for event store)
 */
export interface PersistedEvent extends DomainEvent {
  /** Database record ID */
  recordId: string;

  /** When the event was persisted */
  persistedAt: Date;

  /** Version of the event schema */
  version: number;
}
