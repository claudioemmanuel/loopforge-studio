/**
 * Execution Service (Application Layer)
 *
 * Orchestrates execution operations and coordinates with infrastructure.
 * Public API for AI Execution bounded context.
 */

import type { Redis } from "ioredis";
import { ExecutionRepository } from "../infrastructure/execution-repository";
import { ExecutionAggregate } from "../domain/execution-aggregate";
import type {
  ExecutionConfiguration,
  ExtractionResult,
  CommitInfo,
  StuckSignal,
  RecoveryAttempt,
  ValidationReport,
} from "../domain/types";
import { randomUUID } from "crypto";

/**
 * Execution service
 */
export class ExecutionService {
  private executionRepository: ExecutionRepository;

  constructor(redis: Redis) {
    this.executionRepository = new ExecutionRepository(redis);
  }

  /**
   * Start a new execution
   */
  async startExecution(params: {
    taskId: string;
    branchName: string;
    configuration?: Partial<ExecutionConfiguration>;
  }): Promise<{ executionId: string }> {
    const executionId = randomUUID();

    // Create execution aggregate
    const execution = await ExecutionAggregate.start(
      {
        id: executionId,
        taskId: params.taskId,
        branchName: params.branchName,
        configuration: params.configuration,
      },
      this.executionRepository["redis"],
    );

    // Persist
    await this.executionRepository.save(execution);

    return { executionId };
  }

  /**
   * Start new iteration
   */
  async startIteration(executionId: string): Promise<void> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    execution.startIteration();
    await this.executionRepository.save(execution);
  }

  /**
   * Record iteration completion
   */
  async completeIteration(params: {
    executionId: string;
    thoughts: string[];
    actions: string[];
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.completeIteration({
      thoughts: params.thoughts,
      actions: params.actions,
    });

    await this.executionRepository.save(execution);
  }

  /**
   * Record file extraction
   */
  async recordExtraction(params: {
    executionId: string;
    result: ExtractionResult;
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.recordExtraction(params.result);
    await this.executionRepository.save(execution);
  }

  /**
   * Record commit
   */
  async recordCommit(params: {
    executionId: string;
    commit: CommitInfo;
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.recordCommit(params.commit);
    await this.executionRepository.save(execution);
  }

  /**
   * Detect stuck signal
   */
  async detectStuckSignal(params: {
    executionId: string;
    signal: StuckSignal;
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.detectStuckSignal(params.signal);
    await this.executionRepository.save(execution);
  }

  /**
   * Start recovery
   */
  async startRecovery(params: {
    executionId: string;
    attempt: RecoveryAttempt;
    reason: string;
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.startRecovery(params.attempt, params.reason);
    await this.executionRepository.save(execution);
  }

  /**
   * Complete recovery
   */
  async completeRecovery(params: {
    executionId: string;
    succeeded: boolean;
    error?: string;
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.completeRecovery(params.succeeded, params.error);
    await this.executionRepository.save(execution);
  }

  /**
   * Validate completion
   */
  async validateCompletion(params: {
    executionId: string;
    report: ValidationReport;
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.validateCompletion(params.report);
    await this.executionRepository.save(execution);
  }

  /**
   * Record skill invocation
   */
  async recordSkill(params: {
    executionId: string;
    skillName: string;
    phase: string;
    result: "passed" | "warning" | "blocked";
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.recordSkill({
      skillName: params.skillName,
      phase: params.phase,
      result: params.result,
    });

    await this.executionRepository.save(execution);
  }

  /**
   * Complete execution
   */
  async completeExecution(executionId: string): Promise<void> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    await execution.complete();
    await this.executionRepository.save(execution);
  }

  /**
   * Fail execution
   */
  async failExecution(params: {
    executionId: string;
    error: string;
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.fail(params.error);
    await this.executionRepository.save(execution);
  }

  /**
   * Get execution
   */
  async getExecution(executionId: string): Promise<{
    id: string;
    taskId: string;
    status: string;
    branchName: string;
    currentIteration: number;
    commitCount: number;
    isComplete: boolean;
  } | null> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      return null;
    }

    const state = execution.getState();
    return {
      id: state.id,
      taskId: state.taskId,
      status: state.status,
      branchName: state.branchName,
      currentIteration: state.currentIteration,
      commitCount: state.commits.length,
      isComplete: execution.isComplete(),
    };
  }
}
