/**
 * Repository Management Domain Events
 *
 * Events published by the Repository Management bounded context.
 */

import type { DomainEvent } from "@/lib/contexts/domain-events";

/**
 * Repository connected to user account
 */
export interface RepositoryConnectedEvent extends DomainEvent {
  eventType: "RepositoryConnected";
  aggregateType: "Repository";
  data: {
    repositoryId: string;
    userId: string;
    githubRepoId: string;
    fullName: string;
    isPrivate: boolean;
  };
}

/**
 * Clone operation started
 */
export interface CloneStartedEvent extends DomainEvent {
  eventType: "CloneStarted";
  aggregateType: "Repository";
  data: {
    repositoryId: string;
    clonePath: string;
  };
}

/**
 * Clone completed successfully
 */
export interface CloneCompletedEvent extends DomainEvent {
  eventType: "CloneCompleted";
  aggregateType: "Repository";
  data: {
    repositoryId: string;
    clonePath: string;
    clonedAt: Date;
  };
}

/**
 * Clone failed with error
 */
export interface CloneFailedEvent extends DomainEvent {
  eventType: "CloneFailed";
  aggregateType: "Repository";
  data: {
    repositoryId: string;
    error: string;
  };
}

/**
 * Repository update (pull) started
 */
export interface UpdateStartedEvent extends DomainEvent {
  eventType: "UpdateStarted";
  aggregateType: "Repository";
  data: {
    repositoryId: string;
  };
}

/**
 * Repository update completed
 */
export interface UpdateCompletedEvent extends DomainEvent {
  eventType: "UpdateCompleted";
  aggregateType: "Repository";
  data: {
    repositoryId: string;
    updatedAt: Date;
  };
}

/**
 * Indexing operation started
 */
export interface IndexingStartedEvent extends DomainEvent {
  eventType: "IndexingStarted";
  aggregateType: "Repository";
  data: {
    repositoryId: string;
  };
}

/**
 * Indexing completed successfully
 */
export interface IndexingCompletedEvent extends DomainEvent {
  eventType: "IndexingCompleted";
  aggregateType: "Repository";
  data: {
    repositoryId: string;
    fileCount: number;
    symbolCount: number;
    indexedAt: Date;
  };
}

/**
 * Indexing failed with error
 */
export interface IndexingFailedEvent extends DomainEvent {
  eventType: "IndexingFailed";
  aggregateType: "Repository";
  data: {
    repositoryId: string;
    error: string;
  };
}

/**
 * Test configuration updated
 */
export interface TestConfigurationUpdatedEvent extends DomainEvent {
  eventType: "TestConfigurationUpdated";
  aggregateType: "Repository";
  data: {
    repositoryId: string;
    testCommand?: string;
    testTimeout?: number;
    testsEnabled?: boolean;
    testGatePolicy?: string;
  };
}

/**
 * Union type of all Repository Management events
 */
export type RepositoryManagementEvent =
  | RepositoryConnectedEvent
  | CloneStartedEvent
  | CloneCompletedEvent
  | CloneFailedEvent
  | UpdateStartedEvent
  | UpdateCompletedEvent
  | IndexingStartedEvent
  | IndexingCompletedEvent
  | IndexingFailedEvent
  | TestConfigurationUpdatedEvent;
