/**
 * Repository Aggregate Root
 *
 * Manages GitHub repository integration, cloning, and configuration.
 * This is the main aggregate for the Repository Management bounded context.
 */

import { EventPublisher } from "@/lib/contexts/domain-events";
import type { Redis } from "ioredis";
import type {
  CloneInfo,
  CloneStatus,
  IndexingStatus,
  RepositoryMetadata,
  TestConfiguration,
  PRConfiguration,
} from "./types";
import { DEFAULT_TEST_CONFIG, DEFAULT_PR_CONFIG } from "./types";
import type {
  RepositoryConnectedEvent,
  CloneStartedEvent,
  CloneCompletedEvent,
  CloneFailedEvent,
  UpdateStartedEvent,
  UpdateCompletedEvent,
  TestConfigurationUpdatedEvent,
} from "./events";

/**
 * Repository aggregate state
 */
export interface RepositoryState {
  id: string;
  userId: string;
  metadata: RepositoryMetadata;
  cloneInfo: CloneInfo;
  indexingStatus: IndexingStatus;
  indexedAt: Date | null;
  testConfig: TestConfiguration;
  prConfig: PRConfiguration;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Repository aggregate root
 *
 * Enforces invariants:
 * - Valid GitHub repo ID
 * - Clone path exists if status is "cloned"
 * - Unique per user (user_id + github_repo_id)
 * - Valid clone status transitions
 */
export class RepositoryAggregate {
  private state: RepositoryState;
  private eventPublisher: EventPublisher;

  constructor(state: RepositoryState, redis: Redis) {
    this.state = state;
    this.eventPublisher = EventPublisher.getInstance(redis);
  }

  /**
   * Get repository ID
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * Get current state (for persistence)
   */
  getState(): RepositoryState {
    return { ...this.state };
  }

