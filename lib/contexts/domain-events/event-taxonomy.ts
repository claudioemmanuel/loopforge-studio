/**
 * Domain Event Taxonomy
 *
 * Canonical format: <Aggregate>.<Action>
 * Example: Execution.Completed
 */

export const DomainEventTypes = {
  task: {
    created: "Task.Created",
    deleted: "Task.Deleted",
    statusChanged: "Task.StatusChanged",
    fieldsUpdated: "Task.FieldsUpdated",
    configurationUpdated: "Task.ConfigurationUpdated",
    priorityChanged: "Task.PriorityChanged",
    dependencyAdded: "Task.DependencyAdded",
    dependencyRemoved: "Task.DependencyRemoved",
    executionClaimed: "Task.ExecutionClaimed",
    brainstormingStarted: "Task.BrainstormingStarted",
    brainstormingCompleted: "Task.BrainstormingCompleted",
    planningStarted: "Task.PlanningStarted",
    planningCompleted: "Task.PlanningCompleted",
    executionStarted: "Task.ExecutionStarted",
    executionCompleted: "Task.ExecutionCompleted",
    executionFailed: "Task.ExecutionFailed",
    stuck: "Task.Stuck",
    unblocked: "Task.Unblocked",
  },
  execution: {
    started: "Execution.Started",
    iterationCompleted: "Execution.IterationCompleted",
    filesExtracted: "Execution.FilesExtracted",
    commitCreated: "Execution.CommitCreated",
    stuckSignalDetected: "Execution.StuckSignalDetected",
    recoveryStarted: "Execution.RecoveryStarted",
    recoverySucceeded: "Execution.RecoverySucceeded",
    recoveryFailed: "Execution.RecoveryFailed",
    completionValidated: "Execution.CompletionValidated",
    completed: "Execution.Completed",
    failed: "Execution.Failed",
    skillInvoked: "Execution.SkillInvoked",
    skillBlocked: "Execution.SkillBlocked",
  },
  repository: {
    connected: "Repository.Connected",
    cloneStarted: "Repository.CloneStarted",
    cloneCompleted: "Repository.CloneCompleted",
    cloneFailed: "Repository.CloneFailed",
    updateStarted: "Repository.UpdateStarted",
    updateCompleted: "Repository.UpdateCompleted",
    indexingStarted: "Repository.IndexingStarted",
    indexingCompleted: "Repository.IndexingCompleted",
    indexingFailed: "Repository.IndexingFailed",
    testConfigurationUpdated: "Repository.TestConfigurationUpdated",
  },
  user: {
    registered: "User.Registered",
    providerConfigured: "User.ProviderConfigured",
    providerRemoved: "User.ProviderRemoved",
    preferencesUpdated: "User.PreferencesUpdated",
    sessionExpired: "User.SessionExpired",
    onboardingCompleted: "User.OnboardingCompleted",
  },
  billing: {
    subscriptionCreated: "Subscription.Created",
    subscriptionUpgraded: "Subscription.Upgraded",
    subscriptionDowngraded: "Subscription.Downgraded",
    subscriptionCanceled: "Subscription.Canceled",
    usageRecorded: "Usage.Recorded",
    limitExceeded: "Usage.LimitExceeded",
    billingPeriodEnded: "Billing.PeriodEnded",
  },
} as const;

export const DomainEventPatterns = {
  task: "Task.*",
  execution: "Execution.*",
  repository: "Repository.*",
  user: "User.*",
  subscription: "Subscription.*",
  usage: "Usage.*",
  billing: "Billing.*",
} as const;

