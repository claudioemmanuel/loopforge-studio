// ── Enums ─────────────────────────────────────────────────────────────────────

export enum Stage {
  TODO = 'TODO',
  BRAINSTORMING = 'BRAINSTORMING',
  PLANNING = 'PLANNING',
  READY = 'READY',
  EXECUTING = 'EXECUTING',
  CODE_REVIEW = 'CODE_REVIEW',
  DONE = 'DONE',
  STUCK = 'STUCK',
}

export enum Provider {
  ANTHROPIC = 'ANTHROPIC',
  OPENAI = 'OPENAI',
  GOOGLE = 'GOOGLE',
}

export enum PlanStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum LogLevel {
  INFO = 'INFO',
  ACTION = 'ACTION',
  ERROR = 'ERROR',
  COMMIT = 'COMMIT',
}

export enum ChatRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
}

export enum EventType {
  TASK_CREATED = 'TASK_CREATED',
  STAGE_CHANGED = 'STAGE_CHANGED',
  PLAN_APPROVED = 'PLAN_APPROVED',
  PLAN_REJECTED = 'PLAN_REJECTED',
  EXECUTION_STARTED = 'EXECUTION_STARTED',
  EXECUTION_COMPLETED = 'EXECUTION_COMPLETED',
  STUCK_DETECTED = 'STUCK_DETECTED',
  COMMIT_PUSHED = 'COMMIT_PUSHED',
  PR_CREATED = 'PR_CREATED',
  PR_MERGED = 'PR_MERGED',
  PR_MERGE_FAILED = 'PR_MERGE_FAILED',
}

export enum AgentCategory {
  META_ORCHESTRATION = 'META_ORCHESTRATION',
  CORE_DEVELOPMENT = 'CORE_DEVELOPMENT',
  QUALITY_SECURITY = 'QUALITY_SECURITY',
  LANGUAGE_SPECIALIST = 'LANGUAGE_SPECIALIST',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  DATA_AI = 'DATA_AI',
  DEVELOPER_EXPERIENCE = 'DEVELOPER_EXPERIENCE',
  SPECIALIZED_DOMAIN = 'SPECIALIZED_DOMAIN',
  BUSINESS_PRODUCT = 'BUSINESS_PRODUCT',
  RESEARCH_ANALYSIS = 'RESEARCH_ANALYSIS',
}

export enum AgentExecutionStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// ── Entity interfaces ──────────────────────────────────────────────────────────

export interface User {
  id: string
  githubId: string
  username: string
  avatarUrl: string
  createdAt: string
  updatedAt: string
}

export interface Repository {
  id: string
  userId: string
  githubRepoId: string
  owner: string
  name: string
  fullName: string
  defaultBranch: string
  connectedAt: string
}

export interface Task {
  id: string
  userId: string
  repositoryId: string | null
  title: string
  description: string
  stage: Stage
  featureBranch: string | null
  autonomousMode?: boolean
  pullRequestUrl?: string | null
  createdAt: string
  updatedAt: string
  // Badge data (populated on list endpoint)
  chatMessageCount?: number
  repositoryName?: string
  executionPlanStatus?: PlanStatus
}

export interface PlanStep {
  stepNumber: number
  description: string
  estimatedChanges: string
}

export interface ExecutionPlan {
  id: string
  taskId: string
  steps: PlanStep[]
  status: PlanStatus
  rejectionFeedback: string | null
  approvedAt: string | null
  createdAt: string
}

export interface ChatMessage {
  id: string
  taskId: string
  role: ChatRole
  content: string
  provider: string | null
  model: string | null
  tokenCount: number | null
  createdAt: string
}

export interface ProviderConfig {
  id: string
  userId: string
  provider: Provider
  defaultModel: string
  isDefault: boolean
  hasKey: boolean
  createdAt: string
  updatedAt: string
}

export interface ExecutionLog {
  id: string
  taskId: string
  sequence: number
  level: LogLevel
  message: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface Commit {
  id: string
  taskId: string
  repositoryId: string
  sha: string
  branch: string
  message: string
  filesChanged: number
  committedAt: string
}

export interface AnalyticsEvent {
  id: string
  userId: string
  taskId: string
  repositoryId: string | null
  eventType: EventType
  fromStage: Stage | null
  toStage: Stage | null
  provider: string | null
  model: string | null
  tokensUsed: number | null
  metadata: Record<string, unknown> | null
  occurredAt: string
}

// ── Agent System ───────────────────────────────────────────────────────────────

export interface Agent {
  id: string
  name: string
  displayName: string
  description: string
  category: AgentCategory
  version: string
  systemPrompt: string
  capabilities: Record<string, unknown>
  isActive: boolean
  isCore: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectAgentSettings {
  id: string
  repositoryId: string
  agentId: string
  isEnabled: boolean
  customPrompt: string | null
  config: Record<string, unknown> | null
}

export interface AgentExecution {
  id: string
  taskId: string
  agentId: string
  stage: Stage
  status: AgentExecutionStatus
  startedAt: string
  endedAt: string | null
  contextKey: string
  output: Record<string, unknown> | null
  metrics: Record<string, unknown> | null
}

export interface AgentLog {
  id: string
  executionId: string
  level: LogLevel
  message: string
  timestamp: string
  sequenceNum: number
}

// ── WebSocket event payloads ───────────────────────────────────────────────────

export interface TaskCreatedEvent {
  task: Task
}

export interface TaskUpdatedEvent {
  taskId: string
  stage: Stage
  title: string
  updatedAt: string
}

export interface TaskDeletedEvent {
  taskId: string
}

export interface TaskStageChangedEvent {
  taskId: string
  fromStage: Stage
  toStage: Stage
  at: string
}

export interface AgentExecutionStartedEvent {
  taskId: string
  executionId: string
  agentName: string
  agentDisplayName: string
}

export interface AgentExecutionLogEvent {
  executionId: string
  level: LogLevel
  message: string
  timestamp: string
}

export interface AgentExecutionCompletedEvent {
  executionId: string
  metrics: Record<string, unknown> | null
  output: Record<string, unknown> | null
}

export interface AgentExecutionFailedEvent {
  executionId: string
  error: string
}

export interface AgentQualityUpdatedEvent {
  taskId: string
  metrics: QualityMetrics
}

export interface QualityMetrics {
  codeQualityScore: number | null
  testCoverage: number | null
  securityIssues: {
    critical: number
    high: number
    medium: number
    low: number
  }
  performanceScore: number | null
  accessibilityScore: number | null
}

// ── SSE payloads ───────────────────────────────────────────────────────────────

export interface ChatChunkEvent {
  type: 'chunk'
  content: string
}

export interface ChatDoneEvent {
  type: 'done'
  tokenCount: number
}

export interface ChatErrorEvent {
  type: 'error'
  message: string
}

export type ChatSSEEvent = ChatChunkEvent | ChatDoneEvent | ChatErrorEvent

export interface LogEntrySSE {
  sequence: number
  level: LogLevel
  message: string
  createdAt: string
}
