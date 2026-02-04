/**
 * SSE Stream (Server-Sent Events)
 *
 * Provides real-time streaming of activity events to clients.
 */

import { EventSubscriber } from "@/lib/contexts/domain-events";
import type { DomainEvent } from "@/lib/contexts/domain-events";
import type { Redis } from "ioredis";

/**
 * SSE connection
 */
export interface SSEConnection {
  id: string;
  userId?: string;
  taskId?: string;
  send: (event: SSEEvent) => void;
  close: () => void;
}

/**
 * SSE event
 */
export interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

/**
 * SSE stream manager
 *
 * Manages SSE connections and streams domain events to clients.
 */
export class SSEStreamManager {
  private subscriber: EventSubscriber;
  private redis: Redis;
  private connections: Map<string, SSEConnection>;
  private isListening: boolean = false;

  constructor(redis: Redis) {
    this.redis = redis;
    this.subscriber = EventSubscriber.getInstance(redis);
    this.connections = new Map();
  }

  /**
   * Start listening to domain events
   */
  start(): void {
    if (this.isListening) {
      return;
    }

    // Subscribe to all events
    this.subscriber.subscribe("*", this.handleDomainEvent.bind(this), {
      subscriberId: "sse-stream-manager",
      priority: 5, // Medium priority
    });

    this.isListening = true;
  }

  /**
   * Stop listening
   */
  stop(): void {
    if (!this.isListening) {
      return;
    }

    this.subscriber.unsubscribe("sse-stream-manager", "*");
    this.isListening = false;

    // Close all connections
    for (const connection of this.connections.values()) {
      connection.close();
    }
    this.connections.clear();
  }

  /**
   * Add SSE connection
   */
  addConnection(connection: SSEConnection): void {
    this.connections.set(connection.id, connection);

    // Start listening if not already
    if (!this.isListening) {
      this.start();
    }
  }

  /**
   * Remove SSE connection
   */
  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);

    // Stop listening if no more connections
    if (this.connections.size === 0 && this.isListening) {
      this.stop();
    }
  }

  /**
   * Handle domain event and broadcast to relevant connections
   */
  private async handleDomainEvent(event: DomainEvent): Promise<void> {
    // Skip analytics events to avoid loops
    if (
      event.aggregateType === "Activity" ||
      event.aggregateType === "Summary"
    ) {
      return;
    }

    const data = event.data as Record<string, unknown>;
    const userId = data.userId as string | undefined;
    const taskId = data.taskId as string | undefined;

    // Broadcast to matching connections
    for (const connection of this.connections.values()) {
      // Filter by user
      if (connection.userId && connection.userId !== userId) {
        continue;
      }

      // Filter by task
      if (connection.taskId && connection.taskId !== taskId) {
        continue;
      }

      // Send event
      try {
        connection.send({
          id: event.id,
          event: event.eventType,
          data: JSON.stringify({
            type: event.eventType,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            data: event.data,
            occurredAt: event.occurredAt,
          }),
        });
      } catch (error) {
        console.error("Failed to send SSE event:", error);
        // Remove broken connection
        this.removeConnection(connection.id);
      }
    }
  }

  /**
   * Get active connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get connections for user
   */
  getUserConnections(userId: string): SSEConnection[] {
    return Array.from(this.connections.values()).filter(
      (c) => c.userId === userId,
    );
  }
}

// Singleton instance
let sseStreamManager: SSEStreamManager | null = null;

/**
 * Get SSE stream manager instance
 */
export function getSSEStreamManager(redis: Redis): SSEStreamManager {
  if (!sseStreamManager) {
    sseStreamManager = new SSEStreamManager(redis);
  }
  return sseStreamManager;
}
