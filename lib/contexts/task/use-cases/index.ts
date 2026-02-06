/**
 * Use Cases Index
 * Exports all use cases for easy importing
 */

// Core CRUD
export { CreateTaskUseCase } from "./create-task/CreateTaskUseCase";
export type {
  CreateTaskInput,
  CreateTaskOutput,
} from "./create-task/CreateTaskUseCase";

export { GetTaskUseCase } from "./get-task/GetTaskUseCase";
export type { GetTaskInput, GetTaskOutput } from "./get-task/GetTaskUseCase";

export { GetTaskWithRepoUseCase } from "./get-task-with-repo/GetTaskWithRepoUseCase";
export type {
  GetTaskWithRepoInput,
  GetTaskWithRepoOutput,
} from "./get-task-with-repo/GetTaskWithRepoUseCase";

export { UpdateTaskFieldsUseCase } from "./update-task-fields/UpdateTaskFieldsUseCase";
export type {
  UpdateTaskFieldsInput,
  UpdateTaskFieldsOutput,
} from "./update-task-fields/UpdateTaskFieldsUseCase";

export { DeleteTaskUseCase } from "./delete-task/DeleteTaskUseCase";
export type {
  DeleteTaskInput,
  DeleteTaskOutput,
} from "./delete-task/DeleteTaskUseCase";

export { ListTasksByRepoUseCase } from "./list-tasks-by-repo/ListTasksByRepoUseCase";
export type {
  ListTasksByRepoInput,
  ListTasksByRepoOutput,
} from "./list-tasks-by-repo/ListTasksByRepoUseCase";

export { ListTasksByUserUseCase } from "./list-tasks-by-user/ListTasksByUserUseCase";
export type {
  ListTasksByUserInput,
  ListTasksByUserOutput,
} from "./list-tasks-by-user/ListTasksByUserUseCase";

// Brainstorming Flow
export { ClaimBrainstormingSlotUseCase } from "./claim-brainstorming-slot/ClaimBrainstormingSlotUseCase";
export type {
  ClaimBrainstormingSlotInput,
  ClaimBrainstormingSlotOutput,
} from "./claim-brainstorming-slot/ClaimBrainstormingSlotUseCase";

export { SaveBrainstormResultUseCase } from "./save-brainstorm-result/SaveBrainstormResultUseCase";
export type {
  SaveBrainstormResultInput,
  SaveBrainstormResultOutput,
} from "./save-brainstorm-result/SaveBrainstormResultUseCase";

export { FinalizeBrainstormUseCase } from "./finalize-brainstorm/FinalizeBrainstormUseCase";
export type {
  FinalizeBrainstormInput,
  FinalizeBrainstormOutput,
} from "./finalize-brainstorm/FinalizeBrainstormUseCase";

export { ClearProcessingSlotUseCase } from "./clear-processing-slot/ClearProcessingSlotUseCase";
export type {
  ClearProcessingSlotInput,
  ClearProcessingSlotOutput,
} from "./clear-processing-slot/ClearProcessingSlotUseCase";

// Planning Flow
export { ClaimPlanningSlotUseCase } from "./claim-planning-slot/ClaimPlanningSlotUseCase";
export type {
  ClaimPlanningSlotInput,
  ClaimPlanningSlotOutput,
} from "./claim-planning-slot/ClaimPlanningSlotUseCase";

export { SavePlanUseCase } from "./save-plan/SavePlanUseCase";
export type {
  SavePlanInput,
  SavePlanOutput,
} from "./save-plan/SavePlanUseCase";

export { FinalizePlanningUseCase } from "./finalize-planning/FinalizePlanningUseCase";
export type {
  FinalizePlanningInput,
  FinalizePlanningOutput,
} from "./finalize-planning/FinalizePlanningUseCase";

// Execution Flow
export { ClaimExecutionSlotUseCase } from "./claim-execution-slot/ClaimExecutionSlotUseCase";
export type {
  ClaimExecutionSlotInput,
  ClaimExecutionSlotOutput,
} from "./claim-execution-slot/ClaimExecutionSlotUseCase";

export { RevertExecutionSlotUseCase } from "./revert-execution-slot/RevertExecutionSlotUseCase";
export type {
  RevertExecutionSlotInput,
  RevertExecutionSlotOutput,
} from "./revert-execution-slot/RevertExecutionSlotUseCase";

