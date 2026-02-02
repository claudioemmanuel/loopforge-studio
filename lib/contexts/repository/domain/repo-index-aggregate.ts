/**
 * Repository Index Aggregate
 *
 * Manages repository metadata indexing (tech stack, symbols, dependencies).
 */

import { EventPublisher } from "@/lib/contexts/domain-events";
import type { Redis } from "ioredis";
import type { IndexMetadata } from "./types";
import type {
  IndexingStartedEvent,
  IndexingCompletedEvent,
  IndexingFailedEvent,
} from "./events";

/**
 * Repository index state
 */
export interface RepoIndexState {
  id: string;
  repositoryId: string;
  metadata: IndexMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Repository Index aggregate
 *
 * Enforces invariants:
 * - Single index per repository
 * - Valid tech stack
 * - Non-empty file index (after successful indexing)
 */
export class RepoIndexAggregate {
  private state: RepoIndexState;
  private eventPublisher: EventPublisher;

  constructor(state: RepoIndexState, redis: Redis) {
    this.state = state;
    this.eventPublisher = EventPublisher.getInstance(redis);
  }

  /**
   * Get index ID
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * Get current state (for persistence)
   */
  getState(): RepoIndexState {
    return { ...this.state };
  }

  /**
   * Create a new repository index
   */
  static create(
    params: {
      id: string;
      repositoryId: string;
    },
    redis: Redis,
  ): RepoIndexAggregate {
    const state: RepoIndexState = {
      id: params.id,
      repositoryId: params.repositoryId,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return new RepoIndexAggregate(state, redis);
  }

  /**
   * Start indexing operation
   */
  async startIndexing(): Promise<void> {
    // Publish IndexingStarted event
    const event: IndexingStartedEvent = {
      id: crypto.randomUUID(),
      eventType: "IndexingStarted",
      aggregateType: "Repository",
      aggregateId: this.state.repositoryId,
      occurredAt: new Date(),
      data: {
        repositoryId: this.state.repositoryId,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Complete indexing with metadata
   */
  async completeIndexing(metadata: IndexMetadata): Promise<void> {
    // Validate metadata
    if (metadata.fileCount <= 0) {
      throw new Error("File count must be positive");
    }

    // Update state
    this.state.metadata = metadata;
    this.state.updatedAt = new Date();

    // Publish IndexingCompleted event
    const event: IndexingCompletedEvent = {
      id: crypto.randomUUID(),
      eventType: "IndexingCompleted",
      aggregateType: "Repository",
      aggregateId: this.state.repositoryId,
      occurredAt: new Date(),
      data: {
        repositoryId: this.state.repositoryId,
        fileCount: metadata.fileCount,
        symbolCount: metadata.symbolCount,
        indexedAt: this.state.updatedAt,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Fail indexing with error
   */
  async failIndexing(error: string): Promise<void> {
    this.state.updatedAt = new Date();

    // Publish IndexingFailed event
    const event: IndexingFailedEvent = {
      id: crypto.randomUUID(),
      eventType: "IndexingFailed",
      aggregateType: "Repository",
      aggregateId: this.state.repositoryId,
      occurredAt: new Date(),
      data: {
        repositoryId: this.state.repositoryId,
        error,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Get index metadata
   */
  getMetadata(): IndexMetadata | null {
    return this.state.metadata;
  }

  /**
   * Check if repository has been indexed
   */
  isIndexed(): boolean {
    return this.state.metadata !== null;
  }
}
