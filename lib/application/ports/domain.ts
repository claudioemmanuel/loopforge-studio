export type AiProvider = "anthropic" | "openai" | "gemini";

export type TaskStatus =
  | "todo"
  | "brainstorming"
  | "planning"
  | "ready"
  | "executing"
  | "review"
  | "done"
  | "stuck";

export interface UserAccount {
  id: string;
  encryptedGithubToken?: string | null;
  githubTokenIv?: string | null;
  preferredProvider?: AiProvider | null;
  encryptedApiKey?: string | null;
  apiKeyIv?: string | null;
  openaiEncryptedApiKey?: string | null;
  openaiApiKeyIv?: string | null;
  geminiEncryptedApiKey?: string | null;
  geminiApiKeyIv?: string | null;
  preferredAnthropicModel?: string | null;
  preferredOpenaiModel?: string | null;
  preferredGeminiModel?: string | null;
}

export interface RepoSummary {
  id: string;
  name: string;
  fullName: string;
  defaultBranch: string | null;
  cloneUrl: string;
  prDraftDefault?: boolean | null;
  prLabels?: unknown;
  prReviewers?: unknown;
}

export interface TaskSummary {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  branch: string | null;
  repo: RepoSummary;
}

export interface ExecutionSummary {
  id: string;
  taskId: string;
  status: string;
  iteration: number;
}
