import type { ChatMessage } from "./client";
import type { BrainstormChatResponse, RepoContext } from "./brainstorm-chat";

export interface BrainstormConversation {
  taskId: string;
  messages: ChatMessage[];
  repoContext: RepoContext;
  currentPreview?: BrainstormChatResponse["brainstormPreview"];
  // Context compaction fields (Prompt Engineering Framework 2026-01-29)
  summary?: string;
  messageCount?: number;
  compactedAt?: Date;
}

// In-memory store for active conversations (not persisted)
const activeConversations = new Map<string, BrainstormConversation>();

export function getConversation(
  taskId: string,
): BrainstormConversation | undefined {
  return activeConversations.get(taskId);
}

export function setConversation(
  taskId: string,
  conversation: BrainstormConversation,
): void {
  activeConversations.set(taskId, conversation);
}

export function deleteConversation(taskId: string): void {
  activeConversations.delete(taskId);
}
