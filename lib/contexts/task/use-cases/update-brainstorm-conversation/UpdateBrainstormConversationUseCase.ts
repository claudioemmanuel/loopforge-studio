/**
 * UpdateBrainstormConversation Use Case
 * Saves intermediate brainstorm conversation state during chat
 *
 * Note: Brainstorm conversation is ephemeral UI state that doesn't affect
 * task invariants, so we update it directly via raw persistence layer rather
 * than through the aggregate.
 */

import type { TaskPersistenceAdapter } from "../../infrastructure/task-persistence-adapter";
import { Result } from "@/lib/shared/Result";
import { UseCaseError } from "@/lib/shared/errors";

export interface UpdateBrainstormConversationInput {
  taskId: string;
  conversation: string; // JSON string of conversation messages
  result?: string; // JSON string of current brainstorm preview
  summary?: string;
  messageCount?: number;
  compactedAt?: Date;
}

export interface UpdateBrainstormConversationOutput {
  success: boolean;
}

export class UpdateBrainstormConversationUseCase {
  constructor(private readonly persistence: TaskPersistenceAdapter) {}

  async execute(
    input: UpdateBrainstormConversationInput,
  ): Promise<Result<UpdateBrainstormConversationOutput, UseCaseError>> {
    try {
      // Update ephemeral brainstorm conversation state
      const fields: Record<string, unknown> = {
        brainstormConversation: input.conversation,
      };

      if (input.result !== undefined) {
        fields.brainstormResult = input.result;
      }
      if (input.summary !== undefined) {
        fields.brainstormSummary = input.summary;
      }
      if (input.messageCount !== undefined) {
        fields.brainstormMessageCount = input.messageCount;
      }
      if (input.compactedAt !== undefined) {
        fields.brainstormCompactedAt = input.compactedAt;
      }

      await this.persistence.updateFields(input.taskId, fields);

      return Result.ok({ success: true });
    } catch (error) {
      return Result.fail(
        new UseCaseError(
          "Failed to update brainstorm conversation",
          error as Error,
        ),
      );
    }
  }
}
