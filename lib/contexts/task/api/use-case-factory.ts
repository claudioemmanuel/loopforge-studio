/**
 * Use Case Factory
 * Dependency injection container for Task use cases
 */

import { TaskRepository } from "../adapters/repositories/TaskRepository";
import { TaskPersistenceAdapter } from "../infrastructure/task-persistence-adapter";
import { EventPublisher } from "../../domain-events/event-publisher";
import { AnalyticsServiceAdapter } from "../adapters/services/AnalyticsServiceAdapter";
import { EventPublisherAdapter } from "../adapters/services/EventPublisherAdapter";
import { getRedis } from "@/lib/queue/connection";

// Core CRUD
import { CreateTaskUseCase } from "../use-cases/create-task/CreateTaskUseCase";
import { GetTaskUseCase } from "../use-cases/get-task/GetTaskUseCase";
import { GetTaskWithRepoUseCase } from "../use-cases/get-task-with-repo/GetTaskWithRepoUseCase";
import { UpdateTaskFieldsUseCase } from "../use-cases/update-task-fields/UpdateTaskFieldsUseCase";
import { DeleteTaskUseCase } from "../use-cases/delete-task/DeleteTaskUseCase";
import { ListTasksByRepoUseCase } from "../use-cases/list-tasks-by-repo/ListTasksByRepoUseCase";
import { ListTasksByUserUseCase } from "../use-cases/list-tasks-by-user/ListTasksByUserUseCase";

// Brainstorming Flow
import { ClaimBrainstormingSlotUseCase } from "../use-cases/claim-brainstorming-slot/ClaimBrainstormingSlotUseCase";
import { SaveBrainstormResultUseCase } from "../use-cases/save-brainstorm-result/SaveBrainstormResultUseCase";
import { UpdateBrainstormConversationUseCase } from "../use-cases/update-brainstorm-conversation/UpdateBrainstormConversationUseCase";
import { FinalizeBrainstormUseCase } from "../use-cases/finalize-brainstorm/FinalizeBrainstormUseCase";
import { ClearProcessingSlotUseCase } from "../use-cases/clear-processing-slot/ClearProcessingSlotUseCase";

// Planning Flow
import { ClaimPlanningSlotUseCase } from "../use-cases/claim-planning-slot/ClaimPlanningSlotUseCase";
import { SavePlanUseCase } from "../use-cases/save-plan/SavePlanUseCase";
import { FinalizePlanningUseCase } from "../use-cases/finalize-planning/FinalizePlanningUseCase";

// Execution Flow
import { ClaimExecutionSlotUseCase } from "../use-cases/claim-execution-slot/ClaimExecutionSlotUseCase";
import { RevertExecutionSlotUseCase } from "../use-cases/revert-execution-slot/RevertExecutionSlotUseCase";
import { MarkTaskRunningUseCase } from "../use-cases/mark-task-running/MarkTaskRunningUseCase";
import { MarkTaskCompletedUseCase } from "../use-cases/mark-task-completed/MarkTaskCompletedUseCase";
import { MarkTaskFailedUseCase } from "../use-cases/mark-task-failed/MarkTaskFailedUseCase";
import { MarkTaskStuckUseCase } from "../use-cases/mark-task-stuck/MarkTaskStuckUseCase";

// Dependencies
import { AddTaskDependencyUseCase } from "../use-cases/add-task-dependency/AddTaskDependencyUseCase";
import { RemoveTaskDependencyUseCase } from "../use-cases/remove-task-dependency/RemoveTaskDependencyUseCase";
import { UpdateDependencySettingsUseCase } from "../use-cases/update-dependency-settings/UpdateDependencySettingsUseCase";
import { GetTaskDependencyGraphUseCase } from "../use-cases/get-task-dependency-graph/GetTaskDependencyGraphUseCase";

// Configuration
import { EnableAutonomousModeUseCase } from "../use-cases/enable-autonomous-mode/EnableAutonomousModeUseCase";
import { UpdateTaskPriorityUseCase } from "../use-cases/update-task-priority/UpdateTaskPriorityUseCase";
import { UpdateTaskConfigurationUseCase } from "../use-cases/update-task-configuration/UpdateTaskConfigurationUseCase";

// Validation
import { VerifyTaskOwnershipUseCase } from "../use-cases/verify-task-ownership/VerifyTaskOwnershipUseCase";
import { CheckTaskTransitionValidUseCase } from "../use-cases/check-task-transition-valid/CheckTaskTransitionValidUseCase";

// Bulk Operations
import { DeleteTasksByRepoIdsUseCase } from "../use-cases/delete-tasks-by-repo-ids/DeleteTasksByRepoIdsUseCase";
import { GetTaskIdsByRepoIdsUseCase } from "../use-cases/get-task-ids-by-repo-ids/GetTaskIdsByRepoIdsUseCase";