export { MarkTaskRunningUseCase } from "./mark-task-running/MarkTaskRunningUseCase";
export type {
  MarkTaskRunningInput,
  MarkTaskRunningOutput,
} from "./mark-task-running/MarkTaskRunningUseCase";

export { MarkTaskCompletedUseCase } from "./mark-task-completed/MarkTaskCompletedUseCase";
export type {
  MarkTaskCompletedInput,
  MarkTaskCompletedOutput,
} from "./mark-task-completed/MarkTaskCompletedUseCase";

export { MarkTaskFailedUseCase } from "./mark-task-failed/MarkTaskFailedUseCase";
export type {
  MarkTaskFailedInput,
  MarkTaskFailedOutput,
} from "./mark-task-failed/MarkTaskFailedUseCase";

export { MarkTaskStuckUseCase } from "./mark-task-stuck/MarkTaskStuckUseCase";
export type {
  MarkTaskStuckInput,
  MarkTaskStuckOutput,
} from "./mark-task-stuck/MarkTaskStuckUseCase";

// Dependencies
export { AddTaskDependencyUseCase } from "./add-task-dependency/AddTaskDependencyUseCase";
export type {
  AddTaskDependencyInput,
  AddTaskDependencyOutput,
} from "./add-task-dependency/AddTaskDependencyUseCase";

export { RemoveTaskDependencyUseCase } from "./remove-task-dependency/RemoveTaskDependencyUseCase";
export type {
  RemoveTaskDependencyInput,
  RemoveTaskDependencyOutput,
} from "./remove-task-dependency/RemoveTaskDependencyUseCase";

export { UpdateDependencySettingsUseCase } from "./update-dependency-settings/UpdateDependencySettingsUseCase";
export type {
  UpdateDependencySettingsInput,
  UpdateDependencySettingsOutput,
} from "./update-dependency-settings/UpdateDependencySettingsUseCase";

export { GetTaskDependencyGraphUseCase } from "./get-task-dependency-graph/GetTaskDependencyGraphUseCase";
export type {
  GetTaskDependencyGraphInput,
  GetTaskDependencyGraphOutput,
} from "./get-task-dependency-graph/GetTaskDependencyGraphUseCase";

// Configuration
export { EnableAutonomousModeUseCase } from "./enable-autonomous-mode/EnableAutonomousModeUseCase";
export type {
  EnableAutonomousModeInput,
  EnableAutonomousModeOutput,
} from "./enable-autonomous-mode/EnableAutonomousModeUseCase";

export { UpdateTaskPriorityUseCase } from "./update-task-priority/UpdateTaskPriorityUseCase";
export type {
  UpdateTaskPriorityInput,
  UpdateTaskPriorityOutput,
} from "./update-task-priority/UpdateTaskPriorityUseCase";

export { UpdateTaskConfigurationUseCase } from "./update-task-configuration/UpdateTaskConfigurationUseCase";
export type {
  UpdateTaskConfigurationInput,
  UpdateTaskConfigurationOutput,
} from "./update-task-configuration/UpdateTaskConfigurationUseCase";

// Validation
export { VerifyTaskOwnershipUseCase } from "./verify-task-ownership/VerifyTaskOwnershipUseCase";
export type {
  VerifyTaskOwnershipInput,
  VerifyTaskOwnershipOutput,
} from "./verify-task-ownership/VerifyTaskOwnershipUseCase";

export { CheckTaskTransitionValidUseCase } from "./check-task-transition-valid/CheckTaskTransitionValidUseCase";
export type {
  CheckTaskTransitionValidInput,
  CheckTaskTransitionValidOutput,
} from "./check-task-transition-valid/CheckTaskTransitionValidUseCase";

// Bulk Operations
export { DeleteTasksByRepoIdsUseCase } from "./delete-tasks-by-repo-ids/DeleteTasksByRepoIdsUseCase";
export type {
  DeleteTasksByRepoIdsInput,
  DeleteTasksByRepoIdsOutput,
} from "./delete-tasks-by-repo-ids/DeleteTasksByRepoIdsUseCase";

export { GetTaskIdsByRepoIdsUseCase } from "./get-task-ids-by-repo-ids/GetTaskIdsByRepoIdsUseCase";
export type {
  GetTaskIdsByRepoIdsInput,
  GetTaskIdsByRepoIdsOutput,
} from "./get-task-ids-by-repo-ids/GetTaskIdsByRepoIdsUseCase";