const LEGACY_TO_CANONICAL: Record<string, string> = {
  TaskCreated: DomainEventTypes.task.created,
  TaskDeleted: DomainEventTypes.task.deleted,
  TaskStatusChanged: DomainEventTypes.task.statusChanged,
  TaskFieldsUpdated: DomainEventTypes.task.fieldsUpdated,
  TaskConfigurationUpdated: DomainEventTypes.task.configurationUpdated,
  TaskPriorityChanged: DomainEventTypes.task.priorityChanged,
  TaskDependencyAdded: DomainEventTypes.task.dependencyAdded,
  TaskDependencyRemoved: DomainEventTypes.task.dependencyRemoved,
  TaskUnblocked: DomainEventTypes.task.unblocked,
  TaskStuck: DomainEventTypes.task.stuck,
  ExecutionClaimed: DomainEventTypes.task.executionClaimed,
  BrainstormingStarted: DomainEventTypes.task.brainstormingStarted,
  BrainstormingCompleted: DomainEventTypes.task.brainstormingCompleted,
  PlanningStarted: DomainEventTypes.task.planningStarted,
  PlanningCompleted: DomainEventTypes.task.planningCompleted,
  ExecutionStarted: DomainEventTypes.execution.started,
  ExecutionCompleted: DomainEventTypes.execution.completed,
  ExecutionFailed: DomainEventTypes.execution.failed,
  IterationCompleted: DomainEventTypes.execution.iterationCompleted,
  FilesExtracted: DomainEventTypes.execution.filesExtracted,
  CommitCreated: DomainEventTypes.execution.commitCreated,
  StuckSignalDetected: DomainEventTypes.execution.stuckSignalDetected,
  RecoveryStarted: DomainEventTypes.execution.recoveryStarted,
  RecoverySucceeded: DomainEventTypes.execution.recoverySucceeded,
  RecoveryFailed: DomainEventTypes.execution.recoveryFailed,
  CompletionValidated: DomainEventTypes.execution.completionValidated,
  SkillInvoked: DomainEventTypes.execution.skillInvoked,
  SkillBlocked: DomainEventTypes.execution.skillBlocked,
  RepositoryConnected: DomainEventTypes.repository.connected,
  CloneStarted: DomainEventTypes.repository.cloneStarted,
  CloneCompleted: DomainEventTypes.repository.cloneCompleted,
  CloneFailed: DomainEventTypes.repository.cloneFailed,
  UpdateStarted: DomainEventTypes.repository.updateStarted,
  UpdateCompleted: DomainEventTypes.repository.updateCompleted,
  IndexingStarted: DomainEventTypes.repository.indexingStarted,
  IndexingCompleted: DomainEventTypes.repository.indexingCompleted,
  IndexingFailed: DomainEventTypes.repository.indexingFailed,
  TestConfigurationUpdated:
    DomainEventTypes.repository.testConfigurationUpdated,
  UserRegistered: DomainEventTypes.user.registered,
  ProviderConfigured: DomainEventTypes.user.providerConfigured,
  ProviderRemoved: DomainEventTypes.user.providerRemoved,
  UserPreferencesUpdated: DomainEventTypes.user.preferencesUpdated,
  SessionExpired: DomainEventTypes.user.sessionExpired,
  OnboardingCompleted: DomainEventTypes.user.onboardingCompleted,
  SubscriptionCreated: DomainEventTypes.billing.subscriptionCreated,
  SubscriptionUpgraded: DomainEventTypes.billing.subscriptionUpgraded,
  SubscriptionDowngraded: DomainEventTypes.billing.subscriptionDowngraded,
  SubscriptionCanceled: DomainEventTypes.billing.subscriptionCanceled,
  UsageRecorded: DomainEventTypes.billing.usageRecorded,
  LimitExceeded: DomainEventTypes.billing.limitExceeded,
  BillingPeriodEnded: DomainEventTypes.billing.billingPeriodEnded,
  "Execution.ExecutionCompleted": DomainEventTypes.execution.completed,
};

const CANONICAL_TO_LEGACY = Object.entries(LEGACY_TO_CANONICAL).reduce<
  Record<string, string[]>
>((acc, [legacy, canonical]) => {
  if (!acc[canonical]) {
    acc[canonical] = [];
  }
  acc[canonical].push(legacy);
  return acc;
}, {});

const TASK_AGGREGATE_OVERRIDES: Record<string, string> = {
  ExecutionStarted: DomainEventTypes.task.executionStarted,
  ExecutionCompleted: DomainEventTypes.task.executionCompleted,
  ExecutionFailed: DomainEventTypes.task.executionFailed,
};

const EXECUTION_AGGREGATE_OVERRIDES: Record<string, string> = {
  ExecutionStarted: DomainEventTypes.execution.started,
  ExecutionCompleted: DomainEventTypes.execution.completed,
  ExecutionFailed: DomainEventTypes.execution.failed,
};

export function toCanonicalEventType(
  eventType: string,
  aggregateType?: string,
): string {
  if (aggregateType === "Task" && TASK_AGGREGATE_OVERRIDES[eventType]) {
    return TASK_AGGREGATE_OVERRIDES[eventType];
  }

  if (
    aggregateType === "Execution" &&
    EXECUTION_AGGREGATE_OVERRIDES[eventType]
  ) {
    return EXECUTION_AGGREGATE_OVERRIDES[eventType];
  }

  return LEGACY_TO_CANONICAL[eventType] ?? eventType;
}

export function getCompatibleEventTypes(eventType: string): string[] {
  const canonical = toCanonicalEventType(eventType);
  const aliases = CANONICAL_TO_LEGACY[canonical] ?? [];

  return Array.from(new Set([canonical, ...aliases]));
}
