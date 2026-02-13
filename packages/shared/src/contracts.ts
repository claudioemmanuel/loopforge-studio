import type { Provider, Stage, PlanStatus } from './types.js'

// ── Task DTOs ──────────────────────────────────────────────────────────────────

export interface CreateTaskRequest {
  title: string
  description: string
  repositoryId?: string
  autonomousMode?: boolean
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  repositoryId?: string | null
  autonomousMode?: boolean
}

export interface TransitionStageRequest {
  stage: Stage
  feedback?: string
}

// ── Chat DTOs ──────────────────────────────────────────────────────────────────

export interface SendChatMessageRequest {
  content: string
  provider?: Provider
  model?: string
}

// ── Plan DTOs ──────────────────────────────────────────────────────────────────

export interface RejectPlanRequest {
  feedback: string
}

// ── Repository DTOs ────────────────────────────────────────────────────────────

export interface ConnectRepositoryRequest {
  githubRepoId: string
}

export interface GithubRepositoryOption {
  githubRepoId: string
  fullName: string
  defaultBranch: string
  alreadyConnected: boolean
}

// ── Provider Config DTOs ───────────────────────────────────────────────────────

export interface SaveProviderConfigRequest {
  apiKey?: string
  defaultModel?: string
  isDefault?: boolean
}

// ── Analytics DTOs ─────────────────────────────────────────────────────────────

export interface RepoActivitySummary {
  repositoryId: string
  fullName: string
  taskCount: number
  tokensUsed: number
}

export interface ProviderUsageSummary {
  provider: string
  model: string
  tokensUsed: number
}

export interface AnalyticsSummaryResponse {
  totalTasks: number
  completedTasks: number
  stuckTasks: number
  successRate: number
  totalTokensUsed: number
  byRepository: RepoActivitySummary[]
  byProvider: ProviderUsageSummary[]
}

// ── Auth DTOs ──────────────────────────────────────────────────────────────────

export interface MeResponse {
  id: string
  username: string
  avatarUrl: string
}

// ── Dashboard DTOs ────────────────────────────────────────────────────────────

export interface RepositoryDashboardTile {
  id: string
  fullName: string
  owner: string
  name: string
  defaultBranch: string
  totalTasks: number
  activeTasks: number
  completedTasks: number
  stuckTasks: number
  stageDistribution: Record<Stage, number>
  health: 'green' | 'yellow' | 'red'
  recentActivity: string | null
  connectedAt: string
}

export interface TaskListItem {
  id: string
  title: string
  description: string
  stage: Stage
  featureBranch: string | null
  repositoryId: string | null
  repositoryName: string | null
  chatMessageCount: number
  executionPlanStatus: PlanStatus | null
  autonomousMode: boolean
  createdAt: string
  updatedAt: string
}

// ── Task Flow DTOs ────────────────────────────────────────────────────────────

export interface StageNodeData {
  stage: Stage
  status: 'completed' | 'active' | 'pending'
  enteredAt: string | null
  completedAt: string | null
  data: Record<string, unknown>
}

export interface StageTransition {
  from: Stage
  to: Stage
  timestamp: string
  direction: 'forward' | 'backward'
}

export interface TaskFlowData {
  task: {
    id: string
    title: string
    description: string
    stage: Stage
    featureBranch: string | null
    repositoryId: string | null
    repositoryName: string | null
    autonomousMode: boolean
    pullRequestUrl: string | null
    createdAt: string
    updatedAt: string
  }
  stages: StageNodeData[]
  transitions: StageTransition[]
  stats: {
    chatMessageCount: number
    executionLogCount: number
    commitCount: number
    planStepCount: number
    executionPlanStatus: PlanStatus | null
    filesChanged: number
    linesAdded: number
    linesRemoved: number
  }
}

// ── Error response ─────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  statusCode: number
  error: string
  message: string
}