  /**
   * Connect a new repository
   */
  static async connect(
    params: {
      id: string;
      userId: string;
      metadata: RepositoryMetadata;
    },
    redis: Redis,
  ): Promise<RepositoryAggregate> {
    // Create initial state
    const state: RepositoryState = {
      id: params.id,
      userId: params.userId,
      metadata: params.metadata,
      cloneInfo: {
        status: "not_cloned",
        path: null,
        startedAt: null,
        completedAt: null,
        error: null,
      },
      indexingStatus: "pending",
      indexedAt: null,
      testConfig: { ...DEFAULT_TEST_CONFIG },
      prConfig: { ...DEFAULT_PR_CONFIG },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const repo = new RepositoryAggregate(state, redis);

    // Publish RepositoryConnected event
    const event: RepositoryConnectedEvent = {
      id: crypto.randomUUID(),
      eventType: "RepositoryConnected",
      aggregateType: "Repository",
      aggregateId: state.id,
      occurredAt: new Date(),
      data: {
        repositoryId: state.id,
        userId: state.userId,
        githubRepoId: state.metadata.githubRepoId,
        fullName: state.metadata.fullName,
        isPrivate: state.metadata.isPrivate,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await repo.eventPublisher.publish(event);

    return repo;
  }

  /**
   * Start clone operation
   */
  async startClone(clonePath: string): Promise<void> {
    // Validate clone can start
    if (
      this.state.cloneInfo.status === "cloning" ||
      this.state.cloneInfo.status === "updating"
    ) {
      throw new Error(
        `Cannot start clone: repository is already ${this.state.cloneInfo.status}`,
      );
    }

    // Update clone info
    this.state.cloneInfo = {
      status: "cloning",
      path: clonePath,
      startedAt: new Date(),
      completedAt: null,
      error: null,
    };
    this.state.updatedAt = new Date();

    // Publish CloneStarted event
    const event: CloneStartedEvent = {
      id: crypto.randomUUID(),
      eventType: "CloneStarted",
      aggregateType: "Repository",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        repositoryId: this.state.id,
        clonePath,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Complete clone operation successfully
   */
  async completeClone(): Promise<void> {
    if (this.state.cloneInfo.status !== "cloning") {
      throw new Error(
        `Cannot complete clone: repository is not cloning (status: ${this.state.cloneInfo.status})`,
      );
    }

    const completedAt = new Date();

    // Update clone info
    this.state.cloneInfo = {
      ...this.state.cloneInfo,
      status: "cloned",
      completedAt,
      error: null,
    };
    this.state.updatedAt = completedAt;

    // Publish CloneCompleted event
    const event: CloneCompletedEvent = {
      id: crypto.randomUUID(),
      eventType: "CloneCompleted",
      aggregateType: "Repository",
      aggregateId: this.state.id,
      occurredAt: completedAt,
      data: {
        repositoryId: this.state.id,
        clonePath: this.state.cloneInfo.path!,
        clonedAt: completedAt,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Fail clone operation with error
   */
  async failClone(error: string): Promise<void> {
    if (this.state.cloneInfo.status !== "cloning") {
      throw new Error(
        `Cannot fail clone: repository is not cloning (status: ${this.state.cloneInfo.status})`,
      );
    }

    // Update clone info
    this.state.cloneInfo = {
      ...this.state.cloneInfo,
      status: "failed",
      error,
    };
    this.state.updatedAt = new Date();

    // Publish CloneFailed event
    const event: CloneFailedEvent = {
      id: crypto.randomUUID(),
      eventType: "CloneFailed",
      aggregateType: "Repository",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        repositoryId: this.state.id,
        error,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Start repository update (pull)
   */
  async startUpdate(): Promise<void> {
    if (this.state.cloneInfo.status !== "cloned") {
      throw new Error(
        `Cannot update: repository is not cloned (status: ${this.state.cloneInfo.status})`,
      );
    }

    // Update clone status
    this.state.cloneInfo = {
      ...this.state.cloneInfo,
      status: "updating",
    };
    this.state.updatedAt = new Date();

    // Publish UpdateStarted event
    const event: UpdateStartedEvent = {
      id: crypto.randomUUID(),
      eventType: "UpdateStarted",
      aggregateType: "Repository",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        repositoryId: this.state.id,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Complete repository update
   */
  async completeUpdate(): Promise<void> {
    if (this.state.cloneInfo.status !== "updating") {
      throw new Error(
        `Cannot complete update: repository is not updating (status: ${this.state.cloneInfo.status})`,
      );
    }

    const updatedAt = new Date();

    // Update clone status back to cloned
    this.state.cloneInfo = {
      ...this.state.cloneInfo,
      status: "cloned",
    };
    this.state.updatedAt = updatedAt;

    // Publish UpdateCompleted event
    const event: UpdateCompletedEvent = {
      id: crypto.randomUUID(),
      eventType: "UpdateCompleted",
      aggregateType: "Repository",
      aggregateId: this.state.id,
      occurredAt: updatedAt,
      data: {
        repositoryId: this.state.id,
        updatedAt,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Update test configuration
   */
  async updateTestConfig(config: Partial<TestConfiguration>): Promise<void> {
    // Merge with existing config
    this.state.testConfig = {
      ...this.state.testConfig,
      ...config,
    };
    this.state.updatedAt = new Date();

    // Publish TestConfigurationUpdated event
    const event: TestConfigurationUpdatedEvent = {
      id: crypto.randomUUID(),
      eventType: "TestConfigurationUpdated",
      aggregateType: "Repository",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        repositoryId: this.state.id,
        ...config,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Update PR configuration
   */
  updatePRConfig(config: Partial<PRConfiguration>): void {
    this.state.prConfig = {
      ...this.state.prConfig,
      ...config,
    };
    this.state.updatedAt = new Date();
  }

  /**
   * Update indexing status
   */
  updateIndexingStatus(
    status: IndexingStatus,
    indexedAt: Date | null = null,
  ): void {
    this.state.indexingStatus = status;
    if (indexedAt) {
      this.state.indexedAt = indexedAt;
    }
    this.state.updatedAt = new Date();
  }

  /**
   * Get clone status
   */
  getCloneStatus(): CloneStatus {
    return this.state.cloneInfo.status;
  }

  /**
   * Check if repository is cloned
   */
  isCloned(): boolean {
    return this.state.cloneInfo.status === "cloned";
  }

  /**
   * Get clone path
   */
  getClonePath(): string | null {
    return this.state.cloneInfo.path;
  }

  /**
   * Get indexing status
   */
  getIndexingStatus(): IndexingStatus {
    return this.state.indexingStatus;
  }

  /**
   * Check if repository is indexed
   */
  isIndexed(): boolean {
    return this.state.indexingStatus === "indexed";
  }
}