// Processing State
import { UpdateProcessingStateUseCase } from "../use-cases/update-processing-state/UpdateProcessingStateUseCase";

/**
 * Shared infrastructure dependencies (singletons)
 */
const taskRepository = new TaskRepository();
const taskPersistence = new TaskPersistenceAdapter(getRedis());
const eventPublisher = new EventPublisherAdapter(
  EventPublisher.getInstance(getRedis()),
);
const analyticsService = new AnalyticsServiceAdapter();

/**
 * Use case factory - creates use case instances with dependencies injected
 */
export class UseCaseFactory {
  // Core CRUD
  static createTask() {
    return new CreateTaskUseCase(
      taskRepository,
      eventPublisher,
      analyticsService,
    );
  }

  static getTask() {
    return new GetTaskUseCase(taskRepository);
  }

  static getTaskWithRepo() {
    return new GetTaskWithRepoUseCase(taskRepository);
  }

  static updateTaskFields() {
    return new UpdateTaskFieldsUseCase(taskRepository, eventPublisher);
  }

  static deleteTask() {
    return new DeleteTaskUseCase(
      taskRepository,
      eventPublisher,
      analyticsService,
    );
  }

  static listTasksByRepo() {
    return new ListTasksByRepoUseCase(taskRepository);
  }

  static listTasksByUser() {
    return new ListTasksByUserUseCase(taskRepository);
  }

  // Brainstorming Flow
  static claimBrainstormingSlot() {
    return new ClaimBrainstormingSlotUseCase(taskRepository, eventPublisher);
  }

  static saveBrainstormResult() {
    return new SaveBrainstormResultUseCase(taskRepository, eventPublisher);
  }

  static updateBrainstormConversation() {
    return new UpdateBrainstormConversationUseCase(taskPersistence);
  }

  static finalizeBrainstorm() {
    return new FinalizeBrainstormUseCase(taskRepository, eventPublisher);
  }

  static clearProcessingSlot() {
    return new ClearProcessingSlotUseCase(taskRepository, eventPublisher);
  }

  // Planning Flow
  static claimPlanningSlot() {
    return new ClaimPlanningSlotUseCase(taskRepository, eventPublisher);
  }

  static savePlan() {
    return new SavePlanUseCase(taskRepository, eventPublisher);
  }

  static finalizePlanning() {
    return new FinalizePlanningUseCase(taskRepository, eventPublisher);
  }

  // Execution Flow
  static claimExecutionSlot() {
    return new ClaimExecutionSlotUseCase(taskRepository, eventPublisher);
  }

  static revertExecutionSlot() {
    return new RevertExecutionSlotUseCase(taskRepository, eventPublisher);
  }

  static markTaskRunning() {
    return new MarkTaskRunningUseCase(taskRepository, eventPublisher);
  }

  static markTaskCompleted() {
    return new MarkTaskCompletedUseCase(
      taskRepository,
      eventPublisher,
      analyticsService,
    );
  }

  static markTaskFailed() {
    return new MarkTaskFailedUseCase(taskRepository, eventPublisher);
  }

  static markTaskStuck() {
    return new MarkTaskStuckUseCase(taskRepository, eventPublisher);
  }

  // Dependencies
  static addTaskDependency() {
    return new AddTaskDependencyUseCase(taskRepository, eventPublisher);
  }

  static removeTaskDependency() {
    return new RemoveTaskDependencyUseCase(taskRepository, eventPublisher);
  }

  static updateDependencySettings() {
    return new UpdateDependencySettingsUseCase(taskRepository);
  }

  static getTaskDependencyGraph() {
    return new GetTaskDependencyGraphUseCase(taskRepository);
  }

  // Configuration
  static enableAutonomousMode() {
    return new EnableAutonomousModeUseCase(taskRepository, eventPublisher);
  }

  static updateTaskPriority() {
    return new UpdateTaskPriorityUseCase(taskRepository, eventPublisher);
  }

  static updateTaskConfiguration() {
    return new UpdateTaskConfigurationUseCase(taskRepository, eventPublisher);
  }

  // Validation
  static verifyTaskOwnership() {
    return new VerifyTaskOwnershipUseCase(taskRepository);
  }

  static checkTaskTransitionValid() {
    return new CheckTaskTransitionValidUseCase(taskRepository);
  }

  // Bulk Operations
  static deleteTasksByRepoIds() {
    return new DeleteTasksByRepoIdsUseCase(
      taskRepository,
      eventPublisher,
      analyticsService,
    );
  }

  static getTaskIdsByRepoIds() {
    return new GetTaskIdsByRepoIdsUseCase(taskRepository);
  }

  // Processing State
  static updateProcessingState() {
    return new UpdateProcessingStateUseCase(taskRepository, eventPublisher);
  }
}
